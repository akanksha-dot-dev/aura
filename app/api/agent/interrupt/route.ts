import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ────────────────────────────────────────────────────────────────────────────────────
// POST /api/agent/interrupt
// Replaces: Agora ConvAI POST /agents/{agentId}/interrupt
// Now: Broadcasts an `agent_interrupted` event to Firebase RTDB so the Gemini Live
//     client-side WebSocket handler can call session.close() / abort the response.
// ────────────────────────────────────────────────────────────────────────────────────

interface AgentInterruptRequest {
  agentId?: string;
  agent_id?: string;
  channelName?: string;
  channel_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: AgentInterruptRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const agentId = body.agentId || body.agent_id;
    const channelName = body.channelName || body.channel_name;

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid agentId' },
        { status: 400 }
      );
    }

    // ── Broadcast interrupt event via Firebase RTDB ───────────────────────────
    // Replaces: POST https://api.agora.io/.../agents/{agentId}/interrupt
    // The client-side Gemini Live WebSocket handler listens on:
    //   channels/{channelName}/events → eventType === 'agent_interrupted'
    // and calls session.close() to abort the current speech turn.
    try {
      const { adminDb } = await import('@/lib/firebaseAdmin');

      // Derive channelName from agentId if not provided
      // agentId format: aura-{channelName-slug}-{timestamp36}
      const resolvedChannel = channelName || (() => {
        const parts = agentId.replace(/^aura-/, '').split('-');
        // Drop the last segment (timestamp36) and rejoin
        parts.pop();
        return parts.join('-') || agentId;
      })();

      // Firebase Admin RTDB: use adminDb.ref() — no standalone functions
      await adminDb.ref(`channels/${resolvedChannel}/events`).push({
        id: `evt-interrupt-${Date.now()}`,
        seq: Date.now(),
        timestamp: Date.now(),
        type: 'dashboard_event',
        eventType: 'agent_interrupted',
        customType: 'dashboard_event',
        payload: { agentId, channelName: resolvedChannel, source: 'api' },
      });

      // Also update session status so new listeners see it
      await adminDb.ref(`sessions/${resolvedChannel}/status`).set('interrupted');
    } catch (firebaseErr) {
      // Non-fatal: log and continue — the interrupt event failing shouldn't
      // block the response (agent may already be silent)
      console.warn('[AgentInterrupt] Firebase RTDB write warning:', firebaseErr);
    }

    return NextResponse.json({
      agentId,
      status: 'interrupted',
      transport: 'firebase-rtdb',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to interrupt AURA agent',
      },
      { status: 500 }
    );
  }
}
