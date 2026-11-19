import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface AgentStopRequest {
  agentId?: string;
  agent_id?: string;
  channelName?: string;
  channel_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: AgentStopRequest;
    try {
      const t = await request.text();
      body = t ? JSON.parse(t) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const agentId = body.agentId || body.agent_id;
    const channelName = body.channelName || body.channel_name;
    if (!agentId && !channelName) {
      return NextResponse.json({ error: 'Missing agentId or channelName' }, { status: 400 });
    }

    // Remove Gemini Live session from Firebase RTDB
    // Replaces: POST https://api.agora.io/.../agents/{agentId}/leave
    try {
      const { adminDb } = await import('@/lib/firebaseAdmin');
      if (channelName) {
        // Firebase Admin RTDB uses adminDb.ref() — no standalone functions
        await adminDb.ref(`sessions/${channelName}`).remove();
        await adminDb.ref(`channels/${channelName}/events`).push({
          id: `evt-agent-left-${Date.now()}`,
          seq: Date.now(),
          timestamp: Date.now(),
          type: 'dashboard_event',
          eventType: 'agent_left',
          customType: 'dashboard_event',
          payload: { agentId: agentId || 'aura_agent', channelName },
        });
      }
    } catch (e) {
      console.warn('[AgentStop] Firebase cleanup notice:', e);
    }

    return NextResponse.json({ agentId: agentId || 'aura_agent', channelName, status: 'stopped' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop agent' },
      { status: 500 }
    );
  }
}
