import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface TokenRequest {
  channelName?: string;
  uid?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: TokenRequest;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 }); }
    const { channelName, uid } = body;
    if (!channelName || typeof channelName !== 'string') return NextResponse.json({ error: 'Missing or invalid channelName' }, { status: 400 });
    if (!uid || typeof uid !== 'string') return NextResponse.json({ error: 'Missing or invalid uid' }, { status: 400 });

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || projectId.includes('your-project') || !clientEmail || !privateKey || privateKey.includes('your_private_key')) {
      console.info('[/api/token] Firebase Admin not configured. Returning dev-mode token.');
      return NextResponse.json({ token: `dev-token-${uid}-${Date.now()}`, rtcToken: `dev-rtc-${uid}`, rtmToken: `dev-rtm-${uid}`, uid, channelName, appId: 'dev', mode: 'dev' });
    }

    const { adminAuth } = await import('@/lib/firebaseAdmin');
    // Single Firebase custom token works for all Google services (RTDB, Firestore, Auth)
    // Replaces: Agora UniversalRtcTokenBuilder.buildTokenWithRtm()
    const customToken = await adminAuth.createCustomToken(uid, { channelName, role: 'participant' });

    return NextResponse.json({ token: customToken, rtcToken: customToken, rtmToken: customToken, uid, channelName });
  } catch (error) {
    console.error('[/api/token] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate token' }, { status: 500 });
  }
}
