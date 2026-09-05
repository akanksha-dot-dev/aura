'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LobbyScreen } from '@/components/LobbyScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PersonaConfig } from '@/lib/constants';
import { ScenarioConfig, storeScenarioConfig, PRESET_SCENARIOS } from '@/lib/scenarios';

function ViewTransition({ children, name = 'main-view' }: { children: React.ReactNode; name?: string }) {
  return (
    <div style={{ viewTransitionName: name } as React.CSSProperties} className="view-transition-wrapper">
      {children}
    </div>
  );
}

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelOverride = searchParams.get('channel');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleJoin = (
    persona: PersonaConfig,
    options?: { costRate?: number; simulateReplay?: boolean },
    scenario?: ScenarioConfig
  ) => {
    setIsConnecting(true);

    // Store the full scenario config in sessionStorage for the dashboard to read
    const activeScenario = scenario || PRESET_SCENARIOS[0];
    storeScenarioConfig(activeScenario);

    const channel = channelOverride || activeScenario.channelName;
    const params = new URLSearchParams({
      uid: persona.uid,
      name: persona.displayName,
      role: persona.role,
      channel,
    });
    if (options?.costRate) {
      params.set('costRate', options.costRate.toString());
    }
    if (options?.simulateReplay) {
      params.set('__AURA_REPLAY_MOCK_STREAM', 'true');
      params.set('speed', '1.5');
    }
    const targetUrl = `/?${params.toString()}`;

    // Graceful native View Transition API with fallback
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        router.push(targetUrl);
      });
    } else {
      router.push(targetUrl);
    }
  };

  return <LobbyScreen onJoin={handleJoin} isConnecting={isConnecting} />;
}

export default function LobbyPage() {
  return (
    <ErrorBoundary fallbackMessage="Failed to initialize incident lobby.">
      <ViewTransition name="main-view">
        <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
          <LobbyContent />
        </Suspense>
      </ViewTransition>
    </ErrorBoundary>
  );
}
