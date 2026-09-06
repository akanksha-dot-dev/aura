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

/**
 * Stop any currently-playing speech and clear the queue.
 */
export function stopSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  queue.length = 0;
  isSpeaking = false;
  window.speechSynthesis.cancel();
}
