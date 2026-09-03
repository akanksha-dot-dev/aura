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
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 var(--space-2);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-secondary);
          user-select: none;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .incident-stats__item {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .incident-stats__num {
          font-family: var(--font-mono);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          font-size: 11px;
        }

        .incident-stats__label {
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--text-secondary);
        }

        .incident-stats__dot {
          color: var(--text-muted);
          font-size: 10px;
          opacity: 0.6;
        }

        .incident-stats__item--conflict-active {
          color: var(--color-conflict);
        }

        .incident-stats__item--conflict-active .incident-stats__num,
        .incident-stats__item--conflict-active .incident-stats__label {
          color: var(--color-conflict);
          font-weight: var(--weight-semibold);
        }
      `}</style>
      <div className="incident-stats" role="status" aria-label="Incident summary counts">
        <span className="incident-stats__item" title={`${factCount} confirmed facts`}>
          <span className="incident-stats__num">{factCount}</span>
          <span className="incident-stats__label">facts</span>
        </span>

        <span className="incident-stats__dot" aria-hidden="true">&middot;</span>

        <span className="incident-stats__item" title={`${hypothesisCount} active hypotheses`}>
          <span className="incident-stats__num">{hypothesisCount}</span>
          <span className="incident-stats__label">hypo</span>
        </span>

        <span className="incident-stats__dot" aria-hidden="true">&middot;</span>

        <span className="incident-stats__item" title={`${decisionCount} directives issued`}>
          <span className="incident-stats__num">{decisionCount}</span>
          <span className="incident-stats__label">dec</span>
        </span>

        <span className="incident-stats__dot" aria-hidden="true">&middot;</span>

        <span className="incident-stats__item" title={`${actionCompletedCount} of ${actionTotalCount} actions complete`}>
          <span className="incident-stats__num">{actionCompletedCount}/{actionTotalCount}</span>
          <span className="incident-stats__label">act</span>
        </span>

        <span className="incident-stats__dot" aria-hidden="true">&middot;</span>

        <span
          className={`incident-stats__item ${conflictCount > 0 ? 'incident-stats__item--conflict-active' : ''}`}
          title={`${conflictCount} active contradictions`}
        >
          <span className="incident-stats__num">{conflictCount}</span>
          <span className="incident-stats__label">conf</span>
        </span>
      </div>
    </>
  );
}
