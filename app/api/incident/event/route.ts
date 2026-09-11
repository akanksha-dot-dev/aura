import { NextRequest, NextResponse } from 'next/server';
import { addEvidenceToIncident, updateIncidentState } from '@/lib/incidentStore';
import { createDashboardEvent, publishDashboardEvent } from '@/lib/rtmPublisher';
import { ActionStatus, EvidenceItem, RTMDashboardEvent } from '@/lib/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      channelName = 'incident-war-room',
      item,
      eventType: rawEventType,
      payload: rawPayload,
      actionUpdate,
      icClaim,
    } = body;

    // Normalize direct actionUpdate or icClaim into eventType + payload
    let eventType = rawEventType;
    let payload = rawPayload;

    if (actionUpdate && !eventType) {
      eventType = 'action_status_changed';
      payload = {
        actionId: actionUpdate.actionId,
        actionStatus: actionUpdate.status || actionUpdate.actionStatus,
        ownerUid: actionUpdate.ownerUid,
      };
    } else if (icClaim && !eventType) {
      eventType = 'ic_claimed';
      payload = {
        uid: icClaim.claimedByUid || icClaim.uid,
        displayName: icClaim.displayName,
      };
    }

    // Case 1: Standard Evidence Item Ingestion
    if (item && item.content) {
      const updatedState = addEvidenceToIncident(channelName, item as EvidenceItem);

      // Broadcast over Agora SD-RTN so all other war room participants receive it live
      const rtmEvent = createDashboardEvent('evidence_added', item as Record<string, unknown>);
      publishDashboardEvent(channelName, rtmEvent).catch((err) => {
        console.warn('[/api/incident/event] Agora RTM broadcast notice:', err);
      });

      return NextResponse.json({
        success: true,
        evidenceCount: updatedState.evidenceItems.length,
        currentOODAPhase: updatedState.currentOODAPhase,
      });
    }

    // Case 2: General Dashboard Events (ic_claimed, action_status_changed, etc.)
    if (eventType) {
      const typedEventType = eventType as RTMDashboardEvent['eventType'];
      const eventPayload = (payload || {}) as Record<string, unknown>;

      if (typedEventType === 'action_status_changed' && eventPayload.actionId) {
        const actionId = String(eventPayload.actionId);
        const newStatus = (eventPayload.actionStatus || eventPayload.status || 'done') as ActionStatus;
        updateIncidentState(channelName, (prev) => ({
          ...prev,
          evidenceItems: prev.evidenceItems.map((e) =>
            e.id === actionId || e.content.includes(actionId)
              ? { ...e, actionStatus: newStatus }
              : e
          ),
          eventSeq: prev.eventSeq + 1,
        }));
      } else if (typedEventType === 'ic_claimed' && eventPayload.uid) {
        const uid = String(eventPayload.uid);
        updateIncidentState(channelName, (prev) => ({
          ...prev,
          incidentCommanderUid: uid,
          participants: {
            ...prev.participants,
            [uid]: {
              ...(prev.participants[uid] || {
                uid,
                displayName: String(eventPayload.displayName || uid),
                role: 'Incident Commander',
                joinedAt: Date.now(),
                totalSpeakingMs: 0,
                lastSpokeAt: 0,
              }),
              isIncidentCommander: true,
            },
          },
          eventSeq: prev.eventSeq + 1,
        }));
      }

      // Broadcast event to Agora RTM channel
      const rtmEvent = createDashboardEvent(typedEventType, eventPayload);
      publishDashboardEvent(channelName, rtmEvent).catch((err) => {
        console.warn('[/api/incident/event] Agora RTM broadcast notice:', err);
      });

      return NextResponse.json({
        success: true,
        broadcasted: true,
        eventType: typedEventType,
      });
    }

    return NextResponse.json(
      { error: 'Missing evidence item, content, or valid eventType' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[/api/incident/event] Error recording evidence:', err);
    return NextResponse.json(
      { error: 'Internal server error recording evidence' },
      { status: 500 }
    );
  }
}
