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
  const currentIndex = isResolved ? 4 : PHASES.indexOf(currentPhase as 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT');

  return (
    <>
      <style>{`
        .ooda-indicator {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: var(--bg-glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 3px;
          border-radius: 99px;
          border: 1px solid var(--border-glass);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        }

        .ooda-phase {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 99px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
          transition: all var(--duration-normal) var(--ease-standard);
          color: var(--text-muted);
          background: transparent;
          white-space: nowrap;
          user-select: none;
        }

        .ooda-phase--completed {
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
        }

        .ooda-phase--active {
          font-weight: 600;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
        }

        .ooda-phase--active[data-phase="OBSERVE"] {
          background: var(--color-fact-dim);
          border-color: var(--color-fact-border);
          color: var(--color-observe);
        }
        .ooda-phase--active[data-phase="ORIENT"] {
          background: var(--color-hypothesis-dim);
          border-color: var(--color-hypothesis-border);
          color: var(--color-orient);
        }
        .ooda-phase--active[data-phase="DECIDE"] {
          background: var(--color-decision-dim);
          border-color: var(--color-decision-border);
          color: var(--color-decide);
        }
        .ooda-phase--active[data-phase="ACT"] {
          background: var(--color-action-dim);
          border-color: var(--color-action-border);
          color: var(--color-act);
        }
        .ooda-phase--active[data-phase="RESOLVED"] {
          background: var(--color-fact-dim);
          border-color: var(--color-fact-border);
          color: var(--color-resolved);
        }

        .ooda-phase__bullet {
          font-size: 10px;
          line-height: 1;
        }
      `}</style>
      <nav className="ooda-indicator" aria-label="Incident OODA Phase Progression">
        {PHASES.map((phase, index) => {
          const isActive = !isResolved && currentPhase === phase;
          const isCompleted = isResolved || index < currentIndex;
          const bullet = isCompleted && !isActive ? '✓' : isActive ? '●' : '○';

          return (
            <span
              key={phase}
              className={`ooda-phase ${
                isActive
                  ? 'ooda-phase--active'
                  : isCompleted
                  ? 'ooda-phase--completed'
                  : ''
              }`}
              data-phase={phase}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="ooda-phase__bullet" aria-hidden="true">{bullet}</span>
              <span>{phase}</span>
            </span>
          );
        })}

        {isResolved && (
          <span
            className="ooda-phase ooda-phase--active"
            data-phase="RESOLVED"
            aria-current="step"
          >
            <span className="ooda-phase__bullet" aria-hidden="true">✓</span>
            <span>RESOLVED</span>
          </span>
        )}
      </nav>
    </>
  );
}
