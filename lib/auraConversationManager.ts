/**
 * auraConversationManager.ts — Central conversational brain for AURA's live war room presence.
 *
 * Orchestrates all real-time conversational systems into one coherent engine:
 * 1. Speaker turn tracking per participant
 * 2. Filler word detection → human-like response selection
 * 3. Backchannel generation during long monologues
 * 4. Emotional state detection → empathetic tone adjustment
 * 5. Conversation memory — references earlier points by name
 * 6. Proactive silence/stall/conflict interventions
 * 7. Confirmation echoes for decisions and actions
 * 8. Natural response latency (400–1200ms) for human-like timing
 *
 * This class is the "human face" of AURA — it makes the AI feel like
 * a calm, attentive, senior incident commander on the call.
 */

import {
  detectFillers,
  TurnTakingManager,
  type FillerCategory,
  type TurnTakingState,
} from './conversationalIntelligence';

import {
  getFillerResponse,
  getConfirmationEcho,
  getSituationReadback,
  getParticipantOnboardingMessage,
  type FillerResponseContext,
  type FillerResponse,
} from './fillerResponseLibrary';

import { speakWithProsody, type ProsodyOptions } from './tts';

import type { IncidentState, EvidenceItem } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmotionalState = 'stressed' | 'calm' | 'frustrated' | 'confused' | 'energized';

export interface SpeakerTurn {
  uid: string;
  name: string;
  transcript: string;
  startedAt: number;
  endedAt?: number;
  fillerDetected: FillerCategory | null;
  emotionalState: EmotionalState;
  /** Duration of this turn in ms */
  durationMs: number;
  /** Whether this turn contained a key assertion (hypothesis/decision/action) */
  hasKeyAssertion: boolean;
}

export interface AuraResponse {
  /** Whether AURA should speak */
  shouldSpeak: boolean;
  /** What AURA should say */
  text: string | null;
  /** Prosody for TTS delivery */
  prosody: ProsodyOptions;
  /** Pre-delay before speaking (ms) — for natural timing */
  preDelay: number;
  /** Why AURA is responding */
  reason: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low' | 'silent';
}

export interface ConversationMemoryEntry {
  speaker: string;
  speakerUid: string;
  fact: string;
  timestamp: number;
  category: 'fact' | 'hypothesis' | 'decision' | 'action';
}

export interface ConversationManagerConfig {
  /** Whether to respond to fillers at all */
  fillerResponseEnabled: boolean;
  /** Whether to send backchannels during long monologues */
  backchannelEnabled: boolean;
  /** Minimum seconds between any two AURA responses (anti-spam) */
  cooldownSec: number;
  /** Minimum seconds of silence before AURA reads back the situation */
  silenceReadbackSec: number;
  /** Whether to echo back decisions/actions for confirmation */
  confirmationEchoEnabled: boolean;
  /** Whether to reference earlier facts by name */
  memoryEnabled: boolean;
}

// ── Emotional State Detector ──────────────────────────────────────────────────

function detectEmotionalState(
  transcript: string,
  fillerCategory: FillerCategory | null,
): EmotionalState {
  if (fillerCategory === 'frustration') return 'frustrated';
  if (fillerCategory === 'confusion') return 'confused';
  if (fillerCategory === 'urgency') return 'stressed';
  if (fillerCategory === 'discovery' || fillerCategory === 'agreement') return 'energized';

  // Transcript-level stress signals
  const stressed =
    /\b(still not working|nothing works|what's happening|still failing|worse|escalate|p0|sev.?0)\b/i.test(transcript);
  if (stressed) return 'stressed';

  const confused = /\b(don't understand|makes no sense|not sure why|weird|unexpected)\b/i.test(transcript);
  if (confused) return 'confused';

  return 'calm';
}

// ── Emotional state → Prosody mapping ────────────────────────────────────────

function emotionalStateToProsody(state: EmotionalState): ProsodyOptions {
  const map: Record<EmotionalState, ProsodyOptions> = {
    calm:       { style: 'calm_authoritative',     rateMultiplier: 1.0, pitchShift: 1.15 },
    stressed:   { style: 'urgent_focused',          rateMultiplier: 1.05, pitchShift: 1.1 },
    frustrated: { style: 'empathetic_steady',       rateMultiplier: 0.9, pitchShift: 1.05 },
    confused:   { style: 'empathetic_steady',       rateMultiplier: 0.92, pitchShift: 1.08 },
    energized:  { style: 'energized_collaborative', rateMultiplier: 1.05, pitchShift: 1.2 },
  };
  return map[state];
}

// ── Conversation Memory ───────────────────────────────────────────────────────

export class ConversationMemory {
  private entries: ConversationMemoryEntry[] = [];
  private readonly maxEntries = 50;

  remember(
    speakerUid: string,
    speakerName: string,
    fact: string,
    category: ConversationMemoryEntry['category'],
  ): void {
    this.entries.push({
      speaker: speakerName,
      speakerUid,
      fact,
      timestamp: Date.now(),
      category,
    });
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /** Find a recent memory entry for a topic keyword */
  recall(topicKeyword: string): ConversationMemoryEntry | null {
    const lower = topicKeyword.toLowerCase();
    // Search most recent first
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].fact.toLowerCase().includes(lower)) {
        return this.entries[i];
      }
    }
    return null;
  }

  /** Get a contextual reference phrase for use in AURA's speech */
  getContextualReference(topicKeyword: string): string | null {
    const entry = this.recall(topicKeyword);
    if (!entry) return null;
    const ageMin = Math.floor((Date.now() - entry.timestamp) / 60000);
    if (ageMin > 15) return null; // Too old to be relevant
    const ago = ageMin < 1 ? 'just now' : `${ageMin} minute${ageMin > 1 ? 's' : ''} ago`;
    return `Earlier, ${entry.speaker.split(' ')[0]} mentioned ${entry.fact.slice(0, 60)} — ${ago}.`;
  }

  getRecentFacts(limit = 3): ConversationMemoryEntry[] {
    return this.entries
      .filter(e => e.category === 'fact' || e.category === 'hypothesis')
      .slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }
}

