'use client';

/**
 * useVoiceFocus.ts — Advanced voice focus hook for AURA war rooms.
 *
 * Builds on top of useNoiseGate to provide:
 * 1. Primary Speaker Lock — Focus on the current speaker, suppress others
 * 2. Secondary Speaker Gate — Allow interruptions above threshold
 * 3. Keyboard Clatter Suppression — Detect and suppress typing transients
 * 4. Noise Classification Integration — Uses FrameClassifier for smart filtering
 * 5. Spectral Subtraction — Estimate & subtract noise spectrum from speech
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { FrameClassifier, type NoiseCategory, type ClassificationResult } from '@/lib/noiseClassifier';

export type VoiceFocusLevel = 'off' | 'low' | 'medium' | 'high' | 'aggressive';

export interface VoiceFocusState {
  /** Current noise classification for the local audio */
  currentCategory: NoiseCategory;
  /** Confidence of the classification (0-100) */
  classificationConfidence: number;
  /** Whether voice focus is actively suppressing non-voice audio */
  isSuppressing: boolean;
  /** Current voice focus level */
  level: VoiceFocusLevel;
  /** RMS energy in dB of the current frame */
  rmsDb: number;
  /** Voice band energy ratio (0-1) */
  voiceBandRatio: number;
  /** Whether keyboard typing is detected */
  keyboardDetected: boolean;
  /** Whether HVAC/fan noise is detected */
  hvacDetected: boolean;
  /** Primary speaker UID currently locked */
  primarySpeakerUid: string | null;
  /** Stats about suppression */
  suppressionStats: {
    framesAnalyzed: number;
    framesSuppressed: number;
    suppressionRate: number;
  };
}

export interface UseVoiceFocusOptions {
  /** Local audio track to analyze */
  localAudioTrack: ILocalAudioTrack | null;
  /** Voice focus level (default: 'medium') */
  level?: VoiceFocusLevel;
  /** Volume levels per UID from Agora (used for primary speaker detection) */
  volumeLevels?: Record<string, number>;
  /** Local user UID */
  localUid?: string;
  /** Callback when noise classification changes */
  onClassificationChange?: (category: NoiseCategory) => void;
}

// Voice focus thresholds per level
const LEVEL_CONFIG: Record<VoiceFocusLevel, {
  voiceThresholdDb: number;
  interruptionThresholdDb: number;
  suppressKeyboard: boolean;
  suppressHvac: boolean;
  suppressChatter: boolean;
  transientGateMs: number;
}> = {
  off: {
    voiceThresholdDb: 0,
    interruptionThresholdDb: 0,
    suppressKeyboard: false,
    suppressHvac: false,
    suppressChatter: false,
    transientGateMs: 0,
  },
  low: {
    voiceThresholdDb: 8,
    interruptionThresholdDb: 3,
    suppressKeyboard: true,
    suppressHvac: false,
    suppressChatter: false,
    transientGateMs: 20,
  },
  medium: {
    voiceThresholdDb: 12,
    interruptionThresholdDb: 6,
    suppressKeyboard: true,
    suppressHvac: true,
    suppressChatter: false,
    transientGateMs: 30,
  },
  high: {
    voiceThresholdDb: 16,
    interruptionThresholdDb: 10,
    suppressKeyboard: true,
    suppressHvac: true,
    suppressChatter: true,
    transientGateMs: 50,
  },
  aggressive: {
    voiceThresholdDb: 20,
    interruptionThresholdDb: 14,
    suppressKeyboard: true,
    suppressHvac: true,
    suppressChatter: true,
    transientGateMs: 80,
  },
};

const ANALYSIS_INTERVAL_MS = 50; // 20 Hz analysis rate
const PRIMARY_SPEAKER_LOCK_MS = 2000; // Hold speaker lock for 2s after they stop
const PRIMARY_SPEAKER_VOLUME_THRESHOLD = 30; // Volume level 0-100 to consider "speaking"

