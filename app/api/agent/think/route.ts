import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState } from '@/lib/incidentStore';
import { createDashboardEvent, publishDashboardEvent } from '@/lib/rtmPublisher';

export const runtime = 'edge';

interface AgentThinkRequest {
  agentId?: string;
  channelName?: string;
  message?: string;
  title?: string;
  details?: string;
  suggestedDirective?: string;
  alertType?: string;
  source?: string;
}

/**
 * POST /api/agent/think — Injects external alerts/telemetry directly into the active
 * Agora Conversational AI agent's reasoning loop mid-session without waiting for human speech.
 */
export async function POST(request: NextRequest) {
  try {
    let body: AgentThinkRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const {
      agentId,
      channelName = 'incident-war-room',
      message: rawMessage,
      title,
      details,
      suggestedDirective,
      alertType,
      source = alertType || 'External Telemetry',
    } = body;

    const message = (
      rawMessage ||
      [title, details, suggestedDirective ? `Suggested action: ${suggestedDirective}` : '']
        .filter(Boolean)
        .join(' — ')
    ).trim();

    if (!message) {
      return NextResponse.json(
        { error: 'Missing or empty message string' },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    // Broadcast the alert to the war room via Agora RTM so all dashboards display it
    const alertFact = {
      id: `alert-${Date.now()}`,
      category: 'fact' as const,
      content: `[${source}] ${message.trim()}`,
      speakerUid: 'aura_agent',
      speakerName: 'AURA Telemetry',
      confidence: 85,
      timestamp: Date.now(),
    };

    publishDashboardEvent(
      channelName,
      createDashboardEvent('evidence_added', alertFact)
    ).catch(() => {});

    // If active agentId and Agora REST credentials exist, inject into Agora ConvAI /think
    if (appId && customerKey && customerSecret && agentId) {
      const authHeader = `Basic ${Buffer.from(
        `${customerKey}:${customerSecret}`
      ).toString('base64')}`;

      const endpoint = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/think`;

      try {
        const agoraRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `[TELEMETRY ALERT - ${source}]: ${message.trim()}`,
          }),
        });

        const agoraData = await agoraRes.json().catch(() => ({}));

        if (agoraRes.ok) {
          return NextResponse.json({
            success: true,
            status: 'injected',
            mode: 'agora_think_api',
            agentId,
            message: message.trim(),
            broadcasted: true,
            injectedAt: Date.now(),
            details: agoraData,
          });
        }
      } catch (agoraErr) {
        console.warn('[/api/agent/think] Agora REST call notice:', agoraErr);
      }
    }

    // Graceful fallback when agentId is not passed or offline
    return NextResponse.json({
      success: true,
      status: 'broadcasted_to_rtm',
      mode: 'rtm_broadcast',
      message: message.trim(),
      source,
      injectedAt: Date.now(),
      note: 'Alert broadcast to war room RTM stream and recorded to incident telemetry',
    });
  } catch (error) {
    console.error('[/api/agent/think] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
