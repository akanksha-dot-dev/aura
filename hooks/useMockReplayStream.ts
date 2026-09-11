'use client';

import { useEffect } from 'react';
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
  useEffect(() => {
    if (!isMockReplay) return;

    const cleanup = startMockReplay(processEvent, dispatchStateUpdate, {
      speedMultiplier: speedParam,
      onSpeech: (speaker, transcript) => {
        onSpeech(speaker, transcript);
        speakLine(transcript, speaker === 'AURA' || speaker === null, speedParam).catch(() => {});
      },
      onCelebration,
    });

    return () => {
      cleanup();
      stopSpeech();
    };
  }, [isMockReplay, speedParam, processEvent, dispatchStateUpdate, onSpeech, onCelebration]);
}
