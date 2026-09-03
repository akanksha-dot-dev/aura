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
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          padding: 0 var(--space-2);
          font-family: var(--font-mono);
          user-select: none;
          flex-wrap: nowrap;
        }

        .stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 6px;
          border-radius: var(--radius-sm);
          font-size: 0.6875rem;
          font-weight: var(--weight-medium);
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          white-space: nowrap;
          line-height: 1.2;
          flex-shrink: 0;
        }

        .stat-chip__bullet {
          font-size: 0.625rem;
          line-height: 1;
        }

        .stat-chip--fact {
          color: var(--color-fact);
          border-color: rgba(59, 212, 162, 0.2);
        }
        .stat-chip--hypothesis {
          color: var(--color-hypothesis);
          border-color: rgba(232, 168, 56, 0.2);
        }
        .stat-chip--decision {
          color: var(--color-decision);
          border-color: rgba(123, 140, 255, 0.2);
        }
        .stat-chip--action {
          color: var(--color-action);
          border-color: rgba(232, 125, 62, 0.2);
        }
        .stat-chip--conflict {
          color: var(--color-conflict);
          border-color: rgba(232, 84, 84, 0.3);
          background: rgba(232, 84, 84, 0.08);
        }
        .stat-chip--conflict-pulse {
          animation: conflict-chip-pulse 1.5s ease-in-out infinite;
        }

        @keyframes conflict-chip-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232, 84, 84, 0.4); }
          50% { box-shadow: 0 0 0 3px rgba(232, 84, 84, 0.2); }
        }

        .stat-chip__label {
          color: var(--text-secondary);
          font-size: 0.625rem;
        }

        .stat-chip__val {
          font-weight: var(--weight-bold);
          color: var(--text-primary);
        }
      `}</style>
      <div className="incident-stats" aria-label="Incident summary telemetry counts">
        {/* Facts */}
        <span className="stat-chip stat-chip--fact" title={`${factCount} confirmed facts`}>
          <span className="stat-chip__bullet" aria-hidden="true">●</span>
          <span className="stat-chip__val">{factCount}</span>
          <span className="stat-chip__label">Facts</span>
        </span>

        {/* Hypotheses */}
        <span className="stat-chip stat-chip--hypothesis" title={`${hypothesisCount} active hypotheses`}>
          <span className="stat-chip__bullet" aria-hidden="true">?</span>
          <span className="stat-chip__val">{hypothesisCount}</span>
          <span className="stat-chip__label">Hypo</span>
        </span>

        {/* Decisions */}
        <span className="stat-chip stat-chip--decision" title={`${decisionCount} directives issued`}>
          <span className="stat-chip__bullet" aria-hidden="true">◆</span>
          <span className="stat-chip__val">{decisionCount}</span>
          <span className="stat-chip__label">Dec</span>
        </span>

        {/* Actions */}
        <span className="stat-chip stat-chip--action" title={`${actionCompletedCount} of ${actionTotalCount} actions complete`}>
          <span className="stat-chip__bullet" aria-hidden="true">■</span>
          <span className="stat-chip__val">{actionCompletedCount}/{actionTotalCount}</span>
          <span className="stat-chip__label">Act</span>
        </span>

        {/* Conflicts */}
        <span
          className={`stat-chip stat-chip--conflict ${conflictCount > 0 ? 'stat-chip--conflict-pulse' : ''}`}
          title={`${conflictCount} active contradictions`}
        >
          <span className="stat-chip__bullet" aria-hidden="true">⚠</span>
          <span className="stat-chip__val">{conflictCount}</span>
          <span className="stat-chip__label">Conf</span>
        </span>
      </div>
    </>
  );
}