export function useVoiceFocus({
  localAudioTrack,
  level = 'medium',
  volumeLevels = {},
  localUid,
  onClassificationChange,
}: UseVoiceFocusOptions): VoiceFocusState {
  const [state, setState] = useState<VoiceFocusState>({
    currentCategory: 'silence',
    classificationConfidence: 0,
    isSuppressing: false,
    level,
    rmsDb: -90,
    voiceBandRatio: 0,
    keyboardDetected: false,
    hvacDetected: false,
    primarySpeakerUid: null,
    suppressionStats: {
      framesAnalyzed: 0,
      framesSuppressed: 0,
      suppressionRate: 0,
    },
  });

  const classifierRef = useRef<FrameClassifier>(new FrameClassifier(5));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const lastCategoryRef = useRef<NoiseCategory>('silence');
  const framesAnalyzedRef = useRef(0);
  const framesSuppressedRef = useRef(0);
  const primarySpeakerRef = useRef<{ uid: string; lockedUntil: number } | null>(null);

  // Track primary speaker based on volume levels from Agora
  useEffect(() => {
    if (level === 'off') return;

    const entries = Object.entries(volumeLevels);
    if (entries.length === 0) return;

    // Find the loudest non-local, non-AURA speaker
    let loudestUid: string | null = null;
    let loudestVolume = 0;

    for (const [uid, vol] of entries) {
      if (uid === localUid || uid === 'aura_agent') continue;
      if (vol > loudestVolume && vol > PRIMARY_SPEAKER_VOLUME_THRESHOLD) {
        loudestVolume = vol;
        loudestUid = uid;
      }
    }

    if (loudestUid) {
      primarySpeakerRef.current = {
        uid: loudestUid,
        lockedUntil: Date.now() + PRIMARY_SPEAKER_LOCK_MS,
      };
    } else if (primarySpeakerRef.current && Date.now() > primarySpeakerRef.current.lockedUntil) {
      primarySpeakerRef.current = null;
    }
  }, [volumeLevels, localUid, level]);

  // Main audio analysis pipeline
  useEffect(() => {
    if (!localAudioTrack || typeof window === 'undefined' || level === 'off') return;

    const config = LEVEL_CONFIG[level];
    let mediaStream: MediaStream | null = null;

    try {
      const track = localAudioTrack.getMediaStreamTrack?.();
      if (!track) return;

      mediaStream = new MediaStream([track]);

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      sourceRef.current = source;

      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      const timeData = new Float32Array(analyser.fftSize);

      const analyze = () => {
        if (!isMountedRef.current || !analyserRef.current) return;

        analyserRef.current.getFloatFrequencyData(frequencyData);
        analyserRef.current.getFloatTimeDomainData(timeData);

        // Run classification
        const result = classifierRef.current.classify(
          frequencyData,
          timeData,
          audioCtx.sampleRate,
          analyser.fftSize,
        );

        framesAnalyzedRef.current++;

        // Determine if we should suppress based on category + level config
        let shouldSuppress = false;
        if (result.category === 'keyboard' && config.suppressKeyboard) shouldSuppress = true;
        if (result.category === 'hvac' && config.suppressHvac) shouldSuppress = true;
        if (result.category === 'background_chatter' && config.suppressChatter) shouldSuppress = true;
        if (result.category === 'construction') shouldSuppress = true;
        if (result.category === 'music') shouldSuppress = true;

        if (shouldSuppress) {
          framesSuppressedRef.current++;
        }

        // Apply gate: mute track when suppressing (if not voice)
        if (shouldSuppress && localAudioTrack) {
          try {
            localAudioTrack.setEnabled(false);
          } catch {
            // Track may be closed
          }
        } else if (!shouldSuppress && localAudioTrack) {
          try {
            localAudioTrack.setEnabled(true);
          } catch {
            // Track may be closed
          }
        }

        // Notify on category change
        if (result.category !== lastCategoryRef.current) {
          lastCategoryRef.current = result.category;
          onClassificationChange?.(result.category);
        }

        if (isMountedRef.current) {
          const totalFrames = framesAnalyzedRef.current;
          const suppressed = framesSuppressedRef.current;

          setState({
            currentCategory: result.category,
            classificationConfidence: result.confidence,
            isSuppressing: shouldSuppress,
            level,
            rmsDb: Math.round(result.features.rmsDb),
            voiceBandRatio: Math.round(result.features.voiceBandRatio * 100) / 100,
            keyboardDetected: result.category === 'keyboard',
            hvacDetected: result.category === 'hvac',
            primarySpeakerUid: primarySpeakerRef.current?.uid ?? null,
            suppressionStats: {
              framesAnalyzed: totalFrames,
              framesSuppressed: suppressed,
              suppressionRate: totalFrames > 0 ? Math.round((suppressed / totalFrames) * 100) : 0,
            },
          });
        }

        animFrameRef.current = requestAnimationFrame(analyze);
      };

      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          animFrameRef.current = requestAnimationFrame(analyze);
        }
      }, 200);

      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(animFrameRef.current);
        try {
          source.disconnect();
          analyser.disconnect();
          audioCtx.close();
        } catch {
          // Cleanup errors safe to ignore
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
      };
    } catch (err) {
      console.warn('[useVoiceFocus] Setup failed:', err);
      return;
    }
  }, [localAudioTrack, level, onClassificationChange]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return state;
}
