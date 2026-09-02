'use client';

import React from 'react';
import { OODAPhase } from '@/lib/types';

export interface OODAIndicatorProps {
  currentPhase: OODAPhase;
}

const PHASES: Array<'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT'> = [
  'OBSERVE',
  'ORIENT',
  'DECIDE',
  'ACT',
];

export function OODAIndicator({ currentPhase }: OODAIndicatorProps) {
  const isResolved = currentPhase === 'RESOLVED';

  return (
    <>
      <style>{`
        .ooda-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }
        .ooda-phase {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 4px 10px;
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          letter-spacing: 0.05em;
          transition: background var(--duration-normal) var(--ease-standard),
                      color var(--duration-normal) var(--ease-standard),
                      opacity var(--duration-normal) var(--ease-standard);
          color: var(--text-muted);
          background: transparent;
        }
        .ooda-phase--active {
          font-weight: var(--weight-semibold);
          color: var(--text-inverse);
        }
        .ooda-phase--active[data-phase="OBSERVE"] { background: var(--color-observe); }
        .ooda-phase--active[data-phase="ORIENT"] { background: var(--color-orient); }
        .ooda-phase--active[data-phase="DECIDE"] { background: var(--color-decide); }
        .ooda-phase--active[data-phase="ACT"] { background: var(--color-act); }
        .ooda-phase--active[data-phase="RESOLVED"] { background: var(--color-resolved); }
        .ooda-phase--dimmed {
          opacity: 0.35;
        }
        .ooda-arrow {
          color: var(--text-disabled);
          font-size: var(--text-xs);
          user-select: none;
        }
      `}</style>
      <nav className="ooda-indicator" aria-label="Incident OODA Phase Progression">
        {PHASES.map((phase, index) => {
          const isActive = !isResolved && currentPhase === phase;
          const bullet = isActive ? '●' : '○';

          return (
            <React.Fragment key={phase}>
              <span
                className={`ooda-phase ${isActive ? 'ooda-phase--active' : ''} ${
                  isResolved ? 'ooda-phase--dimmed' : ''
                }`}
                data-phase={phase}
                aria-current={isActive ? 'step' : undefined}
              >
                <span aria-hidden="true">{bullet}</span>
                {phase}
              </span>
              {(index < PHASES.length - 1 || isResolved) && (
                <span className="ooda-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}

        {isResolved && (
          <span
            className="ooda-phase ooda-phase--active"
            data-phase="RESOLVED"
            aria-current="step"
          >
            <span aria-hidden="true">✓</span>
            RESOLVED
          </span>
        )}
      </nav>
    </>
  );
}
