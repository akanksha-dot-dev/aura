'use client';

import { useCallback } from 'react';
import type { RTMDashboardEvent } from '@/lib/types';
import type { QuickCapturePayload } from '@/components/modals/QuickCapture';
import { emitToast } from '@/components/indicators/NotificationToast';

export interface EvidenceLoggerOptions {
  channel: string;
  uid: string;
  name: string;
  eventSeq: number;
  processEvent: (event: RTMDashboardEvent) => void;
}

/**
 * Encapsulates creating and dispatching evidence and action items
 * to local incident state and background telemetry sync.
 */
export function useEvidenceLogger({
  channel,
  uid,
  name,
  eventSeq,
  processEvent,
}: EvidenceLoggerOptions) {
  const logAction = useCallback(
    (title: string, detail: string) => {
      const item = {
        id: `playbook-action-${Date.now()}`,
        category: 'action' as const,
        content: `${title} — ${detail}`,
        speakerUid: uid,
        speakerName: name,
        confidence: 80,
        timestamp: Date.now(),
        actionStatus: 'pending' as const,
      };
      processEvent({
        type: 'dashboard_event',
        id: item.id,
        seq: eventSeq + 1,
        timestamp: Date.now(),
        eventType: 'evidence_added',
        payload: item,
      });
      fetch('/api/incident/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: channel, item }),
      }).catch(() => {});
      emitToast({ type: 'info', title: 'Playbook Action Created', description: `${title}: ${detail}` });
    },
    [channel, uid, name, eventSeq, processEvent]
  );

  const logQuickCapture = useCallback(
    (payload: QuickCapturePayload) => {
      const item = {
        id: `qc-${Date.now()}`,
        category: payload.category,
        content: payload.content,
        speakerUid: uid,
        speakerName: name,
        confidence: 75,
        timestamp: Date.now(),
        ...(payload.category === 'action' ? { actionStatus: 'pending' as const } : {}),
      };
      processEvent({
        type: 'dashboard_event',
        id: item.id,
        seq: eventSeq + 1,
        timestamp: Date.now(),
        eventType: 'evidence_added',
        payload: item,
      });
      fetch('/api/incident/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: channel, item }),
      }).catch(() => {});
      emitToast({ type: 'info', title: `${payload.category.toUpperCase()} Logged`, description: payload.content });
    },
    [channel, uid, name, eventSeq, processEvent]
  );

  return { logAction, logQuickCapture };
}
