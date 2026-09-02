'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseVoiceWaveformOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  audioTrack?: MediaStreamTrack | null; // From RTC remote audio
  color?: string; // Default: '#D4A853' (golden amber)
  fftSize?: number; // Default: 256
  isSpeaking?: boolean;
}

export interface UseVoiceWaveformReturn {
  isActive: boolean;
}

/**
 * Creates a 60fps golden voice waveform canvas visualization.
 * Uses Web Audio API AnalyserNode when an audioTrack is provided,
 * or generates a subtle ambient pulse waveform during silence
 * to visually prove AURA's active processing (Star 1).
 */
export function useVoiceWaveform({
  canvasRef,
  audioTrack,
  color = '#D4A853',
  fftSize = 256,
  isSpeaking = false,
}: UseVoiceWaveformOptions): UseVoiceWaveformReturn {
  const [isActive, setIsActive] = useState(false);
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let rafId: number;
    let timeStep = 0;

    let resumeAudio: (() => void) | null = null;

    // 1. Setup AudioContext if audioTrack is provided
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0.8;

        if (audioTrack && audioTrack.readyState === 'live') {
          const stream = new MediaStream([audioTrack]);
          sourceNode = audioCtx.createMediaStreamSource(stream);
          sourceNode.connect(analyser);
        }

        // Resume audio context on user interaction if suspended
        if (audioCtx.state === 'suspended') {
          resumeAudio = () => {
            if (audioCtx && audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
            if (resumeAudio) {
              window.removeEventListener('click', resumeAudio);
              window.removeEventListener('keydown', resumeAudio);
            }
          };
          window.addEventListener('click', resumeAudio, { once: true });
          window.addEventListener('keydown', resumeAudio, { once: true });
        }
      }
    } catch (err) {
      console.warn('[useVoiceWaveform] AudioContext initialization notice:', err);
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = analyser ? new Uint8Array(bufferLength) : null;
    setIsActive(true);

    // 2. Animation loop at 60fps
    const draw = () => {
      rafId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let hasRealAudio = false;
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        // Check if there is actual non-zero audio energy
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 10) {
            hasRealAudio = true;
            break;
          }
        }
      }

      timeStep += 0.05;
      const barCount = 24;
      const barWidth = 3;
      const totalBarsWidth = barCount * barWidth;
      const totalSpacing = width - totalBarsWidth;
      const barGap = totalSpacing / (barCount - 1);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSpeakingRef.current || hasRealAudio ? 4 : 1;

      for (let i = 0; i < barCount; i++) {
        let normalizedHeight: number;

        if (hasRealAudio && dataArray) {
          const dataIndex = Math.floor((i / barCount) * (dataArray.length * 0.7));
          const val = dataArray[dataIndex] / 255;
          normalizedHeight = Math.max(0.1, val);
        } else {
          // Ambient synthetic sine wave (active AI processing indicator)
          const speakingBoost = isSpeakingRef.current ? 1.8 : 1.0;
          const wave1 = Math.sin(timeStep + i * 0.28);
          const wave2 = Math.cos(timeStep * 0.65 + i * 0.42);
          const envelope = Math.sin((i / (barCount - 1)) * Math.PI); // Taper at edges
          const rawAmp = (0.25 + 0.35 * Math.abs(wave1 * wave2)) * envelope * speakingBoost;
          normalizedHeight = Math.min(0.9, Math.max(0.1, rawAmp));
        }

        const barHeight = Math.max(3, normalizedHeight * (height - 4));
        const x = i * (barWidth + barGap);
        const y = (height - barHeight) / 2;

        ctx.globalAlpha = isSpeakingRef.current || hasRealAudio ? 0.9 : 0.45;
        ctx.beginPath();
        // Rounded rectangle for bar
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    };

    draw();

    // 3. Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      setIsActive(false);
      if (resumeAudio) {
        window.removeEventListener('click', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
      }
      if (sourceNode) {
        sourceNode.disconnect();
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [canvasRef, audioTrack, color, fftSize]);

  return { isActive };
}
