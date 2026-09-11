import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState } from '@/lib/incidentStore';
import {
  evaluateEscalation,
  sendSlackNotification,
  formatSlackIncidentCard,
  formatResolutionNotification,
  acknowledgeEscalation,
  generateEscalationSpeech,
} from '@/lib/escalationEngine';

export const runtime = 'edge';

/**
 * POST /api/escalate — Evaluate and trigger escalation for an incident.
 *
 * Body: { channelName, reason?, joinUrl? }
 * Returns: escalation result with optional Slack notification status.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const channelName = body.channelName || 'incident-war-room';
    const reason = body.reason;
    const joinUrl = body.joinUrl;

    const state = getIncidentState(channelName);

    if (reason) {
      // Manual escalation with custom reason
      const notification = formatSlackIncidentCard(state, reason, joinUrl);
      const sent = await sendSlackNotification(notification);
      const speech = `I've sent an escalation notification: ${reason}`;

      return NextResponse.json({
        action: 'notified',
        message: reason,
        slackSent: sent,
        speech,
      });
    }

    // Automatic policy-based escalation
    const result = evaluateEscalation(state);

    if (result.notification) {
      const sent = await sendSlackNotification(result.notification);
      const speech = generateEscalationSpeech(result, state);

      return NextResponse.json({
        ...result,
        slackSent: sent,
        speech,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/escalate] Error:', error);
    return NextResponse.json(
      { error: 'Escalation failed', code: 'ESCALATION_ERROR' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/escalate — Acknowledge an escalation.
 *
 * Body: { incidentId, acknowledgedBy }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { incidentId, acknowledgedBy } = body;

    if (!incidentId || !acknowledgedBy) {
      return NextResponse.json(
        { error: 'incidentId and acknowledgedBy are required', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const success = acknowledgeEscalation(incidentId, acknowledgedBy);

    if (!success) {
      return NextResponse.json(
        { error: 'No active escalation found for this incident', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      acknowledged: true,
      incidentId,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/escalate] PUT Error:', error);
    return NextResponse.json(
      { error: 'Acknowledgement failed', code: 'ACK_ERROR' },
      { status: 500 },
    );
  }
}
