/**
 * tts.ts — Web Speech API Text-to-Speech for AURA mock replay.
 *
 * Speaks AURA lines in a distinct voice (higher pitch, slightly slower rate)
 * and human participant lines in a neutral voice.
 *
 * Gracefully no-ops when speechSynthesis is unavailable (SSR / unsupported browser).
 */

let voicesLoaded = false;

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesLoaded) {
    return Promise.resolve(window.speechSynthesis.getVoices());
  }
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesLoaded = true;
      resolve(voices);
      return;
    }
    // Chrome fires onvoiceschanged asynchronously
    const onChanged = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        voicesLoaded = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
        resolve(v);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChanged);
    // Fallback: resolve after 500 ms even if event never fires
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

/**
 * Pick the best available English voice for AURA (prefers female / neural voices)
 * and a different voice for human participants.
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  isAura: boolean
): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.startsWith('en'));
  if (en.length === 0) return voices[0] ?? null;

  // Prefer online / neural voices
  const neural = en.filter(
    (v) =>
      v.name.toLowerCase().includes('neural') ||
      v.name.toLowerCase().includes('natural') ||
      v.localService === false
  );
  const pool = neural.length > 0 ? neural : en;

  if (isAura) {
    // Try to pick a female-sounding voice for AURA
    const female = pool.find(
      (v) =>
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('woman') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('hazel') ||
        v.name.toLowerCase().includes('susan') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('victoria') ||
        v.name.toLowerCase().includes('karen') ||
        v.name.toLowerCase().includes('moira')
    );
    return female ?? pool[0] ?? null;
  } else {
    // Human — pick a male or any different voice from AURA's
    const male = pool.find(
      (v) =>
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('man') ||
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('mark') ||
        v.name.toLowerCase().includes('daniel') ||
        v.name.toLowerCase().includes('alex')
    );
    return male ?? pool[Math.min(1, pool.length - 1)] ?? null;
  }
}

// Queue to serialize utterances so they don't overlap
const queue: Array<() => void> = [];
let isSpeaking = false;

function drainQueue() {
  if (isSpeaking || queue.length === 0) return;
  const next = queue.shift();
  if (next) {
    isSpeaking = true;
    next();
  }
}

/**
 * Speak `text` aloud.
 * @param text       The text to read.
 * @param isAura     Whether the speaker is the AURA agent (distinct voice profile).
 * @param speedMultiplier  Replay speed — used to shorten pauses; speech rate is NOT scaled.
 */
export async function speakLine(
  text: string,
  isAura: boolean,
  speedMultiplier = 1
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!text || text === 'NO_RESPONSE' || text.startsWith('[Monitoring')) return;

  const voices = await ensureVoices();

  return new Promise((resolve) => {
    queue.push(() => {
      // Cancel any stale utterance that might have got stuck
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);

      // AURA: slightly faster rate, higher pitch — clinical, authoritative
      // Human: normal rate and pitch
      if (isAura) {
        utter.rate = Math.min(1.3, 1.05 * Math.max(1, speedMultiplier * 0.6));
        utter.pitch = 1.15;
        utter.volume = 1;
      } else {
        utter.rate = Math.min(1.2, 1.0 * Math.max(1, speedMultiplier * 0.5));
        utter.pitch = 0.95;
        utter.volume = 0.85;
      }

      const voice = pickVoice(voices, isAura);
      if (voice) utter.voice = voice;

      utter.onend = () => {
        isSpeaking = false;
        resolve();
        drainQueue();
      };

      utter.onerror = () => {
        isSpeaking = false;
        resolve();
        drainQueue();
      };

      window.speechSynthesis.speak(utter);
    });

    drainQueue();
  });
}

// ── Prosody-Modulated TTS (Pillar 1: Human-Like Conversational AI) ──────────

/**
 * ToneAdjustment from the conversational intelligence engine.
 */
export interface ProsodyOptions {
  /** Speech rate multiplier (0.75–1.3). Default 1.0 */
  rateMultiplier?: number;
  /** Pitch shift relative to base (0.7–1.3). Default 1.15 for AURA */
  pitchShift?: number;
  /** Volume multiplier (0.5–1.2). Default 1.0 */
  volumeMultiplier?: number;
  /** Pause duration between clauses in ms (0–400). Default 150 */
  clausePauseMs?: number;
  /** Response style hint for selecting tone */
  style?: 'calm_authoritative' | 'urgent_focused' | 'empathetic_steady' | 'energized_collaborative';
}

