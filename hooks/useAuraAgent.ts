'use client';

import { useEffect, useRef, useState } from 'react';
import type { IncidentState, Participant } from '@/lib/types';
import {
  ScenarioConfig,
  loadScenarioConfig,
  PRESET_SCENARIOS,
  PersonaDefinition,
} from '@/lib/scenarios';

export interface UseAuraAgentOptions {
  channel: string;
  uid: string;
  name: string;
  role: string;
  voiceLang: string;
  scenarioConfig: ScenarioConfig | null;
  scenarioId: string | null;
  isJoined: boolean;
  isMockReplay: boolean;
  incidentState: IncidentState;
  effectiveParticipants: Record<string, Participant>;
}

/**
 * Manages the live Agora Conversational AI Agent lifecycle:
 * 1. Automatically launches the agent when the operator joins the RTC war room.
 * 2. Hot-syncs active incident telemetry (hypotheses, decisions, facts) via /api/agent/update.
 * 3. Gracefully terminates the agent instance on unmount or session exit.
 */
export function useAuraAgent({
  channel,
  uid,
  name,
  role,
  voiceLang,
  scenarioConfig,
  scenarioId,
  isJoined,
  isMockReplay,
  incidentState,
  effectiveParticipants,
}: UseAuraAgentOptions): { activeAgentId: string | null } {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const activeAgentIdRef = useRef<string | null>(null);
  const activeAgentChannelRef = useRef<string | null>(null);

  // 1. Launch Agora Conversational AI Agent into RTC channel when live bridge is active
  useEffect(() => {
    if (isMockReplay || !channel || !isJoined) return;

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
          console.info('[useAuraAgent] AURA live agent standby:', errData);
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
          setActiveAgentId(data.agentId);
          console.info('[useAuraAgent] AURA agent active in channel:', data.agentId);
        }
      } catch (err) {
        console.warn('[useAuraAgent] AURA agent launch notice:', err);
      }
    }

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
  }, [isMockReplay, channel, isJoined, uid, name, role, voiceLang, scenarioConfig, scenarioId]);

  // 2. Hot-sync dynamic incident state to active Agora ConvAI agent
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

      if (lastSyncedEvidenceSeqRef.current === incidentState.eventSeq) return;
      lastSyncedEvidenceSeqRef.current = incidentState.eventSeq;

      fetch('/api/agent/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          channelName: channel,
          incidentState,
          participants: Object.values(effectiveParticipants),
          operatorUid: uid,
          scenario: scenarioConfig
            ? {
                title: scenarioConfig.title,
                severity: scenarioConfig.severity,
                affectedServices: scenarioConfig.affectedServices,
                description: scenarioConfig.description,
                impact: scenarioConfig.impact,
                suspectedCause: scenarioConfig.suspectedCause,
                playbook: scenarioConfig.playbook,
              }
            : undefined,
        }),
      }).catch((err) => {
        console.warn('[useAuraAgent] Context hot-sync notice:', err);
      });
    }, 1200);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [
    incidentState.eventSeq,
    incidentState.evidenceItems.length,
    incidentState.status,
    incidentState.incidentCommanderUid,
    effectiveParticipants,
    channel,
    isMockReplay,
    scenarioConfig,
    uid,
    incidentState,
  ]);

  return { activeAgentId };
}
