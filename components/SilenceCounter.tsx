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

  let displayText: string;
  if (agentIsSpeaking) {
    displayText = '🔊 Speaking';
  } else if (silentSec < 60) {
    displayText = `⏸ ${silentSec}s`;
  } else {
    const min = Math.floor(silentSec / 60);
    const sec = silentSec % 60;
    displayText = `⏸ ${min}m ${sec}s`;
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
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-variant-numeric: tabular-nums;
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          white-space: nowrap;
          transition: color var(--duration-normal) var(--ease-standard);
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
        title={`AURA activity status: ${displayText}`}
        aria-label={`AURA activity status: ${displayText}`}
      >
        {displayText}
      </span>
    </>
  );
}
