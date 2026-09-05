import { RTMDashboardEvent } from './types';
import { AGENT_UID } from './constants';

let monotonicSeq = 0;

/**
 * Returns the next monotonic sequence number for dashboard events.
 * Starts at 1 and increments sequentially.
 */
export function getNextSeq(): number {
  monotonicSeq += 1;
  return monotonicSeq;
}

/**
 * Generates an event ID from sequence number (e.g. "evt-001").
 */
export function generateEventId(seq: number): string {
  return `evt-${String(seq).padStart(3, '0')}`;
}

/**
 * Factory to create an RTMDashboardEvent with consistent timestamp and sequence numbering.
 */
export function createDashboardEvent(
  eventType: RTMDashboardEvent['eventType'],
  payload: Record<string, unknown>,
  seq?: number
): RTMDashboardEvent {
  const eventSeq = seq ?? getNextSeq();
  return {
    type: 'dashboard_event',
    id: generateEventId(eventSeq),
    seq: eventSeq,
    timestamp: Date.now(),
    eventType,
    payload,
  };
}

/**
 * Publishes a dashboard event to the Agora Signaling (RTM 2.x) REST API.
 * Stateless and safe for serverless/edge route handlers.
 * Catches and logs all errors gracefully without throwing.
 */
export async function publishDashboardEvent(
  channelName: string,
  event: RTMDashboardEvent
): Promise<void> {
  const appId = process.env.AGORA_APP_ID;
  const customerKey = process.env.AGORA_CUSTOMER_KEY;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

  if (!appId || !customerKey || !customerSecret) {
    console.warn(
      '[RTM Publisher] Missing Agora credentials (AGORA_APP_ID, AGORA_CUSTOMER_KEY, AGORA_CUSTOMER_SECRET). Skipping RTM publish.'
    );
    return;
  }

  const botUid = AGENT_UID;
  const endpoint = `https://api.agora.io/api/v2/project/${appId}/rtm/message/channel`;

  const authHeader = `Basic ${Buffer.from(`${customerKey}:${customerSecret}`).toString('base64')}`;

  const messagePayload = JSON.stringify({
    ...event,
    customType: 'dashboard_event',
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_name: channelName,
        message: messagePayload,
        channel_type: 'MESSAGE',
        sender_id: botUid,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(
        `[RTM Publisher] Failed to publish event to channel "${channelName}". HTTP ${res.status}: ${body}`
      );
    }
  } catch (err) {
    console.warn(
      `[RTM Publisher] Network error publishing event to channel "${channelName}":`,
      err instanceof Error ? err.message : String(err)
    );
  }
}
