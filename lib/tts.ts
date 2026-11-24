/**
 * tts.ts — Web Speech API Text-to-Speech for AURA.
 *
 * Speaks AURA lines in a distinct voice (higher pitch, authoritative rate)
 * and human participant lines in a neutral voice.
 *
 * Designed with robust defenses against Chromium Windows bugs:
 * - Garbage collection prevention via persistent window reference
 * - Automatic speech resumption on user gesture (click/keydown)
 * - Anti-stall watchdog timer ensuring queue never permanently locks
 * - Periodic resume ping to prevent Windows Chromium 15s freeze
 */

let voicesLoaded = false;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let resumeInterval: ReturnType<typeof setInterval> | null = null;

// Ensure browser audio/speech context resumes as soon as user interacts
if (typeof window !== 'undefined') {
  const unlockAudioAndSpeech = () => {
    try {
      if (window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    } catch {
      // Ignored
    }
  };

  window.addEventListener('click', unlockAudioAndSpeech, { passive: true });
  window.addEventListener('keydown', unlockAudioAndSpeech, { passive: true });
  window.addEventListener('touchstart', unlockAudioAndSpeech, { passive: true });
}

function startResumeWatcher() {
  if (typeof window === 'undefined' || !window.speechSynthesis || resumeInterval) return;
  resumeInterval = setInterval(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused && isSpeaking) {
          window.speechSynthesis.resume();
        }
      }
    } catch {
      // Ignored
    }
  }, 2000);
}

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([]);
  }

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) {
    voicesLoaded = true;
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const onChanged = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        voicesLoaded = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
        resolve(v);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChanged);
    // Fallback: resolve after 400 ms even if event never fires
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 400);
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
  if (!voices || voices.length === 0) return null;

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
        v.name.toLowerCase().includes('george') ||
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
    startResumeWatcher();
    next();
  }
}

/**
 * Speak `text` aloud using browser SpeechSynthesis with full error recovery.
 */
export async function speakLine(
  text: string,
  isAura: boolean,
  speedMultiplier = 1,
  onEnd?: () => void
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!text || text === 'NO_RESPONSE' || text.startsWith('[Monitoring')) return;

  const voices = await ensureVoices();

  return new Promise((resolve) => {
    queue.push(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utter = new SpeechSynthesisUtterance(text);
        activeUtterance = utter;
        if (typeof window !== 'undefined') {
          (window as unknown as { __aura_utterance?: SpeechSynthesisUtterance }).__aura_utterance = utter;
        }

        if (isAura) {
          utter.rate = Math.min(1.25, 1.05 * Math.max(0.9, speedMultiplier * 0.6));
          utter.pitch = 1.15;
          utter.volume = 1;
        } else {
          utter.rate = Math.min(1.2, 1.0 * Math.max(0.85, speedMultiplier * 0.5));
          utter.pitch = 0.95;
          utter.volume = 0.85;
        }

        const voice = pickVoice(voices, isAura);
        if (voice) utter.voice = voice;

        let finished = false;
        const cleanup = () => {
          if (finished) return;
          finished = true;
          if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
          }
          activeUtterance = null;
          isSpeaking = false;
          try {
            onEnd?.();
          } catch {
            // Ignored
          }
          resolve();
          drainQueue();
        };

        utter.onend = cleanup;
        utter.onerror = (e) => {
          console.warn('[AURA TTS] Utterance notification:', e.error);
          cleanup();
        };

        // Anti-stall watchdog: if browser fails to trigger onend, auto-unblock
        const estimatedDurationMs = Math.max(2000, (text.length * 85) / Math.max(0.5, speedMultiplier) + 1200);
        watchdogTimer = setTimeout(cleanup, estimatedDurationMs);

        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.warn('[AURA TTS] Speak error:', err);
        isSpeaking = false;
        resolve();
        drainQueue();
      }
    });

    drainQueue();
  });
}

// ── Prosody-Modulated TTS ──────────────────────────────────────────────────

