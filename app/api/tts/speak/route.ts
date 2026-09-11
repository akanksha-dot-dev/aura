import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/tts/speak
 *
 * Text-to-speech endpoint for AURA Chrome Extension.
 * Converts AURA's text response to audio bytes using OpenAI TTS
 * and streams them back so the extension can play them in the side panel.
 *
 * Body: { text: string; voice?: string; speed?: number }
 * Returns: audio/mpeg stream
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string; voice?: string; speed?: number; agentId?: string };
    const { text, voice = 'nova', speed = 1.0, agentId } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // 1. If active Agora ConvAI agentId is provided, broadcast directly into RTC channel via Agora /speak
    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (agentId && appId && customerKey && customerSecret) {
      const authHeader = `Basic ${Buffer.from(
        `${customerKey}:${customerSecret}`
      ).toString('base64')}`;

      const endpoint = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/speak`;

      try {
        const agoraRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: text.trim() }),
        });

        if (agoraRes.ok) {
          return NextResponse.json({
            status: 'spoken_via_agora',
            agentId,
            text: text.trim(),
          });
        }
      } catch (err) {
        console.warn('[/api/tts/speak] Agora /speak broadcast notice:', err);
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY || '';
    const hasValidKey = openAiKey.startsWith('sk-') && !openAiKey.includes('your_openai');

    if (!hasValidKey) {
      // Return empty 204 in demo mode — extension/client will handle gracefully
      return new NextResponse(null, { status: 204 });
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096), // OpenAI TTS max
        voice,  // nova: warm, natural female voice
        speed: Math.max(0.25, Math.min(4.0, speed)),
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error('[/api/tts/speak] OpenAI TTS error:', err);
      return NextResponse.json({ error: 'TTS error' }, { status: 502 });
    }

    // Stream audio bytes back to the extension
    const audioBuffer = await ttsRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[/api/tts/speak] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
