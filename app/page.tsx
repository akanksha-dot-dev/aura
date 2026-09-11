'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAgoraRTC } from '@/hooks/useAgoraRTC';
import { setRtmIncidentState } from '@/hooks/useAgoraRTM';
import { useIncidentState } from '@/hooks/useIncidentState';
import { useWarRoomModals } from '@/hooks/useWarRoomModals';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSpeechRecognitionFallback } from '@/hooks/useSpeechRecognitionFallback';
import { useAuraAgent } from '@/hooks/useAuraAgent';
import { useFlightDeckTelemetry } from '@/hooks/useFlightDeckTelemetry';
import { useMockReplayStream } from '@/hooks/useMockReplayStream';
import { useWarRoomTranscripts } from '@/hooks/useWarRoomTranscripts';
import { useScenarioConfig } from '@/hooks/useScenarioConfig';
import { useEvidenceLogger } from '@/hooks/useEvidenceLogger';
import { Participant } from '@/lib/types';
import { createIncidentStateFromScenario } from '@/lib/scenarios';
import { calculateDynamicBurnRate } from '@/lib/costModel';
import {
  StatusBar,
  SpeakerPanel,
  ConflictBanner,
  MainView,
  ActionTracker,
  MissionDeck,
  SimulationBanner,
  WarRoomModals,
  WarRoomSummaryCard,
  LoadingSkeleton,
  ErrorBoundary,
  emitToast,
} from '@/components';
import { playResolutionEarcon } from '@/lib/audioCues';

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
  const explicitCostParam = searchParams.get('costRate') ? Number(searchParams.get('costRate')) : null;
  const [manualCostRate, setManualCostRate] = useState<number | null>(explicitCostParam);

  // 1. Modals, views, and settings
  const modals = useWarRoomModals();
  const [mainViewTab, setMainViewTab] = useState<'timeline' | 'topology' | 'analytics'>('timeline');
  const [isCostPaused, setIsCostPaused] = useState(false);
  const [isSpeakerCollapsed, setIsSpeakerCollapsed] = useState(false);
  const [isActionsCollapsed, setIsActionsCollapsed] = useState(false);
  const [isSummaryDismissed, setIsSummaryDismissed] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('aura_voice_lang') || 'en-IN' : 'en-IN'
  );

  const isValidSession = Boolean(searchParams.get('uid') || searchParams.get('persona') || isMockReplay);

  useEffect(() => {
    if (!isValidSession) {
      router.replace('/lobby');
    }
  }, [isValidSession, router]);

  // 2. Scenario & Central State Engine
  const scenarioConfig = useScenarioConfig(scenarioId, channel);
  const scenarioInitialState = useMemo(() => {
    if (!scenarioConfig) return undefined;
    const base = createIncidentStateFromScenario(scenarioConfig);
    return {
      incidentId: base.incidentId,
      title: base.title,
      severity: base.severity,
      affectedServices: base.affectedServices,
      openedAt: base.openedAt,
    };
  }, [scenarioConfig]);

  const { state, processEvent, dispatchStateUpdate, claimIC, updateActionStatus } =
    useIncidentState(scenarioInitialState);

  const effectiveCostRate = useMemo(() => {
    if (manualCostRate !== null) return manualCostRate;
    const dynamicPerMinute = calculateDynamicBurnRate(state.severity || 'SEV-1', state.affectedServices);
    return Math.max(1, Math.round(dynamicPerMinute / 60));
  }, [manualCostRate, state.severity, state.affectedServices]);

  setRtmIncidentState(state);

  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    if (prevStatusRef.current !== 'resolved' && state.status === 'resolved') {
      playResolutionEarcon();
      const timer = setTimeout(() => modals.openModal('postmortem'), 2000);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = state.status;
  }, [state.status, modals]);

  useEffect(() => {
    const prefix = state.severity ? `[${state.severity.toUpperCase()}]` : '';
    const statusTag = state.status === 'resolved' ? '✓' : '⚠';
    document.title = `${statusTag} ${prefix} ${state.title || 'Incident'} — AURA`;
  }, [state.severity, state.title, state.status]);

  // 3. Audio & Voice Subsystems
  const { joinChannel, isJoined, volumeLevels, connectionState, networkStats, localAudioTrack } =
    useAgoraRTC({ channelName: channel, uid });

  useEffect(() => {
    if (!isValidSession || isMockReplay || isJoined || !channel || !uid) return;
    let active = true;
    joinChannel().catch((err: unknown) => {
      if (!active) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('OPERATION_ABORTED') && !msg.includes('cancel token canceled')) {
        console.warn('[Dashboard] Agora RTC standby:', err);
      }
    });
    return () => { active = false; };
  }, [isValidSession, isMockReplay, isJoined, channel, uid, joinChannel]);

  const toggleMute = useCallback(() => {
    if (!localAudioTrack) return;
    const nextState = !localAudioTrack.enabled;
    localAudioTrack.setEnabled(nextState);
    emitToast({
      type: 'info',
      title: nextState ? 'Microphone Active' : 'Microphone Muted',
      description: nextState ? 'Voice transmission enabled.' : 'Microphone muted (Press Space to unmute).',
    });
  }, [localAudioTrack]);

  const transcripts = useWarRoomTranscripts({
    channel,
    uid,
    name,
    processEvent,
    isMockReplay,
    enabled: isValidSession,
  });

  useSpeechRecognitionFallback({
    isMockReplay,
    isJoined,
    speakerName: name,
    voiceLang,
    volumeLevels,
    onTranscript: (spk, txt) => {
      transcripts.setLiveTranscriptText(txt);
      transcripts.setLiveTranscriptSpeaker(spk);
    },
  });

  // 4. Hotkeys & Mock Replay
  useKeyboardShortcuts({
    onToggleShortcuts: () => modals.toggleModal('shortcuts'),
    onToggleQuickCapture: () => modals.toggleModal('quickCapture'),
    onToggleMute: toggleMute,
    onCloseAllOverlays: modals.closeAllModals,
    onToggleTab: () => setMainViewTab((p) => (p === 'timeline' ? 'topology' : 'timeline')),
    onToggleTranscript: () => modals.toggleModal('transcript'),
    onTogglePostmortem: () => modals.toggleModal('postmortem'),
    onToggleCostPause: () => setIsCostPaused((p) => !p),
    onToggleSpeakerCollapse: () => setIsSpeakerCollapsed((p) => !p),
    onToggleActionsCollapse: () => setIsActionsCollapsed((p) => !p),
    onToggleFullFocus: () => {
      setIsSpeakerCollapsed((p) => {
        const next = !p;
        setIsActionsCollapsed(next);
        return next;
      });
    },
    onToggleResolve: () => modals.toggleModal('resolve'),
    onToggleAnalyticsTab: () => setMainViewTab((p) => (p === 'analytics' ? 'timeline' : 'analytics')),
    onOpenPostmortemIfResolved: () => {
      if (state.status === 'resolved') {
        modals.toggleModal('postmortem');
      } else {
        emitToast({
          type: 'info',
          title: 'Incident not resolved',
          description: 'Postmortem report is available after incident is resolved (press R to resolve).',
        });
      }
    },
  });

  const [mockSpeaker, setMockSpeaker] = useState<string | null>(null);
  const [mockTranscript, setMockTranscript] = useState<string | null>(null);

  useMockReplayStream({
    isMockReplay,
    speedParam,
    processEvent,
    dispatchStateUpdate,
    onSpeech: (speaker, transcript) => {
      setMockSpeaker(speaker);
      setMockTranscript(transcript);
      transcripts.appendTranscript(speaker || 'Incident Responder', transcript);
    },
    onCelebration: () => modals.openModal('postmortem'),
  });

  // 5. Participants & Telemetry
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

  useAuraAgent({
    channel,
    uid,
    name,
    role,
    voiceLang,
    scenarioConfig,
    scenarioId,
    isJoined,
    isMockReplay,
    incidentState: state,
    effectiveParticipants,
  });

  const telemetry = useFlightDeckTelemetry({
    state,
    effectiveParticipants,
    volumeLevels,
    mockSpeaker,
    mockTranscript,
    liveTranscriptSpeaker: transcripts.liveTranscriptSpeaker,
    liveTranscriptText: transcripts.liveTranscriptText,
    connectionState,
    networkStats,
    isMockReplay,
    isJoined,
    transcriptHistory: transcripts.transcriptHistory,
  });

  const { logAction, logQuickCapture, broadcastActionStatus, broadcastClaimIC } = useEvidenceLogger({
    channel,
    uid,
    name,
    eventSeq: state.eventSeq,
    processEvent,
  });

  return (
    <>
      <SimulationBanner isMockReplay={isMockReplay} />

      <div
        className={`command-center ${telemetry.activeConflict ? 'has-conflict' : ''} ${
          state.status === 'resolved' ? 'command-center--resolved' : ''
        } ${isSpeakerCollapsed ? 'speakers-collapsed' : ''} ${isActionsCollapsed ? 'actions-collapsed' : ''}`}
        style={isMockReplay ? { top: '32px', height: 'calc(100vh - 32px)' } : undefined}
      >
        <StatusBar
          incidentTitle={state.title}
          severity={state.severity}
          status={state.status}
          openedAt={state.openedAt}
          resolvedAt={state.resolvedAt}
          currentOODAPhase={state.currentOODAPhase}
          icName={telemetry.icDisplayName}
          connectionQuality={telemetry.connectionQuality}
          onClaimIC={() => {
            claimIC(uid);
            broadcastClaimIC(uid, name);
          }}
          costRate={effectiveCostRate}
          onRateChange={setManualCostRate}
          isCostPaused={isCostPaused}
          onToggleCostPause={() => setIsCostPaused((p) => !p)}
          voiceLang={voiceLang}
          onVoiceLangChange={(l) => {
            setVoiceLang(l);
            if (typeof window !== 'undefined') sessionStorage.setItem('aura_voice_lang', l);
            emitToast({
              type: 'info',
              title: 'ASR Model Switched',
              description: `Voice recognition switched to ${l === 'en-IN' ? 'Indian English (en-IN)' : 'US English (en-US)'}.`,
            });
          }}
          cognitiveLoadScore={state.cognitiveLoadScore}
          onResolve={() => modals.openModal('resolve')}
        />

        <SpeakerPanel
          participants={effectiveParticipants}
          localVolumeLevel={volumeLevels}
          agentUid="aura_agent"
          agentLastSpokeAt={effectiveParticipants['aura_agent']?.lastSpokeAt ?? state.openedAt}
          agentIsSpeaking={(volumeLevels['aura_agent'] ?? 0) > 20}
          cognitiveLoadScore={state.cognitiveLoadScore}
          tempoLevel={telemetry.tempoLevel}
          isCollapsed={isSpeakerCollapsed}
          onToggleCollapse={() => setIsSpeakerCollapsed((p) => !p)}
        />

        <ConflictBanner
          isActive={Boolean(telemetry.activeConflict)}
          hypothesisA={telemetry.activeConflict?.hypothesisA ?? telemetry.activeConflict?.content ?? ''}
          speakerAName={telemetry.conflictSpeakerAName}
          hypothesisB={telemetry.activeConflict?.hypothesisB ?? 'Alternative hypothesis'}
          speakerBName={telemetry.conflictSpeakerBName}
          decidingMetric={telemetry.activeConflict?.decidingMetric ?? 'Database query latency logs'}
        />

        <MainView
          evidenceItems={state.evidenceItems}
          incidentOpenedAt={state.openedAt}
          nodes={telemetry.topologyNodes}
          edges={telemetry.topologyEdges}
          isResolved={state.status === 'resolved'}
          activeTab={mainViewTab}
          onTabChange={setMainViewTab}
          incident={state}
          costRate={effectiveCostRate}
          channelName={channel}
          suspectedCause={scenarioConfig?.suspectedCause}
          scenarioSummary={scenarioConfig?.description || scenarioConfig?.impact}
        />

        <ActionTracker
          actions={telemetry.actions}
          hypotheses={state.evidenceItems.filter((e) => e.category === 'hypothesis')}
          suspectedCause={scenarioConfig?.suspectedCause}
          onStatusChange={(actionId, newStatus) => {
            updateActionStatus(actionId, newStatus);
            broadcastActionStatus(actionId, newStatus);
          }}
          isCollapsed={isActionsCollapsed}
          onToggleCollapse={() => setIsActionsCollapsed((p) => !p)}
          playbookSteps={scenarioConfig?.playbook}
          onCreateAction={logAction}
          incidentStatus={state.status}
        />

        <MissionDeck
          tensionHistory={telemetry.tensionHistory}
          oodaPhase={state.currentOODAPhase}
          inflectionPoints={telemetry.inflectionPoints}
          captionSpeakerName={telemetry.captionSpeakerName}
          currentTranscript={telemetry.currentTranscript}
          factCount={telemetry.factCount}
          hypothesisCount={telemetry.hypothesisCount}
          decisionCount={telemetry.decisionCount}
          actionCompletedCount={telemetry.actionCompletedCount}
          actionTotalCount={telemetry.actions.length}
          conflictCount={telemetry.conflictCount}
          networkStats={networkStats}
          pipelineLatency={telemetry.pipelineLatency}
          isAnalyticsCollapsed={modals.isAnalyticsCollapsed}
          onToggleAnalytics={() => modals.toggleModal('analytics')}
          onToggleTranscript={() => modals.toggleModal('transcript')}
          onToggleShortcuts={() => modals.toggleModal('shortcuts')}
          onOpenQuickCapture={() => modals.openModal('quickCapture')}
          onOpenInvite={() => modals.openModal('invite')}
        />

        {state.evidenceItems.length >= 5 && !isSummaryDismissed && state.status !== 'resolved' && (
          <WarRoomSummaryCard incident={state} actions={telemetry.actions} onDismiss={() => setIsSummaryDismissed(true)} />
        )}

        <WarRoomModals
          modals={modals}
          incident={state}
          topologyEdges={telemetry.topologyEdges}
          costRate={effectiveCostRate}
          channelName={channel}
          effectiveTranscripts={telemetry.effectiveTranscripts}
          speakerName={name}
          onQuickCaptureSubmit={logQuickCapture}
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
        <Suspense fallback={<LoadingSkeleton />}>
          <DashboardContent />
        </Suspense>
      </ViewTransition>
    </ErrorBoundary>
  );
}
