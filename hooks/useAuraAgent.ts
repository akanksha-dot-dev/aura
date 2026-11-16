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

  // 2. Immediately terminate agent on tab close, page refresh, or navigation away from flight deck
  useEffect(() => {
    const handleStop = () => {
      const id = activeAgentIdRef.current;
      const chan = activeAgentChannelRef.current || channel;
      if (!id && !chan) return;

      activeAgentIdRef.current = null;
      activeAgentChannelRef.current = null;

      const payload = JSON.stringify({ agentId: id || undefined, channelName: chan || undefined });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/agent/stop', blob);
      } else {
        fetch('/api/agent/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handleStop);
      window.addEventListener('beforeunload', handleStop);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handleStop);
        window.removeEventListener('beforeunload', handleStop);
      }
      handleStop();
    };
  }, [channel]);

  // 3. Note on mid-session hot-sync:
  // Agora ConvAI maintains continuous conversation history naturally over the active audio bridge.
  // We intentionally do not call /api/agent/update on every evidence event mid-call, because
  // Agora's cloud engine resets in-flight LLM buffers upon receiving /update, which caused
  // the agent to become unresponsive after the first few statements.

  return { activeAgentId };
}

