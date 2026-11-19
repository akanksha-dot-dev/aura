/**
 * rtmPublisher.ts — Firebase Realtime Database Dashboard Event Publisher
 *
 * Replaces: Agora Signaling RTM 2.x REST API
 * Google equivalent: Firebase Realtime Database REST push — sub-100ms delivery
 */
import { RTMDashboardEvent } from './types';
import { AGENT_UID } from './constants';

let monotonicSeq = 0;

export function getNextSeq(): number {
  monotonicSeq += 1;
  return monotonicSeq;
}

export function generateEventId(seq: number): string {
  return `evt-${String(seq).padStart(3, '0')}`;
}

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
 * Publishes a dashboard event to Firebase Realtime Database.
 * Replaces: POST https://api.agora.io/dev/v2/project/.../rtm/users/.../channel_messages
 * Uses Firebase REST API — edge-compatible, no Node SDK needed.
 */
export async function publishDashboardEvent(
  channelName: string,
  event: RTMDashboardEvent
): Promise<void> {
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (
    !databaseURL ||
    databaseURL.includes('your-project') ||
    !projectId ||
    projectId.includes('your-project')
  ) {
    console.warn('[RTM Publisher] Firebase not configured. Skipping dashboard event publish.');
    return;
  }

  try {
    const path = `channels/${encodeURIComponent(channelName)}/events`;
    const url = `${databaseURL}/${path}.json`;

    const payload = {
      ...event,
      customType: 'dashboard_event',
      _publishedBy: AGENT_UID,
      _serverTime: { '.sv': 'timestamp' },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[RTM Publisher] Firebase push failed for "${channelName}". HTTP ${res.status}: ${body}`);
    }
  } catch (err) {
    console.warn(
      `[RTM Publisher] Network error for channel "${channelName}":`,
      err instanceof Error ? err.message : String(err)
    );
  }
}