// ── Main AuraConversationManager Class ───────────────────────────────────────

export class AuraConversationManager {
  private turnManager: TurnTakingManager;
  private memory: ConversationMemory;
  private config: ConversationManagerConfig;

  private lastAuraResponseAt = 0;
  private lastSpeechEndAt = 0;
  private lastReadbackAt = 0;

  /** Running duration of current monologue for backchannel triggering */
  private currentMonologueDurationMs = 0;
  private lastBackchannelAt = 0;

  /** Track who is currently speaking */
  private currentSpeakerUid: string | null = null;
  private currentSpeakerName: string | null = null;

  /** Whether AURA is currently speaking via TTS */
  private auraIsSpeaking = false;

  private pendingResponse: AuraResponse | null = null;

  constructor(config: Partial<ConversationManagerConfig> = {}) {
    this.config = {
      fillerResponseEnabled: true,
      backchannelEnabled: true,
      cooldownSec: 4,
      silenceReadbackSec: 90,
      confirmationEchoEnabled: true,
      memoryEnabled: true,
      ...config,
    };
    this.turnManager = new TurnTakingManager();
    this.memory = new ConversationMemory();
  }

  /**
   * Process a completed speaker turn (transcribed utterance).
   *
   * Call this whenever a speaker finishes a sentence or utterance with
   * a final transcript. This is the main entry point for conversational reactions.
   *
   * @param turn      The completed speaker turn with transcript
   * @param state     Current incident state (for context injection)
   * @returns         AuraResponse indicating what (if anything) AURA should say
   */
  async processTurn(
    turn: SpeakerTurn,
    state: IncidentState,
  ): Promise<AuraResponse> {
    // Always update memory with key assertions
    if (this.config.memoryEnabled && turn.hasKeyAssertion && turn.transcript.length > 10) {
      const category = this.inferCategory(turn.transcript);
      this.memory.remember(turn.uid, turn.name, turn.transcript, category);
    }

    // Record turn timing
    this.lastSpeechEndAt = Date.now();
    this.currentMonologueDurationMs = 0;

    // Check cooldown
    if (!this.isCooldownOver()) {
      return this.silent('cooldown');
    }

    // Don't respond if AURA is currently speaking
    if (this.auraIsSpeaking) {
      return this.silent('aura_speaking');
    }

    const ctx = this.buildContext(turn.name, state);

    // 1. Handle filler words first
    if (this.config.fillerResponseEnabled && turn.fillerDetected) {
      const response = getFillerResponse(turn.fillerDetected, ctx);
      if (response) {
        return this.makeResponse(response, `filler:${turn.fillerDetected}`, 'medium');
      }
    }

    // 2. Handle emotional escalation
    if (turn.emotionalState === 'frustrated' || turn.emotionalState === 'stressed') {
      const response = getFillerResponse(
        turn.emotionalState === 'frustrated' ? 'frustration' : 'urgency',
        ctx,
      );
      if (response) {
        return this.makeResponse(response, `emotional:${turn.emotionalState}`, 'high');
      }
    }

    // 3. Handle confirmation echoes for key assertions
    if (
      this.config.confirmationEchoEnabled &&
      turn.hasKeyAssertion &&
      turn.transcript.length > 15
    ) {
      const category = this.inferCategory(turn.transcript);
      if (category !== 'fact') {
        const echo = getConfirmationEcho(turn.transcript, category, turn.name);
        return {
          shouldSpeak: true,
          text: echo,
          prosody: emotionalStateToProsody('calm'),
          preDelay: 600,
          reason: `confirmation_echo:${category}`,
          priority: 'medium',
        };
      }
    }

    // 4. No proactive response needed
    return this.silent('no_trigger');
  }

