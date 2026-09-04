import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEMO_EVENTS, startMockReplay } from '@/lib/mockReplay';
import { RTMDashboardEvent } from '@/lib/types';

describe('Mock Replay Simulation Engine (lib/mockReplay.ts)', () => {
  describe('DEMO_EVENTS Scenario Integrity', () => {
    it('contains a comprehensive multi-beat incident scenario', () => {
      expect(DEMO_EVENTS.length).toBeGreaterThanOrEqual(15);
    });

    it('maintains non-negative delay timings for all events', () => {
      DEMO_EVENTS.forEach((evt) => {
        expect(evt.delayMs).toBeGreaterThan(0);
      });
    });

    it('contains all required event types throughout the scenario', () => {
      const types = new Set(DEMO_EVENTS.map((e) => e.type));
      expect(types.has('agent_greeting')).toBe(true);
      expect(types.has('human_speech')).toBe(true);
      expect(types.has('tool_call')).toBe(true);
      expect(types.has('state_update')).toBe(true);
    });

    it('references valid MCP tools for all tool call events', () => {
      const validTools = [
        'log_fact',
        'log_hypothesis',
        'log_decision',
        'log_action_item',
        'flag_conflict',
        'create_jira_ticket',
        'post_slack_update',
        'page_oncall_team',
      ];

      const toolEvents = DEMO_EVENTS.filter((e) => e.type === 'tool_call');
      toolEvents.forEach((e) => {
        if (e.type === 'tool_call') {
          expect(validTools).toContain(e.tool);
          expect(e.params).toBeDefined();
        }
      });
    });
  });

  describe('startMockReplay Execution', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('executes scenario and dispatches events accurately at scaled time', () => {
      const processedEvents: RTMDashboardEvent[] = [];
      const dispatchedUpdates: Array<Record<string, unknown>> = [];
      const speechLog: string[] = [];
      let celebrated = false;

      const processEvent = (evt: RTMDashboardEvent) => {
        processedEvents.push(evt);
      };

      const dispatchStateUpdate = (update: Record<string, unknown>) => {
        dispatchedUpdates.push(update);
      };

      // Start replay with 10x speed multiplier
      const cleanup = startMockReplay(processEvent, dispatchStateUpdate, {
        speedMultiplier: 10,
        onSpeech: (_speaker, text) => {
          speechLog.push(text);
        },
        onCelebration: () => {
          celebrated = true;
        },
      });

      // 4 participant_joined events + 1 ic_claimed event dispatched synchronously on start
      expect(processedEvents).toHaveLength(5);

      // Advance timers to complete entire scenario
      vi.advanceTimersByTime(60_000);

      expect(processedEvents.length).toBeGreaterThanOrEqual(5);
      expect(dispatchedUpdates.length).toBeGreaterThanOrEqual(1);
      expect(speechLog.length).toBeGreaterThanOrEqual(3);
      expect(celebrated).toBe(true);

      cleanup();
    });
  });
});
