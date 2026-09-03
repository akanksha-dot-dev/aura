'use client';

import React from 'react';
import { EvidenceItem, ActionStatus } from '@/lib/types';

export interface ActionTrackerProps {
  actions: EvidenceItem[];
  onStatusChange: (actionId: string, newStatus: ActionStatus) => void;
}

export function ActionTracker({ actions, onStatusChange }: ActionTrackerProps) {
  const handleCycleStatus = (action: EvidenceItem) => {
    const current = action.actionStatus ?? 'pending';
    let next: ActionStatus;
    if (current === 'pending') {
      next = 'in_progress';
    } else if (current === 'in_progress') {
      next = 'done';
    } else if (current === 'done') {
      next = 'pending';
    } else {
      next = 'pending';
    }
    onStatusChange(action.id, next);
  };

  const doneCount = actions.filter((a) => a.actionStatus === 'done').length;

  return (
    <>
      <style>{`
        .action-tracker {
          grid-area: actions;
          width: 250px;
          height: 100%;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
          padding: var(--space-3);
          overflow-y: auto;
          user-select: none;
        }

        .action-tracker__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-3);
          padding-bottom: var(--space-1);
          border-bottom: 1px solid var(--border-subtle);
        }

        .action-tracker__title {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-bold);
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .action-tracker__count-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--weight-semibold);
          padding: 1px 6px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--color-aura);
        }

        .action-tracker__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .action-tracker__empty {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-style: normal;
          padding: var(--space-3) 0;
          text-align: center;
          background: var(--bg-surface-raised);
          border: 1px dashed var(--border-subtle);
          border-radius: var(--radius-md);
        }

        .action-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-2h);
          background: var(--bg-surface-raised);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          cursor: pointer;
          position: relative;
          transition: background-color var(--duration-fast) var(--ease-standard),
                      border-color var(--duration-fast) var(--ease-standard),
                      box-shadow var(--duration-fast) var(--ease-standard),
                      transform var(--duration-fast) var(--ease-standard);
        }

        .action-card--pending {
          border-left: 3px solid var(--color-hypothesis);
        }

        .action-card--in_progress {
          border-left: 3px solid var(--color-decision);
        }

        .action-card--done {
          border-left: 3px solid var(--color-fact);
          opacity: 0.85;
        }

        .action-card--blocked {
          border-left: 3px solid var(--color-conflict);
        }

        .action-card:hover {
          background: var(--bg-surface-hover);
          border-color: var(--border-emphasis);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          transform: translateY(-1px);
        }

        .action-card:focus-visible {
          outline: 2px solid var(--color-aura);
          outline-offset: 2px;
        }

        .action-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-1);
        }

        .action-card__ticket {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--weight-bold);
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 1px 5px;
          letter-spacing: 0.04em;
        }

        .action-card__status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: var(--weight-bold);
          padding: 1px 6px;
          border-radius: var(--radius-full);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .action-card__status-pill--pending {
          background: var(--color-hypothesis-dim);
          color: var(--color-hypothesis);
          border: 1px solid var(--color-hypothesis-border);
        }

        .action-card__status-pill--in_progress {
          background: var(--color-decision-dim);
          color: var(--color-decision);
          border: 1px solid var(--color-decision-border);
          animation: action-pulse 1.8s ease-in-out infinite;
        }

        .action-card__status-pill--done {
          background: var(--color-fact-dim);
          color: var(--color-fact);
          border: 1px solid var(--color-fact-border);
        }

        .action-card__status-pill--blocked {
          background: var(--color-conflict-dim);
          color: var(--color-conflict);
          border: 1px solid var(--color-conflict-border);
        }

        @keyframes action-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        .action-card__content {
          font-size: var(--text-xs);
          line-height: var(--leading-normal);
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .action-card--done .action-card__content {
          text-decoration: line-through;
          color: var(--text-secondary);
        }

        .action-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-top: 2px;
          padding-top: 2px;
        }

        .action-card__assignee-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-base);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
          padding: 1px 6px 1px 3px;
          font-size: 10px;
          color: var(--text-secondary);
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .action-card__assignee-avatar {
          width: 13px;
          height: 13px;
          border-radius: var(--radius-full);
          background: var(--bg-surface-hover);
          color: var(--color-aura);
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: var(--weight-bold);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .action-card__sla {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
          white-space: nowrap;
        }
      `}</style>

      <section className="action-tracker" aria-label="Incident action items">
        <div className="action-tracker__header">
          <span className="action-tracker__title">Action Items</span>
          <span className="action-tracker__count-badge">
            {doneCount}/{actions.length}
          </span>
        </div>

        <div className="action-tracker__list">
          {actions.length === 0 ? (
            <div className="action-tracker__empty">No actions assigned</div>
          ) : (
            actions.map((act) => {
              const status = act.actionStatus ?? 'pending';

              const icon = {
                done: '✓',
                in_progress: '◉',
                pending: '○',
                blocked: '✕',
              }[status];

              const label = {
                done: 'Done',
                in_progress: 'Active',
                pending: 'Pending',
                blocked: 'Blocked',
              }[status];

              const ticketNumber = (act.id.replace(/[^0-9]/g, '') || '492').slice(-3);

              return (
                <div
                  key={act.id}
                  className={`action-card action-card--${status}`}
                  onClick={() => handleCycleStatus(act)}
                  title="Click to cycle status (Pending → Active → Done)"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCycleStatus(act);
                    }
                  }}
                >
                  <div className="action-card__header">
                    <span className="action-card__ticket">
                      ACT-{ticketNumber}
                    </span>
                    <span
                      className={`action-card__status-pill action-card__status-pill--${status}`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </span>
                  </div>

                  <div className="action-card__content">{act.content}</div>

                  <div className="action-card__footer">
                    <div className="action-card__assignee-chip" title={`Assignee: ${act.assignedTo || 'Unassigned'}`}>
                      <span className="action-card__assignee-avatar" aria-hidden="true">
                        {(act.assignedTo || 'U')[0].toUpperCase()}
                      </span>
                      <span>
                        {act.assignedTo ? `@${act.assignedTo}` : 'Unassigned'}
                      </span>
                    </div>

                    <div className="action-card__sla" title="Incident Action SLA Target">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{act.eta ? `${Math.max(1, Math.round((act.eta - act.timestamp) / 60000))}m SLA` : '15m SLA'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
