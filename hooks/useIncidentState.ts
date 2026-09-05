'use client';

import { useReducer, useCallback, useRef } from 'react';
import {
  IncidentState,
  EvidenceItem,
  RTMDashboardEvent,
  ActionStatus,
  ClassificationType,
  HypothesisStatus,
  IncidentStatus,
  OODAPhase,
  Participant,
  calculateCognitiveLoad,
  classifyOODAPhase,
} from '@/lib/types';
import { CONFIDENCE_CAP } from '@/lib/constants';

export interface UseIncidentStateReturn {
  state: IncidentState;
  processEvent: (event: RTMDashboardEvent) => void;
  dispatchStateUpdate: (update: Record<string, unknown>) => void;
  resolveIncident: () => void;
  claimIC: (uid: string) => void;
  releaseIC: () => void;
  updateActionStatus: (actionId: string, newStatus: ActionStatus) => void;
}

export const INITIAL_INCIDENT_STATE: IncidentState = {
  incidentId: 'INC-4821',
  title: 'Payment Gateway Outage — Checkout Failures',
  severity: 'SEV-1',
  status: 'investigating',
  openedAt: Date.now(),
  affectedServices: ['payment-gateway', 'checkout-service'],
  participants: {},
  incidentCommanderUid: null,
  evidenceItems: [],
  eventSeq: 0,
  currentOODAPhase: 'OBSERVE',
  costAccrued: 0,
  cognitiveLoadScore: 0,
  lastReadbackAt: 0,
};

type IncidentAction =
  | { type: 'PROCESS_RTM_EVENT'; event: RTMDashboardEvent }
  | { type: 'DISPATCH_STATE_UPDATE'; update: Record<string, unknown> }
  | { type: 'RESOLVE_INCIDENT' }
  | { type: 'CLAIM_IC'; uid: string }
  | { type: 'RELEASE_IC' }
  | { type: 'UPDATE_ACTION_STATUS'; actionId: string; newStatus: ActionStatus };

