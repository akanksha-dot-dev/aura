'use client';

import React, { useState, useEffect } from 'react';

export interface SilenceCounterProps {
  agentLastSpokeAt: number;
  agentIsSpeaking: boolean;
}

export function SilenceCounter({
  agentLastSpokeAt,
  agentIsSpeaking,
}: SilenceCounterProps) {
  const [silentSec, setSilentSec] = useState<number>(0);

  useEffect(() => {
    if (agentIsSpeaking) {
      return;
    }

    const tick = () => {
      setSilentSec(Math.max(0, Math.round((Date.now() - agentLastSpokeAt) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [agentLastSpokeAt, agentIsSpeaking]);

  let icon: string;
  let text: string;
  let isTimer = false;
  if (agentIsSpeaking) {
    icon = '🔊';
    text = 'Speaking';
  } else if (silentSec < 60) {
    icon = '⏸';
    text = `${silentSec}s`;
    isTimer = true;
  } else {
    const min = Math.floor(silentSec / 60);
    const sec = silentSec % 60;
    icon = '⏸';
    text = `${min}m ${sec}s`;
    isTimer = true;
  }

  const statusClass = agentIsSpeaking
    ? 'silence-counter--speaking'
    : silentSec >= 120
    ? 'silence-counter--critical'
    : silentSec >= 60
    ? 'silence-counter--warning'
    : 'silence-counter--normal';

  return (
    <>
      <style>{`
        .silence-counter {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          white-space: nowrap;
          transition: color var(--duration-normal) var(--ease-standard);
        }
        .silence-counter__val {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }
        .silence-counter--speaking {
          color: var(--color-fact);
          font-weight: var(--weight-semibold);
        }
        .silence-counter--normal {
          color: var(--color-aura);
        }
        .silence-counter--warning {
          color: var(--color-orient);
          font-weight: var(--weight-medium);
        }
        .silence-counter--critical {
          color: var(--color-conflict);
          font-weight: var(--weight-bold);
        }
      `}</style>
      <span
        className={`silence-counter ${statusClass}`}
        title={`AURA activity status: ${icon} ${text}`}
        aria-label={`AURA activity status: ${icon} ${text}`}
      >
        <span aria-hidden="true">{icon}</span>
        <span className={isTimer ? 'silence-counter__val' : undefined}>{text}</span>
      </span>
    </>
  );
}
