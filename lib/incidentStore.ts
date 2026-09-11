import { IncidentState, calculateCognitiveLoad, classifyOODAPhase, EvidenceItem } from './types';
import { PRESET_SCENARIOS } from './scenarios';
import { buildDynamicIncidentContext } from './promptBuilder';
import {
  upsertIncident,
  insertEvidence as dbInsertEvidence,
  upsertParticipant,
  persistFullIncidentSnapshot,
  insertTranscript,
} from './db';

/**
 * Creates a clean live incident state for a real operator without mock personas.
 */
export function initializeLiveIncident(
  channelName = 'incident-war-room',
  operator?: { uid: string; displayName: string; role: string },
  scenarioOverrides?: {
    title?: string;
    severity?: 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3';
    affectedServices?: string[];
    description?: string;
    impact?: string;
    suspectedCause?: string;
    personas?: Array<{ uid: string; displayName: string; role: string }>;
  }
): IncidentState {
  const now = Date.now();
  const participants: Record<string, any> = {
    aura_agent: {
      uid: 'aura_agent',
      displayName: 'AURA',
      role: 'AI Incident Commander',
      isIncidentCommander: false,
      joinedAt: now,
      totalSpeakingMs: 0,
      lastSpokeAt: now,
    },
  };

  let icUid: string | null = null;

  // Add the operator
  if (operator && operator.uid) {
    const isIC =
      !operator.role ||
      operator.role.toLowerCase().includes('commander') ||
      operator.role.toLowerCase().includes('lead');

    participants[operator.uid] = {
      uid: operator.uid,
      displayName: operator.displayName || operator.uid,
      role: operator.role || 'Incident Responder',
      isIncidentCommander: isIC,
      joinedAt: now,
      totalSpeakingMs: 0,
      lastSpokeAt: now,
    };
    if (isIC) {
      icUid = operator.uid;
    }
  }

  // Add scenario personas ONLY when no live human operator is provided (e.g. mock/test environments)
  if (!operator && scenarioOverrides?.personas) {
    for (const p of scenarioOverrides.personas) {
      if (participants[p.uid]) continue; // Don't override operator or AURA
      const isIC =
        p.role.toLowerCase().includes('commander') ||
        p.role.toLowerCase().includes('lead');
      participants[p.uid] = {
        uid: p.uid,
        displayName: p.displayName,
        role: p.role,
        isIncidentCommander: isIC,
        joinedAt: now,
        totalSpeakingMs: 0,
        lastSpokeAt: now,
      };
      if (isIC && !icUid) {
        icUid = p.uid;
      }
    }
  }

  const cleanChannelKey = channelName.trim().toLowerCase();
  const matchingPreset = PRESET_SCENARIOS.find(
    (s) =>
      s.channelName.toLowerCase() === cleanChannelKey ||
      s.id.toLowerCase() === cleanChannelKey ||
      cleanChannelKey.includes(s.id.toLowerCase())
  );

  const resolvedTitle =
    scenarioOverrides?.title ||
    matchingPreset?.title ||
    (cleanChannelKey.includes('cdn')
      ? 'CDN Cache Invalidation Storm — Global Latency Spike'
      : cleanChannelKey.includes('auth')
      ? 'Authentication Service Compromise — Suspicious Token Generation'
      : cleanChannelKey.includes('k8s')
      ? 'Kubernetes Node Pool Exhaustion — Pod Eviction Cascade'
      : cleanChannelKey.includes('checkout') || cleanChannelKey.includes('payment')
      ? 'Payment Gateway Degradation & Checkout Outage'
      : `Active Incident Bridge (${channelName})`);

  const resolvedSeverity =
    scenarioOverrides?.severity ||
    matchingPreset?.severity ||
    (cleanChannelKey.includes('auth') ? 'SEV-0' : cleanChannelKey.includes('cdn') ? 'SEV-2' : 'SEV-1');

  const resolvedServices =
    scenarioOverrides?.affectedServices ||
    matchingPreset?.affectedServices ||
    (cleanChannelKey.includes('cdn')
      ? ['cdn-edge', 'static-assets', 'image-service']
      : cleanChannelKey.includes('auth')
      ? ['auth-service', 'token-service', 'user-api']
      : cleanChannelKey.includes('k8s')
      ? ['k8s-control-plane', 'api-gateway', 'worker-pool']
      : cleanChannelKey.includes('payment') || cleanChannelKey.includes('checkout')
      ? ['payment-api', 'checkout-service', 'postgres-primary']
      : ['core-api', 'service-gateway']);

  const liveState: IncidentState = {
    incidentId: `inc-${channelName.replace(/[^a-zA-Z0-9-]/g, '-')}`,
    title: resolvedTitle,
    severity: resolvedSeverity,
    status: 'investigating',
    openedAt: now,
    affectedServices: resolvedServices,
    participants,
    incidentCommanderUid: icUid,
    evidenceItems: [],
    eventSeq: 0,
    currentOODAPhase: 'OBSERVE',
    costAccrued: 0,
    cognitiveLoadScore: 0,
    lastReadbackAt: 0,
  };

  const key = channelName.trim().toLowerCase();
  channelStates.set(key, liveState);
  return liveState;
}

