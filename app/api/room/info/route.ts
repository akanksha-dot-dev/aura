import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getLocalIpAddresses(): string[] {
  const ips: string[] = [];
  try {
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
    // ── Google / Firebase health checks ──────────────────────────────────────
    const firebaseClientKey = !!(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('AIza...')
    );
    const firebaseAdminKey = !!(
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      !process.env.FIREBASE_CLIENT_EMAIL.includes('your-project')
    );
    const firebaseRtdbUrl = !!(
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL &&
      !process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL.includes('your-project')
    );
    const geminiKey = !!(
      process.env.GEMINI_API_KEY &&
      !process.env.GEMINI_API_KEY.includes('AIza...')
    );
    const proxySecret = !!process.env.AURA_PROXY_SECRET;
    const proxyUrl = !!process.env.PROXY_URL;
    const mcpUrl = !!process.env.MCP_URL;
    const slackConfigured = !!process.env.SLACK_WEBHOOK_URL;

    // Voice is ready when Firebase RTDB + Gemini are configured (WebRTC + Gemini Live)
    const voiceReady = firebaseClientKey && firebaseAdminKey && firebaseRtdbUrl && geminiKey;

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
          'Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_DATABASE_URL in .env.local for real-time signaling.',
          'Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (Firebase Admin SDK) for server-side token minting.',
          'Set GEMINI_API_KEY (from AI Studio) to enable the AURA Gemini Live voice agent.',
        ];

    return NextResponse.json({
      health: {
        firebase: {
          clientKey: firebaseClientKey,
          adminKey: firebaseAdminKey,
          rtdbUrl: firebaseRtdbUrl,
        },
        gemini: {
          key: geminiKey,
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