/** Critical terms that should be emphasized (spoken slightly louder/slower) */
const EMPHASIS_TERMS = new Set([
  'sev-0', 'sev-1', 'sev-2', 'sev-3', 'rollback', 'deploy', 'deployment',
  'outage', 'downtime', 'root cause', 'mitigation', 'escalate', 'escalation',
  'p0', 'critical', 'urgent', 'blocked', 'resolved', 'confirmed',
  'database', 'postgres', 'redis', 'kubernetes', 'k8s', 'aws', 'gcp',
  'latency', 'error rate', 'connection pool', 'memory leak', 'cpu',
  'circuit breaker', 'failover', 'canary', 'hotfix',
]);

/**
 * Insert natural micro-pauses between clauses to simulate breathing.
 *
 * Splits text at natural clause boundaries (commas, semicolons, colons,
 * periods, dashes) and speaks each clause with a brief pause between.
 */
function splitIntoClauses(text: string): string[] {
  // Split at natural pause points while preserving the text
  return text
    .split(/(?<=[.!?;:])\s+|(?<=,)\s+(?=[A-Z])|(?:\s+—\s+)|(?:\s+-\s+)/)
    .filter(c => c.trim().length > 0);
}

/**
 * Detect if a word is a critical term that should be emphasized.
 */
function containsEmphasisTerm(clause: string): boolean {
  const lower = clause.toLowerCase();
  for (const term of EMPHASIS_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}

/**
 * Speak text with prosody modulation, breathing simulation, and emphasis.
 *
 * This is the enhanced version of speakLine that integrates with the
 * conversational intelligence engine's ToneAdjustment output.
 *
 * @param text The text to speak
 * @param prosody Prosody modulation options from the conversational intelligence engine
 * @param speedMultiplier Replay speed multiplier (default 1)
 */
export async function speakWithProsody(
  text: string,
  prosody: ProsodyOptions = {},
  speedMultiplier = 1,
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!text || text === 'NO_RESPONSE' || text.startsWith('[Monitoring')) return;

  const {
    rateMultiplier = 1.0,
    pitchShift = 1.15,
    volumeMultiplier = 1.0,
    clausePauseMs = 150,
    style = 'calm_authoritative',
  } = prosody;

  // Style-based base adjustments
  const styleAdjustments: Record<string, { rate: number; pitch: number; pause: number }> = {
    calm_authoritative:     { rate: 1.0,  pitch: 1.15, pause: 150 },
    urgent_focused:         { rate: 1.1,  pitch: 1.1,  pause: 80  },
    empathetic_steady:      { rate: 0.9,  pitch: 1.05, pause: 200 },
    energized_collaborative: { rate: 1.05, pitch: 1.2,  pause: 100 },
  };

  const adj = styleAdjustments[style] || styleAdjustments.calm_authoritative;

  const voices = await ensureVoices();
  const voice = pickVoice(voices, true);

  // Split text into clauses for breathing simulation
  const clauses = splitIntoClauses(text);

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i].trim();
    if (!clause) continue;

    const hasEmphasis = containsEmphasisTerm(clause);

    await new Promise<void>((resolve) => {
      queue.push(() => {
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(clause);

        // Apply prosody modulation
        utter.rate = Math.min(1.3, Math.max(0.75,
          adj.rate * rateMultiplier * Math.max(1, speedMultiplier * 0.6) *
          (hasEmphasis ? 0.92 : 1.0) // Slow down slightly for emphasis terms
        ));
        utter.pitch = Math.min(1.3, Math.max(0.7,
          adj.pitch * (pitchShift / 1.15) *
          (hasEmphasis ? 1.05 : 1.0) // Slightly higher pitch for emphasis
        ));
        utter.volume = Math.min(1, Math.max(0.3,
          1.0 * volumeMultiplier *
          (hasEmphasis ? 1.1 : 1.0) // Slightly louder for emphasis
        ));

        if (voice) utter.voice = voice;

        utter.onend = () => {
          isSpeaking = false;
          resolve();
          drainQueue();
        };

        utter.onerror = () => {
          isSpeaking = false;
          resolve();
          drainQueue();
        };

        window.speechSynthesis.speak(utter);
      });

      drainQueue();
    });

    // Breathing simulation: insert a natural pause between clauses
    if (i < clauses.length - 1) {
      const effectivePause = clausePauseMs || adj.pause;
      // Random variation (±30%) for natural feel
      const jitter = effectivePause * (0.7 + Math.random() * 0.6);
      await new Promise(r => setTimeout(r, Math.round(jitter)));
    }
  }
}

/**
 * Stop any currently-playing speech and clear the queue.
 */
export function stopSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  queue.length = 0;
  isSpeaking = false;
  window.speechSynthesis.cancel();
}

