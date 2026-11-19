import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/tts/speak
 * Replaces: OpenAI TTS + Agora ConvAI /speak
 * Google: Cloud TTS Journey voices (most human-sounding, low latency)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string; isAura?: boolean; voice?: string; speed?: number; agentId?: string };
    const { text, isAura = true, speed = 1.0 } = body;
    if (!text || text.trim().length === 0) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const googleTtsKey = process.env.GOOGLE_TTS_API_KEY;
    const hasValidKey = googleTtsKey && googleTtsKey.startsWith('AIza') && !googleTtsKey.includes('AIza...');
    if (!hasValidKey) return new NextResponse(null, { status: 204 });

    // en-US-Journey-F = authoritative female (AURA)
    // en-US-Journey-D = natural male (human participants)
    const voiceName = isAura ? 'en-US-Journey-F' : 'en-US-Journey-D';

    const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTtsKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.slice(0, 5000) },
        voice: { languageCode: 'en-US', name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: Math.max(0.25, Math.min(4.0, speed)),
          pitch: isAura ? 1.5 : 0.0,
          effectsProfileId: ['headphone-class-device'],
        },
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error('[/api/tts/speak] Google Cloud TTS error:', err);
      return NextResponse.json({ error: 'TTS error', details: err }, { status: 502 });
    }

    const { audioContent } = await ttsRes.json() as { audioContent: string };
    const audioBuffer = Buffer.from(audioContent, 'base64');
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audioBuffer.byteLength), 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('[/api/tts/speak] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
