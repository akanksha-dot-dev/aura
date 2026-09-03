'use client';

/**
 * audioCues.ts — Native Web Audio API Synthesized Earcons
 * Provides subtle, operational auditory feedback for critical bridge transitions.
 * 100% client-side, zero external assets, zero latency, gentle non-intrusive levels.
 */

let audioCtx: AudioContext | null = null;
let isAudioEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioCuesEnabled(enabled: boolean) {
  isAudioEnabled = enabled;
}

export function isAudioCuesEnabled(): boolean {
  return isAudioEnabled;
}

/**
 * Soft dual-frequency low alert for active contradiction detection.
 * 220Hz -> 180Hz (soft sine, 60ms, gentle volume)
 */
export function playConflictEarcon() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(170, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignored if browser blocks audio
  }
}

/**
 * Crisp, authoritative single-cycle blip for completed action item.
 * 540Hz (triangle, 40ms)
 */
export function playActionCompletedEarcon() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Ignored
  }
}

/**
 * Warm harmonic resolution chime (major triad) upon incident recovery.
 * 440Hz (A4) -> 554Hz (C#5) -> 659Hz (E5) (smooth sine swell, 200ms)
 */
export function playResolutionEarcon() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const frequencies = [440, 554.37, 659.25];

    frequencies.forEach((freq, idx) => {
      const startTime = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.04, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch {
    // Ignored
  }
}
