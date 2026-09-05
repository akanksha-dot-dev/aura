import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface AgentStopRequest {
  agentId?: string;
  agent_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    let body: AgentStopRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const agentId = body.agentId || body.agent_id;

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid agentId' },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId) {
      return NextResponse.json(
        { error: 'AGORA_APP_ID not configured' },
        { status: 500 }
      );
    }

    if (!customerKey || !customerSecret) {
      return NextResponse.json(
        {
          error:
            'Agora REST credentials not configured (AGORA_CUSTOMER_KEY or AGORA_CUSTOMER_SECRET missing)',
        },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(
      `${customerKey}:${customerSecret}`
    ).toString('base64')}`;

    const agoraResponse = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/leave`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = await agoraResponse.json().catch(() => ({}));

    // If agent is not found or already left, consider it a successful idempotent stop
    if (!agoraResponse.ok && agoraResponse.status !== 404) {
      return NextResponse.json(
        {
          error: 'Failed to stop Agora ConvAI agent',
          status: agoraResponse.status,
          details: responseData,
        },
        { status: agoraResponse.status }
      );
    }

    return NextResponse.json({
      agentId,
      status: 'stopped',
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to stop ConvAI agent',
      },
      { status: 500 }
    );
  }
}
