'use client';

/**
 * useNoiseGate.ts — Client-side noise gate & voice activity detection hook.
 *
 * Uses Web Audio API AnalyserNode to detect voice energy vs ambient noise floor.
 * Provides real-time signal for UI indicators and smart muting.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ILocalAudioTrack } from 'agora-rtc-sdk-ng';

export interface NoiseGateState {
  /** Whether clear voice is currently detected above the noise floor */
  isVoiceActive: boolean;
  /** Ambient noise floor level in dB (typically -60 to -30) */
  noiseFloorDb: number;
  /** Current voice energy level in dB */
  voiceEnergyDb: number;
  /** Signal-to-noise ratio in dB */
  snrDb: number;
  /** Noise cancellation effectiveness 0-100% */
  noiseCancellationLevel: number;
  /** Whether the noise gate is actively suppressing */
  isGateActive: boolean;
}

export interface UseNoiseGateOptions {
  /** The local audio track to monitor */
  localAudioTrack: ILocalAudioTrack | null;
  /** Threshold above noise floor to consider as voice (dB). Default: 12 */
  voiceThresholdDb?: number;
  /** Whether noise gate auto-mute is enabled. Default: false */
  autoMuteEnabled?: boolean;
  /** Smoothing factor for noise floor estimation (0-1). Default: 0.95 */
  smoothingFactor?: number;
}

const DEFAULT_VOICE_THRESHOLD_DB = 12;
const DEFAULT_SMOOTHING = 0.95;
const ANALYSIS_INTERVAL_MS = 50; // 20 Hz analysis rate

export function useNoiseGate({
  localAudioTrack,
  voiceThresholdDb = DEFAULT_VOICE_THRESHOLD_DB,
  autoMuteEnabled = false,
  smoothingFactor = DEFAULT_SMOOTHING,
}: UseNoiseGateOptions): NoiseGateState {
  const [state, setState] = useState<NoiseGateState>({
    isVoiceActive: false,
    noiseFloorDb: -60,
    voiceEnergyDb: -60,
    snrDb: 0,
    noiseCancellationLevel: 0,
    isGateActive: false,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const noiseFloorRef = useRef<number>(-60);
  const animFrameRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Set up audio analysis pipeline
  useEffect(() => {
    if (!localAudioTrack || typeof window === 'undefined') return;

    let mediaStream: MediaStream | null = null;

    try {
      // Get the underlying MediaStreamTrack from the Agora local audio track
      const track = localAudioTrack.getMediaStreamTrack?.();
      if (!track) return;

      mediaStream = new MediaStream([track]);

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      sourceRef.current = source;

      // Frequency data buffer
      const dataArray = new Float32Array(analyser.frequencyBinCount);

      // Analysis loop
      const analyze = () => {
        if (!isMountedRef.current || !analyserRef.current) return;

        analyserRef.current.getFloatFrequencyData(dataArray);

        // Calculate voice energy (focus on voice frequency range: 85Hz - 3kHz)
        const sampleRate = audioCtx.sampleRate;
        const binWidth = sampleRate / analyser.fftSize;
        const voiceLowBin = Math.floor(85 / binWidth);
        const voiceHighBin = Math.ceil(3000 / binWidth);

        let voiceSum = 0;
        let voiceCount = 0;
        let totalSum = 0;
        let totalCount = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const val = dataArray[i];
          if (isFinite(val)) {
            totalSum += val;
            totalCount++;
            if (i >= voiceLowBin && i <= voiceHighBin) {
              voiceSum += val;
              voiceCount++;
            }
          }
        }

        const voiceEnergyDb = voiceCount > 0 ? voiceSum / voiceCount : -90;
        const totalEnergyDb = totalCount > 0 ? totalSum / totalCount : -90;

        // Exponential moving average for noise floor
        const prevNoiseFloor = noiseFloorRef.current;
        const isLikelyNoise = voiceEnergyDb < prevNoiseFloor + voiceThresholdDb * 0.5;
        if (isLikelyNoise) {
          noiseFloorRef.current = prevNoiseFloor * smoothingFactor + voiceEnergyDb * (1 - smoothingFactor);
        }

        const currentNoiseFloor = noiseFloorRef.current;
        const snr = voiceEnergyDb - currentNoiseFloor;
        const isVoice = snr > voiceThresholdDb;

        // Noise cancellation effectiveness: how well we're separating voice from noise
        const maxSnr = 40; // theoretical max for good conditions
        const ncLevel = Math.min(100, Math.max(0, Math.round((snr / maxSnr) * 100)));

        if (isMountedRef.current) {
          setState({
            isVoiceActive: isVoice,
            noiseFloorDb: Math.round(currentNoiseFloor),
            voiceEnergyDb: Math.round(voiceEnergyDb),
            snrDb: Math.round(snr * 10) / 10,
            noiseCancellationLevel: isVoice ? ncLevel : Math.max(ncLevel, 70),
            isGateActive: !isVoice && autoMuteEnabled,
          });
        }

        // Auto-mute when only noise detected
        if (autoMuteEnabled && localAudioTrack) {
          try {
            localAudioTrack.setEnabled(isVoice);
          } catch {
            // Track may be closed
          }
        }

        animFrameRef.current = requestAnimationFrame(analyze);
      };

      // Start analysis with a slight delay to let audio context initialize
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
          // Cleanup errors are safe to ignore
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
      };
    } catch (err) {
      console.warn('[useNoiseGate] Audio analysis setup failed:', err);
      return;
    }
  }, [localAudioTrack, voiceThresholdDb, autoMuteEnabled, smoothingFactor]);

  return state;
}