/**
 * Creates a fresh baseline incident state matching the SEV-1 Payment Outage for mock/fallback scenarios.
 */
export function createBaselineIncidentState(channelName = 'incident-war-room'): IncidentState {
  const now = Date.now();
  return {
    incidentId: `inc-${channelName.replace(/[^a-zA-Z0-9-]/g, '-')}`,
    title: 'Payment Gateway Degradation & Checkout Outage',
    severity: 'SEV-1',
    status: 'investigating',
    openedAt: now - 360_000,
    affectedServices: ['payment-api', 'checkout-service', 'postgres-primary'],
    participants: {
      'sarah_ic': {
        uid: 'sarah_ic',
        displayName: 'Sarah Chen',
        role: 'Incident Commander',
        isIncidentCommander: true,
        joinedAt: now - 360_000,
        totalSpeakingMs: 45_000,
        lastSpokeAt: now - 25_000,
      },
      'marcus_sre': {
        uid: 'marcus_sre',
        displayName: 'Marcus Vance',
        role: 'Lead SRE',
        isIncidentCommander: false,
        joinedAt: now - 340_000,
        totalSpeakingMs: 65_000,
        lastSpokeAt: now - 10_000,
      },
      'priya_pm': {
        uid: 'priya_pm',
        displayName: 'Priya Patel',
        role: 'Product Manager',
        isIncidentCommander: false,
        joinedAt: now - 300_000,
        totalSpeakingMs: 20_000,
        lastSpokeAt: now - 50_000,
      },
    },
    incidentCommanderUid: 'sarah_ic',
    evidenceItems: [
      {
        id: 'evt-001',
        category: 'fact',
        content: 'Checkout error rate spiked to 42% following v2.14 release',
        speakerUid: 'marcus_sre',
        speakerName: 'Marcus Vance',
        confidence: 85,
        timestamp: now - 300_000,
        serviceAffected: 'payment-api',
        relatedTo: [],
        status: 'confirmed',
      },
      {
        id: 'evt-002',
        category: 'hypothesis',
        content: 'Postgres connection pool exhaustion causing thread starvation',
        speakerUid: 'marcus_sre',
        speakerName: 'Marcus Vance',
        confidence: 75,
        timestamp: now - 240_000,
        serviceAffected: 'postgres-primary',
        relatedTo: ['evt-001'],
        status: 'active',
        decidingMetric: 'active pg_stat_activity connection count',
      },
      {
        id: 'evt-003',
        category: 'hypothesis',
        content: 'Payment gateway API rate limiting after PR #492',
        speakerUid: 'sarah_ic',
        speakerName: 'Sarah Chen',
        confidence: 65,
        timestamp: now - 180_000,
        serviceAffected: 'payment-api',
        relatedTo: ['evt-001'],
        status: 'active',
        decidingMetric: 'upstream gateway HTTP 429 response codes',
      },
      {
        id: 'evt-004',
        category: 'conflict',
        content: 'Connection pool exhaustion vs Gateway rate limiting',
        speakerUid: 'aura_agent',
        speakerName: 'AURA',
        confidence: 80,
        timestamp: now - 120_000,
        serviceAffected: 'payment-api',
        relatedTo: ['evt-002', 'evt-003'],
        status: 'active',
        hypothesisA: 'Postgres connection pool exhaustion',
        hypothesisB: 'Payment gateway rate limiting',
        decidingMetric: 'Database connection metrics vs HTTP 429 errors',
      },
      {
        id: 'evt-005',
        category: 'action',
        content: 'Inspect Postgres connection pool utilization via Datadog',
        speakerUid: 'sarah_ic',
        speakerName: 'Sarah Chen',
        confidence: 85,
        timestamp: now - 60_000,
        serviceAffected: 'postgres-primary',
        relatedTo: ['evt-002'],
        status: 'active',
        assignedTo: 'Marcus Vance',
        actionStatus: 'in_progress',
        eta: now + 180_000,
      },
    ],
    eventSeq: 5,
    currentOODAPhase: 'ORIENT',
    costAccrued: 54000,
    cognitiveLoadScore: 65,
    lastReadbackAt: now - 90_000,
  };
}

