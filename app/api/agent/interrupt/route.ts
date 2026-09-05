import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface AgentInterruptRequest {
  agentId?: string;
  agent_id?: string;
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

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid agentId' },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !customerKey || !customerSecret) {
      return NextResponse.json(
        {
          error:
            'Agora REST credentials not configured (AGORA_APP_ID, AGORA_CUSTOMER_KEY or AGORA_CUSTOMER_SECRET missing)',
        },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(
      `${customerKey}:${customerSecret}`
    ).toString('base64')}`;

    const agoraResponse = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/interrupt`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok) {
      return NextResponse.json(
        {
          error: 'Failed to interrupt Agora ConvAI agent',
          status: agoraResponse.status,
          details: responseData,
        },
        { status: agoraResponse.status }
      );
    }

    return NextResponse.json({
      agentId,
      status: 'interrupted',
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to interrupt ConvAI agent',
      },
      { status: 500 }
    );
  }
}
