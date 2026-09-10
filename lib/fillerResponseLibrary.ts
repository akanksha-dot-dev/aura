/**
 * fillerResponseLibrary.ts — Human-like rotating response templates for AURA.
 *
 * Provides contextually appropriate, natural-sounding responses to filler words
 * and emotional states detected during live incident war rooms.
 *
 * Design principles:
 * 1. Rotation — Never repeat the same response twice in a row per category
 * 2. Personalization — Always address the speaker by first name
 * 3. Context injection — Reference the incident/service when relevant
 * 4. Emotional mirroring — Match/de-escalate energy level appropriately
 * 5. Brevity — Keep backchannels short (< 10 words), interventions medium (< 25)
 */

import type { FillerCategory } from './conversationalIntelligence';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FillerResponseContext {
  /** First name of the speaker (or full name if single word) */
  speakerName: string;
  /** Current incident title, e.g., "checkout service outage" */
  incidentTitle?: string;
  /** Current incident severity */
  severity?: string;
  /** Number of active hypotheses in the war room */
  activeHypotheses?: number;
  /** Whether a resolution is close (hypothesis confirmed) */
  isNearResolution?: boolean;
  /** Minutes elapsed since incident opened */
  elapsedMinutes?: number;
  /** Whether AURA has spoken in the last 30 seconds */
  auraRecentlySpoke?: boolean;
}

export interface FillerResponse {
  text: string;
  /** Prosody style for TTS delivery */
  prosodyStyle: 'calm_authoritative' | 'empathetic_steady' | 'urgent_focused' | 'energized_collaborative';
  /** Whether AURA should pause before speaking (ms) */
  preDelay: number;
  /** Whether this is a backchannel (brief, low-priority) or intervention (higher-priority) */
  type: 'backchannel' | 'intervention' | 'acknowledgment';
}

// ── Rotation state ────────────────────────────────────────────────────────────

const _lastUsedIndex: Partial<Record<FillerCategory | 'agreement' | 'generic', number>> = {};

function pickRotating<T>(
  items: T[],
  key: FillerCategory | 'agreement' | 'generic',
): T {
  const last = _lastUsedIndex[key] ?? -1;
  let next = (last + 1) % items.length;
  // Add entropy to avoid predictable cycling in short arrays
  if (items.length > 2 && Math.random() > 0.7) {
    next = Math.floor(Math.random() * items.length);
    if (next === last) next = (next + 1) % items.length;
  }
  _lastUsedIndex[key] = next;
  return items[next];
}

function firstName(name: string): string {
  return name.split(' ')[0];
}

// ── Response Templates ─────────────────────────────────────────────────────────

const RESPONSES: Record<
  FillerCategory | 'agreement' | 'generic' | 'long_monologue' | 'multi_speaker_confusion',
  Array<(ctx: FillerResponseContext) => FillerResponse>
