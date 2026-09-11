import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/tunnel/start
 *
 * Streams SSE progress messages for public tunnel status.
 * If CLOUDFLARE_TUNNEL_URL or PUBLIC_URL is configured, informs the UI immediately.
 */
export async function POST() {
  const encoder = new TextEncoder();
  const publicUrl = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.CLOUDFLARE_TUNNEL_URL;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify('Checking tunnel prerequisites...')}\n\n`)
      );

      if (publicUrl) {
        controller.enqueue(
          encoder.encode(`event: url\ndata: ${JSON.stringify(publicUrl)}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(`Active public URL: ${publicUrl}`)}\n\n`)
        );
      } else {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(
              'No public tunnel configured. Run `cloudflared tunnel` or set PUBLIC_URL in .env.local.'
            )}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify('Tunnel requires cloudflared CLI or PUBLIC_URL in .env.local')}\n\n`
          )
        );
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
