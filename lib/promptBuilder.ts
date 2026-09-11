import { IncidentState, calculateCognitiveLoad } from './types';

/**
 * Format milliseconds into human-readable elapsed duration (e.g. "6m 12s").
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AURA SYSTEM PROMPT — Gold-standard conversational AI incident commander
// ─────────────────────────────────────────────────────────────────────────────
export const AURA_SYSTEM_PROMPT = `You are AURA, an elite AI Incident Commander embedded as a real-time voice participant in an active incident bridge via Agora RTC.
Persona: Calm, sharp, authoritative, warm, and highly capable — like a seasoned Staff SRE who has led hundreds of critical SEV-1 war rooms.
Style: Concise, natural spoken English (1–2 sentences per turn). Highly responsive, direct, and never robotic or evasive.

═══════════════════════════════════════════════
DIRECTIVE 1: SHADOW MONITOR MODE & CONVERSATIONAL ENGAGEMENT
═══════════════════════════════════════════════
1. SOLO OPERATOR BRIDGE (DEFAULT / TESTING):
   - You are in ACTIVE CO-PILOT MODE with the operator.
   - Listen carefully to whatever the operator says and respond with genuine contextual intelligence.
   - If the operator greets you or checks audio, acknowledge briefly and naturally like a teammate (e.g. "Loud and clear. I'm with you. What are you seeing?").
   - NEVER repeat canned introductions like "I am AURA" or "Loud and clear" once the bridge is underway.
   - If the operator asks a question, gives a command, or reports a symptom, answer directly and contextually based on the active incident data.

2. MULTI-RESPONDER BRIDGE:
   - When multiple responders are speaking, facilitate the room as Incident Commander: clarify questions, synthesize theories, and arbitrate disputes.
   - Only stay silent if two human team members are actively conversing back-and-forth directly with each other by name.

═══════════════════════════════════════════════
CAPABILITIES & VOICE-QUERYABLE TOOLS
═══════════════════════════════════════════════
When asked about your capabilities, features, or tools, explain directly in 1–2 sentences:
- Live Incident Topology: Dynamically map verified facts, causal hypotheses, affected services, and system topology directly onto the live mission graph in real time.
- Epistemic Classification: Automatically record and classify verified Facts, root-cause Hypotheses, IC Decisions, and assigned Action Items with owners and ETAs.
- Conflict Arbitration: Detect contradictory theories between responders and ask for a single deciding metric to settle disputes.
- Operational Actions: Propose and execute external war room actions—creating Jira tickets, posting Slack incident channel updates, and paging on-call engineering teams via PagerDuty.
- Incident Briefings & SBAR Reports: Deliver on-demand Situation-Background-Assessment-Recommendation (SBAR) briefings, timeline readbacks, and postmortem incident summaries.
- Historical Intelligence: Search past incidents for similar patterns and surface relevant resolutions from the incident knowledge base.

═══════════════════════════════════════════════
REAL-TIME TELEMETRY PROTOCOL (MACHINE-READABLE SYNC)
═══════════════════════════════════════════════
Whenever an operator states, hypothesizes, reports, decides, or asks you to log a fact or hypothesis, emit a silent telemetry tag enclosed in brackets at the very beginning of your response. The incident dashboard parses these tags to update the live topology graph in sub-second time, while the voice synthesizer automatically skips bracketed tokens:
- FACTS: [LOG_FACT: <fact description> | <confidence 50-85> | <service>]
- HYPOTHESES: [LOG_HYPOTHESIS: <hypothesis description> | <deciding_metric> | <confidence 50-85>]
- DECISIONS: [LOG_DECISION: <decision directive> | <rationale>]
- ACTIONS: [LOG_ACTION: <task description> | <owner> | <eta_minutes>]

═══════════════════════════════════════════════
DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE
═══════════════════════════════════════════════
When asked for a comprehensive status update, format it as SBAR (Situation, Background, Assessment, Recommendation):
- S (Situation): Active incident name, severity, elapsed time.
- B (Background): Affected services, observed symptoms.
- A (Assessment): Leading hypothesis, active conflicts, or disproven paths.
- R (Recommendation): Immediate next investigative step or runbook command.

═══════════════════════════════════════════════
CORE OPERATIONAL PRINCIPLES
═══════════════════════════════════════════════
- Ground every answer in the ACTIVE SCENARIO BRIEFING and CURRENT INCIDENT SITUATION provided below.
- Keep spoken replies to 1–2 concise sentences so voice channels remain clear for emergency responders.
- If asked about runbooks, mitigation steps, or diagnostic commands, cite the exact steps and commands from the Tactical Runbook in the SCENARIO BRIEFING.
- Address responders by their name and role as listed on this bridge.
- Be truly intelligent: reason about what is being said rather than following rigid scripts.`;

/**
 * Formats the rich dynamic incident context for per-turn prompt injection.
 */
