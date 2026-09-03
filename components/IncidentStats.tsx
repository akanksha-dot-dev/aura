'use client';

import React from 'react';

export interface IncidentStatsProps {
  factCount: number;
  hypothesisCount: number; // Active only
  decisionCount: number;
  actionCompletedCount: number;
  actionTotalCount: number;
  conflictCount: number; // Active only
}

export function IncidentStats({
  factCount,
  hypothesisCount,
  decisionCount,
  actionCompletedCount,
  actionTotalCount,
  conflictCount,
}: IncidentStatsProps) {
  return (
    <>
      <style>{`
        .incident-stats {
          grid-area: stats;
          width: 240px;
          height: 100%;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-default);
          border-top: 1px solid var(--border-subtle);
          display: grid;
          grid-template-columns: 14px 1fr auto;
          align-content: center;
          align-items: center;
          row-gap: var(--space-1);
          column-gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          user-select: none;
        }

        .incident-stats__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .incident-stats__icon--fact { color: var(--color-fact); }
        .incident-stats__icon--hypothesis { color: var(--color-hypothesis); }
        .incident-stats__icon--decision { color: var(--color-decision); }
        .incident-stats__icon--action { color: var(--color-action); }
        .incident-stats__icon--conflict {
          color: var(--color-conflict);
        }

        .incident-stats__icon--conflict-pulse {
          animation: stats-conflict-pulse 1s ease-in-out infinite;
        }

        @keyframes stats-conflict-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .incident-stats__label {
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .incident-stats__val {
          color: var(--text-primary);
          font-weight: var(--weight-semibold);
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
      `}</style>
      <div className="incident-stats" aria-label="Incident summary telemetry counts">
        {/* Row 1: Facts */}
        <span className="incident-stats__icon incident-stats__icon--fact" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <span className="incident-stats__label">Facts</span>
        <span className="incident-stats__val">{factCount}</span>

        {/* Row 2: Hypotheses */}
        <span className="incident-stats__icon incident-stats__icon--hypothesis" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 22 12 12 22 2 12" />
          </svg>
        </span>
        <span className="incident-stats__label">Hypotheses</span>
        <span className="incident-stats__val">{hypothesisCount}</span>

        {/* Row 3: Decisions */}
        <span className="incident-stats__icon incident-stats__icon--decision" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 3 22 21 2 21" />
          </svg>
        </span>
        <span className="incident-stats__label">Decisions</span>
        <span className="incident-stats__val">{decisionCount}</span>

        {/* Row 4: Actions */}
        <span className="incident-stats__icon incident-stats__icon--action" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            {actionCompletedCount > 0 && <polyline points="9 11 12 14 20 6" />}
          </svg>
        </span>
        <span className="incident-stats__label">Actions</span>
        <span className="incident-stats__val">
          {actionCompletedCount}/{actionTotalCount}
        </span>

        {/* Row 5: Conflicts */}
        <span
          className={`incident-stats__icon incident-stats__icon--conflict ${
            conflictCount > 0 ? 'incident-stats__icon--conflict-pulse' : ''
          }`}
          aria-hidden="true"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span className="incident-stats__label">Conflicts</span>
        <span
          className="incident-stats__val"
          style={{ color: conflictCount > 0 ? 'var(--color-conflict)' : undefined }}
        >
          {conflictCount}
        </span>
      </div>
    </>
  );
}
