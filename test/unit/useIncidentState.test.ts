import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIncidentState, INITIAL_INCIDENT_STATE } from '@/hooks/useIncidentState';
import { RTMDashboardEvent } from '@/lib/types';

describe('useIncidentState Hook & Reducer (hooks/useIncidentState.ts)', () => {
  it('initializes with default incident state', () => {
    expect(INITIAL_INCIDENT_STATE.incidentId).toBe('INC-4821');
    const { result } = renderHook(() => useIncidentState());
    expect(result.current.state.incidentId).toBe('INC-4821');
    expect(result.current.state.status).toBe('investigating');
    expect(result.current.state.severity).toBe('SEV-1');
    expect(result.current.state.currentOODAPhase).toBe('OBSERVE');
    expect(result.current.state.incidentCommanderUid).toBeNull();
    expect(result.current.state.evidenceItems).toEqual([]);
    expect(result.current.state.cognitiveLoadScore).toBe(0);
  });

  describe('processEvent (RTM Dashboard Events)', () => {
    it('handles evidence_added event and auto-caps confidence at 85', () => {
      const { result } = renderHook(() => useIncidentState());
      const event: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-101',
        seq: 1,
        timestamp: Date.now(),
        eventType: 'evidence_added',
        payload: {
          id: 'evt-101',
          category: 'hypothesis',
          content: 'Database connection pool saturated',
          speakerUid: 'marcus_devops',
          speakerName: 'Marcus',
          confidence: 99, // Exceeds cap
          status: 'active',
        },
      };

      act(() => {
        result.current.processEvent(event);
      });

      expect(result.current.state.evidenceItems).toHaveLength(1);
      const item = result.current.state.evidenceItems[0];
      expect(item.id).toBe('evt-101');
      expect(item.category).toBe('hypothesis');
      expect(item.confidence).toBe(85); // Capped at CONFIDENCE_CAP
      expect(item.status).toBe('active');
      expect(result.current.state.cognitiveLoadScore).toBe(15); // 1 active hypothesis = 15
      expect(result.current.state.currentOODAPhase).toBe('ORIENT');
    });

    it('deduplicates events with identical event IDs', () => {
      const { result } = renderHook(() => useIncidentState());
      const event: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-dup-1',
        seq: 1,
        timestamp: Date.now(),
        eventType: 'evidence_added',
        payload: {
          id: 'item-dup-1',
          category: 'fact',
          content: 'Latency at 420ms',
          speakerUid: 'marcus_devops',
        },
      };

      act(() => {
        result.current.processEvent(event);
        result.current.processEvent(event); // duplicate
      });

      expect(result.current.state.evidenceItems).toHaveLength(1);
    });

    it('handles evidence_updated event', () => {
      const { result } = renderHook(() => useIncidentState());
      const addEvent: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-up-1',
        seq: 1,
        timestamp: Date.now(),
        eventType: 'evidence_added',
        payload: {
          id: 'item-up-1',
          category: 'hypothesis',
          content: 'Memory leak in worker pool',
          speakerUid: 'marcus_devops',
          status: 'active',
        },
      };
      act(() => {
        result.current.processEvent(addEvent);
      });
      expect(result.current.state.evidenceItems[0].status).toBe('active');

      const updateEvent: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-up-2',
        seq: 2,
        timestamp: Date.now(),
        eventType: 'evidence_updated',
        payload: {
          id: 'item-up-1',
          status: 'confirmed',
        },
      };
      act(() => {
        result.current.processEvent(updateEvent);
      });

      expect(result.current.state.evidenceItems[0].status).toBe('confirmed');
    });

    it('handles participant_joined and participant_left events', () => {
      const { result } = renderHook(() => useIncidentState());
      const joinEvent: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-join-1',
        seq: 1,
        timestamp: Date.now(),
        eventType: 'participant_joined',
        payload: {
          uid: 'priya_lead',
          displayName: 'Priya',
          role: 'Product Manager',
        },
      };

      act(() => {
        result.current.processEvent(joinEvent);
      });
      expect(result.current.state.participants['priya_lead']).toBeDefined();
      expect(result.current.state.participants['priya_lead'].displayName).toBe('Priya');

      const leaveEvent: RTMDashboardEvent = {
        type: 'dashboard_event',
        id: 'evt-leave-1',
        seq: 2,
        timestamp: Date.now(),
        eventType: 'participant_left',
        payload: {
          uid: 'priya_lead',
        },
      };
      act(() => {
        result.current.processEvent(leaveEvent);
      });
      expect(result.current.state.participants['priya_lead']).toBeUndefined();
    });

    it('handles ic_claimed and ic_released events', () => {
      const { result } = renderHook(() => useIncidentState());
      // Join participant first
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'p-join',
          seq: 1,
          timestamp: Date.now(),
          eventType: 'participant_joined',
          payload: { uid: 'sarah_oncall', displayName: 'Sarah', role: 'Incident Commander' },
        });
      });

      // Claim IC
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'ic-claim',
          seq: 2,
          timestamp: Date.now(),
          eventType: 'ic_claimed',
          payload: { uid: 'sarah_oncall' },
        });
      });
      expect(result.current.state.incidentCommanderUid).toBe('sarah_oncall');
      expect(result.current.state.participants['sarah_oncall'].isIncidentCommander).toBe(true);

      // Release IC
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'ic-rel',
          seq: 3,
          timestamp: Date.now(),
          eventType: 'ic_released',
          payload: {},
        });
      });
      expect(result.current.state.incidentCommanderUid).toBeNull();
      expect(result.current.state.participants['sarah_oncall'].isIncidentCommander).toBe(false);
    });

    it('handles action_status_changed event', () => {
      const { result } = renderHook(() => useIncidentState());
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'act-add',
          seq: 1,
          timestamp: Date.now(),
          eventType: 'evidence_added',
          payload: {
            id: 'act-1',
            category: 'action',
            content: 'Scale read replicas to 10',
            actionStatus: 'pending',
          },
        });
      });
      expect(result.current.state.evidenceItems[0].actionStatus).toBe('pending');
      expect(result.current.state.cognitiveLoadScore).toBe(10); // 1 pending action = 10

      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'act-chg',
          seq: 2,
          timestamp: Date.now(),
          eventType: 'action_status_changed',
          payload: {
            actionId: 'act-1',
            actionStatus: 'done',
          },
        });
      });
      expect(result.current.state.evidenceItems[0].actionStatus).toBe('done');
      expect(result.current.state.cognitiveLoadScore).toBe(0); // done actions don't add load
    });
  });

  describe('dispatchStateUpdate', () => {
    it('confirms and disproves hypotheses via dispatchStateUpdate', () => {
      const { result } = renderHook(() => useIncidentState());
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'h-1',
          seq: 1,
          timestamp: Date.now(),
          eventType: 'evidence_added',
          payload: { id: 'hypo-1', category: 'hypothesis', content: 'DNS failure', status: 'active' },
        });
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'h-2',
          seq: 2,
          timestamp: Date.now(),
          eventType: 'evidence_added',
          payload: { id: 'hypo-2', category: 'hypothesis', content: 'DB lock', status: 'active' },
        });
      });

      // Disprove hypo-1 and Confirm hypo-2
      act(() => {
        result.current.dispatchStateUpdate({ disproveHypothesis: 'hypo-1' });
        result.current.dispatchStateUpdate({ confirmHypothesis: 'hypo-2' });
      });

      expect(result.current.state.evidenceItems.find((e) => e.id === 'hypo-1')?.status).toBe('disproven');
      expect(result.current.state.evidenceItems.find((e) => e.id === 'hypo-2')?.status).toBe('confirmed');
    });

    it('completes actions and auto-resolves pending actions when incident status is set to resolved', () => {
      const { result } = renderHook(() => useIncidentState());
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'a-1',
          seq: 1,
          timestamp: Date.now(),
          eventType: 'evidence_added',
          payload: { id: 'act-10', category: 'action', content: 'Drain node 4', actionStatus: 'pending' },
        });
      });

      act(() => {
        result.current.dispatchStateUpdate({ updateStatus: 'resolved' });
      });

      expect(result.current.state.status).toBe('resolved');
      expect(result.current.state.currentOODAPhase).toBe('RESOLVED');
      expect(result.current.state.resolvedAt).toBeDefined();
      expect(result.current.state.evidenceItems[0].actionStatus).toBe('done');
    });
  });

  describe('Direct Action Helpers (resolveIncident, claimIC, releaseIC, updateActionStatus)', () => {
    it('executes direct helpers accurately', () => {
      const { result } = renderHook(() => useIncidentState());
      act(() => {
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'p-sarah',
          seq: 1,
          timestamp: Date.now(),
          eventType: 'participant_joined',
          payload: { uid: 'sarah_oncall', displayName: 'Sarah' },
        });
        result.current.processEvent({
          type: 'dashboard_event',
          id: 'a-step',
          seq: 2,
          timestamp: Date.now(),
          eventType: 'evidence_added',
          payload: { id: 'step-1', category: 'action', content: 'Restart proxy', actionStatus: 'pending' },
        });
      });

      act(() => {
        result.current.claimIC('sarah_oncall');
      });
      expect(result.current.state.incidentCommanderUid).toBe('sarah_oncall');

      act(() => {
        result.current.updateActionStatus('step-1', 'in_progress');
      });
      expect(result.current.state.evidenceItems[0].actionStatus).toBe('in_progress');

      act(() => {
        result.current.releaseIC();
      });
      expect(result.current.state.incidentCommanderUid).toBeNull();

      act(() => {
        result.current.resolveIncident();
      });
      expect(result.current.state.status).toBe('resolved');
      expect(result.current.state.currentOODAPhase).toBe('RESOLVED');
    });
  });
});
