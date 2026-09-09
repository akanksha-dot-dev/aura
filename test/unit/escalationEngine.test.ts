import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateEscalation,
  formatSlackIncidentCard,
  formatResolutionNotification,
  acknowledgeEscalation,
  clearEscalationRecord,
  checkSeverityBump,
  generateEscalationSpeech,
  getEscalationRecord,
} from '@/lib/escalationEngine';
import type { IncidentState } from '@/lib/types';

function createMockState(overrides: Partial<IncidentState> = {}): IncidentState {
  const now = Date.now();
  return {
    incidentId: 'inc-test-001',
    title: 'Test Incident',
    severity: 'SEV-1',
    status: 'investigating',
    openedAt: now - 60_000 * 30, // 30 minutes ago
    affectedServices: ['payment-api', 'checkout-service'],
    participants: {
      sarah_ic: {
        uid: 'sarah_ic',
        displayName: 'Sarah Chen',
        role: 'Incident Commander',
        isIncidentCommander: true,
        joinedAt: now - 60_000 * 30,
        totalSpeakingMs: 45000,
        lastSpokeAt: now - 25000,
      },
    },
    incidentCommanderUid: 'sarah_ic',
    evidenceItems: [],
    eventSeq: 0,
    currentOODAPhase: 'OBSERVE',
    costAccrued: 0,
    cognitiveLoadScore: 40,
    lastReadbackAt: 0,
    ...overrides,
  };
}

describe('Escalation Engine', () => {
  beforeEach(() => {
    clearEscalationRecord('inc-test-001');
  });

  describe('evaluateEscalation', () => {
    it('should skip escalation for resolved incidents', () => {
      const state = createMockState({ status: 'resolved' });
      const result = evaluateEscalation(state);
      expect(result.action).toBe('skipped');
      expect(result.message).toContain('resolved');
    });

    it('should skip escalation if not past the page threshold', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 5 * 60_000, // 5 minutes ago (threshold is 15m)
      });
      const result = evaluateEscalation(state);
      expect(result.action).toBe('skipped');
      expect(result.message).toContain('not due yet');
    });

    it('should escalate when past threshold and no recent evidence', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 20 * 60_000, // 20 minutes ago (threshold 15m)
        evidenceItems: [],
      });
      const result = evaluateEscalation(state);
      expect(result.action).toBe('escalated');
      expect(result.notification).toBeDefined();
      expect(result.notification?.blocks.length).toBeGreaterThan(0);
    });

    it('should skip re-escalation if recently escalated (cooldown)', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 20 * 60_000,
      });
      // First escalation
      const first = evaluateEscalation(state);
      expect(first.action).toBe('escalated');

      // Second attempt should be on cooldown
      const second = evaluateEscalation(state);
      expect(second.action).toBe('cooldown');
    });

    it('should skip if escalation has been acknowledged', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 20 * 60_000,
      });
      evaluateEscalation(state);
      acknowledgeEscalation('inc-test-001', 'admin');

      const result = evaluateEscalation(state);
      expect(result.action).toBe('skipped');
      expect(result.message).toContain('acknowledged');
    });

    it('should bump severity when SLA threshold is exceeded', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 65 * 60_000, // 65 minutes (SEV-1 bump at 60m)
      });
      const result = evaluateEscalation(state);
      expect(result.action).toBe('bumped');
      expect(result.newSeverity).toBe('SEV-0');
    });
  });

  describe('checkSeverityBump', () => {
    it('should return null for SEV-0 (cannot bump higher)', () => {
      expect(checkSeverityBump('SEV-0', 100)).toBeNull();
    });

    it('should return SEV-0 when SEV-1 exceeds threshold', () => {
      expect(checkSeverityBump('SEV-1', 65)).toBe('SEV-0');
    });

    it('should return null when under threshold', () => {
      expect(checkSeverityBump('SEV-1', 30)).toBeNull();
    });

    it('should bump SEV-3 to SEV-2', () => {
      expect(checkSeverityBump('SEV-3', 500)).toBe('SEV-2');
    });
  });

  describe('acknowledgeEscalation', () => {
    it('should return false for non-existent record', () => {
      expect(acknowledgeEscalation('nonexistent', 'admin')).toBe(false);
    });

    it('should successfully acknowledge existing escalation', () => {
      const state = createMockState({
        severity: 'SEV-1',
        openedAt: Date.now() - 20 * 60_000,
      });
      evaluateEscalation(state);

      const result = acknowledgeEscalation('inc-test-001', 'admin');
      expect(result).toBe(true);

      const record = getEscalationRecord('inc-test-001');
      expect(record?.acknowledgedBy).toBe('admin');
      expect(record?.acknowledgedAt).toBeGreaterThan(0);
    });
  });

  describe('formatSlackIncidentCard', () => {
    it('should produce valid Slack blocks with all required sections', () => {
      const state = createMockState();
      const notification = formatSlackIncidentCard(state, 'Test reason', 'https://aura.test/join');

      expect(notification.text).toContain('SEV-1');
      expect(notification.text).toContain('Test Incident');
      expect(notification.blocks.length).toBeGreaterThanOrEqual(4);

      // Should include header, reason, fields, and join button
      const types = notification.blocks.map(b => b.type);
      expect(types).toContain('header');
      expect(types).toContain('section');
      expect(types).toContain('context');
    });

    it('should include emoji per severity', () => {
      const sev0State = createMockState({ severity: 'SEV-0' });
      const sev0 = formatSlackIncidentCard(sev0State, 'reason');
      expect(sev0.text).toContain('🔴');

      const sev2State = createMockState({ severity: 'SEV-2' });
      const sev2 = formatSlackIncidentCard(sev2State, 'reason');
      expect(sev2.text).toContain('🟡');
    });
  });

  describe('formatResolutionNotification', () => {
    it('should format resolution with MTTR and root cause', () => {
      const state = createMockState({ status: 'resolved' });
      const notification = formatResolutionNotification(state, 45, 'Database connection pool exhaustion');

      expect(notification.text).toContain('RESOLVED');
      expect(notification.text).toContain('45m');
    });
  });

  describe('generateEscalationSpeech', () => {
    it('should generate speech for bump action', () => {
      const state = createMockState();
      const speech = generateEscalationSpeech(
        { action: 'bumped', message: 'Bumped', newSeverity: 'SEV-0' },
        state,
      );
      expect(speech).toContain('auto-escalated');
      expect(speech).toContain('SEV-0');
    });

    it('should generate speech for escalated action', () => {
      const state = createMockState();
      const speech = generateEscalationSpeech(
        { action: 'escalated', message: 'Escalated' },
        state,
      );
      expect(speech).toContain('escalation notification');
    });

    it('should return empty string for non-actionable results', () => {
      const state = createMockState();
      const speech = generateEscalationSpeech(
        { action: 'skipped', message: 'Skip' },
        state,
      );
      expect(speech).toBe('');
    });
  });
});
