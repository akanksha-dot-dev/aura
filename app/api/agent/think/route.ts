import { NextRequest, NextResponse } from 'next/server';
import { createDashboardEvent, publishDashboardEvent } from '@/lib/rtmPublisher';

export const runtime = 'nodejs';

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
 * POST /api/agent/think — Injects external alerts/telemetry directly into the
 * active Gemini Live agent's reasoning loop via Firebase RTDB (replaces Agora ConvAI /think).
 *
 * Since Gemini Live is client-side WebSocket, this route:
 * 1. Broadcasts the alert to the Firebase RTDB channel (all dashboards display it instantly)
 * 2. Writes a 'think_injection' event to the session node so the client-side hook
 *    can forward it into the open Gemini Live WebSocket as a user message.
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

    // 1. Broadcast the alert to the war room via Firebase RTDB so all dashboards display it
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

    // 2. Write a think_injection event to Firebase RTDB session node.
    //    The client-side Gemini Live hook listens for this and forwards it
    //    into the open WebSocket as a user turn so the agent reasons about it.
    if (agentId) {
      try {
        const { adminDb } = await import('@/lib/firebaseAdmin');

        // Firebase Admin RTDB uses adminDb.ref() — no standalone functions
        await adminDb.ref(`channels/${channelName}/events`).push({
          id: `think-${Date.now()}`,
          seq: Date.now(),
          timestamp: Date.now(),
          type: 'think_injection',
          eventType: 'think_injection',
          payload: {
            agentId,
            message: `[TELEMETRY ALERT - ${source}]: ${message.trim()}`,
            source,
          },
        });

        return NextResponse.json({
          success: true,
          status: 'injected',
          mode: 'firebase_rtdb_think',
          agentId,
          message: message.trim(),
          broadcasted: true,
          injectedAt: Date.now(),
        });
      } catch (fbErr) {
        console.warn('[/api/agent/think] Firebase RTDB think injection warning:', fbErr);
        // Fall through to broadcasted-only response
      }
    }

    // Graceful fallback when agentId is not passed or Firebase write failed
    return NextResponse.json({
      success: true,
      status: 'broadcasted_to_rtdb',
      mode: 'rtdb_broadcast',
      message: message.trim(),
      source,
      injectedAt: Date.now(),
      note: 'Alert broadcast to Firebase RTDB war room stream and recorded to incident telemetry',
    });
  } catch (error) {
    console.error('[/api/agent/think] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
