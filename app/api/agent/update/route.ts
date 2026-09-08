import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/agent/update — Hot-update the ConvAI agent's context when participants change.
 * Sends updated participant roster and incident context to the active agent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, channelName, participants, incidentContext } = body;

    if (!agentId || !channelName) {
      return NextResponse.json(
        { error: 'Missing agentId or channelName' },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !customerKey || !customerSecret) {
      return NextResponse.json(
        { error: 'Agora credentials not configured' },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(
      `${customerKey}:${customerSecret}`
    ).toString('base64')}`;

    // Build the context update message for the agent
    const participantRoster = Array.isArray(participants)
      ? participants
          .map(
            (p: { displayName: string; role: string; uid: string }) =>
              `${p.displayName} (UID: "${p.uid}", Role: ${p.role})`
          )
          .join(', ')
      : 'No participants';

    const contextUpdate = incidentContext
      ? `[PARTICIPANT UPDATE] Active responders on bridge: ${participantRoster}\n${incidentContext}`
      : `[PARTICIPANT UPDATE] Active responders on bridge: ${participantRoster}`;

    // Use Agora's agent update API to push new context
    const updatePayload = {
      properties: {
        llm: {
          system_messages: [
            {
              role: 'system',
              content: contextUpdate,
            },
          ],
        },
      },
    };

    const agoraResponse = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/update`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    const responseData = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok && agoraResponse.status !== 404) {
      console.warn(
        `[AgentUpdate] Agora update returned HTTP ${agoraResponse.status}:`,
        responseData
      );
      // Non-critical — agent will pick up context from the next proxy turn
      return NextResponse.json({
        status: 'context_queued',
        note: 'Agent update queued; context will sync on next turn',
        details: responseData,
      });
    }

    return NextResponse.json({
      status: 'updated',
      participantCount: Array.isArray(participants) ? participants.length : 0,
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update agent context',
      },
      { status: 500 }
    );
  }
}