> = {

  // "hmm", "uhh", "let me think", "erm"
  thinking: [
    (ctx) => ({
      text: `Take your time, ${firstName(ctx.speakerName)}. I'm capturing everything.`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 1200,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `No rush, ${firstName(ctx.speakerName)}. What are you seeing?`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 1500,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `I'm listening, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 1800,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Still with you, ${firstName(ctx.speakerName)}. Processing.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 2000,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Take a moment, ${firstName(ctx.speakerName)}. We're tracking.`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 1600,
      type: 'backchannel',
    }),
  ],

  // "ohh!", "aha!", "I found it!", "got it"
  discovery: [
    (ctx) => ({
      text: `That sounds significant, ${firstName(ctx.speakerName)}. Walk me through it.`,
      prosodyStyle: 'energized_collaborative',
      preDelay: 400,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Okay, ${firstName(ctx.speakerName)} — what exactly did you find?`,
      prosodyStyle: 'energized_collaborative',
      preDelay: 300,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `That's potentially our breakthrough. ${firstName(ctx.speakerName)}, can you share your screen or describe what you're seeing?`,
      prosodyStyle: 'energized_collaborative',
      preDelay: 500,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Let's capture that immediately. ${firstName(ctx.speakerName)}, what is it?`,
      prosodyStyle: 'urgent_focused',
      preDelay: 300,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `${firstName(ctx.speakerName)} — logging a discovery signal. Please tell the room.`,
      prosodyStyle: 'energized_collaborative',
      preDelay: 400,
      type: 'intervention',
    }),
  ],

  // "damn", "ugh", "not again", "still broken"
  frustration: [
    (ctx) => ({
      text: `I hear you, ${firstName(ctx.speakerName)}. Let's slow down and focus on one thing at a time.`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 800,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `This is tough, but we've got this, ${firstName(ctx.speakerName)}. What's the most critical path right now?`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 700,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Acknowledged, ${firstName(ctx.speakerName)}. Let me read back where we are so we can reset.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 600,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `${firstName(ctx.speakerName)}, that frustration makes sense — ${ctx.elapsedMinutes ? `we're ${ctx.elapsedMinutes} minutes in` : 'this has been going on a while'}. What's blocking us specifically?`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 900,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Let's not spiral, ${firstName(ctx.speakerName)}. One step. What can we verify right now?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 600,
      type: 'intervention',
    }),
  ],

  // "huh?", "sorry?", "I don't understand"
  confusion: [
    (ctx) => ({
      text: `Happy to clarify, ${firstName(ctx.speakerName)}. What part is unclear?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 500,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Let me re-frame that for you, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 600,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Good catch, ${firstName(ctx.speakerName)} — let's make sure everyone is aligned. Can you say what's unclear?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 500,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `${firstName(ctx.speakerName)}, I'll give a quick readback so we're all on the same page.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 700,
      type: 'intervention',
    }),
  ],

  // "no", "that's not right", "I disagree"
  negation: [
    (ctx) => ({
      text: `Noted, ${firstName(ctx.speakerName)}. What's your read on it?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 400,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Logging a conflict. ${firstName(ctx.speakerName)}, can you state the alternative clearly so I can log it?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 400,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Disagreement flagged. ${firstName(ctx.speakerName)}, what evidence supports your view?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 500,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `This is important, ${firstName(ctx.speakerName)}. The team needs to hear your perspective — go ahead.`,
      prosodyStyle: 'energized_collaborative',
      preDelay: 400,
      type: 'intervention',
    }),
  ],

  // "wait", "hold on", "one sec"
  hesitation: [
    (ctx) => ({
      text: `Standing by, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 1000,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Sure, ${firstName(ctx.speakerName)} — take your time.`,
      prosodyStyle: 'empathetic_steady',
      preDelay: 1200,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Room is with you, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 1100,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Pausing, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 1000,
      type: 'backchannel',
    }),
  ],

  // "yes", "right", "absolutely", "agreed"
  agreement: [
    (ctx) => ({
      text: `Good, ${firstName(ctx.speakerName)}. I've logged that as confirmed.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 300,
      type: 'acknowledgment',
    }),
    (ctx) => ({
      text: `Confirmed. Moving on.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'acknowledgment',
    }),
    (ctx) => ({
      text: `Aligned. ${firstName(ctx.speakerName)}, anything to add before we proceed?`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 300,
      type: 'acknowledgment',
    }),
    () => ({
      text: `Good.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
  ],

  // "ok", "understood", "got it"
  acknowledgment: [
    () => ({
      text: `Copy.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Noted, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
    () => ({
      text: `Received.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Got it, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
  ],

  // "asap", "now", "critical", "urgent"
  urgency: [
    (ctx) => ({
      text: `On it, ${firstName(ctx.speakerName)}. Everyone, this is a priority action.`,
      prosodyStyle: 'urgent_focused',
      preDelay: 200,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Heard, ${firstName(ctx.speakerName)}. Flagging as critical. Who's executing this?`,
      prosodyStyle: 'urgent_focused',
      preDelay: 200,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `Logging as urgent. ${firstName(ctx.speakerName)}, confirm the owner and ETA.`,
      prosodyStyle: 'urgent_focused',
      preDelay: 200,
      type: 'intervention',
    }),
    (ctx) => ({
      text: `${firstName(ctx.speakerName)}, escalating to top of queue. Please confirm the action.`,
      prosodyStyle: 'urgent_focused',
      preDelay: 200,
      type: 'intervention',
    }),
  ],

  // Generic backchannel during long monologues (>30s continuous speech)
  long_monologue: [
    (ctx) => ({
      text: `Mhm. Keep going, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 0,
      type: 'backchannel',
    }),
    () => ({
      text: `I see.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 0,
      type: 'backchannel',
    }),
    () => ({
      text: `Mm.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 0,
      type: 'backchannel',
    }),
    (ctx) => ({
      text: `Go on, ${firstName(ctx.speakerName)}.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 0,
      type: 'backchannel',
    }),
    () => ({
      text: `I'm tracking.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 0,
      type: 'backchannel',
    }),
  ],

  // When 3+ speakers talk over each other
  multi_speaker_confusion: [
    () => ({
      text: `Let's go one at a time. I want to hear everyone clearly.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 300,
      type: 'intervention',
    }),
    () => ({
      text: `One voice please. I can't log what I can't hear.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 300,
      type: 'intervention',
    }),
    () => ({
      text: `Room, let's take turns. Incident commander, please take the floor.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 400,
      type: 'intervention',
    }),
  ],

  // Generic catch-all
  generic: [
    (ctx) => ({
      text: `${firstName(ctx.speakerName)}, noted.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 300,
      type: 'backchannel',
    }),
    () => ({
      text: `Copy.`,
      prosodyStyle: 'calm_authoritative',
      preDelay: 200,
      type: 'backchannel',
    }),
  ],
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a human-like response for a detected filler category.
 *
 * @param category   The filler category detected (or null for generic)
 * @param ctx        Context about the speaker and incident
 * @returns          A ready-to-speak FillerResponse, or null if AURA should stay silent
 */
export function getFillerResponse(
  category: FillerCategory | 'agreement' | 'generic' | 'long_monologue' | 'multi_speaker_confusion',
  ctx: FillerResponseContext,
): FillerResponse | null {
  // Don't respond to every single filler — use probability gating
  const categoryProbabilities: Partial<Record<typeof category, number>> = {
    thinking:              0.65, // Respond 65% of the time (not every "hmm")
    hesitation:            0.50,
    acknowledgment:        0.40, // Very frequent — keep most silent
    agreement:             0.45,
    discovery:             1.00, // Always respond to discoveries
    frustration:           0.90, // Almost always respond to frustration
    negation:              0.95, // Always respond to disagreement
    confusion:             0.95,
    urgency:               1.00,
    long_monologue:        0.30, // Sparse backchannels during long speech
    multi_speaker_confusion: 1.00,
    generic:               0.20,
  };

  const prob = categoryProbabilities[category] ?? 0.3;
  if (Math.random() > prob) return null;

  // Don't speak if AURA just spoke in the last 5 seconds (unless urgent)
  if (ctx.auraRecentlySpoke && category !== 'urgency' && category !== 'discovery') {
    return null;
  }

  const templates = RESPONSES[category];
  if (!templates || templates.length === 0) {
    return RESPONSES.generic[0](ctx);
  }

  const templateFn = pickRotating(templates, category);
  return templateFn(ctx);
}

/**
 * Get a contextual confirmation echo — AURA repeats back what it heard.
 * Used after key decisions or actions are announced.
 */
export function getConfirmationEcho(
  content: string,
  category: 'decision' | 'action' | 'hypothesis',
  speakerName: string,
): string {
  const name = firstName(speakerName);
  const categoryLabel = { decision: 'decision', action: 'action item', hypothesis: 'hypothesis' }[category];

  const templates = [
    `Logging that as a ${categoryLabel}: "${truncate(content, 60)}". Confirmed, ${name}?`,
    `Got it — ${categoryLabel} logged: "${truncate(content, 60)}".`,
    `${name}, I've recorded that ${categoryLabel}. Proceeding.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get a contextual situation readback — AURA summarizes the current war room state.
 */
export function getSituationReadback(
  speakerCount: number,
  evidenceCount: number,
  hypothesisCount: number,
  elapsedMinutes: number,
  severity: string,
): string {
  const templates = [
    `Quick readback: We're ${elapsedMinutes} minutes into this ${severity}. We have ${speakerCount} responders, ${evidenceCount} evidence items, and ${hypothesisCount} active hypotheses. What's our highest confidence path to resolution?`,
    `Situation check: ${elapsedMinutes} minutes elapsed. ${hypothesisCount} hypotheses in play. Who has the strongest evidence right now?`,
    `I want to make sure we're all aligned. It's been ${elapsedMinutes} minutes. We have ${evidenceCount} facts logged. What's our current best hypothesis and who's owning the fix?`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get a name-personalized greeting when a new participant joins mid-incident.
 */
export function getParticipantOnboardingMessage(
  newParticipantName: string,
  incidentTitle: string,
  elapsedMinutes: number,
  keyFact: string | null,
): string {
  const name = firstName(newParticipantName);
  const base = `Welcome, ${name}. We're ${elapsedMinutes} minutes into a ${incidentTitle}.`;
  const context = keyFact ? ` Key finding so far: ${keyFact}.` : '';
  return `${base}${context} I'll catch you up — any questions, just ask.`;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
