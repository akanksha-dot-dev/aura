'use client';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAgoraRTC } from '@/hooks/useAgoraRTC';
import { useAgoraRTM, setRtmIncidentState } from '@/hooks/useAgoraRTM';
import { useIncidentState } from '@/hooks/useIncidentState';
import { Participant, TopologyNode, TopologyEdge } from '@/lib/types';
import { startMockReplay } from '@/lib/mockReplay';
import {
  loadScenarioConfig,
  createIncidentStateFromScenario,
  ScenarioConfig,
  PRESET_SCENARIOS,
  PersonaDefinition,
} from '@/lib/scenarios';
import { StatusBar } from '@/components/StatusBar';
import { SpeakerPanel } from '@/components/SpeakerPanel';
import { ConflictBanner } from '@/components/ConflictBanner';
import { MainView } from '@/components/MainView';
import { ActionTracker } from '@/components/ActionTracker';
import { IncidentStats } from '@/components/IncidentStats';
import { NarrativeBar } from '@/components/NarrativeBar';
import { LiveCaptions } from '@/components/LiveCaptions';
import { PostmortemModal } from '@/components/PostmortemModal';
import { TranscriptDrawer, TranscriptEntry } from '@/components/TranscriptDrawer';
import { AgoraAnalyticsOverlay } from '@/components/AgoraAnalyticsOverlay';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { WarRoomInvite } from '@/components/WarRoomInvite';
import { QuickCapture, QuickCapturePayload } from '@/components/QuickCapture';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationToastContainer, emitToast } from '@/components/NotificationToast';
import { ResolveIncidentModal } from '@/components/ResolveIncidentModal';
import { WarRoomSummaryCard } from '@/components/WarRoomSummaryCard';
import {
  playConflictEarcon,
  playActionCompletedEarcon,
  playResolutionEarcon,
} from '@/lib/audioCues';
import { speakLine, stopSpeech } from '@/lib/tts';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || 'operator_1';
  const name = searchParams.get('name') || 'Operator';
  const role = searchParams.get('role') || 'Incident Responder';
  const channel = searchParams.get('channel') || 'incident-war-room';
  const scenarioId = searchParams.get('scenarioId');
  const isMockReplay = Boolean(searchParams.get('__AURA_REPLAY_MOCK_STREAM'));
  const speedParam = Math.max(0.1, Number(searchParams.get('speed')) || 1);
  const initialCostRate = Math.max(1, Number(searchParams.get('costRate')) || 150);
  const [costRate, setCostRate] = useState<number>(initialCostRate);

  // If directly accessing / without a persona or mock replay flag, redirect to mission lobby
  useEffect(() => {
    if (!searchParams.get('uid') && !searchParams.get('persona') && !isMockReplay) {
      router.replace('/lobby');
    }
  }, [searchParams, isMockReplay, router]);

  // View tabs & Modal states
  const [mainViewTab, setMainViewTab] = useState<'timeline' | 'topology' | 'analytics'>('timeline');
  const [isPostmortemOpen, setIsPostmortemOpen] = useState(false);
  const [isTranscriptDrawerOpen, setIsTranscriptDrawerOpen] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [isAnalyticsCollapsed, setIsAnalyticsCollapsed] = useState(true);
  const [isCostPaused, setIsCostPaused] = useState(false);
  const [isSpeakerCollapsed, setIsSpeakerCollapsed] = useState(false);
  const [isActionsCollapsed, setIsActionsCollapsed] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isWarRoomSummaryDismissed, setIsWarRoomSummaryDismissed] = useState(false);

  // Ref to hold current incident status for keyboard shortcut handler (avoids dependency ordering issues)
  const incidentStatusRef = useRef<string>('active');

  // Global Mission-Control Keyboard Shortcuts (T: Tab, J: Drawer, P: Postmortem, K: Pause Cost, [: Left Sidebar, ]: Right Sidebar, \: Full Focus, ?: Shortcuts, Esc: Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        setMainViewTab((prev) => (prev === 'timeline' ? 'topology' : 'timeline'));
      } else if (e.key === 'j' || e.key === 'J') {
        setIsTranscriptDrawerOpen((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        setIsPostmortemOpen((prev) => !prev);
      } else if (e.key === 'k' || e.key === 'K') {
        setIsCostPaused((prev) => !prev);
      } else if (e.key === '[') {
        setIsSpeakerCollapsed((prev) => !prev);
      } else if (e.key === ']') {
        setIsActionsCollapsed((prev) => !prev);
      } else if (e.key === '\\') {
        setIsSpeakerCollapsed((prev) => {
          const next = !prev;
          setIsActionsCollapsed(next);
          return next;
        });
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        setIsQuickCaptureOpen((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        setIsResolveOpen((prev) => !prev);
      } else if (e.key === 'a' || e.key === 'A') {
        setMainViewTab((prev) => prev === 'analytics' ? 'timeline' : 'analytics');
        } else if (e.key === 'g' || e.key === 'G') {
        // G opens postmortem only when incident is resolved
        if (incidentStatusRef.current === 'resolved') {
          setIsPostmortemOpen((prev) => !prev);
        } else {
          emitToast({ type: 'info', title: 'Incident not resolved', description: 'Postmortem report is available after the incident is resolved (press R to resolve).' });
        }
      } else if (e.key === 'Escape') {
        setIsTranscriptDrawerOpen(false);
        setIsPostmortemOpen(false);
        setIsAnalyticsCollapsed(true);
        setIsShortcutsOpen(false);
        setIsQuickCaptureOpen(false);
        setIsResolveOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 0. Synchronously resolve scenario config from sessionStorage or URL query params (set by lobby)
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = loadScenarioConfig();
      if (stored) return stored;
    }
    const matchingPreset =
      (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
      PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase()) ||
      PRESET_SCENARIOS[0];
    return matchingPreset;
  });

  useEffect(() => {
    const config =
      loadScenarioConfig() ||
      (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
      PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase());
    if (config) setScenarioConfig(config);
  }, [scenarioId, channel]);

  // 1. Central Incident State Engine — initialized from scenario config
  const scenarioInitialState = useMemo(() => {
    if (!scenarioConfig) return undefined;
    const baseState = createIncidentStateFromScenario(scenarioConfig);
    return {
      incidentId: baseState.incidentId,
      title: baseState.title,
      severity: baseState.severity,
      affectedServices: baseState.affectedServices,
      openedAt: baseState.openedAt,
    };
  }, [scenarioConfig]);

  const { state, processEvent, dispatchStateUpdate, claimIC, updateActionStatus } =
    useIncidentState(scenarioInitialState);

  // Keep incidentStatusRef in sync so keyboard shortcut handler can safely read it
  incidentStatusRef.current = state.status;
  // Keep RTM conversation manager context current
  setRtmIncidentState(state);

  // Auto-open postmortem modal 2 seconds after resolution + play resolution chime
  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    if (prevStatusRef.current !== 'resolved' && state.status === 'resolved') {
      playResolutionEarcon();
      const timer = setTimeout(() => {
        setIsPostmortemOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  // Dynamic browser tab title: [SEV-1] Incident Title — AURA
  useEffect(() => {
    const prefix = state.severity ? `[${state.severity.toUpperCase()}]` : '';
    const statusTag = state.status === 'resolved' ? '✓' : '⚠';
    document.title = `${statusTag} ${prefix} ${state.title || 'Incident'} — AURA`;
  }, [state.severity, state.title, state.status]);

  // 2. Agora RTC (Audio + Volume Levels)
  const {
    joinChannel,
    isJoined,
    volumeLevels,
    connectionState,
    networkStats,
  } = useAgoraRTC({
    channelName: channel,
    uid,
  });

  // 3. Agora RTM (Intelligence Telemetry Stream & Live ConvAI Transcripts)
  const [liveTranscriptText, setLiveTranscriptText] = useState<string | null>(null);
  const [liveTranscriptSpeaker, setLiveTranscriptSpeaker] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('aura_voice_lang') || 'en-US';
    }
    return 'en-US';
  });

  useAgoraRTM({
    channelName: channel,
    uid,
    userName: name,
    onEvent: processEvent,
    onTranscript: (entry) => {
      const textLower = (entry.text || '').toLowerCase().trim();
      const isAgentText =
        textLower.includes('aura online') ||
        textLower.includes('incident bridge monitoring active') ||
        textLower.includes("i'm focused on the active incident") ||
        textLower.includes('what is the next data point') ||
        textLower.includes("what's the next data point") ||
        textLower.includes('logging hypothesis') ||
        textLower.includes('logging fact') ||
        textLower.includes('logging decision') ||
        textLower.includes('the hypothesis has been recorded') ||
        textLower.includes('situation: sev-') ||
        textLower.includes('flagging contradiction') ||
        textLower.includes("here's what we know for certain") ||
        textLower.includes('ai incident commander') ||
        textLower.includes('standing by');

      const isAgent =
        entry.speakerName === 'AURA' ||
        entry.speakerName?.toLowerCase().includes('aura') ||
        entry.id.includes('aura_agent') ||
        entry.id.includes('agent-') ||
        isAgentText;

      const isSelf =
        !isAgent &&
        (entry.speakerName === uid ||
          entry.speakerName === name ||
          entry.speakerName === 'Operator' ||
          entry.speakerName === 'Kai' ||
          entry.speakerName === 'Responder');

      const speakerDisplay = isAgent ? 'AURA' : isSelf ? (name || 'Responder') : (entry.speakerName || 'Responder');

      setLiveTranscriptText(entry.text);
      setLiveTranscriptSpeaker(speakerDisplay);
      setTranscriptHistory((prev) => {
        const turnKey = entry.id;
        const existingIndex = prev.findIndex((p) => p.id === turnKey);

        if (existingIndex >= 0) {
          const oldEntry = prev[existingIndex];
          let mergedText = entry.text;

          const cleanOld = oldEntry.text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
          const cleanNew = entry.text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');

          if (
            cleanNew.startsWith(cleanOld) ||
            cleanOld.startsWith(cleanNew) ||
            cleanNew.includes(cleanOld) ||
            cleanOld.includes(cleanNew)
          ) {
            mergedText = entry.text.length >= oldEntry.text.length ? entry.text : oldEntry.text;
          } else {
            mergedText = `${oldEntry.text.trim()} ${entry.text.trim()}`;
          }

          const updated = [...prev];
          updated[existingIndex] = {
            ...oldEntry,
            text: mergedText,
            speakerName: speakerDisplay,
            timestamp: entry.timestamp || oldEntry.timestamp,
          };
          return updated;
        }

        // Each distinct turn gets its own clean, isolated transcript bubble
        return [
          ...prev,
          {
            id: entry.id,
            speakerName: speakerDisplay,
            timestamp: entry.timestamp,
            text: entry.text,
          },
        ];
      });
    },
    enabled: !isMockReplay,
  });

  // 3b. Client-Side Speech Recognition (Instant Zero-Latency Local Captions)
  // Use a ref for volumeLevels so the effect doesn't restart on every audio frame
  const volumeLevelsRef = useRef(volumeLevels);
  volumeLevelsRef.current = volumeLevels;

  useEffect(() => {
    if (isMockReplay || typeof window === 'undefined') return;

    interface IWindowWithSpeech extends Window {
      SpeechRecognition?: new () => any; // eslint-disable-line @typescript-eslint/no-explicit-any
      webkitSpeechRecognition?: new () => any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    const win = window as unknown as IWindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    // In live WebRTC bridge sessions, Agora ConvAI captures audio directly and streams Deepgram ASR transcripts via RTM.
    // Running Web Speech API simultaneously on Windows Chromium causes audio driver contention and starves the WebRTC track.
    if (!SpeechRec || isJoined) return;

    let recognition: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    let isAlive = true;

    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLang || 'en-IN';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) {
            const trimmed = transcript.trim();
            const isAgentSpeaking = (volumeLevelsRef.current['aura_agent'] ?? 0) > 15;
            if (trimmed && !isAgentSpeaking) {
              setLiveTranscriptText(trimmed);
              setLiveTranscriptSpeaker(name || 'Operator');
            }
          } else {
            interimText += transcript;
          }
        }
        const isAgentSpeaking = (volumeLevelsRef.current['aura_agent'] ?? 0) > 15;
        if (interimText.trim() && !isAgentSpeaking) {
          const trimmed = interimText.trim();
          setLiveTranscriptText(trimmed);
          setLiveTranscriptSpeaker(name || 'Operator');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.info('[LiveCaptions] Speech recognition notice:', err.error);
        }
      };

      recognition.onend = () => {
        if (isAlive && isJoined) {
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
  }, [isMockReplay, isJoined, name]);

  // 4. Mock Replay Stream (when ?__AURA_REPLAY_MOCK_STREAM is present)
  const [mockTranscript, setMockTranscript] = useState<string | null>(null);
  const [mockSpeaker, setMockSpeaker] = useState<string | null>(null);

  useEffect(() => {
    if (!isMockReplay) return;

    const cleanup = startMockReplay(processEvent, dispatchStateUpdate, {
      speedMultiplier: speedParam,
      onSpeech: (speaker, transcript) => {
        setMockSpeaker(speaker);
        setMockTranscript(transcript);
        setTranscriptHistory((prev) => [
          ...prev,
          {
            id: `speech-${Date.now()}-${prev.length}`,
            speakerName: speaker || 'Incident Responder',
            timestamp: Date.now(),
            text: transcript,
          },
        ]);
        // Speak the line aloud using Web Speech API TTS.
        // AURA gets a distinct (slightly higher pitch, faster) voice.
        const isAura = speaker === 'AURA' || speaker === null;
        speakLine(transcript, isAura, speedParam).catch(() => {});
      },
      onCelebration: () => {
        setTimeout(() => {
          setIsPostmortemOpen(true);
        }, 2000);
      },
    });

    return () => {
      cleanup();
      stopSpeech();
    };
  }, [isMockReplay, speedParam, processEvent, dispatchStateUpdate]);

  // Combined transcript entries (from real-time speech history or epistemic evidence stream)
  const effectiveTranscripts = useMemo<TranscriptEntry[]>(() => {
    if (transcriptHistory.length > 0) {
      return transcriptHistory;
    }
    return state.evidenceItems.map((e) => ({
      id: `ev-${e.id}`,
      speakerName: e.speakerName || 'Incident Responder',
      timestamp: e.timestamp,
      text: e.content,
    }));
  }, [transcriptHistory, state.evidenceItems]);

  // Automatically attempt RTC audio join on mount (skipped during mock replay)
  useEffect(() => {
    if (isMockReplay || isJoined || !channel || !uid) return;

    let isEffectActive = true;
    joinChannel().catch((err: unknown) => {
      if (!isEffectActive) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('OPERATION_ABORTED') && !msg.includes('cancel token canceled')) {
        console.warn('[Dashboard] Agora RTC join standby:', err);
      }
    });

    return () => {
      isEffectActive = false;
    };
  }, [isMockReplay, isJoined, channel, uid, joinChannel]);

  // Automatically launch Agora Conversational AI Agent into RTC channel when live bridge is active
  const activeAgentIdRef = useRef<string | null>(null);
  const activeAgentChannelRef = useRef<string | null>(null);

  useEffect(() => {
    // CRITICAL: Only launch the agent AFTER the user has joined the RTC channel.
    // If we launch before isJoined, Agora ConvAI immediately fails with "RTC connection error"
    // because there is no existing session for it to connect to.
    if (isMockReplay || !channel || !isJoined) return;

    // If an agent is already active in this exact channel, keep it running
    if (activeAgentIdRef.current && activeAgentChannelRef.current === channel) {
      return;
    }

    let isMounted = true;
    let launchTimer: ReturnType<typeof setTimeout> | null = null;

    async function summonAgent() {
      try {
        const activeScenario =
          scenarioConfig ||
          (typeof window !== 'undefined' ? loadScenarioConfig() : null) ||
          (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
          PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase()) ||
          PRESET_SCENARIOS[0];

        const agentPayload: Record<string, unknown> = {
          channelName: channel,
          userUid: uid,
          userName: name,
          userRole: role,
          language: voiceLang || 'en-IN',
        };

        if (activeScenario) {
          agentPayload.scenario = {
            id: activeScenario.id,
            title: activeScenario.title,
            severity: activeScenario.severity,
            affectedServices: activeScenario.affectedServices,
            description: activeScenario.description,
            impact: activeScenario.impact,
            suspectedCause: activeScenario.suspectedCause,
            personas: activeScenario.personas.map((p: PersonaDefinition) => ({
              uid: p.uid,
              displayName: p.displayName,
              role: p.role,
            })),
            playbook: activeScenario.playbook,
          };
        }

        const res = await fetch('/api/agent/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentPayload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.info('[Dashboard] AURA live agent standby (requires Agora REST credentials & live proxy):', errData);
          return;
        }
        const data = await res.json();
        if (!isMounted && data?.agentId) {
          fetch('/api/agent/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: data.agentId }),
          }).catch(() => {});
          return;
        }
        if (data?.agentId) {
          activeAgentIdRef.current = data.agentId;
          activeAgentChannelRef.current = channel;
          console.info('[Dashboard] AURA agent active in channel:', data.agentId, '| Stack:', data.stack);
        }
      } catch (err) {
        console.warn('[Dashboard] AURA agent launch network notice:', err);
      }
    }

    // Debounce agent launch by 1000ms:
    // 1) lets Agora RTC edge cluster settle user entry
    // 2) cancels cleanly if React FastRefresh / Strict Mode remounts before firing
    launchTimer = setTimeout(() => {
      if (isMounted) {
        void summonAgent();
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (launchTimer) {
        clearTimeout(launchTimer);
        launchTimer = null;
      }
    };
  // isJoined is intentionally in deps — agent must wait until user is in the channel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMockReplay, channel, isJoined, uid, name, role, voiceLang, scenarioConfig, scenarioId]);

  // Merge local user into participant list if not yet dispatched via RTM
  const effectiveParticipants: Record<string, Participant> = useMemo(() => {
    const list: Record<string, Participant> = { ...state.participants };
    if (uid && !list[uid]) {
      list[uid] = {
        uid,
        displayName: name,
        role,
        isIncidentCommander: state.incidentCommanderUid === uid,
        joinedAt: state.openedAt,
        totalSpeakingMs: 0,
        lastSpokeAt: 0,
      };
    }
    return list;
  }, [state.participants, uid, name, role, state.incidentCommanderUid, state.openedAt]);

  // Hot-sync dynamic incident state to active Agora ConvAI agent whenever evidence, actions, or status change
  const lastSyncedEvidenceSeqRef = useRef<number>(-1);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isMockReplay || !channel || !activeAgentIdRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const agentId = activeAgentIdRef.current;
      if (!agentId) return;

      // Don't re-sync if sequence hasn't advanced
      if (lastSyncedEvidenceSeqRef.current === state.eventSeq) return;
      lastSyncedEvidenceSeqRef.current = state.eventSeq;

      fetch('/api/agent/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          channelName: channel,
          incidentState: state,
          participants: Object.values(effectiveParticipants),
          operatorUid: uid,
          scenario: scenarioConfig ? {
            title: scenarioConfig.title,
            severity: scenarioConfig.severity,
            affectedServices: scenarioConfig.affectedServices,
            description: scenarioConfig.description,
            impact: scenarioConfig.impact,
            suspectedCause: scenarioConfig.suspectedCause,
            playbook: scenarioConfig.playbook,
          } : undefined,
        }),
      }).catch((err) => {
        console.warn('[Dashboard] Agent context hot-sync notice:', err);
      });
    }, 1200);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state.eventSeq, state.evidenceItems.length, state.status, state.incidentCommanderUid, effectiveParticipants, channel, isMockReplay, scenarioConfig, uid]);

  // Find active conflict for conditional ConflictBanner
  const activeConflict = useMemo(() => {
    return state.evidenceItems.find(
      (e) => e.category === 'conflict' && e.status === 'active'
    );
  }, [state.evidenceItems]);

  // Derived action items for ActionTracker
  const actions = useMemo(() => {
    return state.evidenceItems.filter((e) => e.category === 'action');
  }, [state.evidenceItems]);

  // Derived counts for IncidentStats
  const factCount = useMemo(
    () => state.evidenceItems.filter((e) => e.category === 'fact').length,
    [state.evidenceItems]
  );
  const hypothesisCount = useMemo(
    () =>
      state.evidenceItems.filter(
        (e) => e.category === 'hypothesis' && e.status === 'active'
      ).length,
    [state.evidenceItems]
  );
  const decisionCount = useMemo(
    () => state.evidenceItems.filter((e) => e.category === 'decision').length,
    [state.evidenceItems]
  );
  const actionCompletedCount = useMemo(
    () => actions.filter((e) => e.actionStatus === 'done').length,
    [actions]
  );
  const conflictCount = useMemo(
    () =>
      state.evidenceItems.filter(
        (e) => e.category === 'conflict' && e.status === 'active'
      ).length,
    [state.evidenceItems]
  );

  // Auditory Operational Earcons (Contradictions & Completed Actions)
  const prevConflictRef = useRef(false);
  useEffect(() => {
    const hasConflict = Boolean(activeConflict);
    if (!prevConflictRef.current && hasConflict) {
      playConflictEarcon();
    }
    prevConflictRef.current = hasConflict;
  }, [activeConflict]);

  const prevActionCountRef = useRef(actionCompletedCount);
  useEffect(() => {
    if (actionCompletedCount > prevActionCountRef.current) {
      playActionCompletedEarcon();
    }
    prevActionCountRef.current = actionCompletedCount;
  }, [actionCompletedCount]);

  // Derived Topology Graph Data (Nodes & Edges) for MainView
  const topologyNodes = useMemo<TopologyNode[]>(() => {
    return state.evidenceItems.map((item) => ({
      id: item.id,
      category: item.category,
      content:
        item.content.length > 50
          ? `${item.content.substring(0, 47)}…`
          : item.content,
      fullContent: item.content,
      speakerUid: item.speakerUid,
      speakerName: item.speakerName,
      confidence: item.confidence,
      timestamp: item.timestamp,
      status: item.status,
    }));
  }, [state.evidenceItems]);

  const topologyEdges = useMemo<TopologyEdge[]>(() => {
    const edges: TopologyEdge[] = [];
    const nodeIds = new Set(state.evidenceItems.map((e) => e.id));

    state.evidenceItems.forEach((item) => {
      // 1. Causal edges from relatedTo
      item.relatedTo.forEach((relId) => {
        if (nodeIds.has(relId)) {
          edges.push({
            source: relId,
            target: item.id,
            type: 'causal',
          });
        }
      });

      // 2. Conflict edges
      if (item.category === 'conflict') {
        if (
          item.relatedTo.length >= 2 &&
          nodeIds.has(item.relatedTo[0]) &&
          nodeIds.has(item.relatedTo[1])
        ) {
          edges.push({
            source: item.relatedTo[0],
            target: item.relatedTo[1],
            type: 'conflict',
          });
        }
      }
    });

    return edges;
  }, [state.evidenceItems]);

  // Derived tension history & inflection markers for NarrativeBar
  const tensionHistory = useMemo(() => {
    if (state.evidenceItems.length === 0) {
      return [{ timestamp: state.openedAt, value: 15 }];
    }
    const history = state.evidenceItems.map((item, idx) => ({
      timestamp: item.timestamp,
      value: Math.min(
        100,
        Math.max(
          10,
          15 + idx * 7 + (item.category === 'conflict' ? 30 : 0)
        )
      ),
    }));

    if (state.status === 'resolved') {
      const resolvedTimestamp =
        state.resolvedAt ||
        (state.evidenceItems.length > 0
          ? state.evidenceItems[state.evidenceItems.length - 1].timestamp
          : state.openedAt);

      history.push({
        timestamp: resolvedTimestamp,
        value: 10,
      });
    }

    return history;
  }, [state.evidenceItems, state.openedAt, state.status, state.resolvedAt]);

  const inflectionPoints = useMemo(() => {
    const points = state.evidenceItems
      .filter(
        (e) =>
          e.category === 'conflict' ||
          e.category === 'decision' ||
          (e.category === 'hypothesis' && e.status === 'confirmed')
      )
      .slice(-4)
      .map((e) => ({
        timestamp: e.timestamp,
        label:
          e.category === 'conflict'
            ? 'Conflict detected'
            : e.category === 'decision'
            ? 'IC directive'
            : 'Hypothesis confirmed',
      }));

    if (state.status === 'resolved') {
      const resolvedTimestamp =
        state.resolvedAt ||
        (state.evidenceItems.length > 0
          ? state.evidenceItems[state.evidenceItems.length - 1].timestamp
          : state.openedAt);

      points.push({
        timestamp: resolvedTimestamp,
        label: 'Resolved (mitigated)',
      });
    }

    return points;
  }, [state.evidenceItems, state.status, state.resolvedAt, state.openedAt]);

  // Speaker with highest volume for live caption highlight
  const speakingUid = useMemo(() => {
    let maxUid: string | null = null;
    let maxVol = 20;
    for (const [speakerId, vol] of Object.entries(volumeLevels)) {
      if (vol > maxVol) {
        maxVol = vol;
        maxUid = speakerId;
      }
    }
    return maxUid;
  }, [volumeLevels]);

  const activeSpeakerName = speakingUid
    ? effectiveParticipants[speakingUid]?.displayName ?? speakingUid
    : null;

  const captionSpeakerName =
    mockSpeaker ??
    liveTranscriptSpeaker ??
    activeSpeakerName;

  const currentTranscript =
    mockTranscript ??
    liveTranscriptText ??
    (activeSpeakerName
      ? `${activeSpeakerName} is transmitting telemetry and situational updates...`
      : 'Voice channel active — monitoring real-time communications...');

  // Tempo calculation based on recent evidence volume
  const tempoLevel = useMemo(() => {
    return Math.min(5, Math.max(1, Math.ceil(state.evidenceItems.length / 3) || 1));
  }, [state.evidenceItems.length]);

  const icDisplayName = state.incidentCommanderUid
    ? effectiveParticipants[state.incidentCommanderUid]?.displayName ??
      state.incidentCommanderUid
    : null;

  const connectionQuality =
    connectionState === 'CONNECTED'
      ? networkStats.mos >= 3.8
        ? 'excellent'
        : networkStats.mos >= 2.8
        ? 'good'
        : 'poor'
      : isJoined
      ? 'good'
      : 'poor';

  // Dynamic AI pipeline latencies driven by live network RTT and event throughput
  const pipelineLatency = useMemo(() => {
    if (connectionState !== 'CONNECTED' && !isMockReplay) {
      return { stt: null, llm: null, tts: null };
    }
    const stt = Math.max(28, Math.round(36 + networkStats.rtt * 0.12));
    const llm = Math.max(120, Math.round(160 + networkStats.rtt * 0.25));
    const tts = Math.max(65, Math.round(78 + networkStats.jitter * 1.1));
    return { stt, llm, tts };
  }, [connectionState, isMockReplay, networkStats.rtt, networkStats.jitter]);

  return (
    <>
      {/* Simulation Replay Banner with 1-click switch to Live Real-Time Voice */}
      {isMockReplay && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '32px',
            background: 'linear-gradient(90deg, rgba(255, 170, 0, 0.18) 0%, rgba(255, 110, 0, 0.14) 100%)',
            borderBottom: '1px solid rgba(255, 170, 0, 0.4)',
            color: '#ffbe3b',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 500,
            zIndex: 10000,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px' }}>⚠</span>
            <span>
              <strong>SCRIPTED SIMULATION REPLAY MODE:</strong> Real-time microphone input is paused while playing an automated script demo.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.delete('__AURA_REPLAY_MOCK_STREAM');
              params.delete('speed');
              window.location.href = `/?${params.toString()}`;
            }}
            style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #0070f3 100%)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🎙 SWITCH TO REAL-TIME VOICE BRIDGE →
          </button>
        </div>
      )}

      <div
        className={`command-center ${activeConflict ? 'has-conflict' : ''} ${
          state.status === 'resolved' ? 'command-center--resolved' : ''
        } ${isSpeakerCollapsed ? 'speakers-collapsed' : ''} ${
          isActionsCollapsed ? 'actions-collapsed' : ''
        }`}
        style={isMockReplay ? { top: '32px', height: 'calc(100vh - 32px)' } : undefined}
      >
        {/* 1. Status Bar */}
        <StatusBar
          incidentTitle={state.title}
          severity={state.severity}
          status={state.status}
          openedAt={state.openedAt}
          resolvedAt={state.resolvedAt}
          currentOODAPhase={state.currentOODAPhase}
          icName={icDisplayName}
          connectionQuality={connectionQuality}
          onClaimIC={() => claimIC(uid)}
          costRate={costRate}
          onRateChange={setCostRate}
          isCostPaused={isCostPaused}
          onToggleCostPause={() => setIsCostPaused((prev) => !prev)}
          voiceLang={voiceLang}
          onVoiceLangChange={(newLang) => {
            setVoiceLang(newLang);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('aura_voice_lang', newLang);
            }
            emitToast({
              type: 'info',
              title: 'ASR Model Switched',
              description: `Voice recognition switched to ${newLang === 'en-IN' ? 'Indian English (en-IN)' : 'US English (en-US)'}.`,
            });
          }}
          cognitiveLoadScore={state.cognitiveLoadScore}
          onResolve={() => setIsResolveOpen(true)}
        />

      {/* 2. Speaker Panel */}
      <SpeakerPanel
        participants={effectiveParticipants}
        localVolumeLevel={volumeLevels}
        agentUid="aura_agent"
        agentLastSpokeAt={
          effectiveParticipants['aura_agent']?.lastSpokeAt ?? state.openedAt
        }
        agentIsSpeaking={(volumeLevels['aura_agent'] ?? 0) > 20}
        cognitiveLoadScore={state.cognitiveLoadScore}
        tempoLevel={tempoLevel}
        isCollapsed={isSpeakerCollapsed}
        onToggleCollapse={() => setIsSpeakerCollapsed((prev) => !prev)}
      />

      {/* 3. Conflict Banner (Conditional) */}
      <ConflictBanner
        isActive={Boolean(activeConflict)}
        hypothesisA={activeConflict?.hypothesisA ?? activeConflict?.content ?? ''}
        speakerAName={
          activeConflict?.speakerAUid
            ? effectiveParticipants[activeConflict.speakerAUid]?.displayName ??
              activeConflict.speakerAUid
            : activeConflict?.speakerName ?? 'Marcus'
        }
        hypothesisB={activeConflict?.hypothesisB ?? 'Alternative hypothesis'}
        speakerBName={
          activeConflict?.speakerBUid
            ? effectiveParticipants[activeConflict.speakerBUid]?.displayName ??
              activeConflict.speakerBUid
            : 'Sarah'
        }
        decidingMetric={
          activeConflict?.decidingMetric ?? 'Database query latency logs'
        }
      />

      {/* 4. Main View: Tabbed Container (Timeline ↔ Topology ↔ Analytics) */}
      <MainView
        evidenceItems={state.evidenceItems}
        incidentOpenedAt={state.openedAt}
        nodes={topologyNodes}
        edges={topologyEdges}
        isResolved={state.status === 'resolved'}
        activeTab={mainViewTab}
        onTabChange={setMainViewTab}
        incident={state}
        costRate={costRate}
        channelName={channel}
        suspectedCause={scenarioConfig?.suspectedCause}
        scenarioSummary={scenarioConfig?.description || scenarioConfig?.impact}
      />

      {/* 5. Tactical Console: Unified Action Tracker & Playbook Runbook */}
      <ActionTracker
        actions={actions}
        hypotheses={state.evidenceItems.filter((e) => e.category === 'hypothesis')}
        suspectedCause={scenarioConfig?.suspectedCause}
        onStatusChange={updateActionStatus}
        isCollapsed={isActionsCollapsed}
        onToggleCollapse={() => setIsActionsCollapsed((prev) => !prev)}
        playbookSteps={scenarioConfig?.playbook}
        onCreateAction={(title, detail) => {
          const actionItem = {
            id: `playbook-action-${Date.now()}`,
            category: 'action' as const,
            content: `${title} — ${detail}`,
            speakerUid: uid,
            speakerName: name,
            confidence: 80,
            timestamp: Date.now(),
            actionStatus: 'pending' as const,
          };
          processEvent({
            type: 'dashboard_event',
            id: actionItem.id,
            seq: state.eventSeq + 1,
            timestamp: Date.now(),
            eventType: 'evidence_added',
            payload: actionItem,
          });
          fetch('/api/incident/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName: channel, item: actionItem }),
          }).catch(() => {});
          emitToast({
            type: 'info',
            title: 'Playbook Action Created',
            description: `${title}: ${detail}`,
          });
        }}
        incidentStatus={state.status}
      />

      {/* 6-8. Unified Mission Deck (Bottom Dock: Tension Sparkline, Live Captions, Incident Stats) */}
      <footer className="mission-deck" role="region" aria-label="Incident Mission Deck">
        <div className="mission-deck__tension">
          <NarrativeBar
            tensionHistory={tensionHistory}
            oodaPhase={state.currentOODAPhase}
            inflectionPoints={inflectionPoints}
          />
        </div>
        <div className="mission-deck__captions">
          <LiveCaptions
            currentSpeakerName={captionSpeakerName}
            currentTranscript={currentTranscript}
          />
        </div>
        <div className="mission-deck__right">
          <div className="mission-deck__stats">
            <IncidentStats
              factCount={factCount}
              hypothesisCount={hypothesisCount}
              decisionCount={decisionCount}
              actionCompletedCount={actionCompletedCount}
              actionTotalCount={actions.length}
              conflictCount={conflictCount}
            />
          </div>
          <button
            type="button"
            className="mission-deck__log-btn"
            onClick={() => setIsTranscriptDrawerOpen((prev) => !prev)}
            title="Toggle Voice Transcript Log (Press J)"
            aria-label="Toggle Voice Transcript Log"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Log</span>
            <kbd className="keyboard-hint-badge">J</kbd>
          </button>
          <button
            type="button"
            className="mission-deck__log-btn"
            onClick={() => setIsShortcutsOpen((prev) => !prev)}
            title="Keyboard Shortcuts Cheat Sheet (Press ?)"
            aria-label="Toggle Keyboard Shortcuts"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Keys</span>
            <kbd className="keyboard-hint-badge">?</kbd>
          </button>

          {/* Quick Capture button */}
          <button
            id="quick-capture-btn"
            type="button"
            className="mission-deck__log-btn"
            onClick={() => setIsQuickCaptureOpen(true)}
            title="Quick Capture — Log evidence instantly (Press /)"
            aria-label="Open Quick Capture"
            style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--color-aura)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span>Capture</span>
            <kbd className="keyboard-hint-badge">/</kbd>
          </button>

          {/* Share War Room button — opens invite modal */}
          <button
            id="war-room-share-btn"
            type="button"
            className="mission-deck__log-btn"
            onClick={() => setIsInviteOpen(true)}
            title="Share War Room &amp; Invite Team"
            aria-label="Share War Room"
            style={{ borderColor: 'rgba(108,92,231,0.5)', color: '#A29BFE' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Share</span>
          </button>
          <AgoraAnalyticsOverlay
            mos={networkStats.mos}
            jitter={networkStats.jitter}
            rtt={networkStats.rtt}
            packetLoss={networkStats.packetLoss}
            sttLatencyMs={pipelineLatency.stt}
            llmLatencyMs={pipelineLatency.llm}
            ttsLatencyMs={pipelineLatency.tts}
            isCollapsed={isAnalyticsCollapsed}
            onToggle={() => setIsAnalyticsCollapsed((prev) => !prev)}
          />
        </div>
      </footer>
      {/* War Room Summary Card — floating at bottom-right after 5 evidence items */}
      {state.evidenceItems.length >= 5 && !isWarRoomSummaryDismissed && state.status !== 'resolved' && (
        <WarRoomSummaryCard
          incident={state}
          actions={actions}
          onDismiss={() => setIsWarRoomSummaryDismissed(true)}
        />
      )}

      {/* 9. SRE Postmortem Report Modal (Star 7) */}
      <PostmortemModal
        isOpen={isPostmortemOpen}
        onClose={() => setIsPostmortemOpen(false)}
        incident={state}
        evidenceChainEdges={topologyEdges}
        costRate={costRate}
      />

      {/* 9b. Resolve Incident Modal */}
      <ResolveIncidentModal
        isOpen={isResolveOpen}
        onClose={() => setIsResolveOpen(false)}
        incident={state}
        channelName={channel}
        onResolved={() => {
          playResolutionEarcon();
        }}
      />

      {/* 9c. Toast Notification System */}
      <NotificationToastContainer />

      {/* 10. Transcript Drawer (WI-502) */}
      <TranscriptDrawer
        isOpen={isTranscriptDrawerOpen}
        onClose={() => setIsTranscriptDrawerOpen(false)}
        entries={effectiveTranscripts}
      />

      {/* 11. Command-Center Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* 12. War Room Invite & Share Modal */}
      <WarRoomInvite
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      {/* 13. Quick Capture Command Bar */}
      <QuickCapture
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        speakerName={name}
        onSubmit={(payload: QuickCapturePayload) => {
          const newItem = {
            id: `qc-${Date.now()}`,
            category: payload.category,
            content: payload.content,
            speakerUid: uid,
            speakerName: name,
            confidence: 75,
            timestamp: Date.now(),
            ...(payload.category === 'action' ? { actionStatus: 'pending' as const } : {}),
          };
          processEvent({
            type: 'dashboard_event',
            id: newItem.id,
            seq: state.eventSeq + 1,
            timestamp: Date.now(),
            eventType: 'evidence_added',
            payload: newItem,
          });
          fetch('/api/incident/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName: channel, item: newItem }),
          }).catch(() => {});
          emitToast({
            type: 'info',
            title: `${payload.category.toUpperCase()} Logged`,
            description: payload.content,
          });
        }}
      />
    </div>
    </>
  );
}

function ViewTransition({ children, name = 'main-view' }: { children: React.ReactNode; name?: string }) {
  return (
    <div style={{ viewTransitionName: name } as React.CSSProperties} className="view-transition-wrapper">
      {children}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary fallbackMessage="Operational fault detected on Command Bridge.">
      <ViewTransition name="main-view">
        <Suspense
          fallback={
            <div className="loading-skeleton" aria-label="Initializing Command Bridge" role="status">
              <div className="loading-skeleton__status-bar" />
              <div className="loading-skeleton__body">
                <div className="loading-skeleton__panel" />
                <div className="loading-skeleton__main">
                  <div className="loading-skeleton__card" />
                  <div className="loading-skeleton__card" />
                  <div className="loading-skeleton__card" />
                </div>
                <div className="loading-skeleton__panel" />
              </div>
              <div className="loading-skeleton__dock" />
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </ViewTransition>
    </ErrorBoundary>
  );
}
