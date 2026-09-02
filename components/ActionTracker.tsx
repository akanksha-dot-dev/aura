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

  return (
    <>
      <style>{`
        .action-tracker {
          grid-area: actions;
          width: 240px;
          height: 100%;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
          padding: var(--space-3);
          overflow-y: auto;
          user-select: none;
        }

        .action-tracker__title {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: var(--space-3);
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
          padding: var(--space-2) 0;
        }

        .action-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-2);
          background: var(--bg-surface-raised);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: background var(--duration-fast) var(--ease-standard),
                      border-color var(--duration-fast) var(--ease-standard);
        }

        .action-card:hover {
          background: var(--bg-surface-hover);
          border-color: var(--border-emphasis);
        }

        .action-card__top {
          display: flex;
          align-items: flex-start;
          gap: var(--space-1h);
        }

        .action-card__icon {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          line-height: 1.3;
          flex-shrink: 0;
        }

        .action-card__icon--done {
          color: var(--color-fact);
          font-weight: var(--weight-bold);
        }

        .action-card__icon--in_progress {
          color: var(--color-hypothesis);
          animation: action-pulse 1.5s ease-in-out infinite;
        }

        .action-card__icon--pending {
          color: var(--text-muted);
        }

        .action-card__icon--blocked {
          color: var(--color-conflict);
          font-weight: var(--weight-bold);
        }

        @keyframes action-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .action-card__content {
          font-size: var(--text-sm);
          line-height: var(--leading-tight);
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .action-card__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-top: 2px;
        }

        .action-card__assignee {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-secondary);
        }

        .action-card__chip {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          font-weight: var(--weight-medium);
        }

        .action-card__chip--done {
          background: var(--color-fact-dim);
          color: var(--color-fact);
        }

        .action-card__chip--in_progress {
          background: var(--color-hypothesis-dim);
          color: var(--color-hypothesis);
        }

        .action-card__chip--pending {
          background: var(--bg-surface-hover);
          color: var(--text-muted);
        }

        .action-card__chip--blocked {
          background: var(--color-conflict-dim);
          color: var(--color-conflict);
        }
      `}</style>
      <section className="action-tracker" aria-label="Incident action items">
        <div className="action-tracker__title">Actions</div>

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
                in_progress: 'In Progress',
                pending: 'Pending',
                blocked: 'Blocked',
              }[status];

              return (
                <div
                  key={act.id}
                  className="action-card"
                  onClick={() => handleCycleStatus(act)}
                  title="Click to advance status"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCycleStatus(act);
                    }
                  }}
                >
                  <div className="action-card__top">
                    <span
                      className={`action-card__icon action-card__icon--${status}`}
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    <span className="action-card__content">{act.content}</span>
                  </div>

                  <div className="action-card__meta">
                    <span className="action-card__assignee">
                      {act.assignedTo ? `@${act.assignedTo}` : 'Unassigned'}
                    </span>
                    <span
                      className={`action-card__chip action-card__chip--${status}`}
                    >
                      {label}
                    </span>
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
