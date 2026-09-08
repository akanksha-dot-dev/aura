import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState } from '@/lib/incidentStore';

export const runtime = 'nodejs';

/**
 * GET /api/meet/status?channel=incident-war-room
 *
 * Server-Sent Events stream that the Chrome Extension side panel subscribes to.
 * Pushes real-time incident state (evidence, OODA phase, severity, active speakers)
 * every 2 seconds so the panel stays in sync without polling.
 */
export async function GET(request: NextRequest) {
  const channelName = request.nextUrl.searchParams.get('channel') || 'incident-war-room';

  const encoder = new TextEncoder();
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ channel: channelName, ts: Date.now() })}\n\n`)
      );

      // Push state every 2 seconds
      intervalHandle = setInterval(() => {
        try {
          const state = getIncidentState(channelName);
          if (!state) {
            controller.enqueue(
              encoder.encode(`event: idle\ndata: ${JSON.stringify({ channel: channelName, ts: Date.now() })}\n\n`)
            );
            return;
          }

          const payload = {
            ts: Date.now(),
            channel: channelName,
            severity: state.severity,
            status: state.status,
            oodaPhase: state.oodaPhase,
            cognitiveLoad: state.cognitiveLoadScore,
            costAccrued: state.costAccrued,
            activeConflict: state.activeConflict,
            evidenceCount: state.evidence.length,
            recentEvidence: state.evidence.slice(-3).map((e) => ({
              id: e.id,
              category: e.category,
              content: e.content.slice(0, 120),
              speakerName: e.speakerName,
              timestamp: e.timestamp,
            })),
            actionItems: state.actionItems.slice(-3).map((a) => ({
              id: a.id,
              title: a.title,
              owner: a.owner,
              status: a.status,
            })),
            participants: state.participants.map((p) => ({
              uid: p.uid,
              displayName: p.displayName,
              role: p.role,
              isActive: p.isActive,
            })),
          };

          controller.enqueue(
            encoder.encode(`event: state\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // State not ready yet
        }
      }, 2000);
    },
    cancel() {
      if (intervalHandle) clearInterval(intervalHandle);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // Allow Chrome extension origin
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
