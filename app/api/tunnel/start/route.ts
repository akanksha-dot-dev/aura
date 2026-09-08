import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * POST /api/tunnel/start
 * Spawns a cloudflared quick tunnel that exposes localhost:3000 to the internet.
 * Streams the public URL back via SSE, then patches .env.local automatically.
 *
 * The client should:
 *   1. POST to this endpoint (no body needed)
 *   2. Read the SSE stream for `url` events
 *   3. Once the url event fires, the tunnel is live and .env.local is patched
 */
export async function POST(_request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent('status', 'Checking cloudflared availability...');

      // Try cloudflared; fall back to a helpful error
      const proc = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      let publicUrl: string | null = null;
      const URL_RE = /https?:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        const match = text.match(URL_RE);
        if (match && !publicUrl) {
          publicUrl = match[0];
          sendEvent('url', publicUrl);
          sendEvent('status', `Tunnel live: ${publicUrl}`);

          // Patch .env.local
          try {
            const envPath = path.join(process.cwd(), '.env.local');
            let envContent = fs.readFileSync(envPath, 'utf-8');
            envContent = envContent.replace(
              /^PROXY_URL=.*$/m,
              `PROXY_URL="${publicUrl}/api/llm/proxy"`
            );
            envContent = envContent.replace(
              /^MCP_URL=.*$/m,
              `MCP_URL="${publicUrl}/api/mcp/sse"`
            );
            fs.writeFileSync(envPath, envContent, 'utf-8');
            sendEvent('patched', publicUrl);
          } catch (err) {
            sendEvent('warn', `Could not patch .env.local automatically: ${String(err)}`);
          }
        }
      };

      proc.stdout.on('data', handleOutput);
      proc.stderr.on('data', handleOutput);

      proc.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          sendEvent('error', 'cloudflared is not installed. Run: winget install Cloudflare.cloudflared');
        } else {
          sendEvent('error', `Tunnel process error: ${err.message}`);
        }
        controller.close();
      });

      proc.on('exit', (code) => {
        sendEvent('status', `Tunnel exited with code ${code}`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
