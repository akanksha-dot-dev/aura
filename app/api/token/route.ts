import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtmTokenBuilder, RtcRole } from 'agora-token';

export const runtime = 'edge';

interface TokenRequest {
  channelName?: string;
  uid?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: TokenRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { channelName, uid } = body;

    if (!channelName || typeof channelName !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid channelName' },
        { status: 400 }
      );
    }

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid uid' },
        { status: 400 }
      );
    }

    const rawAppId = process.env.AGORA_APP_ID?.trim() || '';
    const rawCert = process.env.AGORA_APP_CERTIFICATE?.trim() || '';

    const isPlaceholderOrInvalid = (val: string) =>
      !val ||
      val.includes('your_') ||
      val.includes('placeholder') ||
      !/^[0-9a-fA-F]{32}$/.test(val);

    if (isPlaceholderOrInvalid(rawAppId) || isPlaceholderOrInvalid(rawCert)) {
      return NextResponse.json(
        {
          error:
            'Agora server credentials not configured (AGORA_APP_ID or AGORA_APP_CERTIFICATE missing, placeholder, or invalid in .env.local)',
        },
        { status: 500 }
      );
    }

    const appId: string = rawAppId;
    const appCertificate: string = rawCert;
    const expireTimeInSeconds = 3600; // 1 hour

    // Build RTC token with String UID / user account
    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireTimeInSeconds,
      expireTimeInSeconds
    );

    // Build RTM token
    const rtmToken = RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      uid,
      expireTimeInSeconds
    );

    return NextResponse.json({
      rtcToken,
      rtmToken,
      appId,
      uid,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate token' },
      { status: 500 }
    );
  }
}