  /**
   * Called on every audio frame (~50ms) to manage turn-taking and backchannels.
   *
   * @param isSomeoneSpeaking  Whether any participant is currently speaking
   * @param speakerUid         Current speaker UID (or null)
   * @param speakerName        Current speaker display name (or null)
   * @param state              Current incident state
   */
  onAudioFrame(
    isSomeoneSpeaking: boolean,
    speakerUid: string | null,
    speakerName: string | null,
    state: IncidentState,
  ): AuraResponse | null {
    if (speakerUid) {
      this.currentSpeakerUid = speakerUid;
      this.currentSpeakerName = speakerName;
    }

    // Update monologue timer
    if (isSomeoneSpeaking) {
      this.currentMonologueDurationMs += 50;
    } else {
      this.currentMonologueDurationMs = 0;
    }

    // Backchannel during long monologue (>30 seconds)
    if (
      this.config.backchannelEnabled &&
      this.currentMonologueDurationMs > 30_000 &&
      speakerName &&
      Date.now() - this.lastBackchannelAt > 20_000 &&
      this.isCooldownOver() &&
      !this.auraIsSpeaking
    ) {
      const ctx = this.buildContext(speakerName, state);
      const response = getFillerResponse('long_monologue', ctx);
      if (response) {
        this.lastBackchannelAt = Date.now();
        return this.makeResponse(response, 'backchannel:long_monologue', 'low');
      }
    }

    // Silence readback trigger
    if (
      !isSomeoneSpeaking &&
      this.lastSpeechEndAt > 0 &&
      Date.now() - this.lastSpeechEndAt > this.config.silenceReadbackSec * 1000 &&
      Date.now() - this.lastReadbackAt > 120_000 && // max once per 2 min
      this.isCooldownOver() &&
      !this.auraIsSpeaking &&
      state.evidenceItems.length >= 3
    ) {
      this.lastReadbackAt = Date.now();
      const elapsedMin = Math.floor((Date.now() - state.openedAt) / 60000);
      const speakerCount = Object.keys(state.participants).length;
      const hypotheses = state.evidenceItems.filter(e => e.category === 'hypothesis' && e.status === 'active');
      const readback = getSituationReadback(
        speakerCount,
        state.evidenceItems.length,
        hypotheses.length,
        elapsedMin,
        state.severity,
      );
      return {
        shouldSpeak: true,
        text: readback,
        prosody: { style: 'calm_authoritative', rateMultiplier: 0.95 },
        preDelay: 1000,
        reason: 'silence_readback',
        priority: 'medium',
      };
    }

    return null;
  }

  /**
   * Called when a new participant joins mid-incident.
   */
  onParticipantJoined(
    participantName: string,
    state: IncidentState,
  ): AuraResponse {
    const elapsedMin = Math.floor((Date.now() - state.openedAt) / 60000);
    const recentFacts = this.memory.getRecentFacts(1);
    const keyFact = recentFacts.length > 0 ? recentFacts[0].fact : null;

    const welcome = getParticipantOnboardingMessage(
      participantName,
      state.title,
      elapsedMin,
      keyFact,
    );

    return {
      shouldSpeak: true,
      text: welcome,
      prosody: { style: 'calm_authoritative', rateMultiplier: 0.95 },
      preDelay: 800,
      reason: 'participant_onboarding',
      priority: 'medium',
    };
  }

  /**
   * Called when multi-speaker overlap is detected (3+ speakers simultaneously).
   */
  onMultiSpeakerOverlap(): AuraResponse | null {
    if (!this.isCooldownOver() || this.auraIsSpeaking) return null;

    const response = getFillerResponse('multi_speaker_confusion', {
      speakerName: 'team',
    });
    if (!response) return null;

    return this.makeResponse(response, 'overlap:multi_speaker', 'high');
  }

  /**
   * Speak an AURA response via TTS, with proper echo gate signalling.
   * Integrates with the VoiceCancellationPipeline echo gate.
   *
   * @param response     AuraResponse from processTurn or onAudioFrame
   * @param onSpeakStart Callback when TTS starts (for echo gate)
   * @param onSpeakEnd   Callback when TTS ends (for echo gate)
   */
  async speak(
    response: AuraResponse,
    onSpeakStart?: () => void,
    onSpeakEnd?: () => void,
  ): Promise<void> {
    if (!response.shouldSpeak || !response.text) return;

    // Natural pre-delay
    if (response.preDelay > 0) {
      await new Promise(r => setTimeout(r, response.preDelay));
    }

    this.auraIsSpeaking = true;
    this.lastAuraResponseAt = Date.now();
    onSpeakStart?.();

    try {
      await speakWithProsody(response.text, response.prosody);
    } finally {
      this.auraIsSpeaking = false;
      onSpeakEnd?.();
    }
  }

