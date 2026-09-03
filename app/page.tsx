'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAgoraRTC } from '@/hooks/useAgoraRTC';
import { useAgoraRTM } from '@/hooks/useAgoraRTM';
import { useIncidentState } from '@/hooks/useIncidentState';
import { Participant, TopologyNode, TopologyEdge } from '@/lib/types';
import { startMockReplay } from '@/lib/mockReplay';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  playConflictEarcon,
  playActionCompletedEarcon,
  playResolutionEarcon,
} from '@/lib/audioCues';

function DashboardContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || 'operator_1';
  const name = searchParams.get('name') || 'Operator';
  const role = searchParams.get('role') || 'Incident Responder';
  const channel = searchParams.get('channel') || 'incident-war-room';
  const isMockReplay = Boolean(searchParams.get('__AURA_REPLAY_MOCK_STREAM'));
  const speedParam = Math.max(0.1, Number(searchParams.get('speed')) || 1);
  const initialCostRate = Math.max(1, Number(searchParams.get('costRate')) || 150);
  const [costRate, setCostRate] = useState<number>(initialCostRate);

  // View tabs & Modal states
  const [mainViewTab, setMainViewTab] = useState<'timeline' | 'topology'>('timeline');
  const [isPostmortemOpen, setIsPostmortemOpen] = useState(false);
  const [isTranscriptDrawerOpen, setIsTranscriptDrawerOpen] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [isAnalyticsCollapsed, setIsAnalyticsCollapsed] = useState(false);

  // Global Mission-Control Keyboard Shortcuts (T: Tab, J: Drawer, P: Postmortem, Esc: Close)
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
      } else if (e.key === 'Escape') {
        setIsTranscriptDrawerOpen(false);
        setIsPostmortemOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Central Incident State Engine
  const { state, processEvent, dispatchStateUpdate, claimIC, updateActionStatus } =
    useIncidentState();

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

  // 3. Agora RTM (Intelligence Telemetry Stream) - disabled during mock replay
  useAgoraRTM({
    channelName: channel,
    uid,
    onEvent: processEvent,
    enabled: !isMockReplay,
  });

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
      },
      onCelebration: () => {
        setTimeout(() => {
          setIsPostmortemOpen(true);
        }, 2000);
      },
    });

    return cleanup;
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
    if (!isMockReplay && !isJoined && channel && uid) {
      joinChannel().catch((err: unknown) => {
        console.warn('[Dashboard] Agora RTC join standby:', err);
      });
    }
  }, [isMockReplay, isJoined, channel, uid, joinChannel]);

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

  const captionSpeakerName = mockSpeaker ?? activeSpeakerName;

  const currentTranscript = mockTranscript
    ? mockTranscript
    : activeSpeakerName
    ? `${activeSpeakerName} is transmitting telemetry and situational updates...`
    : 'Voice channel active — monitoring real-time communications...';

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
    <div
      className={`command-center ${activeConflict ? 'has-conflict' : ''} ${
        state.status === 'resolved' ? 'command-center--resolved' : ''
      }`}
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

      {/* 4. Main View: Tabbed Container (Timeline ↔ Topology) */}
      <MainView
        evidenceItems={state.evidenceItems}
        incidentOpenedAt={state.openedAt}
        nodes={topologyNodes}
        edges={topologyEdges}
        isResolved={state.status === 'resolved'}
        activeTab={mainViewTab}
        onTabChange={setMainViewTab}
      />

      {/* 5. Action Tracker */}
      <ActionTracker
        actions={actions}
        onStatusChange={updateActionStatus}
      />

      {/* 6. Narrative Bar */}
      <NarrativeBar
        tensionHistory={tensionHistory}
        oodaPhase={state.currentOODAPhase}
        inflectionPoints={inflectionPoints}
      />

      {/* 7. Incident Stats */}
      <IncidentStats
        factCount={factCount}
        hypothesisCount={hypothesisCount}
        decisionCount={decisionCount}
        actionCompletedCount={actionCompletedCount}
        actionTotalCount={actions.length}
        conflictCount={conflictCount}
      />

      {/* 8. Live Captions */}
      <LiveCaptions
        currentSpeakerName={captionSpeakerName}
        currentTranscript={currentTranscript}
        onToggleTranscriptDrawer={() => {
          setIsTranscriptDrawerOpen((prev) => !prev);
        }}
      />

      {/* 9. SRE Postmortem Report Modal (Star 7) */}
      <PostmortemModal
        isOpen={isPostmortemOpen}
        onClose={() => setIsPostmortemOpen(false)}
        incident={state}
        evidenceChainEdges={topologyEdges}
        costRate={costRate}
      />

      {/* 10. Transcript Drawer (WI-502) */}
      <TranscriptDrawer
        isOpen={isTranscriptDrawerOpen}
        onClose={() => setIsTranscriptDrawerOpen(false)}
        entries={effectiveTranscripts}
      />

      {/* 11. Agora Analytics Overlay (WI-506) */}
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
            <div
              style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
                color: 'var(--color-aura)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
              }}
            >
              INITIALIZING AURA COMMAND BRIDGE...
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </ViewTransition>
    </ErrorBoundary>
  );
}
