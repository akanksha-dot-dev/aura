import { IncidentState, calculateCognitiveLoad, classifyOODAPhase, EvidenceItem } from './types';

/**
 * Format milliseconds into human-readable elapsed duration (e.g. "6m 12s").
 */
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

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

  // Add scenario personas (they won't be duplicated because the operator is separate)
  if (scenarioOverrides?.personas) {
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

  const liveState: IncidentState = {
    incidentId: `inc-${channelName.replace(/[^a-zA-Z0-9-]/g, '-')}`,
    title: scenarioOverrides?.title || 'Payment Gateway Outage — Checkout Failures',
    severity: scenarioOverrides?.severity || 'SEV-1',
    status: 'investigating',
    openedAt: now,
    affectedServices: scenarioOverrides?.affectedServices || ['payment-api', 'checkout-service', 'postgres-primary'],
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
    channelStates.set(key, createBaselineIncidentState(channelName));
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
  return next;
}

/**
 * Adds an evidence item (fact, hypothesis, decision, action, conflict) to the channel state.
 */
export function addEvidenceToIncident(
  channelName: string,
  item: EvidenceItem
): IncidentState {
  return updateIncidentState(channelName, (prev) => ({
    ...prev,
    eventSeq: prev.eventSeq + 1,
    evidenceItems: [...prev.evidenceItems, item],
  }));
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

export function buildDynamicContext(state: IncidentState): string {
  const elapsed = formatElapsedTime(Date.now() - state.openedAt);
  const ic = state.incidentCommanderUid
    ? state.participants[state.incidentCommanderUid]?.displayName ?? state.incidentCommanderUid
    : 'Unassigned';

  const humanParticipants = Object.values(state.participants)
    .filter((p) => p.uid !== 'aura_agent')
    .map((p) => {
      const silentFor = Math.round((Date.now() - p.lastSpokeAt) / 1000);
      return `${p.displayName} (UID: "${p.uid}", Role: ${p.role}${p.isIncidentCommander ? ', Incident Commander' : ''}, silent ${Math.max(0, silentFor)}s)`;
    })
    .join(', ');

  const recentEvents =
    state.evidenceItems
      .slice(-6)
      .map(
        (e) =>
          `  [${e.id}] ${e.category.toUpperCase()}: "${e.content}" (by ${e.speakerName}, confidence ${e.confidence})`
      )
      .join('\n') || '  None yet. Awaiting initial telemetry and observations from responders.';

  const conflicts =
    state.evidenceItems
      .filter((e) => e.category === 'conflict' && e.status === 'active')
      .map(
        (e) =>
          `  ${e.hypothesisA ?? 'Theory A'} vs ${e.hypothesisB ?? 'Theory B'} — deciding metric: ${e.decidingMetric ?? 'None'}`
      )
      .join('\n') || '  None';

  const pendingActions =
    state.evidenceItems
      .filter(
        (e) =>
          e.category === 'action' &&
          (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')
      )
      .map(
        (e) =>
          `  ${e.content} → ${e.assignedTo ?? 'unassigned'} (${e.actionStatus ?? 'pending'})`
      )
      .join('\n') || '  None';

  const secsSinceReadback = Math.round((Date.now() - state.lastReadbackAt) / 1000);

  return `[INCIDENT CONTEXT — INJECTED AT ${new Date().toISOString()}]
Incident: ${state.title} | Severity: ${state.severity} | Status: ${state.status} | Elapsed: ${elapsed}
IC: ${ic} | Current OODA Phase: ${state.currentOODAPhase}
Active Responders on Bridge: ${humanParticipants || 'None currently detected'}
Telemetry & Epistemic Counts: Facts: ${state.evidenceItems.filter((e) => e.category === 'fact').length} | Active Hypotheses: ${state.evidenceItems.filter((e) => e.category === 'hypothesis' && e.status === 'active').length} | Decisions: ${state.evidenceItems.filter((e) => e.category === 'decision').length} | Pending Actions: ${state.evidenceItems.filter((e) => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')).length} | Unresolved Conflicts: ${state.evidenceItems.filter((e) => e.category === 'conflict' && e.status === 'active').length}
Last verbal readback: ${Math.max(0, secsSinceReadback)}s ago
Sweller Cognitive Load: ${calculateCognitiveLoad(state)}/100

Recent verified evidence:
${recentEvents}

Active conflicts:
${conflicts}

Pending action items:
${pendingActions}
[END INCIDENT CONTEXT]`;
}
