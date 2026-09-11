import { describe, it, expect } from 'vitest';
import {
  AURA_SYSTEM_PROMPT,
  buildDynamicIncidentContext,
  buildEffectiveSystemPrompt,
  formatElapsedTime,
} from '@/lib/promptBuilder';
import { IncidentState } from '@/lib/types';

describe('promptBuilder unit tests', () => {
  it('formats elapsed time into human readable minutes and seconds', () => {
    expect(formatElapsedTime(0)).toBe('0m 00s');
    expect(formatElapsedTime(65000)).toBe('1m 05s');
    expect(formatElapsedTime(360000)).toBe('6m 00s');
  });

  it('contains core responsive voice rules and SBAR directives', () => {
    expect(AURA_SYSTEM_PROMPT).toContain('DIRECTIVE 1: SHADOW MONITOR MODE & CONVERSATIONAL ENGAGEMENT');
    expect(AURA_SYSTEM_PROMPT).toContain('SOLO OPERATOR BRIDGE (DEFAULT / TESTING)');
    expect(AURA_SYSTEM_PROMPT).toContain('ACTIVE CO-PILOT MODE');
    expect(AURA_SYSTEM_PROMPT).toContain('DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE');
    expect(AURA_SYSTEM_PROMPT).toContain('CAPABILITIES & VOICE-QUERYABLE TOOLS');
    expect(AURA_SYSTEM_PROMPT).toContain('REAL-TIME TELEMETRY PROTOCOL (MACHINE-READABLE SYNC)');
    expect(AURA_SYSTEM_PROMPT).toContain('[LOG_FACT:');
    expect(AURA_SYSTEM_PROMPT).toContain('[LOG_HYPOTHESIS:');
    expect(AURA_SYSTEM_PROMPT).toContain('[LOG_CONFLICT:');
    expect(AURA_SYSTEM_PROMPT).toContain('[RESOLVE_CONFLICT:');
    expect(AURA_SYSTEM_PROMPT).toContain('[COMPLETE_ACTION:');
    expect(AURA_SYSTEM_PROMPT).toContain('OPERATIONAL ROLE & COMMAND EXECUTION BOUNDARY');
    expect(AURA_SYSTEM_PROMPT).toContain('ADVISORY Voice Incident Commander');
  });

  it('buildDynamicIncidentContext correctly builds solo operator mode context', () => {
    const now = Date.now();
    const mockState: IncidentState = {
      incidentId: 'inc-test-101',
      title: 'Payment Gateway Outage',
      severity: 'SEV-1',
      status: 'investigating',
      openedAt: now - 120_000,
      affectedServices: ['payment-api', 'checkout-service'],
      participants: {
        aura_agent: {
          uid: 'aura_agent',
          displayName: 'AURA',
          role: 'AI Incident Commander',
          isIncidentCommander: false,
          joinedAt: now - 120_000,
          totalSpeakingMs: 0,
          lastSpokeAt: now - 120_000,
        },
        solo_user: {
          uid: 'solo_user',
          displayName: 'Alex SRE',
          role: 'Lead SRE',
          isIncidentCommander: true,
          joinedAt: now - 120_000,
          totalSpeakingMs: 0,
          lastSpokeAt: now - 10_000,
        },
      },
      incidentCommanderUid: 'solo_user',
      evidenceItems: [
        {
          id: 'ev-1',
          category: 'fact',
          content: 'Checkout error rate is 45%',
          speakerUid: 'solo_user',
          speakerName: 'Alex SRE',
          confidence: 85,
          timestamp: now - 90_000,
          serviceAffected: 'checkout-service',
          relatedTo: [],
          status: 'confirmed',
        },
        {
          id: 'ev-2',
          category: 'hypothesis',
          content: 'Database connection starvation',
          speakerUid: 'solo_user',
          speakerName: 'Alex SRE',
          confidence: 75,
          timestamp: now - 60_000,
          serviceAffected: 'postgres-primary',
          relatedTo: ['ev-1'],
          status: 'active',
          decidingMetric: 'pg_stat_activity count',
        },
        {
          id: 'ev-3',
          category: 'action',
          content: 'Scale read replicas',
          speakerUid: 'solo_user',
          speakerName: 'Alex SRE',
          confidence: 80,
          timestamp: now - 30_000,
          assignedTo: 'Alex SRE',
          actionStatus: 'in_progress',
          relatedTo: ['ev-2'],
          status: 'confirmed',
        },
      ],
      eventSeq: 3,
      currentOODAPhase: 'ORIENT',
      costAccrued: 24000,
      cognitiveLoadScore: 45,
      lastReadbackAt: now - 30_000,
    };

    const context = buildDynamicIncidentContext(mockState, 'solo_user');
    expect(context).toContain('Payment Gateway Outage');
    expect(context).toContain('SEV-1');
    expect(context).toContain('IC: Alex SRE');
    expect(context).toContain('Active Responders on Bridge: Alex SRE');
    expect(context).toContain('Bridge Mode: 1-on-1 Solo Session');
    expect(context).toContain('Facts: 1 | Active Hypotheses: 1 | Decisions: 0 | Pending Actions: 1');
    expect(context).toContain('Checkout error rate is 45%');
    expect(context).toContain('Database connection starvation');
    expect(context).toContain('Scale read replicas → Alex SRE (in_progress)');
  });

  it('buildEffectiveSystemPrompt combines prompt, scenario briefing and live situation', () => {
    const now = Date.now();
    const mockState: IncidentState = {
      incidentId: 'inc-test-202',
      title: 'CDN Edge Storm',
      severity: 'SEV-2',
      status: 'investigating',
      openedAt: now,
      affectedServices: ['cdn-edge'],
      participants: {
        aura_agent: {
          uid: 'aura_agent',
          displayName: 'AURA',
          role: 'AI Incident Commander',
          isIncidentCommander: false,
          joinedAt: now,
          totalSpeakingMs: 0,
          lastSpokeAt: now,
        },
      },
      incidentCommanderUid: null,
      evidenceItems: [],
      eventSeq: 0,
      currentOODAPhase: 'OBSERVE',
      costAccrued: 0,
      cognitiveLoadScore: 0,
      lastReadbackAt: 0,
    };

    const scenario = {
      title: 'CDN Edge Cache Storm',
      severity: 'SEV-2',
      affectedServices: ['cdn-edge', 'varnish'],
      description: 'Global cache flush caused traffic storm on origin servers.',
      impact: 'Origin latencies spiked to 8 seconds.',
      suspectedCause: 'Automated deployment purged edge tier.',
      personas: [
        { uid: 'sarah_ic', displayName: 'Sarah Chen', role: 'Incident Commander' },
      ],
    };

    const prompt = buildEffectiveSystemPrompt({
      incidentState: mockState,
      scenario,
      operatorUid: 'operator_1',
    });

    expect(prompt).toContain('CDN Edge Cache Storm');
    expect(prompt).toContain('Global cache flush caused traffic storm');
    expect(prompt).toContain('On-Call Engineering Directory (Offline Stakeholders): Sarah Chen (Incident Commander)');
    expect(prompt).toContain('CURRENT INCIDENT SITUATION & REAL-TIME CONTEXT');
    expect(prompt).toContain('DIRECTIVE 1: SHADOW MONITOR MODE');
  });

  it('injects tactical playbook runbook steps and command citations into the prompt', () => {
    const now = Date.now();
    const mockState: IncidentState = {
      incidentId: 'inc-test-runbook',
      title: 'Payment Gateway Outage',
      severity: 'SEV-1',
      status: 'investigating',
      openedAt: now,
      affectedServices: ['payment-api', 'postgres-primary'],
      participants: {},
      incidentCommanderUid: null,
      evidenceItems: [],
      eventSeq: 0,
      currentOODAPhase: 'OBSERVE',
      costAccrued: 0,
      cognitiveLoadScore: 0,
      lastReadbackAt: 0,
    };

    const scenario = {
      title: 'Payment Gateway Outage',
      severity: 'SEV-1',
      affectedServices: ['payment-api', 'postgres-primary'],
      description: 'Checkout error rate spiked to 42%.',
      impact: '1,420 sessions failing.',
      suspectedCause: 'Database connection starvation.',
      personas: [],
      playbook: [
        {
          id: 'po-1',
          phase: 'diagnose',
          priority: 'critical',
          title: 'Check DB connection pool metrics',
          detail: 'Verify pool utilization and wait queue depth.',
          command: 'kubectl exec -it postgres-primary -- psql -c "SELECT count(*) FROM pg_stat_activity;"',
        },
        {
          id: 'po-4',
          phase: 'mitigate',
          priority: 'critical',
          title: 'Rollback PR #492',
          detail: 'Execute immediate rollback to restore connection headroom.',
          command: 'git revert HEAD --no-edit && git push origin main',
        },
      ],
    };

    const prompt = buildEffectiveSystemPrompt({
      incidentState: mockState,
      scenario,
    });

    expect(prompt).toContain('Tactical Runbook / Playbook Steps:');
    expect(prompt).toContain('[DIAGNOSE] Check DB connection pool metrics');
    expect(prompt).toContain('kubectl exec -it postgres-primary -- psql');
    expect(prompt).toContain('[MITIGATE] Rollback PR #492');
    expect(prompt).toContain('git revert HEAD --no-edit');
  });
});