// Global server-side map of incident states per channel
const channelStates = new Map<string, IncidentState>();

/**
 * Gets or initializes incident state for a channel.
 */
export function getIncidentState(channelName = 'incident-war-room'): IncidentState {
  const key = channelName.trim().toLowerCase();
  if (!channelStates.has(key)) {
    const preset = PRESET_SCENARIOS.find(
      (s) =>
        s.channelName.toLowerCase() === key ||
        s.id.toLowerCase() === key ||
        key.includes(s.id.toLowerCase())
    );
    if (preset) {
      channelStates.set(
        key,
        initializeLiveIncident(channelName, undefined, {
          title: preset.title,
          severity: preset.severity,
          affectedServices: preset.affectedServices,
          description: preset.description,
          impact: preset.impact,
          suspectedCause: preset.suspectedCause,
          personas: preset.personas,
        })
      );
    } else {
      channelStates.set(key, initializeLiveIncident(channelName));
    }
  }
  return channelStates.get(key)!;
}

/**
 * Updates incident state for a channel and recomputes derived metrics.
 */
export function updateIncidentState(
  channelName: string,
  updater: (prev: IncidentState) => IncidentState
): IncidentState {
  const current = getIncidentState(channelName);
  const next = updater(current);
  next.cognitiveLoadScore = calculateCognitiveLoad(next);
  next.currentOODAPhase = classifyOODAPhase(next);
  const key = channelName.trim().toLowerCase();
  channelStates.set(key, next);

  // Persist to database (non-blocking)
  try {
    upsertIncident({
      id: next.incidentId,
      title: next.title,
      severity: next.severity,
      status: next.status,
      channelName,
      openedAt: next.openedAt,
      resolvedAt: next.resolvedAt,
      affectedServices: next.affectedServices,
      incidentCommanderUid: next.incidentCommanderUid,
      costAccrued: next.costAccrued,
      cognitiveLoadScore: next.cognitiveLoadScore,
      oodaPhase: next.currentOODAPhase,
    });

    // On resolution, persist full snapshot for historical intelligence
    if (next.status === 'resolved') {
      persistFullIncidentSnapshot({
        incidentId: next.incidentId,
        title: next.title,
        severity: next.severity,
        status: next.status,
        channelName,
        openedAt: next.openedAt,
        resolvedAt: next.resolvedAt,
        affectedServices: next.affectedServices,
        incidentCommanderUid: next.incidentCommanderUid,
        costAccrued: next.costAccrued,
        cognitiveLoadScore: next.cognitiveLoadScore,
        currentOODAPhase: next.currentOODAPhase,
        participants: next.participants,
        evidenceItems: next.evidenceItems,
      });
    }
  } catch (err) {
    console.warn('[IncidentStore] DB persistence error (non-critical):', err);
  }

  return next;
}

