import { NextRequest, NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

/**
 * GET /api/room/info
 * Returns everything needed for the War Room Invite modal:
 * - Credential health (Agora, OpenAI, proxy secret)
 * - Local network IP for LAN sharing
 * - Current public origin (works behind tunnels)
 * - Per-persona shareable invite links
 */
export async function GET(request: NextRequest) {
  // ─── Credential Health Check ───────────────────────────────────────────────
  const agoraAppId = process.env.AGORA_APP_ID || '';
  const agoraCert = process.env.AGORA_APP_CERTIFICATE || '';
  const agoraCustKey = process.env.AGORA_CUSTOMER_KEY || '';
  const agoraCustSecret = process.env.AGORA_CUSTOMER_SECRET || '';
  const openAiKey = process.env.OPENAI_API_KEY || '';
  const proxySecret = process.env.INTERNAL_PROXY_SECRET || '';
  const slackWebhook = process.env.SLACK_WEBHOOK_URL || '';
  const proxyUrl = process.env.PROXY_URL || '';
  const mcpUrl = process.env.MCP_URL || '';

  const isPlaceholder = (v: string, ...bad: string[]) =>
    !v || bad.some((b) => v.includes(b));

  const health = {
    agora: {
      appId: !isPlaceholder(agoraAppId, 'your_agora', 'placeholder'),
      certificate: !isPlaceholder(agoraCert, 'your_agora', 'placeholder'),
      restApi:
        !isPlaceholder(agoraCustKey, 'your_agora', 'placeholder') &&
        !isPlaceholder(agoraCustSecret, 'your_agora', 'placeholder'),
    },
    openAi: {
      key:
        openAiKey.startsWith('sk-') &&
        !isPlaceholder(openAiKey, 'your_openai', 'placeholder'),
    },
    proxy: {
      secret: !isPlaceholder(proxySecret, 'replace_with', 'placeholder'),
      url: !isPlaceholder(proxyUrl, 'localhost', 'placeholder', 'akanksha.dev'),
      mcpUrl: !isPlaceholder(mcpUrl, 'localhost', 'placeholder', 'akanksha.dev'),
    },
    slack: {
      configured: !isPlaceholder(slackWebhook, 'placeholder', 'example.com'),
    },
  };

  const voiceReady =
    health.agora.appId &&
    health.agora.certificate &&
    health.agora.restApi &&
    health.openAi.key &&
    health.proxy.secret &&
    health.proxy.url;

  // ─── Network Discovery ─────────────────────────────────────────────────────
  const networkInterfaces = os.networkInterfaces();
  const localIps: string[] = [];
  for (const iface of Object.values(networkInterfaces)) {
    for (const addr of iface || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        localIps.push(addr.address);
      }
    }
  }
  const primaryLanIp = localIps[0] || '127.0.0.1';

  // ─── Public origin detection ───────────────────────────────────────────────
  const host = request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const publicOrigin = isLocalhost ? null : `${proto}://${host}`;
  const lanOrigin = `http://${primaryLanIp}:3000`;

  // ─── Persona Invite Links ──────────────────────────────────────────────────
  const channel = 'incident-war-room';
  const baseUrl = publicOrigin || lanOrigin;

  const personas = [
    {
      uid: 'alex_ic',
      name: 'Alex',
      role: 'Incident Commander',
      emoji: '🎖️',
      color: '#6C5CE7',
      description: 'Leads the war room, makes final decisions',
    },
    {
      uid: 'marcus_sre',
      name: 'Marcus',
      role: 'DevOps / SRE',
      emoji: '🛠️',
      color: '#00B4D8',
      description: 'Infrastructure, K8s, database diagnostics',
    },
    {
      uid: 'sarah_oncall',
      name: 'Sarah',
      role: 'On-Call Engineer',
      emoji: '👩‍💻',
      color: '#4ECDC4',
      description: 'Service-level debugging and telemetry',
    },
    {
      uid: 'priya_pm',
      name: 'Priya',
      role: 'Product Manager',
      emoji: '📊',
      color: '#FFD93D',
      description: 'Business impact assessment and comms',
    },
    {
      uid: 'raj_backend',
      name: 'Raj',
      role: 'Backend Engineer',
      emoji: '⚙️',
      color: '#FF6B6B',
      description: 'Application code, API debugging',
    },
    {
      uid: 'nina_qa',
      name: 'Nina',
      role: 'QA Lead',
      emoji: '🔍',
      color: '#A29BFE',
      description: 'Reproduction steps and test validation',
    },
  ];

  const personaLinks = personas.map((p) => ({
    ...p,
    url: `${baseUrl}/lobby?prefill_uid=${p.uid}&prefill_name=${encodeURIComponent(p.name)}&prefill_role=${encodeURIComponent(p.role)}&channel=${channel}`,
    directUrl: `${baseUrl}/?uid=${p.uid}&name=${encodeURIComponent(p.name)}&role=${encodeURIComponent(p.role)}&channel=${channel}`,
  }));

  return NextResponse.json({
    health,
    voiceReady,
    network: {
      localIps,
      primaryLanIp,
      lanOrigin,
      publicOrigin,
      isPublic: !isLocalhost,
    },
    channel,
    lobbyUrl: `${baseUrl}/lobby`,
    personaLinks,
    setupInstructions: voiceReady
      ? null
      : buildSetupInstructions(health, proxyUrl, mcpUrl),
  });
}

function buildSetupInstructions(
  health: Record<string, Record<string, boolean>>,
  proxyUrl: string,
  mcpUrl: string
) {
  const steps: string[] = [];

  if (!health.agora.appId || !health.agora.certificate || !health.agora.restApi) {
    steps.push(
      '1. Get Agora credentials at https://console.agora.io → Create Project → Copy App ID, Certificate, and REST API keys → Set in .env.local'
    );
  }
  if (!health.openAi.key) {
    steps.push(
      '2. Get OpenAI API key at https://platform.openai.com/api-keys → Set OPENAI_API_KEY in .env.local'
    );
  }
  if (!health.proxy.url) {
    steps.push(
      '3. Create a public tunnel: run  npm run tunnel  in a second terminal → Copy the https:// URL → Set PROXY_URL and MCP_URL in .env.local → Restart the server'
    );
  }
  return steps;
}
