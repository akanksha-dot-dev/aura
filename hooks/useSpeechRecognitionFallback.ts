'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';

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
  abort: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export interface SpeechRecognitionFallbackOptions {
  isMockReplay: boolean;
  speakerName: string;
  voiceLang?: string;
  volumeLevels?: Record<string, number>;
  onTranscript?: (speaker: string, text: string) => void;
  onTranscriptFinal?: (speaker: string, text: string) => void;
}

export interface UseSpeechRecognitionFallbackReturn {
  isSupported: boolean;
  isListening: boolean;
  transcriptText: string | null;
  transcriptSpeaker: string | null;
  startListening: () => void;
  stopListening: () => void;
}

/**
 * Browser Web Speech API for real-time speech-to-text.
 * Designed with resilience against Windows Chromium restrictions and network drops.
 */
export function useSpeechRecognitionFallback({
  isMockReplay,
  speakerName,
  voiceLang,
  volumeLevels = {},
  onTranscript,
  onTranscriptFinal,
}: SpeechRecognitionFallbackOptions): UseSpeechRecognitionFallbackReturn {
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptSpeaker, setTranscriptSpeaker] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const isSupported = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === 'undefined') return false;
      const win = window as unknown as WindowWithSpeech;
      return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    },
    () => false
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isAliveRef = useRef(true);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const volumeLevelsRef = useRef(volumeLevels);
  const onTranscriptRef = useRef(onTranscript);
  const onTranscriptFinalRef = useRef(onTranscriptFinal);

  useEffect(() => {
    volumeLevelsRef.current = volumeLevels;
    onTranscriptRef.current = onTranscript;
    onTranscriptFinalRef.current = onTranscriptFinal;
  });

  const resolvedLang = voiceLang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isMockReplay) return;
    const win = window as unknown as WindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = resolvedLang;

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) {
            const trimmed = transcript.trim();
            const isAgentSpeaking = (volumeLevelsRef.current['aura_agent'] ?? 0) > 15;
            if (trimmed && trimmed.length >= 2 && !isAgentSpeaking) {
              const activeSpeaker = speakerName || 'Operator';
              setTranscriptText(trimmed);
              setTranscriptSpeaker(activeSpeaker);
              onTranscriptRef.current?.(activeSpeaker, trimmed);
              onTranscriptFinalRef.current?.(activeSpeaker, trimmed);
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

      rec.onerror = (err: SpeechRecognitionErrorEventLike) => {
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.info('[LiveCaptions] Speech recognition status:', err.error);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        // Graceful exponential backoff restart if session is still alive
        if (isAliveRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (isAliveRef.current) {
              try {
                rec.start();
                setIsListening(true);
              } catch {
                // Will retry on next interaction
              }
            }
          }, 800);
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (e) {
      console.info('[LiveCaptions] Speech recognition startup notice:', e);
    }
  }, [isMockReplay, resolvedLang, speakerName]);

  const stopListening = useCallback(() => {
    isAliveRef.current = false;
    setIsListening(false);
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isMockReplay || typeof window === 'undefined') return;
    isAliveRef.current = true;

    // Start listening on mount or first user interaction
    startListening();

    const resumeOnInteraction = () => {
      if (isAliveRef.current && !isListening) {
        startListening();
      }
    };

    window.addEventListener('click', resumeOnInteraction, { passive: true });
    window.addEventListener('keydown', resumeOnInteraction, { passive: true });

    return () => {
      isAliveRef.current = false;
      window.removeEventListener('click', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
      stopListening();
    };
  }, [isMockReplay, startListening, stopListening, isListening]);

  return {
    isSupported,
    isListening,
    transcriptText,
    transcriptSpeaker,
    startListening,
    stopListening,
  };
}