/**
 * Adds an evidence item (fact, hypothesis, decision, action, conflict) to the channel state.
 */
export function addEvidenceToIncident(
  channelName: string,
  item: EvidenceItem
): IncidentState {
  const updated = updateIncidentState(channelName, (prev) => ({
    ...prev,
    eventSeq: prev.eventSeq + 1,
    evidenceItems: [...prev.evidenceItems, item],
  }));

  // Persist individual evidence item to DB
  try {
    dbInsertEvidence({
      id: item.id,
      incidentId: updated.incidentId,
      category: item.category,
      content: item.content,
      speakerUid: item.speakerUid,
      speakerName: item.speakerName,
      confidence: item.confidence,
      timestamp: item.timestamp,
      serviceAffected: item.serviceAffected,
      relatedTo: item.relatedTo,
      status: item.status,
      assignedTo: item.assignedTo,
      eta: item.eta,
      actionStatus: item.actionStatus,
      decidingMetric: item.decidingMetric,
      hypothesisA: item.hypothesisA,
      hypothesisB: item.hypothesisB,
      speakerAUid: item.speakerAUid,
      speakerBUid: item.speakerBUid,
    });
  } catch (err) {
    console.warn('[IncidentStore] Evidence DB persistence error (non-critical):', err);
  }

  return updated;
}

/**
 * Dynamically adds a participant to an active incident channel.
 * Used when new team members join the war room.
 */
export function addParticipantToIncident(
  channelName: string,
  participant: { uid: string; displayName: string; role: string; isIncidentCommander?: boolean }
): IncidentState {
  const updated = updateIncidentState(channelName, (prev) => {
    if (prev.participants[participant.uid]) return prev; // Already joined
    const now = Date.now();
    return {
      ...prev,
      participants: {
        ...prev.participants,
        [participant.uid]: {
          uid: participant.uid,
          displayName: participant.displayName,
          role: participant.role,
          isIncidentCommander: participant.isIncidentCommander || false,
          joinedAt: now,
          totalSpeakingMs: 0,
          lastSpokeAt: now,
        },
      },
    };
  });

  // Persist participant to DB
  try {
    upsertParticipant({
      incidentId: updated.incidentId,
      uid: participant.uid,
      displayName: participant.displayName,
      role: participant.role,
      isIncidentCommander: participant.isIncidentCommander,
      joinedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[IncidentStore] Participant DB persistence error (non-critical):', err);
  }

  return updated;
}

/**
 * Removes a participant from an active incident channel.
 */
export function removeParticipantFromIncident(
  channelName: string,
  uid: string
): IncidentState {
  return updateIncidentState(channelName, (prev) => {
    const { [uid]: _, ...remaining } = prev.participants;
    return {
      ...prev,
      participants: remaining,
    };
  });
}

/**
 * Persists a transcript entry for an active incident.
 */
export function persistTranscriptEntry(
  channelName: string,
  entry: { speakerName: string; speakerUid?: string; text: string; isAgent?: boolean; isFiller?: boolean; timestamp: number; turnId?: string }
): void {
  try {
    const state = getIncidentState(channelName);
    insertTranscript({
      incidentId: state.incidentId,
      ...entry,
    });
  } catch (err) {
    console.warn('[IncidentStore] Transcript DB persistence error (non-critical):', err);
  }
}

/**
 * Formats the rich dynamic incident context for per-turn prompt injection.
 */
/**
 * Resolves a human-readable display name for any speaker UID in a given channel.
 */
export function getSpeakerDisplayName(channelName: string, uid?: string): string {
  if (!uid) return 'Responder';
  if (uid === 'aura_agent' || uid.toLowerCase().includes('aura')) return 'AURA';
  const state = getIncidentState(channelName);
  if (state.participants[uid]?.displayName) {
    return state.participants[uid].displayName;
  }
  return uid;
}

export function buildDynamicContext(state: IncidentState, operatorUid?: string): string {
  return buildDynamicIncidentContext(state, operatorUid);
}
