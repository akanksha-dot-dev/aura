/**
 * conversationalIntelligence.ts — Human-like conversational behavior engine for AURA.
 *
 * Makes AURA's voice interactions indistinguishable from a senior incident commander:
 *
 * 1. Turn-Taking Manager — Natural pause detection before AURA responds
 * 2. Backchannel Generator — Brief acknowledgments during long speech
 * 3. Emotional Tone Analysis — Pitch/rate/volume-based stress detection
 * 4. Filler Word Taxonomy — Comprehensive filler word classification & response shaping
 * 5. Context-Aware Response Shaping — Adapts tone based on detected emotional state
 */

// ── Filler Word Taxonomy ─────────────────────────────────────────────────────

export type FillerCategory =
  | 'thinking'
  | 'agreement'
  | 'hesitation'
  | 'discovery'
  | 'confusion'
  | 'urgency'
  | 'negation'
  | 'acknowledgment'
  | 'frustration'
  | 'long_monologue'
  | 'multi_speaker_confusion';

export interface FillerDetection {
  category: FillerCategory;
  matchedPhrase: string;
  confidence: number; // 0-100
}

const FILLER_PATTERNS: Array<{
  category: FillerCategory;
  patterns: RegExp[];
  priority: number; // Higher = checked first
}> = [
  {
    category: 'urgency',
    priority: 10,
    patterns: [
      /\b(quick(?:ly)?|now|immediately|asap|hurry|urgent(?:ly)?|right now|this instant)\b/i,
      /\b(we need to|we have to|critical|p0|sev[- ]?0|emergency)\b/i,
    ],
  },
  {
    category: 'discovery',
    priority: 9,
    patterns: [
      /^(a+h+!?|o+h+!?|oh wait|oh!|aha!?|eureka|I see|got it|found it|there it is|bingo)[\s.!]*$/i,
      /\b(I found|I see it|that's it|look at this|check this out|wait.*look)\b/i,
    ],
  },
  {
    category: 'frustration',
    priority: 8,
    patterns: [
      /\b(damn|ugh+|argh+|seriously|come on|not again|why is this|what the)\b/i,
      /\b(this is broken|nothing works|still broken|keeps failing)\b/i,
    ],
  },
  {
    category: 'confusion',
    priority: 7,
    patterns: [
      /^(huh\??|what\??|sorry\??|come again\??|say that again|I don't understand|pardon|excuse me)[\s.?]*$/i,
      /\b(I'm confused|doesn't make sense|that's weird|wait what|how is that)\b/i,
    ],
  },
  {
    category: 'negation',
    priority: 6,
    patterns: [
      /^(no+|nope|nah|negative|I don't think so|that's not right|disagree|not correct)[\s.]*$/i,
      /\b(that's wrong|incorrect|I disagree|actually no|not quite)\b/i,
    ],
  },
  {
    category: 'hesitation',
    priority: 5,
    patterns: [
      /^(wait|hold on|one sec|hang on|give me a (?:moment|second|minute)|let me (?:think|check|look))[\s.]*$/i,
      /\b(hold that thought|just a sec|before we continue|pause for a moment)\b/i,
    ],
  },
  {
    category: 'agreement',
    priority: 4,
    patterns: [
      /^(yes+|yeah+|right|exactly|correct|yep|yup|absolutely|agreed|affirmative|definitely|indeed|precisely|totally|100%?)[\s.!]*$/i,
      /\b(I agree|that's right|makes sense|sounds good|let's do it|go ahead|confirmed)\b/i,
    ],
  },
  {
    category: 'acknowledgment',
    priority: 3,
    patterns: [
      /^(ok+|okay|copy|roger|understood|noted|got it|sure|alright|fine|fair enough)[\s.]*$/i,
      /\b(I hear you|I understand|acknowledged|received|will do)\b/i,
    ],
  },
  {
    category: 'thinking',
    priority: 2,
    patterns: [
      /^(h+m+|u+h+|u+m+|e+r+m*|m+h+m+|let me see|let me think|so+|well+)[\s.]*$/i,
      /\b(I'm thinking|give me a sec|processing|let me.*recall|trying to remember)\b/i,
    ],
  },
];

/**
 * Detects filler words/phrases in transcribed text.
 * Returns all matching categories, sorted by priority.
 */
export function detectFillers(text: string): FillerDetection[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return []; // Only analyze short utterances

  const detections: FillerDetection[] = [];

  for (const group of FILLER_PATTERNS.sort((a, b) => b.priority - a.priority)) {
    for (const pattern of group.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        detections.push({
          category: group.category,
          matchedPhrase: match[0],
          confidence: trimmed.length < 30 ? 90 : 65, // Higher confidence for short utterances
        });
        break; // Only one match per category
      }
    }
  }

  return detections;
}

// ── Turn-Taking Manager ──────────────────────────────────────────────────────

export interface TurnTakingState {
  /** Whether it's currently AURA's turn to speak */
  isAuraTurn: boolean;
  /** How long the current silence has lasted (ms) */
  silenceDurationMs: number;
  /** Whether someone is mid-utterance */
  isSpeakerActive: boolean;
  /** Last speaker UID */
  lastSpeakerUid: string | null;
  /** Whether AURA should wait before responding */
  shouldWait: boolean;
  /** Reason for waiting */
  waitReason: string | null;
}

export class TurnTakingManager {
  private lastSpeechEndTime = 0;
  private lastSpeakerUid: string | null = null;
  private isSpeaking = false;
  private consecutiveSilenceFrames = 0;

  // Thresholds
  private readonly minPauseBeforeResponse = 500; // 500ms minimum pause
  private readonly thinkingPause = 2000; // Wait 2s if someone said "hmm"
  private readonly interruptionCooldown = 300; // 300ms after interruption

  /**
   * Update with current voice activity state.
   * Call this on every audio frame (~50ms intervals).
   */
  update(
    isSomeoneSpeaking: boolean,
    speakerUid: string | null,
    lastFillerCategory?: FillerCategory | null,
  ): TurnTakingState {
    const now = Date.now();

    if (isSomeoneSpeaking) {
      this.isSpeaking = true;
      this.lastSpeakerUid = speakerUid;
      this.consecutiveSilenceFrames = 0;
    } else {
      if (this.isSpeaking) {
        // Speaker just stopped
        this.lastSpeechEndTime = now;
        this.isSpeaking = false;
      }
      this.consecutiveSilenceFrames++;
    }

    const silenceMs = this.isSpeaking ? 0 : (now - this.lastSpeechEndTime);

    // Determine if AURA should wait
    let shouldWait = false;
    let waitReason: string | null = null;

    // Still speaking
    if (this.isSpeaking) {
      shouldWait = true;
      waitReason = 'Speaker is active';
    }
    // Not enough pause yet
    else if (silenceMs < this.minPauseBeforeResponse) {
      shouldWait = true;
      waitReason = 'Waiting for natural pause';
    }
    // Thinking filler detected — give extra time
    else if (lastFillerCategory === 'thinking' && silenceMs < this.thinkingPause) {
      shouldWait = true;
      waitReason = 'Speaker is thinking — giving space';
    }
    // Hesitation — also give extra time
    else if (lastFillerCategory === 'hesitation' && silenceMs < this.thinkingPause) {
      shouldWait = true;
      waitReason = 'Speaker paused — waiting for continuation';
    }

    return {
      isAuraTurn: !shouldWait && silenceMs >= this.minPauseBeforeResponse,
      silenceDurationMs: Math.round(silenceMs),
      isSpeakerActive: this.isSpeaking,
      lastSpeakerUid: this.lastSpeakerUid,
      shouldWait,
      waitReason,
    };
  }

  reset(): void {
    this.lastSpeechEndTime = 0;
    this.lastSpeakerUid = null;
    this.isSpeaking = false;
    this.consecutiveSilenceFrames = 0;
  }
}

// ── Backchannel Generator ────────────────────────────────────────────────────

export type BackchannelType = 'acknowledgment' | 'encouragement' | 'empathy' | 'redirect';

export interface Backchannel {
  type: BackchannelType;
  text: string;
  /** How long the speaker has been talking (s) before inserting this */
  triggerAfterSec: number;
}

const BACKCHANNEL_POOL: Backchannel[] = [
  // Acknowledgment (short, non-interrupting)
  { type: 'acknowledgment', text: 'Got it.', triggerAfterSec: 15 },
  { type: 'acknowledgment', text: 'Understood.', triggerAfterSec: 20 },
  { type: 'acknowledgment', text: 'Copy that.', triggerAfterSec: 25 },
  { type: 'acknowledgment', text: 'Noted.', triggerAfterSec: 30 },
  { type: 'acknowledgment', text: 'I\'m tracking.', triggerAfterSec: 35 },

  // Encouragement (when someone is explaining a hypothesis)
  { type: 'encouragement', text: 'Go on, I\'m listening.', triggerAfterSec: 20 },
  { type: 'encouragement', text: 'That\'s a good lead — continue.', triggerAfterSec: 25 },
  { type: 'encouragement', text: 'Interesting. What makes you think so?', triggerAfterSec: 30 },

  // Empathy (when stress is detected)
  { type: 'empathy', text: 'I hear you. Let\'s work through this.', triggerAfterSec: 15 },
  { type: 'empathy', text: 'This is tough, but we\'re making progress.', triggerAfterSec: 20 },

  // Redirect (when someone has been talking too long without conclusion)
  { type: 'redirect', text: 'Good context. What do you suggest as next steps?', triggerAfterSec: 45 },
  { type: 'redirect', text: 'Understood. Can we turn that into an action item?', triggerAfterSec: 50 },
  { type: 'redirect', text: 'Let me capture that. Shall we move to a decision?', triggerAfterSec: 55 },
];

/**
 * Selects an appropriate backchannel response based on how long the speaker
 * has been talking and the emotional context.
 */
export function selectBackchannel(
  speakingDurationSec: number,
  emotionalState: EmotionalState,
  recentFillers: FillerCategory[],
): Backchannel | null {
  // Don't backchannel too early
  if (speakingDurationSec < 12) return null;

  // Filter by trigger time
  const eligible = BACKCHANNEL_POOL.filter(
    b => b.triggerAfterSec <= speakingDurationSec
  );

  if (eligible.length === 0) return null;

  // Prioritize by emotional state
  let preferred: BackchannelType = 'acknowledgment';
  if (emotionalState.stressLevel > 70) preferred = 'empathy';
  else if (speakingDurationSec > 40) preferred = 'redirect';
  else if (recentFillers.includes('thinking') || recentFillers.includes('hesitation')) preferred = 'encouragement';

  const filtered = eligible.filter(b => b.type === preferred);
  const pool = filtered.length > 0 ? filtered : eligible;

  // Pick a random one from the eligible pool
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Emotional Tone Analysis ──────────────────────────────────────────────────

export interface EmotionalState {
  /** Overall stress level (0-100) */
  stressLevel: number;
  /** Speaking urgency (0-100) */
  urgency: number;
  /** Confidence in speaker's assertions (0-100) */
  speakerConfidence: number;
  /** Emotional valence: 'calm' | 'stressed' | 'frustrated' | 'excited' */
  valence: 'calm' | 'stressed' | 'frustrated' | 'excited';
  /** Should AURA adapt its response tone? */
  shouldAdaptTone: boolean;
  /** Recommended AURA tone adjustment */
  toneAdjustment: ToneAdjustment;
}

export interface ToneAdjustment {
  /** Speech rate multiplier (0.8 = slower, 1.2 = faster) */
  rateMultiplier: number;
  /** Pitch shift in semitones (-2 to +2) */
  pitchShift: number;
  /** Volume multiplier (0.8 = softer, 1.2 = louder) */
  volumeMultiplier: number;
  /** Insert pauses between clauses (ms) */
  clausePauseMs: number;
  /** Response style hint */
  style: 'calm_authoritative' | 'urgent_focused' | 'empathetic_steady' | 'energized_collaborative';
}

/**
 * Analyzes emotional tone from speech metrics.
 *
 * @param speechRateWPM Words per minute of the speaker
 * @param avgPitchHz Average fundamental frequency
 * @param pitchVariance How much pitch varies (higher = more emotional)
 * @param volumeDb Average volume level
 * @param recentFillers Recently detected filler categories
 */
export function analyzeEmotionalTone(
  speechRateWPM: number,
  avgPitchHz: number,
  pitchVariance: number,
  volumeDb: number,
  recentFillers: FillerCategory[],
): EmotionalState {
  // Normal speech: 120-150 WPM, pitch 85-255 Hz, variance < 50
  const isRapid = speechRateWPM > 180;
  const isLoud = volumeDb > -20;
  const isHighPitch = avgPitchHz > 200;
  const isHighVariance = pitchVariance > 60;

  // Calculate stress level (0-100)
  let stressLevel = 20; // Baseline
  if (isRapid) stressLevel += 25;
  if (isHighPitch && isHighVariance) stressLevel += 20;
  if (isLoud) stressLevel += 15;
  if (recentFillers.includes('frustration')) stressLevel += 25;
  if (recentFillers.includes('urgency')) stressLevel += 15;
  if (recentFillers.includes('thinking')) stressLevel -= 10; // Thinking = composed
  stressLevel = Math.max(0, Math.min(100, stressLevel));

  // Calculate urgency
  let urgency = 30;
  if (isRapid) urgency += 30;
  if (recentFillers.includes('urgency')) urgency += 30;
  if (isLoud) urgency += 10;
  urgency = Math.max(0, Math.min(100, urgency));

  // Speaker confidence
  let speakerConfidence = 60;
  if (recentFillers.includes('hesitation') || recentFillers.includes('confusion')) speakerConfidence -= 25;
  if (recentFillers.includes('agreement')) speakerConfidence += 15;
  if (recentFillers.includes('negation')) speakerConfidence += 10; // Confident in disagreement
  speakerConfidence = Math.max(0, Math.min(100, speakerConfidence));

  // Determine valence
  let valence: EmotionalState['valence'] = 'calm';
  if (stressLevel > 70) valence = recentFillers.includes('frustration') ? 'frustrated' : 'stressed';
  else if (urgency > 60 || recentFillers.includes('discovery')) valence = 'excited';

  // Determine tone adjustment
  let toneAdjustment: ToneAdjustment;
  switch (valence) {
    case 'stressed':
      toneAdjustment = {
        rateMultiplier: 0.9, // Speak slower to calm
        pitchShift: -0.5,    // Slightly lower pitch
        volumeMultiplier: 0.95,
        clausePauseMs: 200,  // Longer pauses
        style: 'calm_authoritative',
      };
      break;
    case 'frustrated':
      toneAdjustment = {
        rateMultiplier: 0.85,
        pitchShift: -1,
        volumeMultiplier: 0.9,
        clausePauseMs: 250,
        style: 'empathetic_steady',
      };
      break;
    case 'excited':
      toneAdjustment = {
        rateMultiplier: 1.05,
        pitchShift: 0.3,
        volumeMultiplier: 1.05,
        clausePauseMs: 100,
        style: 'energized_collaborative',
      };
      break;
    default:
      toneAdjustment = {
        rateMultiplier: 1.0,
        pitchShift: 0,
        volumeMultiplier: 1.0,
        clausePauseMs: 150,
        style: 'calm_authoritative',
      };
  }

  return {
    stressLevel,
    urgency,
    speakerConfidence,
    valence,
    shouldAdaptTone: stressLevel > 50 || valence !== 'calm',
    toneAdjustment,
  };
}

// ── Context-Aware Response Shaping ───────────────────────────────────────────

export interface ResponseShaping {
  /** Modified response text with prosody markers */
  shapedText: string;
  /** TTS rate for this response */
  rate: number;
  /** TTS pitch for this response */
  pitch: number;
  /** Whether to prefix with a brief empathetic phrase */
  empathyPrefix: string | null;
  /** Whether to append a follow-up question */
  followUpQuestion: string | null;
}

/**
 * Shapes AURA's response based on emotional context and filler detection.
 *
 * Examples of context-aware shaping:
 * - If speaker said "hmm..." → "Take your time. Would it help if I summarized?"
 * - If speaker said "oh wait!" → "You've found something — go ahead."
 * - If multiple "yeah, yeah" → AURA recognizes consensus and moves to action
 * - If speaker is stressed → AURA speaks slower, calmer, more structured
 */
export function shapeResponse(
  baseResponse: string,
  emotionalState: EmotionalState,
  recentFillers: FillerCategory[],
  silenceDurationMs: number,
): ResponseShaping {
  const adjustment = emotionalState.toneAdjustment;
  let shapedText = baseResponse;
  let empathyPrefix: string | null = null;
  let followUpQuestion: string | null = null;

  // ── Filler-aware shaping ───────────────────────────────────────────────
  const latestFiller = recentFillers[recentFillers.length - 1];

  if (latestFiller === 'thinking' && silenceDurationMs > 2000) {
    empathyPrefix = 'Take your time.';
    followUpQuestion = 'Would it help if I summarized what we know so far?';
  }

  if (latestFiller === 'discovery') {
    empathyPrefix = 'Sounds like you\'ve found something —';
    followUpQuestion = null; // Let them continue
  }

  if (latestFiller === 'frustration') {
    empathyPrefix = 'I understand this is frustrating. Let\'s focus on what we can control.';
  }

  if (latestFiller === 'confusion') {
    empathyPrefix = 'Let me clarify.';
    followUpQuestion = 'Does that make more sense now?';
  }

  // Multiple agreements = consensus detected
  const agreementCount = recentFillers.filter(f => f === 'agreement').length;
  if (agreementCount >= 2) {
    followUpQuestion = 'It sounds like we have consensus. Shall I create an action item?';
  }

  // Urgency → match energy but stay structured
  if (latestFiller === 'urgency') {
    empathyPrefix = null; // Skip empathy, be direct
    adjustment.rateMultiplier = 1.1; // Slightly faster
  }

  // ── Emotional tone shaping ─────────────────────────────────────────────
  if (emotionalState.stressLevel > 70 && !empathyPrefix) {
    empathyPrefix = 'I hear you. Let\'s work through this step by step.';
  }

  // Assemble final shaped text
  if (empathyPrefix) {
    shapedText = `${empathyPrefix} ${shapedText}`;
  }
  if (followUpQuestion) {
    shapedText = `${shapedText} ${followUpQuestion}`;
  }

  return {
    shapedText,
    rate: Math.min(1.3, Math.max(0.75, 1.0 * adjustment.rateMultiplier)),
    pitch: Math.min(1.3, Math.max(0.7, 1.1 + adjustment.pitchShift * 0.05)),
    empathyPrefix,
    followUpQuestion,
  };
}

// ── Session Memory (Contextual Cross-Referencing) ────────────────────────────

export interface MemoryEntry {
  text: string;
  timestamp: number;
  fillers: FillerCategory[];
  emotionalState: EmotionalState | null;
}

/**
 * Session Memory — Tracks per-speaker utterances within a war room session.
 *
 * Enables AURA to reference earlier statements:
 * "Priya, you mentioned the Redis connection pool 10 minutes ago — does that
 *  relate to what Mark just found?"
 */
export class SessionMemory {
  /** Speaker UID → list of their utterances (most recent last) */
  private memory = new Map<string, MemoryEntry[]>();
  /** Speaker UID → display name mapping */
  private names = new Map<string, string>();
  /** Maximum entries per speaker */
  private readonly maxEntriesPerSpeaker = 50;
  /** Maximum age of entries to consider for recall (ms) */
  private readonly recallWindowMs = 30 * 60_000; // 30 minutes

  /**
   * Record an utterance from a speaker.
   */
  record(speakerUid: string, displayName: string, text: string, fillers: FillerCategory[] = [], emotionalState: EmotionalState | null = null): void {
    this.names.set(speakerUid, displayName);

    if (!this.memory.has(speakerUid)) {
      this.memory.set(speakerUid, []);
    }

    const entries = this.memory.get(speakerUid)!;
    entries.push({
      text,
      timestamp: Date.now(),
      fillers,
      emotionalState,
    });

    // Trim old entries
    if (entries.length > this.maxEntriesPerSpeaker) {
      entries.shift();
    }
  }

  /**
   * Search for a keyword/phrase in any speaker's past utterances.
   * Returns matches sorted by recency.
   */
  searchContext(query: string, excludeUid?: string): Array<{
    speakerUid: string;
    speakerName: string;
    text: string;
    timestamp: number;
    ageMinutes: number;
  }> {
    const queryLower = query.toLowerCase();
    const now = Date.now();
    const cutoff = now - this.recallWindowMs;
    const results: Array<{
      speakerUid: string;
      speakerName: string;
      text: string;
      timestamp: number;
      ageMinutes: number;
    }> = [];

    for (const [uid, entries] of this.memory) {
      if (uid === excludeUid) continue;
      const name = this.names.get(uid) || 'Unknown';

      for (const entry of entries) {
        if (entry.timestamp < cutoff) continue;
        if (entry.text.toLowerCase().includes(queryLower)) {
          results.push({
            speakerUid: uid,
            speakerName: name,
            text: entry.text,
            timestamp: entry.timestamp,
            ageMinutes: Math.round((now - entry.timestamp) / 60_000),
          });
        }
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get the most recent utterances from a specific speaker.
   */
  getRecentFromSpeaker(speakerUid: string, limit = 5): MemoryEntry[] {
    const entries = this.memory.get(speakerUid) || [];
    return entries.slice(-limit);
  }

  /**
   * Build a contextual reference phrase for AURA to use.
   * E.g., "Priya, you mentioned Redis connection issues about 8 minutes ago"
   */
  buildContextReference(query: string, currentSpeakerUid: string): string | null {
    const matches = this.searchContext(query, currentSpeakerUid);
    if (matches.length === 0) return null;

    const best = matches[0];
    const timeAgo = best.ageMinutes < 1
      ? 'just a moment ago'
      : best.ageMinutes < 5
        ? 'a few minutes ago'
        : `about ${best.ageMinutes} minutes ago`;

    return `${best.speakerName}, you mentioned something related ${timeAgo} — "${best.text.substring(0, 80)}${best.text.length > 80 ? '...' : ''}"`;
  }

  /**
   * Get speaker display name.
   */
  getSpeakerName(uid: string): string {
    return this.names.get(uid) || 'Unknown';
  }

  /**
   * Get all unique speaker names.
   */
  getAllSpeakers(): Array<{ uid: string; name: string; utteranceCount: number }> {
    const speakers: Array<{ uid: string; name: string; utteranceCount: number }> = [];
    for (const [uid, entries] of this.memory) {
      speakers.push({
        uid,
        name: this.names.get(uid) || 'Unknown',
        utteranceCount: entries.length,
      });
    }
    return speakers;
  }

  reset(): void {
    this.memory.clear();
    this.names.clear();
  }
}

// ── Consensus Tracker ────────────────────────────────────────────────────────

export interface ConsensusSignal {
  speakerUid: string;
  speakerName: string;
  signalType: 'agreement' | 'acknowledgment';
  timestamp: number;
}

export interface ConsensusResult {
  /** Whether consensus has been detected */
  hasConsensus: boolean;
  /** Number of unique speakers who agreed */
  agreementCount: number;
  /** List of speakers who agreed */
  agreeingSpeakers: Array<{ uid: string; name: string }>;
  /** Time window in which consensus was detected (ms) */
  windowMs: number;
  /** Suggested action item text */
  suggestedAction: string | null;
}

/**
 * Tracks multi-speaker agreement signals to detect consensus.
 *
 * When 3+ participants say "yes", "agreed", "let's do it", etc. within a
 * short window, AURA detects consensus and proposes creating an action item.
 */
export class ConsensusTracker {
  private signals: ConsensusSignal[] = [];
  /** Minimum unique speakers for consensus */
  private readonly minSpeakers = 3;
  /** Time window to look for agreement signals (ms) */
  private readonly windowMs = 30_000; // 30 seconds
  /** Maximum signals to keep */
  private readonly maxSignals = 100;
  /** Last consensus detection timestamp (for cooldown) */
  private lastConsensusAt = 0;
  /** Cooldown between consensus detections (ms) */
  private readonly cooldownMs = 60_000;

  /**
   * Record an agreement signal from a speaker.
   */
  recordAgreement(speakerUid: string, speakerName: string, signalType: 'agreement' | 'acknowledgment' = 'agreement'): void {
    this.signals.push({
      speakerUid,
      speakerName,
      signalType,
      timestamp: Date.now(),
    });

    // Trim old signals
    if (this.signals.length > this.maxSignals) {
      this.signals = this.signals.slice(-this.maxSignals);
    }
  }

  /**
   * Check if consensus has been reached.
   */
  checkConsensus(): ConsensusResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Don't re-trigger too quickly
    if (now - this.lastConsensusAt < this.cooldownMs) {
      return {
        hasConsensus: false,
        agreementCount: 0,
        agreeingSpeakers: [],
        windowMs: this.windowMs,
        suggestedAction: null,
      };
    }

    // Find unique speakers who agreed within the window
    const recentSignals = this.signals.filter(s => s.timestamp > cutoff);
    const uniqueSpeakers = new Map<string, string>();
    for (const signal of recentSignals) {
      if (signal.signalType === 'agreement') {
        uniqueSpeakers.set(signal.speakerUid, signal.speakerName);
      }
    }

    const hasConsensus = uniqueSpeakers.size >= this.minSpeakers;
    if (hasConsensus) {
      this.lastConsensusAt = now;
    }

    return {
      hasConsensus,
      agreementCount: uniqueSpeakers.size,
      agreeingSpeakers: Array.from(uniqueSpeakers.entries()).map(([uid, name]) => ({ uid, name })),
      windowMs: this.windowMs,
      suggestedAction: hasConsensus
        ? 'It sounds like we have consensus from the team. Shall I create an action item to capture this decision?'
        : null,
    };
  }

  reset(): void {
    this.signals = [];
    this.lastConsensusAt = 0;
  }
}

// ── Disagreement Detector ────────────────────────────────────────────────────

export interface DisagreementSignal {
  speakerAUid: string;
  speakerAName: string;
  speakerBUid: string;
  speakerBName: string;
  topicText: string;
  detectedAt: number;
  /** Whether AURA has already mediated this */
  mediated: boolean;
}

/**
 * Detects when two speakers express opposing views on a topic.
 *
 * Triggers AURA's mediation protocol:
 * "I'm hearing two different perspectives. Let me capture both and we can test them."
 */
export class DisagreementDetector {
  private recentNegations: Array<{ uid: string; name: string; text: string; timestamp: number }> = [];
  private detectedDisagreements: DisagreementSignal[] = [];
  /** Window to look for back-to-back negations (ms) */
  private readonly windowMs = 15_000;

  /**
   * Record a negation from a speaker.
   */
  recordNegation(speakerUid: string, speakerName: string, text: string): void {
    const now = Date.now();
    this.recentNegations.push({ uid: speakerUid, name: speakerName, text, timestamp: now });

    // Trim old entries
    const cutoff = now - this.windowMs;
    this.recentNegations = this.recentNegations.filter(n => n.timestamp > cutoff);
  }

  /**
   * Check if a disagreement has been detected between speakers.
   *
   * Looks for pattern: Speaker A says something → Speaker B negates it within 15s
   */
  checkDisagreement(latestSpeakerUid: string, latestSpeakerName: string, latestText: string): DisagreementSignal | null {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Find recent negations from OTHER speakers
    const otherNegations = this.recentNegations.filter(
      n => n.uid !== latestSpeakerUid && n.timestamp > cutoff
    );

    if (otherNegations.length === 0) return null;

    // Check if the latest text is also a negation
    const negationPatterns = [
      /\b(no|nope|disagree|wrong|incorrect|not right|actually|but|however)\b/i,
      /\b(I don't think|that's not|I disagree|not quite|hold on)\b/i,
    ];

    const isLatestNegation = negationPatterns.some(p => p.test(latestText));
    if (!isLatestNegation) return null;

    const otherSpeaker = otherNegations[otherNegations.length - 1];

    // Check we haven't already flagged this pair recently
    const recentDisagreement = this.detectedDisagreements.find(
      d => (d.speakerAUid === otherSpeaker.uid && d.speakerBUid === latestSpeakerUid) ||
           (d.speakerAUid === latestSpeakerUid && d.speakerBUid === otherSpeaker.uid)
    );
    if (recentDisagreement && !recentDisagreement.mediated && (now - recentDisagreement.detectedAt) < 60_000) {
      return null; // Already flagged
    }

    const signal: DisagreementSignal = {
      speakerAUid: otherSpeaker.uid,
      speakerAName: otherSpeaker.name,
      speakerBUid: latestSpeakerUid,
      speakerBName: latestSpeakerName,
      topicText: `${otherSpeaker.text} vs. ${latestText}`,
      detectedAt: now,
      mediated: false,
    };

    this.detectedDisagreements.push(signal);
    return signal;
  }

  /**
   * Mark a disagreement as mediated (AURA has spoken about it).
   */
  markMediated(detectedAt: number): void {
    const signal = this.detectedDisagreements.find(d => d.detectedAt === detectedAt);
    if (signal) signal.mediated = true;
  }

  /**
   * Build a mediation phrase for AURA.
   */
  buildMediationPhrase(signal: DisagreementSignal): string {
    return `I'm hearing two different perspectives from ${signal.speakerAName} and ${signal.speakerBName}. Let me capture both viewpoints and we can determine which one the data supports. What metric or evidence would help us decide?`;
  }

  reset(): void {
    this.recentNegations = [];
    this.detectedDisagreements = [];
  }
}

// ── Energy Monitor ───────────────────────────────────────────────────────────

export interface RoomEnergy {
  /** Overall room energy level (0-100) */
  level: number;
  /** Trend: rising, falling, or stable */
  trend: 'rising' | 'falling' | 'stable';
  /** Whether energy is critically low (team fatigue) */
  isFatigued: boolean;
  /** Whether energy is too high (chaos/panic) */
  isChaotic: boolean;
  /** Suggested intervention if needed */
  suggestion: string | null;
}

/**
 * Monitors overall room energy across all speakers.
 *
 * Combines pitch variance + speech rate + speaking frequency across all
 * participants to detect team fatigue or escalating chaos.
 */
export class EnergyMonitor {
  private energySamples: Array<{ level: number; timestamp: number }> = [];
  private readonly windowMs = 5 * 60_000; // 5 minute window
  private readonly maxSamples = 300;
  /** Below this level, suggest a break */
  private readonly fatigueThreshold = 25;
  /** Above this level, suggest calming down */
  private readonly chaosThreshold = 85;
  /** Last suggestion timestamp */
  private lastSuggestionAt = 0;
  /** Cooldown between suggestions */
  private readonly suggestionCooldownMs = 3 * 60_000;

  /**
   * Record a composite energy reading.
   *
   * @param speechRateWPM Average speaking rate across room
   * @param avgPitchVariance Average pitch variance across room
   * @param activeSpeakerCount Number of people who spoke in the last 60 seconds
   * @param totalParticipants Total participants in room
   */
  recordSample(
    speechRateWPM: number,
    avgPitchVariance: number,
    activeSpeakerCount: number,
    totalParticipants: number,
  ): void {
    // Normalize components to 0-100 scale
    const rateEnergy = Math.min(100, (speechRateWPM / 200) * 50); // 200 WPM = high energy
    const pitchEnergy = Math.min(100, (avgPitchVariance / 80) * 30); // High variance = high energy
    const participationEnergy = totalParticipants > 0
      ? (activeSpeakerCount / totalParticipants) * 20
      : 0;

    const level = Math.max(0, Math.min(100, rateEnergy + pitchEnergy + participationEnergy));

    this.energySamples.push({ level, timestamp: Date.now() });
    if (this.energySamples.length > this.maxSamples) {
      this.energySamples.shift();
    }
  }

  /**
   * Get the current room energy assessment.
   */
  assess(): RoomEnergy {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recentSamples = this.energySamples.filter(s => s.timestamp > cutoff);

    if (recentSamples.length < 5) {
      return { level: 50, trend: 'stable', isFatigued: false, isChaotic: false, suggestion: null };
    }

    // Current level = average of last 10 samples
    const recent = recentSamples.slice(-10);
    const currentLevel = recent.reduce((sum, s) => sum + s.level, 0) / recent.length;

    // Trend: compare first half vs second half
    const halfpoint = Math.floor(recentSamples.length / 2);
    const firstHalf = recentSamples.slice(0, halfpoint);
    const secondHalf = recentSamples.slice(halfpoint);
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.level, 0) / Math.max(firstHalf.length, 1);
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.level, 0) / Math.max(secondHalf.length, 1);

    let trend: RoomEnergy['trend'] = 'stable';
    if (secondAvg - firstAvg > 10) trend = 'rising';
    else if (firstAvg - secondAvg > 10) trend = 'falling';

    const isFatigued = currentLevel < this.fatigueThreshold;
    const isChaotic = currentLevel > this.chaosThreshold;

    // Generate suggestion with cooldown
    let suggestion: string | null = null;
    if ((isFatigued || isChaotic) && (now - this.lastSuggestionAt) > this.suggestionCooldownMs) {
      if (isFatigued) {
        suggestion = 'Team energy is dropping. Should we take a 2-minute break to regroup, or does anyone need to step out briefly?';
      } else if (isChaotic) {
        suggestion = 'We have a lot of energy in the room. Let\'s take a breath and focus on one thread at a time. Who wants to lead the next discussion point?';
      }
      this.lastSuggestionAt = now;
    }

    return {
      level: Math.round(currentLevel),
      trend,
      isFatigued,
      isChaotic,
      suggestion,
    };
  }

  reset(): void {
    this.energySamples = [];
    this.lastSuggestionAt = 0;
  }
}

// ── Extended Filler Patterns (Hindi/Regional + Natural Interjections) ────────

export const EXTENDED_FILLER_PATTERNS: Array<{
  category: FillerCategory;
  patterns: RegExp[];
  priority: number;
}> = [
  {
    category: 'agreement',
    priority: 4,
    patterns: [
      // Hindi/regional agreement
      /^(achha|haan|theek hai|bilkul|sahi|pakka|done|chalo)[.\s]*$/i,
      // Casual affirmative
      /\b(you know what.*(?:right|yes)|that's(?:\s+)(?:spot on|on point|the one))\b/i,
    ],
  },
  {
    category: 'hesitation',
    priority: 5,
    patterns: [
      // Hindi/regional hesitation
      /^(ek minute|ruko|bas ek second|zara|thoda wait)[.\s]*$/i,
      // Contextual hesitation
      /\b(can I jump in|sorry but|actually wait|no no no|before that)\b/i,
    ],
  },
  {
    category: 'thinking',
    priority: 2,
    patterns: [
      // Hindi/regional thinking
      /^(matlab|dekho|suno|yaar|bhai)[.\s]*$/i,
      // Extended thinking patterns
      /\b(you know what|the thing is|how do I put this|what I mean is)\b/i,
    ],
  },
  {
    category: 'acknowledgment',
    priority: 3,
    patterns: [
      // Hindi/regional acknowledgment
      /^(samajh gaya|samajh gayi|pata hai|mil gaya)[.\s]*$/i,
    ],
  },
  {
    category: 'urgency',
    priority: 10,
    patterns: [
      // Hindi/regional urgency
      /\b(jaldi|abhi|turant|fatafat|fata fat)\b/i,
    ],
  },
];

/**
 * Extended filler detection that includes regional/Hindi patterns.
 * Falls back to the standard detectFillers for English.
 */
export function detectFillersExtended(text: string): FillerDetection[] {
  // First try standard English detection
  const standardDetections = detectFillers(text);

  // Then try extended patterns
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return standardDetections;

  for (const group of EXTENDED_FILLER_PATTERNS) {
    for (const pattern of group.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Don't add if we already detected this category
        if (!standardDetections.find(d => d.category === group.category)) {
          standardDetections.push({
            category: group.category,
            matchedPhrase: match[0],
            confidence: trimmed.length < 20 ? 85 : 60,
          });
        }
        break;
      }
    }
  }

  return standardDetections;
}

