/**
 * proactiveEngine.ts — OODA-driven proactive intervention engine for AURA.
 *
 * Monitors the war room state and proactively intervenes when:
 * 1. Silence Watchdog — War room is silent for too long
 * 2. Stall Detector — Same OODA phase persists without progress
 * 3. Cognitive Overload Intervener — Sweller score exceeds threshold
 * 4. Contradiction Resolver — Unresolved conflicts persist
 * 5. Auto-Escalation — Severity is critical but resolution stalls
 * 6. Readback Reminder — Periodic situation summaries
 * 7. Action Expiry Monitor — Pending actions past their ETA
 */

import type { IncidentState, OODAPhase, EvidenceItem } from './types';

export type InterventionType =
  | 'silence_watchdog'
  | 'stall_detector'
  | 'cognitive_overload'
  | 'contradiction_resolver'
  | 'auto_escalation'
  | 'readback_reminder'
  | 'action_expiry'
  | 'participant_onboarding'
  | 'consensus_check'
  | 'resolution_nudge';

export interface ProactiveIntervention {
  type: InterventionType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** What AURA should say (spoken via TTS) */
  spokenMessage: string;
  /** Internal reason for this intervention */
  reason: string;
  /** Suggested follow-up actions */
  suggestedActions?: string[];
  /** How long to wait before re-triggering this type (ms) */
  cooldownMs: number;
  /** Timestamp when this intervention was generated */
  generatedAt: number;
}

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  /** Seconds of silence before AURA speaks up */
  silenceThresholdSec: 60,
  /** Minutes in the same OODA phase before nudging */
  stallThresholdMin: 5,
  /** Cognitive load score that triggers intervention */
  cognitiveOverloadThreshold: 80,
  /** Minutes of unresolved conflict before proposing resolution */
  conflictMaxAgeMin: 3,
  /** Minutes without a readback before reminding */
  readbackIntervalMin: 5,
  /** Minutes past ETA before flagging action items */
  actionExpiryGraceMin: 2,
  /** Minimum gap between interventions of the same type (ms) */
  defaultCooldownMs: 120_000, // 2 minutes
  /** Whether escalation is enabled for SEV-0/SEV-1 */
  autoEscalationEnabled: true,
};

// ── Cooldown Tracker ─────────────────────────────────────────────────────────

const lastInterventionTime = new Map<InterventionType, number>();

function isOnCooldown(type: InterventionType, cooldownMs: number): boolean {
  const lastTime = lastInterventionTime.get(type) ?? 0;
  return (Date.now() - lastTime) < cooldownMs;
}

function markTriggered(type: InterventionType): void {
  lastInterventionTime.set(type, Date.now());
}

// ── Intervention Generators ──────────────────────────────────────────────────

function checkSilenceWatchdog(
  state: IncidentState,
  lastSpeechTimestamp: number,
): ProactiveIntervention | null {
  if (state.status === 'resolved') return null;

  const silenceSec = (Date.now() - lastSpeechTimestamp) / 1000;
  if (silenceSec < CONFIG.silenceThresholdSec) return null;
  if (isOnCooldown('silence_watchdog', CONFIG.defaultCooldownMs)) return null;

  const elapsedMin = Math.floor((Date.now() - state.openedAt) / 60_000);
  const activeHypotheses = state.evidenceItems.filter(
    e => e.category === 'hypothesis' && e.status === 'active'
  ).length;
  const pendingActions = state.evidenceItems.filter(
    e => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')
  ).length;

  let message: string;
  if (pendingActions > 0) {
    message = `We've been quiet for about ${Math.round(silenceSec)}seconds. We have ${pendingActions} pending action${pendingActions > 1 ? 's' : ''}. Can someone provide an update on progress?`;
  } else if (activeHypotheses > 0) {
    message = `The bridge has been silent for a minute. We have ${activeHypotheses} active hypothes${activeHypotheses > 1 ? 'es' : 'is'} on the board. Let me recap where we are: we're ${elapsedMin} minutes into this ${state.severity} incident. What's our next move?`;
  } else {
    message = `We've been quiet for a moment. Let me summarize: we're ${elapsedMin} minutes in, currently in the ${state.currentOODAPhase} phase. What observations or data points should we be looking at?`;
  }

  markTriggered('silence_watchdog');
  return {
    type: 'silence_watchdog',
    priority: 'medium',
    spokenMessage: message,
    reason: `War room silent for ${Math.round(silenceSec)}s`,
    cooldownMs: CONFIG.defaultCooldownMs,
    generatedAt: Date.now(),
  };
}

