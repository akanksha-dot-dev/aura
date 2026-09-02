'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAgoraRTC } from '@/hooks/useAgoraRTC';
import { useAgoraRTM } from '@/hooks/useAgoraRTM';
import { useIncidentState } from '@/hooks/useIncidentState';
import { Participant } from '@/lib/types';
import { StatusBar } from '@/components/StatusBar';
import { SpeakerPanel } from '@/components/SpeakerPanel';
import { ConflictBanner } from '@/components/ConflictBanner';
import { TimelineFeed } from '@/components/TimelineFeed';
import { ActionTracker } from '@/components/ActionTracker';
import { IncidentStats } from '@/components/IncidentStats';
import { NarrativeBar } from '@/components/NarrativeBar';
import { LiveCaptions } from '@/components/LiveCaptions';

function DashboardContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || 'operator_1';
  const name = searchParams.get('name') || 'Operator';
  const role = searchParams.get('role') || 'Incident Responder';
  const channel = searchParams.get('channel') || 'incident-war-room';

  // 1. Central Incident State Engine
  const { state, processEvent, claimIC, updateActionStatus } =
    useIncidentState();

  // 2. Agora RTC (Audio + Volume Levels)
  const {
    joinChannel,
    isJoined,
    volumeLevels,
    connectionState,
  } = useAgoraRTC({
    channelName: channel,
    uid,
  });

  // 3. Agora RTM (Intelligence Telemetry Stream)
  useAgoraRTM({
    channelName: channel,
    uid,
    onEvent: processEvent,
  });

  // Automatically attempt RTC audio join on mount
  useEffect(() => {
    if (!isJoined && channel && uid) {
      joinChannel().catch((err: unknown) => {
        console.warn('[Dashboard] Agora RTC join standby:', err);
      });
    }
  }, [isJoined, channel, uid, joinChannel]);

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

  // Derived tension history & inflection markers for NarrativeBar
  const tensionHistory = useMemo(() => {
    if (state.evidenceItems.length === 0) {
      return [{ timestamp: state.openedAt, value: 15 }];
    }
    return state.evidenceItems.map((item, idx) => ({
      timestamp: item.timestamp,
      value: Math.min(
        100,
        Math.max(
          10,
          15 + idx * 7 + (item.category === 'conflict' ? 30 : 0)
        )
      ),
    }));
  }, [state.evidenceItems, state.openedAt]);

  const inflectionPoints = useMemo(() => {
    return state.evidenceItems
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
  }, [state.evidenceItems]);

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

  const currentTranscript = activeSpeakerName
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
      ? 'excellent'
      : isJoined
      ? 'good'
      : 'poor';

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

      {/* 4. Main View: Timeline Feed */}
      <main className="main-view">
        <TimelineFeed
          evidenceItems={state.evidenceItems}
          incidentOpenedAt={state.openedAt}
        />
      </main>

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
        currentSpeakerName={activeSpeakerName}
        currentTranscript={currentTranscript}
        onToggleTranscriptDrawer={() => {
          // Slide-out drawer toggle (Tier 2 feature)
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
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
  );
}