  // ── State Management ─────────────────────────────────────────────────────────

  setAuraSpeaking(speaking: boolean): void {
    this.auraIsSpeaking = speaking;
    if (!speaking) {
      this.lastAuraResponseAt = Date.now();
    }
  }

  getMemory(): ConversationMemory {
    return this.memory;
  }

  updateConfig(updates: Partial<ConversationManagerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  reset(): void {
    this.lastAuraResponseAt = 0;
    this.lastSpeechEndAt = 0;
    this.lastReadbackAt = 0;
    this.currentMonologueDurationMs = 0;
    this.lastBackchannelAt = 0;
    this.currentSpeakerUid = null;
    this.currentSpeakerName = null;
    this.auraIsSpeaking = false;
    this.pendingResponse = null;
    this.memory.clear();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private isCooldownOver(): boolean {
    return Date.now() - this.lastAuraResponseAt > this.config.cooldownSec * 1000;
  }

  private buildContext(
    speakerName: string,
    state: IncidentState,
  ): FillerResponseContext {
    const hypotheses = state.evidenceItems.filter(e => e.category === 'hypothesis' && e.status === 'active');
    return {
      speakerName,
      incidentTitle: state.title,
      severity: state.severity,
      activeHypotheses: hypotheses.length,
      isNearResolution: state.status === 'identified' || state.status === 'monitoring',
      elapsedMinutes: Math.floor((Date.now() - state.openedAt) / 60000),
      auraRecentlySpoke: Date.now() - this.lastAuraResponseAt < 30_000,
    };
  }

  private makeResponse(
    fr: FillerResponse,
    reason: string,
    priority: AuraResponse['priority'],
  ): AuraResponse {
    return {
      shouldSpeak: true,
      text: fr.text,
      prosody: emotionalStateToProsody(
        fr.prosodyStyle === 'empathetic_steady' ? 'frustrated'
          : fr.prosodyStyle === 'urgent_focused' ? 'stressed'
          : fr.prosodyStyle === 'energized_collaborative' ? 'energized'
          : 'calm',
      ),
      preDelay: fr.preDelay,
      reason,
      priority,
    };
  }

  private silent(reason: string): AuraResponse {
    return {
      shouldSpeak: false,
      text: null,
      prosody: {},
      preDelay: 0,
      reason,
      priority: 'silent',
    };
  }

  private inferCategory(
    transcript: string,
  ): 'fact' | 'hypothesis' | 'decision' | 'action' {
    const lower = transcript.toLowerCase();
    if (/\b(decided|we will|going to|let's|action:|task:|assign|@|owner)\b/.test(lower)) return 'action';
    if (/\b(we should|decision:|decided|agreed|resolution)\b/.test(lower)) return 'decision';
    if (/\b(might be|could be|possibly|probably|suspect|hypothesis|think it's)\b/.test(lower)) return 'hypothesis';
    return 'fact';
  }
}

// ── Singleton for use in hooks ────────────────────────────────────────────────

let _managerInstance: AuraConversationManager | null = null;

export function getConversationManager(
  config?: Partial<ConversationManagerConfig>,
): AuraConversationManager {
  if (!_managerInstance) {
    _managerInstance = new AuraConversationManager(config);
  }
  return _managerInstance;
}

export function resetConversationManager(): void {
  if (_managerInstance) {
    _managerInstance.reset();
    _managerInstance = null;
  }
}

/**
 * Process a transcript utterance and get AURA's conversational response.
 * Convenience wrapper for use in RTM message handlers.
 */
export async function processTranscriptForConversation(
  speakerUid: string,
  speakerName: string,
  transcript: string,
  state: IncidentState,
): Promise<AuraResponse> {
  const manager = getConversationManager();

  // Detect fillers
  const fillers = detectFillers(transcript);
  const topFiller = fillers.length > 0 ? fillers[0].category : null;

  // Build turn object
  const turn: SpeakerTurn = {
    uid: speakerUid,
    name: speakerName,
    transcript,
    startedAt: Date.now() - 2000, // approximate
    endedAt: Date.now(),
    fillerDetected: topFiller,
    emotionalState: detectEmotionalState(transcript, topFiller),
    durationMs: 2000,
    hasKeyAssertion: transcript.length > 20,
  };

  return manager.processTurn(turn, state);
}

// Re-export for convenience
export { detectEmotionalState };