function checkStallDetector(
  state: IncidentState,
  phaseEnteredAt: number,
): ProactiveIntervention | null {
  if (state.status === 'resolved') return null;

  const phaseAgeMin = (Date.now() - phaseEnteredAt) / 60_000;
  if (phaseAgeMin < CONFIG.stallThresholdMin) return null;
  if (isOnCooldown('stall_detector', CONFIG.defaultCooldownMs * 2)) return null;

  const phaseMessages: Record<OODAPhase, string> = {
    OBSERVE: `We've been in the OBSERVE phase for ${Math.round(phaseAgeMin)} minutes. Do we have enough data to form hypotheses? If so, let's move to ORIENT.`,
    ORIENT: `We've been analyzing for ${Math.round(phaseAgeMin)} minutes in ORIENT. We have ${state.evidenceItems.filter(e => e.category === 'hypothesis' && e.status === 'active').length} active hypotheses. Can we prioritize one and make a decision?`,
    DECIDE: `We've been in the DECIDE phase for ${Math.round(phaseAgeMin)} minutes. We need to commit to an action plan. What's blocking the decision?`,
    ACT: `We've been executing for ${Math.round(phaseAgeMin)} minutes. Do we have results from our actions? Should we reassess?`,
    RESOLVED: '',
  };

  const message = phaseMessages[state.currentOODAPhase];
  if (!message) return null;

  markTriggered('stall_detector');
  return {
    type: 'stall_detector',
    priority: 'high',
    spokenMessage: message,
    reason: `${state.currentOODAPhase} phase persisting for ${Math.round(phaseAgeMin)}m`,
    suggestedActions: [
      `Review evidence in current ${state.currentOODAPhase} phase`,
      'Assign owners to unresolved items',
      'Set a 5-minute timebox for the next phase',
    ],
    cooldownMs: CONFIG.defaultCooldownMs * 2,
    generatedAt: Date.now(),
  };
}

