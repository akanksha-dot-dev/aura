'use client';

import { useState, useEffect, useRef } from 'react';

// Strict type interfaces for Web Speech API fallback without any
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export interface SpeechRecognitionFallbackOptions {
  isMockReplay: boolean;
  isJoined: boolean;
  speakerName: string;
  voiceLang?: string;
  volumeLevels?: Record<string, number>;
  onTranscript?: (speaker: string, text: string) => void;
}

export interface UseSpeechRecognitionFallbackReturn {
  isSupported: boolean;
  transcriptText: string | null;
  transcriptSpeaker: string | null;
}

/**
 * Browser Web Speech API fallback for zero-latency local captions when offline or before RTC bridge joins.
 * Intentionally suppressed during live RTC sessions to prevent Windows Chromium audio driver contention.
 */
export function useSpeechRecognitionFallback({
  isMockReplay,
  isJoined,
  speakerName,
  voiceLang = 'en-US',
  volumeLevels = {},
  onTranscript,
}: SpeechRecognitionFallbackOptions): UseSpeechRecognitionFallbackReturn {
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptSpeaker, setTranscriptSpeaker] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const volumeLevelsRef = useRef(volumeLevels);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    volumeLevelsRef.current = volumeLevels;
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    if (isMockReplay || typeof window === 'undefined') return;

    const win = window as unknown as WindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    // In live WebRTC bridge sessions, Agora ConvAI captures audio directly and streams Deepgram ASR transcripts via RTM.
    // Running Web Speech API simultaneously on Windows Chromium causes audio driver contention and starves the WebRTC track.
    if (isJoined) return;

    let recognition: SpeechRecognitionInstance | null = null;
    let isAlive = true;

    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLang || 'en-IN';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) {
            const trimmed = transcript.trim();
            const isAgentSpeaking = (volumeLevelsRef.current['aura_agent'] ?? 0) > 15;
            if (trimmed && !isAgentSpeaking) {
              const activeSpeaker = speakerName || 'Operator';
              setTranscriptText(trimmed);
              setTranscriptSpeaker(activeSpeaker);
              onTranscriptRef.current?.(activeSpeaker, trimmed);
            }
          } else {
            interimText += transcript;
          }
        }
        const isAgentSpeaking = (volumeLevelsRef.current['aura_agent'] ?? 0) > 15;
        if (interimText.trim() && !isAgentSpeaking) {
          const trimmed = interimText.trim();
          const activeSpeaker = speakerName || 'Operator';
          setTranscriptText(trimmed);
          setTranscriptSpeaker(activeSpeaker);
          onTranscriptRef.current?.(activeSpeaker, trimmed);
        }
      };

      recognition.onerror = (err: SpeechRecognitionErrorEventLike) => {
        if (err.error !== 'no-speech') {
          console.info('[LiveCaptions] Speech recognition notice:', err.error);
        }
      };

      recognition.onend = () => {
        if (isAlive && !isJoined) {
          try {
            recognition?.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (e) {
      console.info('[LiveCaptions] Local speech recognition standby:', e);
    }

    return () => {
      isAlive = false;
      try {
        recognition?.stop();
      } catch {}
    };
  }, [isMockReplay, isJoined, speakerName, voiceLang]);

  return {
    isSupported,
    transcriptText,
    transcriptSpeaker,
  };
}
