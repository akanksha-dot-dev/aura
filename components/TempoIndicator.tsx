'use client';

import React from 'react';

export interface TempoIndicatorProps {
  level: number; // 1-5
}

export function TempoIndicator({ level }: TempoIndicatorProps) {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  const dots = [1, 2, 3, 4, 5];

  return (
    <>
      <style>{`
        .tempo-indicator {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          width: 100%;
        }
        .tempo-indicator__dots {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          letter-spacing: 0.1em;
          user-select: none;
        }
        .tempo-indicator__dot--active {
          color: var(--color-aura);
        }
        .tempo-indicator__dot--inactive {
          color: var(--text-disabled);
        }
      `}</style>
      <div
        className="tempo-indicator"
        aria-label={`Incident tempo: ${clamped} of 5`}
      >
        <span>TEMPO:</span>
        <span className="tempo-indicator__dots" aria-hidden="true">
          {dots.map((d) => (
            <span
              key={d}
              className={
                d <= clamped
                  ? 'tempo-indicator__dot--active'
                  : 'tempo-indicator__dot--inactive'
              }
            >
              {d <= clamped ? '◉' : '○'}
            </span>
          ))}
        </span>
      </div>
    </>
  );
}
