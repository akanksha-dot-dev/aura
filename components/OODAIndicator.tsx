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

const PHASE_COLORS: Record<string, string> = {
  OBSERVE: 'var(--color-observe)',
  ORIENT: 'var(--color-orient)',
  DECIDE: 'var(--color-decide)',
  ACT: 'var(--color-act)',
  RESOLVED: 'var(--color-resolved)',
};

export function OODAIndicator({ currentPhase }: OODAIndicatorProps) {
  const isResolved = currentPhase === 'RESOLVED';
  const currentIndex = isResolved ? 4 : PHASES.indexOf(currentPhase as 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT');

  return (
    <>
      <style>{`
        .ooda-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 0, 0, 0.35);
          padding: 3px 6px;
          border-radius: 99px;
          border: 1px solid var(--border-subtle);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .ooda-phase {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 99px;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: var(--weight-medium);
          letter-spacing: 0.05em;
          border: 1px solid transparent;
          transition: all var(--duration-normal) var(--ease-standard);
          color: var(--text-disabled);
          background: transparent;
          white-space: nowrap;
        }

        .ooda-phase--completed {
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--border-subtle);
        }

        .ooda-phase--active {
          font-weight: var(--weight-bold);
          color: var(--text-inverse);
          box-shadow: 0 0 12px var(--glow-color, rgba(255, 255, 255, 0.3)), 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .ooda-phase--active[data-phase="OBSERVE"] {
          background: var(--color-observe);
          --glow-color: rgba(59, 212, 162, 0.4);
        }
        .ooda-phase--active[data-phase="ORIENT"] {
          background: var(--color-orient);
          --glow-color: rgba(232, 168, 56, 0.4);
        }
        .ooda-phase--active[data-phase="DECIDE"] {
          background: var(--color-decide);
          --glow-color: rgba(123, 140, 255, 0.4);
        }
        .ooda-phase--active[data-phase="ACT"] {
          background: var(--color-act);
          --glow-color: rgba(232, 125, 62, 0.4);
        }
        .ooda-phase--active[data-phase="RESOLVED"] {
          background: var(--color-resolved);
          --glow-color: rgba(59, 212, 162, 0.5);
        }

        .ooda-phase__bullet {
          font-size: 0.625rem;
          line-height: 1;
        }

        .ooda-divider {
          width: 6px;
          height: 2px;
          border-radius: 1px;
          background: var(--border-subtle);
          flex-shrink: 0;
          transition: background 0.2s ease;
        }

        .ooda-divider--passed {
          background: var(--border-emphasis);
        }
      `}</style>
      <nav className="ooda-indicator" aria-label="Incident OODA Phase Progression">
        {PHASES.map((phase, index) => {
          const isActive = !isResolved && currentPhase === phase;
          const isCompleted = isResolved || index < currentIndex;
          const isPassedDivider = index < currentIndex;

          const bullet = isCompleted && !isActive ? '✓' : isActive ? '●' : '○';

          return (
            <React.Fragment key={phase}>
              <span
                className={`ooda-phase ${
                  isActive
                    ? 'ooda-phase--active'
                    : isCompleted
                    ? 'ooda-phase--completed'
                    : ''
                }`}
                data-phase={phase}
                style={
                  isCompleted && !isActive
                    ? {
                        backgroundColor: `color-mix(in srgb, ${PHASE_COLORS[phase]} 12%, transparent)`,
                        borderColor: `color-mix(in srgb, ${PHASE_COLORS[phase]} 25%, transparent)`,
                        color: 'var(--text-primary)',
                      }
                    : undefined
                }
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="ooda-phase__bullet" aria-hidden="true">{bullet}</span>
                <span>{phase}</span>
              </span>
              {index < PHASES.length - 1 && (
                <span
                  className={`ooda-divider ${isPassedDivider ? 'ooda-divider--passed' : ''}`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}

        {isResolved && (
          <>
            <span className="ooda-divider ooda-divider--passed" aria-hidden="true" />
            <span
              className="ooda-phase ooda-phase--active"
              data-phase="RESOLVED"
              aria-current="step"
            >
              <span className="ooda-phase__bullet" aria-hidden="true">✓</span>
              <span>RESOLVED</span>
            </span>
          </>
        )}
      </nav>
    </>
  );
}
