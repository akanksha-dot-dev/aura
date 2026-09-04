import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ClassificationType,
  HypothesisStatus,
  IncidentStatus,
  OODAPhase,
  ActionStatus,
  Severity,
  Participant,
  EvidenceItem,
  IncidentState,
  calculateCognitiveLoad,
  getDisplayConfidence,
  classifyOODAPhase,
  forceConfig,
} from '@/lib/types';

describe('Domain Model & Zod Validation Schemas (lib/types.ts)', () => {
  describe('Zod Enum Schemas', () => {
    it('validates ClassificationType enum values', () => {
      const validTypes = ['fact', 'hypothesis', 'decision', 'action', 'conflict'];
      validTypes.forEach((type) => {
        expect(ClassificationType.parse(type)).toBe(type);
      });
      expect(() => ClassificationType.parse('invalid_type')).toThrow();
    });

    it('validates HypothesisStatus enum values', () => {
      const validStatuses = ['active', 'confirmed', 'disproven', 'stale'];
      validStatuses.forEach((status) => {
        expect(HypothesisStatus.parse(status)).toBe(status);
      });
      expect(() => HypothesisStatus.parse('unknown')).toThrow();
    });

    it('validates IncidentStatus enum values', () => {
      const validStatuses = ['investigating', 'identified', 'monitoring', 'resolved'];
      validStatuses.forEach((status) => {
        expect(IncidentStatus.parse(status)).toBe(status);
      });
      expect(() => IncidentStatus.parse('closed')).toThrow();
    });

    it('validates OODAPhase enum values', () => {
      const validPhases = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT', 'RESOLVED'];
      validPhases.forEach((phase) => {
        expect(OODAPhase.parse(phase)).toBe(phase);
      });
      expect(() => OODAPhase.parse('EXECUTE')).toThrow();
    });

    it('validates ActionStatus enum values', () => {
      const validStatuses = ['pending', 'in_progress', 'done', 'blocked'];
      validStatuses.forEach((status) => {
        expect(ActionStatus.parse(status)).toBe(status);
      });
      expect(() => ActionStatus.parse('cancelled')).toThrow();
    });

    it('validates Severity enum values', () => {
      const validSeverities = ['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3'];
      validSeverities.forEach((sev) => {
        expect(Severity.parse(sev)).toBe(sev);
      });
      expect(() => Severity.parse('SEV-4')).toThrow();
    });
  });

  describe('Participant Schema', () => {
    it('validates a correct participant object', () => {
      const validParticipant = {
        uid: 'sarah_oncall',
        displayName: 'Sarah',
        role: 'Incident Commander',
        isIncidentCommander: true,
        joinedAt: Date.now(),
        totalSpeakingMs: 12500,
        lastSpokeAt: Date.now(),
      };
      const parsed = Participant.parse(validParticipant);
      expect(parsed.uid).toBe('sarah_oncall');
      expect(parsed.isIncidentCommander).toBe(true);
    });

    it('rejects invalid participant schema missing required fields', () => {
      expect(() => Participant.parse({ uid: 'sarah' })).toThrow();
    });
  });

  describe('EvidenceItem Schema & Confidence Capping (D-026)', () => {
    it('validates a valid EvidenceItem with confidence <= 85', () => {
      const validItem = {
        id: 'evt-001',
        category: 'fact',
        content: 'Database connection pool exhausted on node 4',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus',
        confidence: 85,
        timestamp: Date.now(),
      };
      const parsed = EvidenceItem.parse(validItem);
      expect(parsed.id).toBe('evt-001');
      expect(parsed.confidence).toBe(85);
      expect(parsed.status).toBe('active'); // default
      expect(parsed.relatedTo).toEqual([]); // default
    });

    it('enforces confidence cap: rejects confidence > 85 per D-026 safety boundary', () => {
      const invalidItem = {
        id: 'evt-002',
        category: 'hypothesis',
        content: 'Cache stampede causing latency spike',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus',
        confidence: 95, // Exceeds cap 85
        timestamp: Date.now(),
      };
      expect(() => EvidenceItem.parse(invalidItem)).toThrow();
    });
  });

  describe('IncidentState Schema', () => {
    it('validates a comprehensive incident state object', () => {
      const rawState = {
        incidentId: 'INC-4821',
        title: 'Payment Gateway Outage',
        severity: 'SEV-1',
        status: 'investigating',
        openedAt: Date.now(),
        affectedServices: ['payment-gateway', 'checkout'],
        participants: {
          sarah_oncall: {
            uid: 'sarah_oncall',
            displayName: 'Sarah',
            role: 'Incident Commander',
            isIncidentCommander: true,
            joinedAt: Date.now(),
            totalSpeakingMs: 5000,
            lastSpokeAt: Date.now(),
          },
        },
        incidentCommanderUid: 'sarah_oncall',
        evidenceItems: [],
      };
      const parsed = IncidentState.parse(rawState);
      expect(parsed.incidentId).toBe('INC-4821');
      expect(parsed.currentOODAPhase).toBe('OBSERVE');
      expect(parsed.cognitiveLoadScore).toBe(0);
      expect(parsed.eventSeq).toBe(0);
    });
  });

  describe('Sweller Cognitive Load Model (calculateCognitiveLoad)', () => {
    const createBaseState = (evidenceItems: EvidenceItem[]): IncidentState => ({
      incidentId: 'INC-4821',
      title: 'Payment Gateway Outage',
      severity: 'SEV-1',
      status: 'investigating',
      openedAt: Date.now(),
      affectedServices: ['payment-gateway'],
      participants: {},
      incidentCommanderUid: null,
      evidenceItems,
      eventSeq: 1,
      currentOODAPhase: 'OBSERVE',
      costAccrued: 0,
      cognitiveLoadScore: 0,
      lastReadbackAt: 0,
    });

    it('returns 0 when there are no active hypotheses, pending actions, or conflicts', () => {
      const state = createBaseState([
        {
          id: '1',
          category: 'fact',
          content: 'Error rate at 12%',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
        {
          id: '2',
          category: 'hypothesis',
          content: 'Network partition',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 70,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'disproven',
        },
      ]);
      expect(calculateCognitiveLoad(state)).toBe(0);
    });

    it('computes exact load: 2 active hypotheses (30) + 1 pending action (10) + 1 active conflict (25) = 65', () => {
      const state = createBaseState([
        {
          id: 'h1',
          category: 'hypothesis',
          content: 'H1',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 80,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
        {
          id: 'h2',
          category: 'hypothesis',
          content: 'H2',
          speakerUid: 'sarah',
          speakerName: 'Sarah',
          confidence: 75,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
        {
          id: 'a1',
          category: 'action',
          content: 'Rollback canary',
          speakerUid: 'sarah',
          speakerName: 'Sarah',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
          actionStatus: 'pending',
        },
        {
          id: 'c1',
          category: 'conflict',
          content: 'Conflict between H1 and H2',
          speakerUid: 'aura_agent',
          speakerName: 'AURA',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
      ]);
      expect(calculateCognitiveLoad(state)).toBe(65);
    });

    it('caps cognitive load at 100 under overwhelming incident pressure', () => {
      const manyItems: EvidenceItem[] = [];
      for (let i = 0; i < 10; i++) {
        manyItems.push({
          id: `h-${i}`,
          category: 'hypothesis',
          content: `Hypothesis ${i}`,
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 75,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        });
        manyItems.push({
          id: `c-${i}`,
          category: 'conflict',
          content: `Conflict ${i}`,
          speakerUid: 'aura_agent',
          speakerName: 'AURA',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        });
      }
      const state = createBaseState(manyItems);
      expect(calculateCognitiveLoad(state)).toBe(100);
    });
  });

  describe('Temporal Confidence Decay (getDisplayConfidence)', () => {
    let now: number;

    beforeEach(() => {
      now = 1700000000000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns raw confidence for non-hypothesis items', () => {
      const factItem: EvidenceItem = {
        id: 'f1',
        category: 'fact',
        content: 'Traffic elevated',
        speakerUid: 'marcus',
        speakerName: 'Marcus',
        confidence: 80,
        timestamp: now - 300_000, // 5 min ago
        relatedTo: [],
        status: 'active',
      };
      expect(getDisplayConfidence(factItem)).toBe(80);
    });

    it('returns raw confidence for confirmed or disproven hypotheses', () => {
      const confirmedHypo: EvidenceItem = {
        id: 'h1',
        category: 'hypothesis',
        content: 'Connection pool exhausted',
        speakerUid: 'marcus',
        speakerName: 'Marcus',
        confidence: 80,
        timestamp: now - 300_000,
        relatedTo: [],
        status: 'confirmed',
      };
      expect(getDisplayConfidence(confirmedHypo)).toBe(80);
    });

    it('decays active hypothesis confidence linearly over 10 minutes', () => {
      const freshHypo: EvidenceItem = {
        id: 'h2',
        category: 'hypothesis',
        content: 'Redis timeout',
        speakerUid: 'marcus',
        speakerName: 'Marcus',
        confidence: 80,
        timestamp: now, // 0m elapsed
        relatedTo: [],
        status: 'active',
      };
      expect(getDisplayConfidence(freshHypo)).toBe(80);

      // 5 minutes elapsed -> 50% decay (80 * 0.5 = 40)
      const halfAgeHypo: EvidenceItem = {
        ...freshHypo,
        timestamp: now - 5 * 60_000,
      };
      expect(getDisplayConfidence(halfAgeHypo)).toBe(40);

      // 10 minutes elapsed -> 100% decay (0)
      const expiredHypo: EvidenceItem = {
        ...freshHypo,
        timestamp: now - 10 * 60_000,
      };
      expect(getDisplayConfidence(expiredHypo)).toBe(0);

      // 15 minutes elapsed -> remains 0, no negative confidence
      const ancientHypo: EvidenceItem = {
        ...freshHypo,
        timestamp: now - 15 * 60_000,
      };
      expect(getDisplayConfidence(ancientHypo)).toBe(0);
    });
  });

  describe('OODA Loop Phase Auto-Classification (classifyOODAPhase)', () => {
    const createBaseState = (evidenceItems: EvidenceItem[], status: IncidentStatus = 'investigating'): IncidentState => ({
      incidentId: 'INC-4821',
      title: 'Payment Gateway Outage',
      severity: 'SEV-1',
      status,
      openedAt: Date.now(),
      affectedServices: ['payment-gateway'],
      participants: {},
      incidentCommanderUid: null,
      evidenceItems,
      eventSeq: 1,
      currentOODAPhase: 'OBSERVE',
      costAccrued: 0,
      cognitiveLoadScore: 0,
      lastReadbackAt: 0,
    });

    it('returns RESOLVED when incident status is resolved', () => {
      const state = createBaseState([], 'resolved');
      expect(classifyOODAPhase(state)).toBe('RESOLVED');
    });

    it('returns OBSERVE when evidence items list is empty', () => {
      const state = createBaseState([], 'investigating');
      expect(classifyOODAPhase(state)).toBe('OBSERVE');
    });

    it('returns DECIDE when the most recent item is a decision', () => {
      const state = createBaseState([
        {
          id: '1',
          category: 'fact',
          content: 'Traffic 2x',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
        {
          id: '2',
          category: 'decision',
          content: 'Rollback deployment v2.14',
          speakerUid: 'sarah',
          speakerName: 'Sarah',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
      ]);
      expect(classifyOODAPhase(state)).toBe('DECIDE');
    });

    it('returns ACT when the most recent item is an action', () => {
      const state = createBaseState([
        {
          id: '1',
          category: 'decision',
          content: 'Rollback deployment',
          speakerUid: 'sarah',
          speakerName: 'Sarah',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
        {
          id: '2',
          category: 'action',
          content: 'Execute kubectl rollout undo',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
          actionStatus: 'in_progress',
        },
      ]);
      expect(classifyOODAPhase(state)).toBe('ACT');
    });

    it('returns ORIENT when active hypotheses or conflicts are present', () => {
      const state = createBaseState([
        {
          id: '1',
          category: 'fact',
          content: '500 error spike',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 85,
          timestamp: Date.now() - 5000,
          relatedTo: [],
          status: 'active',
        },
        {
          id: '2',
          category: 'hypothesis',
          content: 'Database connection limit exceeded',
          speakerUid: 'marcus',
          speakerName: 'Marcus',
          confidence: 80,
          timestamp: Date.now() - 2000,
          relatedTo: [],
          status: 'active',
        },
        {
          id: '3',
          category: 'fact',
          content: 'Pod CPU at 40%',
          speakerUid: 'sarah',
          speakerName: 'Sarah',
          confidence: 85,
          timestamp: Date.now(),
          relatedTo: [],
          status: 'active',
        },
      ]);
      expect(classifyOODAPhase(state)).toBe('ORIENT');
    });
  });

  describe('D3-Force Topology Configuration (forceConfig)', () => {
    it('defines valid physics constants', () => {
      expect(forceConfig.chargeStrength).toBe(-120);
      expect(forceConfig.linkDistance).toBe(80);
      expect(forceConfig.linkStrength).toBe(0.3);
      expect(forceConfig.collisionRadius).toBe(30);
      expect(forceConfig.factClusterStrength).toBe(0.05);
    });
  });
});