export interface ProsodyOptions {
  rateMultiplier?: number;
  pitchShift?: number;
  volumeMultiplier?: number;
  clausePauseMs?: number;
  style?: 'calm_authoritative' | 'urgent_focused' | 'empathetic_steady' | 'energized_collaborative';
}

const EMPHASIS_TERMS = new Set([
  'sev-0', 'sev-1', 'sev-2', 'sev-3', 'rollback', 'deploy', 'deployment',
  'outage', 'downtime', 'root cause', 'mitigation', 'escalate', 'escalation',
  'p0', 'critical', 'urgent', 'blocked', 'resolved', 'confirmed',
  'database', 'postgres', 'redis', 'kubernetes', 'k8s', 'aws', 'gcp',
  'latency', 'error rate', 'connection pool', 'memory leak', 'cpu',
  'circuit breaker', 'failover', 'canary', 'hotfix',
]);

function splitIntoClauses(text: string): string[] {
  return text
    .split(/(?<=[.!?;:])\s+|(?<=,)\s+(?=[A-Z])|(?:\s+—\s+)|(?:\s+-\s+)/)
    .filter((c) => c.trim().length > 0);
}

function containsEmphasisTerm(clause: string): boolean {
  const lower = clause.toLowerCase();
  for (const term of EMPHASIS_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}

export async function speakWithProsody(
  text: string,
  prosody: ProsodyOptions = {},
  speedMultiplier = 1
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

  const styleAdjustments: Record<string, { rate: number; pitch: number; pause: number }> = {
    calm_authoritative: { rate: 1.0, pitch: 1.15, pause: 150 },
    urgent_focused: { rate: 1.1, pitch: 1.1, pause: 80 },
    empathetic_steady: { rate: 0.9, pitch: 1.05, pause: 200 },
    energized_collaborative: { rate: 1.05, pitch: 1.2, pause: 100 },
  };

  const adj = styleAdjustments[style] || styleAdjustments.calm_authoritative;
  const voices = await ensureVoices();
  const voice = pickVoice(voices, true);
  const clauses = splitIntoClauses(text);

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i].trim();
    if (!clause) continue;

    const hasEmphasis = containsEmphasisTerm(clause);

    await new Promise<void>((resolve) => {
      queue.push(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          const utter = new SpeechSynthesisUtterance(clause);
          activeUtterance = utter;

          utter.rate = Math.min(1.3, Math.max(0.75,
            adj.rate * rateMultiplier * Math.max(1, speedMultiplier * 0.6) *
            (hasEmphasis ? 0.92 : 1.0)
          ));
          utter.pitch = Math.min(1.3, Math.max(0.7,
            adj.pitch * (pitchShift / 1.15) *
            (hasEmphasis ? 1.05 : 1.0)
          ));
          utter.volume = Math.min(1, Math.max(0.3,
            1.0 * volumeMultiplier *
            (hasEmphasis ? 1.1 : 1.0)
          ));

          if (voice) utter.voice = voice;

          let finished = false;
          const cleanup = () => {
            if (finished) return;
            finished = true;
            if (watchdogTimer) {
              clearTimeout(watchdogTimer);
              watchdogTimer = null;
            }
            activeUtterance = null;
            isSpeaking = false;
            resolve();
            drainQueue();
          };

          utter.onend = cleanup;
          utter.onerror = cleanup;

          const estDuration = Math.max(1500, (clause.length * 85) + 1000);
          watchdogTimer = setTimeout(cleanup, estDuration);

          window.speechSynthesis.speak(utter);
        } catch {
          isSpeaking = false;
          resolve();
          drainQueue();
        }
      });

      drainQueue();
    });

    if (i < clauses.length - 1) {
      const effectivePause = clausePauseMs || adj.pause;
      const jitter = effectivePause * (0.7 + Math.random() * 0.6);
      await new Promise((r) => setTimeout(r, Math.round(jitter)));
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
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  activeUtterance = null;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignored
  }
}
