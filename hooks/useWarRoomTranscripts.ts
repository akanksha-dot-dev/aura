'use client';

import { useState, useCallback } from 'react';
import { useAgoraRTM } from '@/hooks/useAgoraRTM';
import type { RTMDashboardEvent } from '@/lib/types';
import type { TranscriptEntry } from '@/components/modals/TranscriptDrawer';

export interface WarRoomTranscriptsOptions {
  channel: string;
  uid: string;
  name: string;
  processEvent: (event: RTMDashboardEvent) => void;
  isMockReplay: boolean;
}

/**
 * Encapsulates Agora RTM speech transcript aggregation, speaker attribution,
 * and live caption stream state.
 */
export function useWarRoomTranscripts({
  channel,
  uid,
  name,
  processEvent,
  isMockReplay,
}: WarRoomTranscriptsOptions) {
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [liveTranscriptText, setLiveTranscriptText] = useState<string | null>(null);
  const [liveTranscriptSpeaker, setLiveTranscriptSpeaker] = useState<string | null>(null);

  const appendTranscript = useCallback((speaker: string, text: string) => {
    setLiveTranscriptText(text);
    setLiveTranscriptSpeaker(speaker);
    setTranscriptHistory((prev) => [
      ...prev,
      {
        id: `speech-${Date.now()}-${prev.length}`,
        speakerName: speaker,
        timestamp: Date.now(),
        text,
      },
    ]);
  }, []);

  useAgoraRTM({
    channelName: channel,
    uid,
    userName: name,
    onEvent: processEvent,
    onTranscript: (entry) => {
      const textLower = (entry.text || '').toLowerCase().trim();
      const isAgent =
        entry.speakerName === 'AURA' ||
        entry.speakerName?.toLowerCase().includes('aura') ||
        entry.id.includes('aura_agent') ||
        entry.id.includes('agent-') ||
        textLower.includes('aura online') ||
        textLower.includes('incident bridge monitoring active') ||
        textLower.includes('standing by');
      const isSelf =
        !isAgent &&
        (entry.speakerName === uid || entry.speakerName === name || entry.speakerName === 'Operator');
      const speakerDisplay = isAgent ? 'AURA' : isSelf ? (name || 'Responder') : (entry.speakerName || 'Responder');

      setLiveTranscriptText(entry.text);
      setLiveTranscriptSpeaker(speakerDisplay);
      setTranscriptHistory((prev) => {
        const idx = prev.findIndex((p) => p.id === entry.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...prev[idx], text: entry.text, speakerName: speakerDisplay };
          return updated;
        }
        return [...prev, { id: entry.id, speakerName: speakerDisplay, timestamp: entry.timestamp, text: entry.text }];
      });
    },
    enabled: !isMockReplay,
  });

  return {
    transcriptHistory,
    liveTranscriptText,
    liveTranscriptSpeaker,
    setLiveTranscriptText,
    setLiveTranscriptSpeaker,
    appendTranscript,
  };
}
