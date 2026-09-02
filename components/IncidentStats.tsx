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
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          user-select: none;
        }

        .incident-stats__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          line-height: var(--leading-tight);
        }

        .incident-stats__left {
          display: flex;
          align-items: center;
          gap: var(--space-1h);
        }

        .incident-stats__icon {
          font-size: var(--text-xs);
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
          50% { opacity: 0.4; }
        }

        .incident-stats__label {
          color: var(--text-secondary);
        }

        .incident-stats__val {
          color: var(--text-primary);
          font-weight: var(--weight-semibold);
          font-variant-numeric: tabular-nums;
        }
      `}</style>
      <div className="incident-stats" aria-label="Incident summary counts">
        <div className="incident-stats__row">
          <div className="incident-stats__left">
            <span className="incident-stats__icon incident-stats__icon--fact" aria-hidden="true">
              ●
            </span>
            <span className="incident-stats__label">Facts</span>
          </div>
          <span className="incident-stats__val">{factCount}</span>
        </div>

        <div className="incident-stats__row">
          <div className="incident-stats__left">
            <span
              className="incident-stats__icon incident-stats__icon--hypothesis"
              aria-hidden="true"
            >
              ◆
            </span>
            <span className="incident-stats__label">Hypotheses</span>
          </div>
          <span className="incident-stats__val">{hypothesisCount}</span>
        </div>

        <div className="incident-stats__row">
          <div className="incident-stats__left">
            <span
              className="incident-stats__icon incident-stats__icon--decision"
              aria-hidden="true"
            >
              ▲
            </span>
            <span className="incident-stats__label">Decisions</span>
          </div>
          <span className="incident-stats__val">{decisionCount}</span>
        </div>

        <div className="incident-stats__row">
          <div className="incident-stats__left">
            <span
              className="incident-stats__icon incident-stats__icon--action"
              aria-hidden="true"
            >
              ■
            </span>
            <span className="incident-stats__label">Actions</span>
          </div>
          <span className="incident-stats__val">
            {actionCompletedCount}/{actionTotalCount}
          </span>
        </div>

        <div className="incident-stats__row">
          <div className="incident-stats__left">
            <span
              className={`incident-stats__icon incident-stats__icon--conflict ${
                conflictCount > 0 ? 'incident-stats__icon--conflict-pulse' : ''
              }`}
              aria-hidden="true"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <span className="incident-stats__label">Conflicts</span>
          </div>
          <span
            className="incident-stats__val"
            style={{ color: conflictCount > 0 ? 'var(--color-conflict)' : undefined }}
          >
            {conflictCount}
          </span>
        </div>
      </div>
    </>
  );
}