function checkCognitiveOverload(state: IncidentState): ProactiveIntervention | null {
  if (state.cognitiveLoadScore < CONFIG.cognitiveOverloadThreshold) return null;
  if (isOnCooldown('cognitive_overload', CONFIG.defaultCooldownMs * 3)) return null;

  const activeHypotheses = state.evidenceItems
    .filter(e => e.category === 'hypothesis' && e.status === 'active')
    .sort((a, b) => b.confidence - a.confidence);

  const pendingActions = state.evidenceItems
    .filter(e => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress'))
    .sort((a, b) => (a.eta ?? Infinity) - (b.eta ?? Infinity));

  const topItems = [
    ...activeHypotheses.slice(0, 2).map(h => `Hypothesis: ${h.content}`),
    ...pendingActions.slice(0, 1).map(a => `Action: ${a.content} — assigned to ${a.assignedTo || 'unassigned'}`),
  ];

  const message = `Cognitive load is at ${state.cognitiveLoadScore} out of 100, which is quite high. Let me prioritize for the team. The ${topItems.length} most critical items right now are: ${topItems.join('. ')}. I suggest we focus on these and park the rest.`;

  markTriggered('cognitive_overload');
  return {
    type: 'cognitive_overload',
    priority: 'high',
    spokenMessage: message,
    reason: `Cognitive load score ${state.cognitiveLoadScore}/100 exceeds threshold`,
    suggestedActions: [
      'Close or park low-confidence hypotheses',
      'Assign clear owners to pending actions',
      'Reduce parallel investigation threads',
    ],
    cooldownMs: CONFIG.defaultCooldownMs * 3,
    generatedAt: Date.now(),
  };
}

function checkContradictionResolver(state: IncidentState): ProactiveIntervention | null {
  const activeConflicts = state.evidenceItems.filter(
    e => e.category === 'conflict' && e.status === 'active'
  );

  if (activeConflicts.length === 0) return null;

  // Find conflicts older than threshold
  const staleConflicts = activeConflicts.filter(
    c => (Date.now() - c.timestamp) > CONFIG.conflictMaxAgeMin * 60_000
  );

  if (staleConflicts.length === 0) return null;
  if (isOnCooldown('contradiction_resolver', CONFIG.defaultCooldownMs * 2)) return null;

  const oldest = staleConflicts[0];
  const ageMin = Math.round((Date.now() - oldest.timestamp) / 60_000);

  const message = `We have an unresolved contradiction that's been open for ${ageMin} minutes: ${oldest.hypothesisA || 'Theory A'} versus ${oldest.hypothesisB || 'Theory B'}. The deciding metric would be ${oldest.decidingMetric || 'still to be determined'}. Can someone pull that data to resolve this?`;

  markTriggered('contradiction_resolver');
  return {
    type: 'contradiction_resolver',
    priority: 'high',
    spokenMessage: message,
    reason: `Conflict "${oldest.content}" unresolved for ${ageMin}m`,
    suggestedActions: [
      `Check ${oldest.decidingMetric || 'relevant metrics'}`,
      `Assign investigation of both hypotheses`,
      `Set 5-minute timebox for resolution`,
    ],
    cooldownMs: CONFIG.defaultCooldownMs * 2,
    generatedAt: Date.now(),
  };
}

function checkAutoEscalation(state: IncidentState): ProactiveIntervention | null {
  if (!CONFIG.autoEscalationEnabled) return null;
  if (state.status === 'resolved') return null;
  if (state.severity !== 'SEV-0' && state.severity !== 'SEV-1') return null;

  const elapsedMin = (Date.now() - state.openedAt) / 60_000;

  // SEV-0: escalate after 15 minutes without progress
  // SEV-1: escalate after 30 minutes without progress
  const threshold = state.severity === 'SEV-0' ? 15 : 30;
  if (elapsedMin < threshold) return null;

  // Check if we're making progress (evidence activity in last 5 min)
  const recentEvidence = state.evidenceItems.filter(
    e => (Date.now() - e.timestamp) < 5 * 60_000
  );
  if (recentEvidence.length > 0) return null; // Still making progress

  if (isOnCooldown('auto_escalation', CONFIG.defaultCooldownMs * 5)) return null;

  const participantCount = Object.keys(state.participants).filter(k => k !== 'aura_agent').length;

  const message = `This ${state.severity} incident has been open for ${Math.round(elapsedMin)} minutes and we haven't had new evidence in the last 5 minutes. With ${participantCount} responders currently in the room, should we escalate to bring in additional expertise? I can help draft an escalation message.`;

  markTriggered('auto_escalation');
  return {
    type: 'auto_escalation',
    priority: 'critical',
    spokenMessage: message,
    reason: `${state.severity} incident stalled for ${Math.round(elapsedMin)}m with no recent progress`,
    suggestedActions: [
      'Page additional on-call engineers',
      'Escalate to engineering leadership',
      'Bring in vendor support if external dependency',
    ],
    cooldownMs: CONFIG.defaultCooldownMs * 5,
    generatedAt: Date.now(),
  };
}

function checkReadbackReminder(state: IncidentState): ProactiveIntervention | null {
  if (state.status === 'resolved') return null;

  const sinceReadbackMin = (Date.now() - state.lastReadbackAt) / 60_000;
  if (sinceReadbackMin < CONFIG.readbackIntervalMin) return null;
  if (isOnCooldown('readback_reminder', CONFIG.defaultCooldownMs)) return null;

  const elapsedMin = Math.round((Date.now() - state.openedAt) / 60_000);
  const facts = state.evidenceItems.filter(e => e.category === 'fact').length;
  const hypotheses = state.evidenceItems.filter(e => e.category === 'hypothesis' && e.status === 'active').length;

  const message = `Quick readback: We're ${elapsedMin} minutes into this ${state.severity}. We've logged ${facts} facts and have ${hypotheses} active hypothes${hypotheses !== 1 ? 'es' : 'is'}. We're in the ${state.currentOODAPhase} phase. Is everyone aligned on our current direction?`;

  markTriggered('readback_reminder');
  return {
    type: 'readback_reminder',
    priority: 'medium',
    spokenMessage: message,
    reason: `No readback in ${Math.round(sinceReadbackMin)} minutes`,
    cooldownMs: CONFIG.defaultCooldownMs,
    generatedAt: Date.now(),
  };
}

function checkActionExpiry(state: IncidentState): ProactiveIntervention | null {
  const now = Date.now();
  const graceMs = CONFIG.actionExpiryGraceMin * 60_000;

  const expiredActions = state.evidenceItems.filter(
    e =>
      e.category === 'action' &&
      (e.actionStatus === 'pending' || e.actionStatus === 'in_progress') &&
      e.eta &&
      (now - e.eta) > graceMs
  );

  if (expiredActions.length === 0) return null;
  if (isOnCooldown('action_expiry', CONFIG.defaultCooldownMs)) return null;

  const oldest = expiredActions[0];
  const overMin = Math.round((now - (oldest.eta || 0)) / 60_000);

  const message = `Action item "${oldest.content}" assigned to ${oldest.assignedTo || 'unassigned'} is ${overMin} minutes past its estimated completion time. ${oldest.assignedTo ? `${oldest.assignedTo}, can you provide a status update?` : 'Who can take ownership of this?'}`;

  markTriggered('action_expiry');
  return {
    type: 'action_expiry',
    priority: 'medium',
    spokenMessage: message,
    reason: `Action "${oldest.content}" overdue by ${overMin}m`,
    cooldownMs: CONFIG.defaultCooldownMs,
    generatedAt: Date.now(),
  };
}

// ── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Evaluates all proactive intervention rules against the current incident state.
 * Returns the highest-priority intervention that should be triggered, or null.
 *
 * @param state Current incident state
 * @param lastSpeechTimestamp When someone last spoke (ms)
 * @param phaseEnteredAt When the current OODA phase was entered (ms)
 */
export function evaluateInterventions(
  state: IncidentState,
  lastSpeechTimestamp: number,
  phaseEnteredAt: number,
): ProactiveIntervention | null {
  if (state.status === 'resolved') return null;

  const priorityOrder: Array<() => ProactiveIntervention | null> = [
    () => checkAutoEscalation(state),
    () => checkCognitiveOverload(state),
    () => checkContradictionResolver(state),
    () => checkStallDetector(state, phaseEnteredAt),
    () => checkActionExpiry(state),
    () => checkSilenceWatchdog(state, lastSpeechTimestamp),
    () => checkReadbackReminder(state),
  ];

  for (const check of priorityOrder) {
    const intervention = check();
    if (intervention) return intervention;
  }

  return null;
}

/**
 * Resets all cooldown timers (e.g., when a new incident starts).
 */
export function resetAllCooldowns(): void {
  lastInterventionTime.clear();
}

/**
 * Updates configuration values at runtime.
 */
export function updateConfig(overrides: Partial<typeof CONFIG>): void {
  Object.assign(CONFIG, overrides);
}
