import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIncidentState } from '@/hooks/useIncidentState';
import { RTMDashboardEvent } from '@/lib/types';
import { DEMO_EVENTS, startMockReplay } from '@/lib/mockReplay';
import { CONFIDENCE_CAP } from '@/lib/constants';

let seqCounter = 0;
function makeRTMEvent(
  eventType: RTMDashboardEvent['eventType'],
  payload: Record<string, unknown>,
  id?: string
): RTMDashboardEvent {
  seqCounter += 1;
  return {
    type: 'dashboard_event',
    id: id || `rtm-${seqCounter}`,
    seq: seqCounter,
    timestamp: Date.now(),
    eventType,
    payload,
  };
}

describe('Automated End-to-End Incident Lifecycle Integration Test (WI-1006)', () => {
  describe('Full 6-Beat Incident State Simulation', () => {
    it('progresses through Lobby -> Ingestion -> Contradiction -> Action -> Strikethrough -> Resolution', () => {
      const { result } = renderHook(() => useIncidentState());

      // ----------------------------------------------------
      // Initial State Checks
      // ----------------------------------------------------
      expect(result.current.state.incidentId).toBe('INC-4821');
      expect(result.current.state.status).toBe('investigating');
      expect(result.current.state.currentOODAPhase).toBe('OBSERVE');
      expect(result.current.state.evidenceItems).toHaveLength(0);
      expect(Object.keys(result.current.state.participants)).toHaveLength(0);

      // ====================================================
      // BEAT 1: Bridge Initiation & Participants Join
      // ====================================================
      act(() => {
        result.current.processEvent(
          makeRTMEvent('participant_joined', {
            uid: 'sarah_oncall',
            displayName: 'Sarah Chen',
            role: 'Incident Commander',
          }, 'p-1')
        );
        result.current.processEvent(
          makeRTMEvent('participant_joined', {
            uid: 'marcus_devops',
            displayName: 'Marcus Vance',
            role: 'Senior SRE',
          }, 'p-2')
        );
        result.current.processEvent(
          makeRTMEvent('participant_joined', {
            uid: 'priya_pm',
            displayName: 'Priya Sharma',
            role: 'Product Lead',
          }, 'p-3')
        );
        result.current.processEvent(
          makeRTMEvent('participant_joined', {
            uid: 'aura_agent',
            displayName: 'AURA',
            role: 'AI Incident Commander',
          }, 'p-4')
        );
        result.current.claimIC('sarah_oncall');
      });

      expect(Object.keys(result.current.state.participants)).toHaveLength(4);
      expect(result.current.state.incidentCommanderUid).toBe('sarah_oncall');
      expect(result.current.state.participants['sarah_oncall'].isIncidentCommander).toBe(true);
      expect(result.current.state.currentOODAPhase).toBe('OBSERVE');

      // ====================================================
      // BEAT 2: Shadow Monitor & Telemetry Fact Gathering
      // ====================================================
      act(() => {
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'evt-1',
            category: 'fact',
            content: 'Checkout API 500 error rate surged to 42%',
            speakerUid: 'marcus_devops',
            speakerName: 'Marcus Vance',
            confidence: 95, // Test that confidence gets capped
          }, 'evt-1')
        );
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'evt-2',
            category: 'fact',
            content: 'Postgres primary CPU utilization normal at 18%',
            speakerUid: 'marcus_devops',
            speakerName: 'Marcus Vance',
            confidence: 85,
          }, 'evt-2')
        );
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'evt-3',
            category: 'fact',
            content: 'Connection pool active count at 98/100',
            speakerUid: 'sarah_oncall',
            speakerName: 'Sarah Chen',
            confidence: 80,
          }, 'evt-3')
        );
      });

      expect(result.current.state.evidenceItems).toHaveLength(3);
      // Verify confidence capped at CONFIDENCE_CAP (85)
      expect(result.current.state.evidenceItems[0].confidence).toBe(CONFIDENCE_CAP);
      expect(result.current.state.evidenceItems.every((e) => e.category === 'fact')).toBe(true);
      expect(result.current.state.currentOODAPhase).toBe('OBSERVE');
      const baselineCogLoad = result.current.state.cognitiveLoadScore;

      // ====================================================
      // BEAT 3: The Contradiction (Dual Hypotheses & Conflict Flag)
      // ====================================================
      act(() => {
        // Marcus's DB connection hypothesis
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'hyp-1',
            category: 'hypothesis',
            content: 'Postgres connection pool exhaustion caused by unindexed query',
            speakerUid: 'marcus_devops',
            speakerName: 'Marcus Vance',
            confidence: 80,
            status: 'active',
          }, 'hyp-1')
        );
        // Sarah's ALB timeout hypothesis
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'hyp-2',
            category: 'hypothesis',
            content: 'AWS ALB SSL handshake timeout cascading into gateway errors',
            speakerUid: 'sarah_oncall',
            speakerName: 'Sarah Chen',
            confidence: 70,
            status: 'active',
          }, 'hyp-2')
        );
        // AURA flags contradiction conflict
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'conf-1',
            category: 'conflict',
            content: 'Hypothesis clash: DB Connection Pool vs AWS ALB SSL Timeout',
            speakerUid: 'aura_agent',
            speakerName: 'AURA',
            confidence: 85,
            decidingMetric: 'Active DB Connection Count',
            hypothesisA: 'Postgres connection pool exhaustion',
            hypothesisB: 'AWS ALB SSL handshake timeout',
            speakerAUid: 'marcus_devops',
            speakerBUid: 'sarah_oncall',
            status: 'active',
          }, 'conf-1')
        );
      });

      expect(result.current.state.evidenceItems).toHaveLength(6);
      const activeHypotheses = result.current.state.evidenceItems.filter(
        (e) => e.category === 'hypothesis' && e.status === 'active'
      );
      expect(activeHypotheses).toHaveLength(2);

      const activeConflicts = result.current.state.evidenceItems.filter(
        (e) => e.category === 'conflict' && e.status === 'active'
      );
      expect(activeConflicts).toHaveLength(1);

      // Cognitive load must surge due to unresolved hypotheses and conflicts
      expect(result.current.state.cognitiveLoadScore).toBeGreaterThan(baselineCogLoad);
      // OODA phase shifts to ORIENT because hypotheses/conflicts exist without decisions
      expect(result.current.state.currentOODAPhase).toBe('ORIENT');

      // ====================================================
      // BEAT 4: Two-Phase Commit & External Actions (Jira / Slack)
      // ====================================================
      act(() => {
        // IC Decision
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'dec-1',
            category: 'decision',
            content: 'Authorize mitigation: scale connection pool size to 250 and restart pooler',
            speakerUid: 'sarah_oncall',
            speakerName: 'Sarah Chen',
            confidence: 85,
            status: 'confirmed',
          }, 'dec-1')
        );
        // Remediation Action
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'act-1',
            category: 'action',
            content: 'Restart checkout service pods with expanded pool configuration',
            speakerUid: 'sarah_oncall',
            speakerName: 'Sarah Chen',
            assignedTo: 'Marcus Vance',
            actionStatus: 'pending',
            eta: 300,
            status: 'active',
          }, 'act-1')
        );
        // External Tool: Jira Ticket Creation
        result.current.processEvent(
          makeRTMEvent('evidence_added', {
            id: 'act-2',
            category: 'action',
            content: 'Created Jira incident ticket INC-4821 [P1 - Critical Outage]',
            speakerUid: 'aura_agent',
            speakerName: 'AURA',
            assignedTo: 'Marcus Vance',
            actionStatus: 'done',
            status: 'confirmed',
          }, 'act-2')
        );
      });

      expect(result.current.state.evidenceItems).toHaveLength(9);
      const decisions = result.current.state.evidenceItems.filter((e) => e.category === 'decision');
      expect(decisions).toHaveLength(1);
      // OODA phase advances to ACT with active decisions/actions
      expect(result.current.state.currentOODAPhase).toBe('ACT');

      // ====================================================
      // BEAT 5: The Strikethrough (Hypothesis Confirmation & Rejection)
      // ====================================================
      act(() => {
        result.current.dispatchStateUpdate({
          confirmHypothesis: 'hyp-1',
          disproveHypothesis: 'hyp-2',
          resolveConflict: 'conf-1',
          completeAction: ['act-1'],
        });
      });

      const confirmedHyp = result.current.state.evidenceItems.find((e) => e.id === 'hyp-1');
      const disprovenHyp = result.current.state.evidenceItems.find((e) => e.id === 'hyp-2');
      const resolvedConf = result.current.state.evidenceItems.find((e) => e.id === 'conf-1');
      const completedAction = result.current.state.evidenceItems.find((e) => e.id === 'act-1');

      expect(confirmedHyp?.status).toBe('confirmed');
      expect(disprovenHyp?.status).toBe('disproven');
      expect(resolvedConf?.status).toBe('disproven'); // marked disproven when resolved
      expect(completedAction?.actionStatus).toBe('done');

      // ====================================================
      // BEAT 6: Incident Resolution & Postmortem Data Integrity
      // ====================================================
      act(() => {
        result.current.resolveIncident();
      });

      expect(result.current.state.status).toBe('resolved');
      expect(result.current.state.currentOODAPhase).toBe('RESOLVED');
      expect(result.current.state.resolvedAt).toBeDefined();
      expect(result.current.state.resolvedAt).toBeGreaterThan(0);

      // Verify all actions marked done upon resolution
      const allActions = result.current.state.evidenceItems.filter((e) => e.category === 'action');
      expect(allActions.every((a) => a.actionStatus === 'done')).toBe(true);

      // Verify final SRE Debrief Data Integrity
      const finalState = result.current.state;
      const rootCause = finalState.evidenceItems.find(
        (e) => e.category === 'hypothesis' && e.status === 'confirmed'
      );
      expect(rootCause).toBeDefined();
      expect(rootCause?.content).toContain('Postgres connection pool exhaustion');

      const disprovenTheories = finalState.evidenceItems.filter(
        (e) => e.category === 'hypothesis' && e.status === 'disproven'
      );
      expect(disprovenTheories).toHaveLength(1);
      expect(disprovenTheories[0].content).toContain('AWS ALB SSL handshake timeout');

      const facts = finalState.evidenceItems.filter((e) => e.category === 'fact');
      expect(facts).toHaveLength(3);
    });
  });

  describe('Demo Replay Scenario Multi-Beat Execution', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('replays all 6 scenario beats with speed multiplier and triggers celebration', () => {
      const events: RTMDashboardEvent[] = [];
      const updates: Array<Record<string, unknown>> = [];
      const speechTurns: Array<{ speaker: string; text: string }> = [];
      let celebrated = false;

      const onEvent = (evt: RTMDashboardEvent) => {
        events.push(evt);
      };

      const onUpdate = (update: Record<string, unknown>) => {
        updates.push(update);
      };

      const onSpeech = (speaker: string | null, text: string) => {
        speechTurns.push({ speaker: speaker || 'AURA', text });
      };

      const onCelebration = () => {
        celebrated = true;
      };

      // Verify DEMO_EVENTS structure
      expect(DEMO_EVENTS.length).toBeGreaterThanOrEqual(15);
      expect(DEMO_EVENTS.every((e) => typeof e.delayMs === 'number')).toBe(true);

      // Start the replay at 10x speed
      const cleanup = startMockReplay(onEvent, onUpdate, {
        speedMultiplier: 10,
        onSpeech,
        onCelebration,
      });

      // 4 participant_joined events + 1 ic_claimed dispatched synchronously
      expect(events).toHaveLength(5);
      expect(events.map((e) => e.eventType)).toContain('participant_joined');
      expect(events.map((e) => e.eventType)).toContain('ic_claimed');

      // Fast forward all timers to execute the entire script
      act(() => {
        vi.runAllTimers();
      });

      // Assert event ingestion
      expect(events.length).toBeGreaterThanOrEqual(12);
      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(speechTurns.length).toBeGreaterThanOrEqual(4);
      expect(celebrated).toBe(true);

      // Assert specific tool events occurred
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain('evidence_added');

      cleanup();
    });
  });
});
