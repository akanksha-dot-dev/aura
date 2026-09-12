'use client';

import { useEffect, useRef } from 'react';
import type { RTMDashboardEvent, IncidentState } from '@/lib/types';
import { startMockReplay } from '@/lib/mockReplay';
import { speakLine, stopSpeech } from '@/lib/tts';

export interface MockReplayStreamOptions {
  isMockReplay: boolean;
  speedParam: number;
  processEvent: (event: RTMDashboardEvent) => void;
  dispatchStateUpdate: (update: Partial<IncidentState>) => void;
  onSpeech: (speaker: string | null, transcript: string) => void;
  onCelebration: () => void;
}

/**
 * Encapsulates the scripted mock replay telemetry streamer, TTS voice simulation,
 * and celebration resolution callback.
 */
export function useMockReplayStream({
  isMockReplay,
  speedParam,
  processEvent,
  dispatchStateUpdate,
  onSpeech,
  onCelebration,
}: MockReplayStreamOptions) {
  const callbacksRef = useRef({
    processEvent,
    dispatchStateUpdate,
    onSpeech,
    onCelebration,
  });

  // Keep latest callbacks without triggering effect re-execution
  useEffect(() => {
    callbacksRef.current = {
      processEvent,
      dispatchStateUpdate,
      onSpeech,
      onCelebration,
    };
  });

  useEffect(() => {
    if (!isMockReplay) return;

    let active = true;
    const cleanup = startMockReplay(
      (event) => {
        if (active) callbacksRef.current.processEvent(event);
      },
      (update) => {
        if (active) callbacksRef.current.dispatchStateUpdate(update);
      },
      {
        speedMultiplier: speedParam,
        onSpeech: (speaker, transcript) => {
          if (!active) return;
          callbacksRef.current.onSpeech(speaker, transcript);

          // Clear speaking highlight after speech duration (or when TTS finishes)
          const isAura = speaker === 'AURA' || speaker === null;
          const estimatedMs = Math.max(2500, Math.min(8000, (transcript.length * 65) / speedParam));
          
          let speechCleared = false;
          const clearSpeaker = () => {
            if (!speechCleared && active) {
              speechCleared = true;
              callbacksRef.current.onSpeech(null, transcript);
            }
          };

          const fallbackTimer = setTimeout(clearSpeaker, estimatedMs);

          speakLine(transcript, isAura, speedParam)
            .then(() => {
              clearTimeout(fallbackTimer);
              clearSpeaker();
            })
            .catch(() => {
              // fallbackTimer will clear
            });
        },
        onCelebration: () => {
          if (active) callbacksRef.current.onCelebration();
        },
      }
    );

    return () => {
      active = false;
      cleanup();
      stopSpeech();
    };
  }, [isMockReplay, speedParam]);
}
