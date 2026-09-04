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
          font-family: var(--font-mono);
          font-size: 10px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border-hairline);
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-standard);
        }
        .silence-counter__pip {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
        .silence-counter__val {
          font-variant-numeric: tabular-nums;
        }
        .silence-counter--speaking {
          color: var(--color-fact);
          border-color: var(--color-fact-border);
          background: var(--color-fact-dim);
          font-weight: 500;
        }
        .silence-counter--normal {
          color: var(--text-secondary);
        }
        .silence-counter--warning {
          color: var(--color-hypothesis);
          border-color: var(--color-hypothesis-border);
        }
        .silence-counter--critical {
          color: var(--color-conflict);
          border-color: var(--color-conflict-border);
        }
      `}</style>
      <span
        className={`silence-counter ${statusClass}`}
        title={`AURA activity status: ${icon} ${text}`}
        aria-label={`AURA activity status: ${icon} ${text}`}
      >
        <span className="silence-counter__pip" aria-hidden="true" />
        <span className={isTimer ? 'silence-counter__val' : undefined}>{text}</span>
      </span>
    </>
  );
}