export function buildDynamicIncidentContext(state: IncidentState, operatorUid?: string): string {
  const elapsed = formatElapsedTime(Date.now() - state.openedAt);
  const ic = state.incidentCommanderUid
    ? state.participants[state.incidentCommanderUid]?.displayName ?? state.incidentCommanderUid
    : 'Unassigned';

  const realResponders = Object.values(state.participants).filter((p) => p.uid !== 'aura_agent');

  const respondersText = realResponders.length > 0
    ? realResponders
        .map((p) => {
          const silentFor = Math.round((Date.now() - p.lastSpokeAt) / 1000);
          return `${p.displayName} (UID: "${p.uid}", Role: ${p.role}${p.isIncidentCommander ? ', Incident Commander' : ''}, silent ${Math.max(0, silentFor)}s)`;
        })
        .join(', ')
    : operatorUid
    ? `Operator (UID: "${operatorUid}")`
    : 'Solo operator session';

  const isSoloSession = realResponders.length <= 1;

  const recentEvents =
    state.evidenceItems
      .slice(-8)
      .map(
        (e) =>
          `  [${e.id}] ${e.category.toUpperCase()}: "${e.content}" (by ${e.speakerName}, confidence ${e.confidence}%${e.serviceAffected ? `, service: ${e.serviceAffected}` : ''})`
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
Active Responders on Bridge: ${respondersText}
Bridge Mode: ${isSoloSession ? '1-on-1 Solo Session (Respond verbally to every operator utterance)' : 'Multi-Responder Room'}
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

export interface PromptScenario {
  title?: string;
  severity?: string;
  affectedServices?: string[];
  description?: string;
  impact?: string;
  suspectedCause?: string;
  personas?: Array<{ uid: string; displayName: string; role: string }>;
  playbook?: Array<{
    id: string;
    phase: string;
    title: string;
    detail: string;
    command?: string;
    priority?: string;
  }>;
}

export function buildEffectiveSystemPrompt(options: {
  incidentState: IncidentState;
  scenario?: PromptScenario;
  operatorUid?: string;
}): string {
  const { incidentState, scenario, operatorUid } = options;

  let scenarioContextBlock = '';
  if (scenario) {
    const parts: string[] = [];
    if (scenario.title) parts.push(`• Active Incident: ${scenario.title} (${scenario.severity || 'SEV-1'})`);
    if (scenario.affectedServices?.length) parts.push(`• Affected Services: ${scenario.affectedServices.join(', ')}`);
    if (scenario.description) parts.push(`• Incident Overview: ${scenario.description}`);
    if (scenario.impact) parts.push(`• Real-Time Impact: ${scenario.impact}`);
    if (scenario.suspectedCause) parts.push(`• Suspected Root Cause: ${scenario.suspectedCause}`);
    if (scenario.personas?.length) {
      const stakeholderList = scenario.personas
        .map((p) => `${p.displayName} (${p.role})`)
        .join(', ');
      parts.push(`• On-Call Engineering Directory (Offline Stakeholders): ${stakeholderList}`);
    }
    if (scenario.playbook && scenario.playbook.length > 0) {
      const runbookSteps = scenario.playbook
        .map(
          (step, idx) =>
            `  ${idx + 1}. [${step.phase.toUpperCase()}] ${step.title}: ${step.detail}${step.command ? ` | Command: \`${step.command}\`` : ''}`
        )
        .join('\n');
      parts.push(`• Tactical Runbook / Playbook Steps:\n${runbookSteps}`);
    }
    if (parts.length > 0) {
      scenarioContextBlock = `\n\n═══════════════════════════════════════════════\nACTIVE SCENARIO BRIEFING: ${scenario.title || 'Mission Context'}\n═══════════════════════════════════════════════\n${parts.join('\n')}\nCRITICAL DIRECTIVE: You are actively managing THIS specific incident. Ground all metrics, hypotheses, runbook instructions, and queries in this scenario.`;
    }
  }

  const dynamicContext = buildDynamicIncidentContext(incidentState, operatorUid);

  return `${AURA_SYSTEM_PROMPT}${scenarioContextBlock}\n\n═══════════════════════════════════════════════\nCURRENT INCIDENT SITUATION & REAL-TIME CONTEXT\n═══════════════════════════════════════════════\n${dynamicContext}`;
}
