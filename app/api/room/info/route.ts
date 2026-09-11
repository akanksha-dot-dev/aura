import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function getLocalIpAddresses(): string[] {
  const ips: string[] = [];
  try {
    // Dynamically query interfaces if available, fallback safely on Edge/Cloudflare
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeOs = typeof require !== 'undefined' ? require('os') : null;
    const interfaces = nodeOs?.networkInterfaces?.();
    if (interfaces) {
      for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name];
        if (!ifaceList) continue;
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }
    }
  } catch {
    // Fallback
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

export async function GET(request: NextRequest) {
  try {
    const agoraAppId = !!process.env.AGORA_APP_ID;
    const agoraCert = !!process.env.AGORA_APP_CERTIFICATE;
    const agoraRest = !!(
      (process.env.AGORA_CUSTOMER_KEY && process.env.AGORA_CUSTOMER_SECRET) ||
      (process.env.AGORA_REST_KEY && process.env.AGORA_REST_SECRET)
    );
    const openAiKey = !!process.env.OPENAI_API_KEY;
    const proxySecret = !!process.env.AURA_PROXY_SECRET;
    const proxyUrl = !!process.env.PROXY_URL;
    const mcpUrl = !!process.env.MCP_URL;
    const slackConfigured = !!process.env.SLACK_WEBHOOK_URL;

    const voiceReady = agoraAppId && agoraCert;

    const hostHeader = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const origin = `${protocol}://${hostHeader}`;

    const localIps = getLocalIpAddresses();
    const primaryLanIp = localIps[0] || '127.0.0.1';
    const port = hostHeader.includes(':') ? hostHeader.split(':')[1] : '3000';
    const lanOrigin = `http://${primaryLanIp}:${port}`;

    const publicOrigin =
      process.env.PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (hostHeader.includes('trycloudflare.com') ? origin : null);

    const baseJoinUrl = publicOrigin || lanOrigin;
    const channel = 'incident-war-room';

    const personaLinks = [
      {
        uid: 'alex_ic',
        name: 'Alex',
        role: 'Incident Commander',
        emoji: '🎖️',
        color: '#6C5CE7',
        description: 'Leads the war room, coordinates responders and makes final calls',
        url: `${baseJoinUrl}/lobby?channel=${channel}&prefill_uid=alex_ic`,
        directUrl: `${baseJoinUrl}/?channel=${channel}&uid=alex_ic&name=Alex&role=Incident%20Commander`,
      },
      {
        uid: 'marcus_sre',
        name: 'Marcus',
        role: 'DevOps / SRE',
        emoji: '🔧',
        color: '#00B4D8',
        description: 'Infrastructure, Kubernetes clusters, database replication',
        url: `${baseJoinUrl}/lobby?channel=${channel}&prefill_uid=marcus_sre`,
        directUrl: `${baseJoinUrl}/?channel=${channel}&uid=marcus_sre&name=Marcus&role=DevOps%20%2F%20SRE`,
      },
      {
        uid: 'sarah_net',
        name: 'Sarah',
        role: 'Network Lead',
        emoji: '🌐',
        color: '#4ECDC4',
        description: 'Traffic ingress, DNS resolution, CDN caching, load balancers',
        url: `${baseJoinUrl}/lobby?channel=${channel}&prefill_uid=sarah_net`,
        directUrl: `${baseJoinUrl}/?channel=${channel}&uid=sarah_net&name=Sarah&role=Network%20Lead`,
      },
      {
        uid: 'priya_sec',
        name: 'Priya',
        role: 'Security Specialist',
        emoji: '🛡️',
        color: '#FF6B6B',
        description: 'Access tokens, authentication logs, vulnerability surface',
        url: `${baseJoinUrl}/lobby?channel=${channel}&prefill_uid=priya_sec`,
        directUrl: `${baseJoinUrl}/?channel=${channel}&uid=priya_sec&name=Priya&role=Security%20Specialist`,
      },
    ];

    const instructions = voiceReady
      ? null
      : [
          'Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env.local to enable live voice.',
          'Set AGORA_CUSTOMER_KEY and AGORA_CUSTOMER_SECRET to enable server-side agent hot-updates.',
        ];

    return NextResponse.json({
      health: {
        agora: {
          appId: agoraAppId,
          certificate: agoraCert,
          restApi: agoraRest,
        },
        openAi: {
          key: openAiKey,
        },
        proxy: {
          secret: proxySecret,
          url: proxyUrl,
          mcpUrl: mcpUrl,
        },
        slack: {
          configured: slackConfigured,
        },
      },
      voiceReady,
      network: {
        localIps,
        primaryLanIp,
        lanOrigin,
        publicOrigin,
        isPublic: !!publicOrigin,
      },
      channel,
      lobbyUrl: `${baseJoinUrl}/lobby?channel=${channel}`,
      personaLinks,
      setupInstructions: instructions,
    });
  } catch (error) {
    console.error('[/api/room/info] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve room info' }, { status: 500 });
  }
}
