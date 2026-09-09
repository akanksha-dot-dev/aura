import { NextRequest, NextResponse } from 'next/server';

/**
 * Invite Link API — JWT-based sharable war room invite links for AURA.
 *
 * POST /api/invite — Generate a signed invite link
 *   Body: { channelName, role, expiry?, persona?, incidentTitle?, severity? }
 *   Returns: { inviteUrl, token, expiresAt, role }
 *
 * GET /api/invite?token=xxx — Validate a token and return join metadata
 *   Returns: { valid, channelName, role, persona, incidentTitle, severity, expiresAt }
 *
 * Token structure: Base64-encoded JSON payload with HMAC-SHA256 signature.
 * Uses INVITE_SECRET env var (falls back to AGORA_APP_ID for dev convenience).
 */

// ── Types ────────────────────────────────────────────────────────────────────

type InviteRole = 'observer' | 'participant' | 'commander';

interface InvitePayload {
  /** Channel name to join */
  ch: string;
  /** Role: observer (read-only), participant (voice), commander (full control) */
  rl: InviteRole;
  /** Persona UID (optional, for pre-assigned roles) */
  ps?: string;
  /** Incident title */
  ti?: string;
  /** Severity level */
  sv?: string;
  /** Issued at (epoch seconds) */
  iat: number;
  /** Expires at (epoch seconds) */
  exp: number;
  /** Random nonce for uniqueness */
  nc: string;
}

// ── Crypto helpers (Web Crypto API — works in Edge runtime) ──────────────────

function getSecret(): string {
  return process.env.INVITE_SECRET || process.env.AGORA_APP_ID || 'aura-dev-secret';
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  // Constant-time comparison (best effort in JS)
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

function generateNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Token encoding/decoding ──────────────────────────────────────────────────

async function createToken(payload: InvitePayload): Promise<string> {
  const payloadStr = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const signature = await hmacSign(payloadStr, getSecret());
  return `${payloadStr}.${signature}`;
}

async function validateToken(token: string): Promise<{ valid: boolean; payload?: InvitePayload; error?: string }> {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, error: 'Invalid token format' };

  const [payloadStr, signature] = parts;
  const isValid = await hmacVerify(payloadStr, signature, getSecret());
  if (!isValid) return { valid: false, error: 'Invalid signature' };

  try {
    // Restore base64 padding
    const padded = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
    const payload: InvitePayload = JSON.parse(atob(padded));

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Malformed payload' };
  }
}

// ── Role descriptions ────────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<InviteRole, {
  label: string;
  description: string;
  permissions: string[];
}> = {
  observer: {
    label: 'Observer',
    description: 'Read-only access to the war room. Can view transcript, evidence, and timeline but cannot speak or take actions.',
    permissions: ['view_transcript', 'view_evidence', 'view_timeline'],
  },
  participant: {
    label: 'Participant',
    description: 'Full voice access. Can speak, add evidence, and collaborate in the war room.',
    permissions: ['view_transcript', 'view_evidence', 'view_timeline', 'speak', 'add_evidence', 'add_action_items'],
  },
  commander: {
    label: 'Incident Commander',
    description: 'Full control. Can change severity, assign actions, resolve the incident, and manage participants.',
    permissions: ['view_transcript', 'view_evidence', 'view_timeline', 'speak', 'add_evidence', 'add_action_items', 'change_severity', 'assign_actions', 'resolve_incident', 'manage_participants'],
  },
};

// ── POST: Generate invite link ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      channelName,
      role = 'participant',
      expiryHours = 4,
      persona,
      incidentTitle,
      severity,
    } = body;

    if (!channelName) {
      return NextResponse.json(
        { error: 'channelName is required' },
        { status: 400 },
      );
    }

    // Validate role
    if (!['observer', 'participant', 'commander'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be one of: observer, participant, commander' },
        { status: 400 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.floor(expiryHours * 3600);

    const payload: InvitePayload = {
      ch: channelName,
      rl: role as InviteRole,
      iat: now,
      exp: expiresAt,
      nc: generateNonce(),
    };

    if (persona) payload.ps = persona;
    if (incidentTitle) payload.ti = incidentTitle;
    if (severity) payload.sv = severity;

    const token = await createToken(payload);

    // Build the invite URL
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const inviteUrl = `${protocol}://${host}/join/${token}`;

    return NextResponse.json({
      inviteUrl,
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      role,
      roleInfo: ROLE_DESCRIPTIONS[role as InviteRole],
      channelName,
    });
  } catch (err) {
    console.error('[API /invite POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate invite' },
      { status: 500 },
    );
  }
}

// ── GET: Validate invite token ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'token query parameter is required' },
      { status: 400 },
    );
  }

  const result = await validateToken(token);

  if (!result.valid || !result.payload) {
    return NextResponse.json(
      {
        valid: false,
        error: result.error || 'Invalid token',
      },
      { status: 401 },
    );
  }

  const p = result.payload;
  return NextResponse.json({
    valid: true,
    channelName: p.ch,
    role: p.rl,
    roleInfo: ROLE_DESCRIPTIONS[p.rl],
    persona: p.ps || null,
    incidentTitle: p.ti || null,
    severity: p.sv || null,
    issuedAt: new Date(p.iat * 1000).toISOString(),
    expiresAt: new Date(p.exp * 1000).toISOString(),
    remainingMinutes: Math.max(0, Math.floor((p.exp - Date.now() / 1000) / 60)),
  });
}
