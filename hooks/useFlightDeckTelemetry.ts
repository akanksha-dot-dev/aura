'use client';

import { useMemo, useRef, useEffect } from 'react';
import type { IncidentState, Participant, TopologyNode, TopologyEdge } from '@/lib/types';
import type { AgoraNetworkStats } from '@/hooks/useAgoraRTC';
import type { TranscriptEntry } from '@/components/modals/TranscriptDrawer';
import { playConflictEarcon, playActionCompletedEarcon } from '@/lib/audioCues';

export interface FlightDeckTelemetryOptions {
  state: IncidentState;
  effectiveParticipants: Record<string, Participant>;
  volumeLevels: Record<string, number>;
  mockSpeaker: string | null;
  mockTranscript: string | null;
  liveTranscriptSpeaker: string | null;
  liveTranscriptText: string | null;
  connectionState: string;
  networkStats: AgoraNetworkStats;
  isMockReplay: boolean;
  isJoined: boolean;
  transcriptHistory?: TranscriptEntry[];
}

export function useFlightDeckTelemetry({
  state,
  effectiveParticipants,
  volumeLevels,
  mockSpeaker,
  mockTranscript,
  liveTranscriptSpeaker,
  liveTranscriptText,
  connectionState,
  networkStats,
  isMockReplay,
  isJoined,
  transcriptHistory = [],
}: FlightDeckTelemetryOptions) {
  // Derived Topology Graph Data (Nodes & Edges) for MainView
  const topologyNodes = useMemo<TopologyNode[]>(() => {
    return state.evidenceItems.map((item) => ({
      id: item.id,
      category: item.category,
      content:
        item.content.length > 50 ? `${item.content.substring(0, 47)}…` : item.content,
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
        Math.max(10, 15 + idx * 7 + (item.category === 'conflict' ? 30 : 0))
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
    mockSpeaker ?? liveTranscriptSpeaker ?? activeSpeakerName;

  const currentTranscript =
    mockTranscript ??
    liveTranscriptText ??
    (activeSpeakerName
      ? `${activeSpeakerName} is transmitting telemetry and situational updates...`
      : 'Voice channel active — monitoring real-time communications...');

  const tempoLevel = useMemo(() => {
    return Math.min(5, Math.max(1, Math.ceil(state.evidenceItems.length / 3) || 1));
  }, [state.evidenceItems.length]);

  const icDisplayName = state.incidentCommanderUid
    ? effectiveParticipants[state.incidentCommanderUid]?.displayName ??
      state.incidentCommanderUid
    : null;

  const connectionQuality: 'excellent' | 'good' | 'poor' =
    connectionState === 'CONNECTED'
      ? networkStats.mos >= 3.8
        ? 'excellent'
        : networkStats.mos >= 2.8
        ? 'good'
        : 'poor'
      : isJoined
      ? 'good'
      : 'poor';

  const pipelineLatency = useMemo(() => {
    if (connectionState !== 'CONNECTED' && !isMockReplay) {
      return { stt: null, llm: null, tts: null };
    }
    const stt = Math.max(28, Math.round(36 + networkStats.rtt * 0.12));
    const llm = Math.max(120, Math.round(160 + networkStats.rtt * 0.25));
    const tts = Math.max(65, Math.round(78 + networkStats.jitter * 1.1));
    return { stt, llm, tts };
  }, [connectionState, isMockReplay, networkStats.rtt, networkStats.jitter]);

  // Telemetry items & counts
  const activeConflict = useMemo(
    () => state.evidenceItems.find((e) => e.category === 'conflict' && e.status === 'active'),
    [state.evidenceItems]
  );
  const actions = useMemo(() => state.evidenceItems.filter((e) => e.category === 'action'), [state.evidenceItems]);
  const factCount = useMemo(() => state.evidenceItems.filter((e) => e.category === 'fact').length, [state.evidenceItems]);
  const hypothesisCount = useMemo(
    () => state.evidenceItems.filter((e) => e.category === 'hypothesis' && e.status === 'active').length,
    [state.evidenceItems]
  );
  const decisionCount = useMemo(() => state.evidenceItems.filter((e) => e.category === 'decision').length, [state.evidenceItems]);
  const actionCompletedCount = useMemo(() => actions.filter((e) => e.actionStatus === 'done').length, [actions]);
  const conflictCount = useMemo(
    () => state.evidenceItems.filter((e) => e.category === 'conflict' && e.status === 'active').length,
    [state.evidenceItems]
  );

  // Operational Auditory Earcons
  const prevConflictRef = useRef(false);
  useEffect(() => {
    if (!prevConflictRef.current && Boolean(activeConflict)) {
      playConflictEarcon();
    }
    prevConflictRef.current = Boolean(activeConflict);
  }, [activeConflict]);

  const prevActionCountRef = useRef(actionCompletedCount);
  useEffect(() => {
    if (actionCompletedCount > prevActionCountRef.current) {
      playActionCompletedEarcon();
    }
    prevActionCountRef.current = actionCompletedCount;
  }, [actionCompletedCount]);

  const effectiveTranscripts = useMemo<TranscriptEntry[]>(() => {
    if (transcriptHistory.length > 0) return transcriptHistory;
    return state.evidenceItems.map((e) => ({
      id: `ev-${e.id}`,
      speakerName: e.speakerName || 'Incident Responder',
      timestamp: e.timestamp,
      text: e.content,
    }));
  }, [transcriptHistory, state.evidenceItems]);

  const conflictSpeakerAName = useMemo(() => {
    if (!activeConflict) return 'Marcus';
    if (activeConflict.speakerAUid) {
      return effectiveParticipants[activeConflict.speakerAUid]?.displayName ?? activeConflict.speakerAUid;
    }
    return activeConflict.speakerName ?? 'Marcus';
  }, [activeConflict, effectiveParticipants]);

  const conflictSpeakerBName = useMemo(() => {
    if (!activeConflict) return 'Sarah';
    if (activeConflict.speakerBUid) {
      return effectiveParticipants[activeConflict.speakerBUid]?.displayName ?? activeConflict.speakerBUid;
    }
    return 'Sarah';
  }, [activeConflict, effectiveParticipants]);

  return {
    topologyNodes,
    topologyEdges,
    tensionHistory,
    inflectionPoints,
    captionSpeakerName,
    currentTranscript,
    tempoLevel,
    icDisplayName,
    connectionQuality,
    pipelineLatency,
    activeConflict,
    conflictSpeakerAName,
    conflictSpeakerBName,
    actions,
    factCount,
    hypothesisCount,
    decisionCount,
    actionCompletedCount,
    conflictCount,
    effectiveTranscripts,
  };
}
