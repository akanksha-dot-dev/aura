import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * Lightweight JWT-like invite token system for AURA War Room.
 *
 * Generates short-lived invite tokens (24h TTL) that encode:
 * - Channel name
 * - Inviter UID
 * - Incident title & severity
 * - Optional access code
 * - Expiry timestamp
 *
 * Tokens are HMAC-signed with INTERNAL_PROXY_SECRET.
 */

interface InvitePayload {
  /** Channel to join */
  ch: string;
  /** Incident title */
  t: string;
  /** Severity (SEV-0 to SEV-3) */
  s: string;
  /** Affected services (comma-separated) */
  svc: string;
  /** Inviter UID */
  inv: string;
  /** Inviter display name */
  invName: string;
  /** Access code (if access-controlled) */
  ac?: string;
  /** Issued at (unix seconds) */
  iat: number;
  /** Expires at (unix seconds) */
  exp: number;
}

// In-memory invite tracking (for analytics; in production, use DB)
const inviteLog: Array<{
  token: string;
  channel: string;
  inviter: string;
  createdAt: number;
  joinCount: number;
}> = [];

function getSecret(): string {
  return process.env.INTERNAL_PROXY_SECRET || 'aura_default_invite_secret';
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function signPayload(payload: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createInviteToken(payload: InvitePayload): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifyInviteToken(token: string): InvitePayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedSig = signPayload(encoded);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as InvitePayload;

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * POST /api/room/invite — Generate a new invite token
 *
 * Body: { channel, title, severity, affectedServices, inviterUid, inviterName, accessCode?, ttlHours? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      channel,
      title,
      severity,
      affectedServices,
      inviterUid,
      inviterName,
      accessCode,
      ttlHours = 24,
    } = body;

    if (!channel || !title || !inviterUid) {
      return NextResponse.json(
        { error: 'Missing required fields: channel, title, inviterUid' },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const payload: InvitePayload = {
      ch: channel,
      t: title,
      s: severity || 'SEV-1',
      svc: Array.isArray(affectedServices) ? affectedServices.join(',') : (affectedServices || ''),
      inv: inviterUid,
      invName: inviterName || inviterUid,
      iat: now,
      exp: now + (ttlHours * 3600),
    };

    if (accessCode) {
      payload.ac = crypto.createHash('sha256').update(accessCode).digest('hex').slice(0, 16);
    }

    const token = createInviteToken(payload);

    // Determine base URL
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = host.includes('localhost') || host.includes('127.0.0.1')
      ? `http://${host}`
      : `${proto}://${host}`;

    const joinUrl = `${baseUrl}/lobby?invite=${encodeURIComponent(token)}`;
    const warRoomUrl = `${baseUrl}/war-room/${encodeURIComponent(channel)}?invite=${encodeURIComponent(token)}`;

    // Track invite for analytics
    inviteLog.push({
      token: token.slice(0, 16) + '...',
      channel,
      inviter: inviterUid,
      createdAt: Date.now(),
      joinCount: 0,
    });

    // Generate rich invite message for clipboard/Slack/Teams
    const richMessage = formatRichInvite({
      title,
      severity: severity || 'SEV-1',
      affectedServices: Array.isArray(affectedServices) ? affectedServices : [],
      inviterName: inviterName || inviterUid,
      joinUrl,
      channel,
    });

    return NextResponse.json({
      token,
      joinUrl,
      warRoomUrl,
      richMessage,
      expiresAt: new Date((now + ttlHours * 3600) * 1000).toISOString(),
      hasAccessCode: !!accessCode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invite' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/room/invite?token=... — Validate an invite token
 *
 * Returns incident metadata if valid, 401 if expired/invalid.
 * Optionally validates access code via &code=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const accessCode = searchParams.get('code');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing invite token' },
      { status: 400 }
    );
  }

  const payload = verifyInviteToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired invite token', expired: true },
      { status: 401 }
    );
  }

  // Check access code if one was set
  if (payload.ac) {
    if (!accessCode) {
      return NextResponse.json(
        { error: 'Access code required', requiresCode: true, channel: payload.ch, title: payload.t },
        { status: 403 }
      );
    }
    const codeHash = crypto.createHash('sha256').update(accessCode).digest('hex').slice(0, 16);
    if (codeHash !== payload.ac) {
      return NextResponse.json(
        { error: 'Invalid access code', requiresCode: true },
        { status: 403 }
      );
    }
  }

  // Increment join count in tracking
  const tracked = inviteLog.find(
    (i) => i.channel === payload.ch && i.inviter === payload.inv
  );
  if (tracked) {
    tracked.joinCount++;
  }

  return NextResponse.json({
    valid: true,
    channel: payload.ch,
    title: payload.t,
    severity: payload.s,
    affectedServices: payload.svc ? payload.svc.split(',') : [],
    inviter: { uid: payload.inv, name: payload.invName },
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  });
}

/**
 * Formats a rich invite message suitable for Slack, MS Teams, email, or clipboard.
 */
function formatRichInvite(info: {
  title: string;
  severity: string;
  affectedServices: string[];
  inviterName: string;
  joinUrl: string;
  channel: string;
}): {
  plainText: string;
  slackMarkdown: string;
  htmlEmail: string;
} {
  const svcList = info.affectedServices.length > 0
    ? info.affectedServices.join(', ')
    : 'multiple services';

  const plainText = [
    `🚨 ${info.severity} INCIDENT — ${info.title}`,
    `Affected: ${svcList}`,
    `Invited by: ${info.inviterName}`,
    ``,
    `Join the AURA War Room:`,
    info.joinUrl,
    ``,
    `Channel: #${info.channel}`,
    `AURA AI Incident Commander is active and assisting.`,
  ].join('\n');

  const slackMarkdown = [
    `🚨 *${info.severity} INCIDENT* — ${info.title}`,
    `> *Affected Services:* ${svcList}`,
    `> *Invited by:* ${info.inviterName}`,
    ``,
    `<${info.joinUrl}|⚡ Join AURA War Room>`,
    ``,
    `_🤖 AURA AI Incident Commander is active and assisting._`,
  ].join('\n');

  const htmlEmail = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: #1a1a2e; border-radius: 12px; padding: 24px; color: #e4e4e7;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <span style="font-size: 24px;">🛡️</span>
          <span style="font-size: 18px; font-weight: 700; color: #F59E0B;">AURA</span>
          <span style="font-size: 12px; color: #71717a;">AI Incident Commander</span>
        </div>
        <div style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 700; color: #F97316; margin-bottom: 4px;">${info.severity}</div>
          <div style="font-size: 16px; font-weight: 600; color: #fafafa;">${info.title}</div>
        </div>
        <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 8px;">
          <strong>Affected:</strong> ${svcList}
        </p>
        <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 16px;">
          <strong>Invited by:</strong> ${info.inviterName}
        </p>
        <a href="${info.joinUrl}" style="display: block; text-align: center; background: linear-gradient(135deg, #F59E0B, #D97706); color: #000; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          ⚡ Join the War Room
        </a>
        <p style="font-size: 11px; color: #52525b; text-align: center; margin: 12px 0 0;">
          🤖 AURA AI Incident Commander is active and assisting.
        </p>
      </div>
    </div>
  `.trim();

  return { plainText, slackMarkdown, htmlEmail };
}