function incidentReducer(
  state: IncidentState,
  action: IncidentAction
): IncidentState {
  switch (action.type) {
    case 'RESOLVE_INCIDENT': {
      const updated: IncidentState = {
        ...state,
        status: 'resolved',
        resolvedAt: Date.now(),
        currentOODAPhase: 'RESOLVED',
        eventSeq: state.eventSeq + 1,
      };
      updated.cognitiveLoadScore = calculateCognitiveLoad(updated);
      return updated;
    }

    case 'DISPATCH_STATE_UPDATE': {
      const { update } = action;
      let nextEvidence = [...state.evidenceItems];
      let nextStatus = state.status;
      let nextResolvedAt = state.resolvedAt;

      if (update.confirmHypothesis) {
        const id = String(update.confirmHypothesis);
        nextEvidence = nextEvidence.map((item) =>
          item.id === id ? { ...item, status: 'confirmed' as HypothesisStatus } : item
        );
      }

      if (update.disproveHypothesis) {
        const id = String(update.disproveHypothesis);
        nextEvidence = nextEvidence.map((item) =>
          item.id === id ? { ...item, status: 'disproven' as HypothesisStatus } : item
        );
      }

      if (update.resolveConflict) {
        const id = String(update.resolveConflict);
        nextEvidence = nextEvidence.map((item) =>
          item.id === id ? { ...item, status: 'disproven' as HypothesisStatus } : item
        );
      }

      if (update.completeAction) {
        const actionIds = Array.isArray(update.completeAction)
          ? update.completeAction.map(String)
          : [String(update.completeAction)];
        nextEvidence = nextEvidence.map((item) =>
          actionIds.includes(item.id)
            ? { ...item, actionStatus: 'done' as ActionStatus }
            : item
        );
      }

      if (update.updateStatus) {
        const s = update.updateStatus as IncidentStatus;
        if (s) {
          nextStatus = s;
          if (s === 'resolved') {
            if (!nextResolvedAt) {
              nextResolvedAt = Date.now();
            }
            // All action items are completed when incident is resolved
            nextEvidence = nextEvidence.map((item) =>
              item.category === 'action' && item.actionStatus !== 'done'
                ? { ...item, actionStatus: 'done' as ActionStatus }
                : item
            );
          }
        }
      }

      if (update.resolvedAt) {
        nextResolvedAt =
          update.resolvedAt === 'NOW' ? Date.now() : Number(update.resolvedAt);
      }

      const nextState: IncidentState = {
        ...state,
        evidenceItems: nextEvidence,
        status: nextStatus,
        resolvedAt: nextResolvedAt,
        eventSeq: state.eventSeq + 1,
      };

      if (update.currentOODAPhase || update.oodaPhase) {
        nextState.currentOODAPhase = (update.currentOODAPhase || update.oodaPhase) as OODAPhase;
      } else {
        nextState.currentOODAPhase =
          nextStatus === 'resolved' ? 'RESOLVED' : classifyOODAPhase(nextState);
      }

      nextState.cognitiveLoadScore = calculateCognitiveLoad(nextState);

      return nextState;
    }

    case 'CLAIM_IC': {
      const uid = action.uid;
      const updatedParticipants: Record<string, Participant> = {};
      for (const [key, p] of Object.entries(state.participants)) {
        updatedParticipants[key] = {
          ...p,
          isIncidentCommander: key === uid,
        };
      }

      const updated: IncidentState = {
        ...state,
        incidentCommanderUid: uid,
        participants: updatedParticipants,
        eventSeq: state.eventSeq + 1,
      };
      updated.currentOODAPhase = classifyOODAPhase(updated);
      updated.cognitiveLoadScore = calculateCognitiveLoad(updated);
      return updated;
    }

    case 'RELEASE_IC': {
      const updatedParticipants: Record<string, Participant> = {};
      for (const [key, p] of Object.entries(state.participants)) {
        updatedParticipants[key] = {
          ...p,
          isIncidentCommander: false,
        };
      }

      const updated: IncidentState = {
        ...state,
        incidentCommanderUid: null,
        participants: updatedParticipants,
        eventSeq: state.eventSeq + 1,
      };
      updated.currentOODAPhase = classifyOODAPhase(updated);
      updated.cognitiveLoadScore = calculateCognitiveLoad(updated);
      return updated;
    }

    case 'UPDATE_ACTION_STATUS': {
      const { actionId, newStatus } = action;
      const updatedEvidence = state.evidenceItems.map((item) => {
        if (item.id === actionId || item.content.includes(actionId)) {
          return {
            ...item,
            actionStatus: newStatus,
          };
        }
        return item;
      });

      const updated: IncidentState = {
        ...state,
        evidenceItems: updatedEvidence,
        eventSeq: state.eventSeq + 1,
      };
      updated.currentOODAPhase = classifyOODAPhase(updated);
      updated.cognitiveLoadScore = calculateCognitiveLoad(updated);
      return updated;
    }

    case 'PROCESS_RTM_EVENT': {
      const { event } = action;
      const payload = event.payload || {};

      let nextEvidence = [...state.evidenceItems];
      const nextParticipants = { ...state.participants };
      let nextStatus = state.status;
      let nextResolvedAt = state.resolvedAt;
      let nextIC = state.incidentCommanderUid;

      switch (event.eventType) {
        case 'evidence_added': {
          const category = (payload.category as ClassificationType) || 'fact';
          const newEvidence: EvidenceItem = {
            id: String(payload.id || event.id || `evt-${state.eventSeq + 1}`),
            category,
            content: String(payload.content || ''),
            speakerUid: String(payload.speakerUid || 'unknown'),
            speakerName: String(payload.speakerName || payload.speakerUid || 'Unknown'),
            confidence: Math.min(
              CONFIDENCE_CAP,
              Number(payload.confidence) || 75
            ),
            timestamp: Number(payload.timestamp) || event.timestamp || Date.now(),
            serviceAffected: payload.serviceAffected
              ? String(payload.serviceAffected)
              : undefined,
            relatedTo: Array.isArray(payload.relatedTo)
              ? (payload.relatedTo as string[])
              : [],
            status:
              (payload.status as HypothesisStatus) ||
              (category === 'hypothesis' || category === 'conflict' ? 'active' : 'confirmed'),
            assignedTo: payload.assignedTo ? String(payload.assignedTo) : undefined,
            eta: payload.eta ? Number(payload.eta) : undefined,
            actionStatus: payload.actionStatus
              ? (payload.actionStatus as ActionStatus)
              : undefined,
            decidingMetric: payload.decidingMetric
              ? String(payload.decidingMetric)
              : undefined,
            hypothesisA: payload.hypothesisA
              ? String(payload.hypothesisA)
              : undefined,
            hypothesisB: payload.hypothesisB
              ? String(payload.hypothesisB)
              : undefined,
            speakerAUid: payload.speakerAUid
              ? String(payload.speakerAUid)
              : undefined,
            speakerBUid: payload.speakerBUid
              ? String(payload.speakerBUid)
              : undefined,
          };

          // Append or replace if already present by id
          const existingIdx = nextEvidence.findIndex(
            (e) => e.id === newEvidence.id
          );
          if (existingIdx >= 0) {
            nextEvidence[existingIdx] = {
              ...nextEvidence[existingIdx],
              ...newEvidence,
            };
          } else {
            nextEvidence.push(newEvidence);
          }
          break;
        }

        case 'evidence_updated': {
          const idToUpdate = String(payload.id || event.id);
          const idx = nextEvidence.findIndex((e) => e.id === idToUpdate);
          if (idx >= 0) {
            nextEvidence[idx] = {
              ...nextEvidence[idx],
              ...(payload as Partial<EvidenceItem>),
            };
          } else {
            console.warn(
              `[useIncidentState] evidence_updated: item "${idToUpdate}" not found`
            );
          }
          break;
        }

        case 'status_changed': {
          const status = payload.status as IncidentStatus;
          if (status) {
            nextStatus = status;
            if (status === 'resolved') {
              nextResolvedAt = Date.now();
            }
          }
          break;
        }

        case 'ic_claimed': {
          const uid = String(payload.uid || payload.userId || '');
          if (uid) {
            nextIC = uid;
            for (const [key, p] of Object.entries(nextParticipants)) {
              nextParticipants[key] = {
                ...p,
                isIncidentCommander: key === uid,
              };
            }
          }
          break;
        }

        case 'ic_released': {
          nextIC = null;
          for (const [key, p] of Object.entries(nextParticipants)) {
            nextParticipants[key] = {
              ...p,
              isIncidentCommander: false,
            };
          }
          break;
        }

        case 'action_status_changed': {
          const targetId = String(
            payload.actionId || payload.ticketId || payload.id || ''
          );
          const newStatus = (payload.actionStatus ||
            payload.status ||
            'done') as ActionStatus;

          const existingIdx = nextEvidence.findIndex(
            (item) => item.id === targetId || (targetId && item.content.includes(targetId))
          );

          if (existingIdx >= 0) {
            nextEvidence = nextEvidence.map((item, idx) =>
              idx === existingIdx
                ? {
                    ...item,
                    actionStatus: newStatus,
                  }
                : item
            );
          } else {
            // Automatically add new Action card (e.g. Jira Ticket, Slack broadcast, PagerDuty)
            const summary = String(
              payload.summary ||
              payload.statusMessage ||
              payload.escalationNote ||
              (payload.ticketId ? `Jira Ticket ${payload.ticketId}` : 'Incident Action')
            );
            nextEvidence = [
              ...nextEvidence,
              {
                id: targetId || event.id,
                category: 'action',
                content: summary,
                speakerUid: 'aura_agent',
                speakerName: 'AURA',
                confidence: 85,
                timestamp: Date.now(),
                status: 'confirmed',
                actionStatus: (newStatus as string) === 'created' ? 'in_progress' : newStatus,
                assignedTo: String(payload.assignedTeam || payload.channel || 'Core SRE'),
                relatedTo: [],
              },
            ];
          }
          break;
        }

        case 'participant_joined': {
          const uid = String(payload.uid || payload.userId || '');
          if (uid) {
            nextParticipants[uid] = {
              uid,
              displayName: String(payload.displayName || payload.name || uid),
              role: String(payload.role || 'Responder'),
              isIncidentCommander: uid === nextIC,
              joinedAt: Number(payload.joinedAt) || Date.now(),
              totalSpeakingMs: Number(payload.totalSpeakingMs) || 0,
              lastSpokeAt: Number(payload.lastSpokeAt) || Date.now(),
            };
          }
          break;
        }

        case 'participant_left': {
          const uid = String(payload.uid || payload.userId || '');
          if (uid && nextParticipants[uid]) {
            delete nextParticipants[uid];
            if (nextIC === uid) {
              nextIC = null;
            }
          }
          break;
        }

        default:
          console.warn(
            `[useIncidentState] Unhandled eventType: ${event.eventType}`
          );
          return state;
      }

      const nextState: IncidentState = {
        ...state,
        evidenceItems: nextEvidence,
        participants: nextParticipants,
        status: nextStatus,
        resolvedAt: nextResolvedAt,
        incidentCommanderUid: nextIC,
        eventSeq: Math.max(state.eventSeq + 1, event.seq || 0),
      };

      nextState.currentOODAPhase = classifyOODAPhase(nextState);
      nextState.cognitiveLoadScore = calculateCognitiveLoad(nextState);

      return nextState;
    }

    default:
      return state;
  }
}

export function useIncidentState(
  initialState?: Partial<IncidentState>
): UseIncidentStateReturn {
  const [state, dispatch] = useReducer(incidentReducer, {
    ...INITIAL_INCIDENT_STATE,
    ...initialState,
  });

  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const processEvent = useCallback((event: RTMDashboardEvent) => {
    if (event.id) {
      if (processedEventIdsRef.current.has(event.id)) {
        return; // Skip duplicate event silently
      }
      processedEventIdsRef.current.add(event.id);
      if (processedEventIdsRef.current.size > 1000) {
        const oldest = processedEventIdsRef.current.values().next().value;
        if (oldest) processedEventIdsRef.current.delete(oldest);
      }
    }

    dispatch({ type: 'PROCESS_RTM_EVENT', event });
  }, []);

  const resolveIncident = useCallback(() => {
    dispatch({ type: 'RESOLVE_INCIDENT' });
  }, []);

  const claimIC = useCallback((uid: string) => {
    dispatch({ type: 'CLAIM_IC', uid });
  }, []);

  const releaseIC = useCallback(() => {
    dispatch({ type: 'RELEASE_IC' });
  }, []);

  const updateActionStatus = useCallback(
    (actionId: string, newStatus: ActionStatus) => {
      dispatch({ type: 'UPDATE_ACTION_STATUS', actionId, newStatus });
    },
    []
  );

  const dispatchStateUpdate = useCallback(
    (update: Record<string, unknown>) => {
      dispatch({ type: 'DISPATCH_STATE_UPDATE', update });
    },
    []
  );

  return {
    state,
    processEvent,
    dispatchStateUpdate,
    resolveIncident,
    claimIC,
    releaseIC,
    updateActionStatus,
  };
}
