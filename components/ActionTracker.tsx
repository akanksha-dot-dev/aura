'use client';

import React, { useState } from 'react';
import { EvidenceItem, ActionStatus } from '@/lib/types';

export interface ActionTrackerProps {
  actions: EvidenceItem[];
  onStatusChange: (actionId: string, newStatus: ActionStatus) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ActionTracker({
  actions,
  onStatusChange,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalOnToggleCollapse,
}: ActionTrackerProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (externalOnToggleCollapse) {
      externalOnToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

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
          width: 100%;
          height: 100%;
          background: var(--bg-glass-panel);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid var(--border-glass);
          display: flex;
          flex-direction: column;
          padding: var(--space-3);
          overflow-y: auto;
          user-select: none;
          box-shadow: var(--shadow-glass);
          transition: background-color var(--duration-fast) var(--ease-standard);
        }

        .action-tracker.is-collapsed {
          padding-bottom: var(--space-2);
        }

        .action-tracker__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-3);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border-glass);
          gap: var(--space-2);
        }

        .action-tracker.is-collapsed .action-tracker__header {
          margin-bottom: 0;
          border-bottom: none;
          padding-bottom: 0;
        }

        .action-tracker__title-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .action-tracker__title {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .action-tracker__controls {
          display: flex;
          align-items: center;
          gap: var(--space-1h);
        }

        .action-tracker__count-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--weight-semibold);
          padding: 1px 7px;
          background: var(--bg-glass-raised);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-full);
          color: var(--color-aura);
        }

        .action-tracker__collapse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: var(--radius-sm);
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .action-tracker__collapse-btn:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
          border-color: var(--border-glass-emphasis);
        }

        .action-tracker__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .action-tracker.is-collapsed .action-tracker__list {
          display: none;
        }

        .action-tracker__empty {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
          padding: var(--space-5) var(--space-3);
          text-align: center;
          background: var(--bg-glass);
          border: 1px dashed var(--border-glass);
          border-radius: var(--radius-md);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .action-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-2h) var(--space-3);
          background: var(--bg-glass-raised);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-glass);
          cursor: pointer;
          position: relative;
          box-shadow: var(--shadow-card);
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
          opacity: 0.82;
        }

        .action-card--blocked {
          border-left: 3px solid var(--color-conflict);
        }

        .action-card:hover {
          background: var(--bg-glass-hover);
          border-color: var(--border-glass-emphasis);
          box-shadow: var(--shadow-glass), 0 4px 14px rgba(0, 0, 0, 0.25);
          transform: translateY(-1px) scale(1.01);
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
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-sm);
          padding: 1px 5px;
          letter-spacing: 0.04em;
        }

        .action-card__status-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: var(--weight-medium);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          text-transform: capitalize;
          letter-spacing: 0.02em;
        }

        .action-card__status-pill--pending {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .action-card__status-pill--in_progress {
          background: var(--color-hypothesis-dim);
          color: var(--color-hypothesis);
          border: 1px solid var(--color-hypothesis-border);
          animation: action-pulse 2s ease-in-out infinite;
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
          50% { opacity: 0.55; }
        }

        .action-card__content {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          line-height: var(--leading-normal);
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .action-card--done .action-card__content {
          color: var(--text-secondary);
          opacity: 0.82;
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
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-full);
          padding: 1px 7px 1px 3px;
          font-family: var(--font-sans);
          font-size: 10px;
          color: var(--text-secondary);
          max-width: 155px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .action-card__assignee-avatar {
          width: 14px;
          height: 14px;
          border-radius: var(--radius-full);
          background: var(--bg-glass-hover);
          color: var(--color-aura);
          font-family: var(--font-sans);
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

      <section
        className={`action-tracker ${isCollapsed ? 'is-collapsed' : ''}`}
        aria-label="Incident action items"
      >
        <div className="action-tracker__header">
          <div className="action-tracker__title-group">
            <span className="action-tracker__title">Action Items</span>
          </div>
          <div className="action-tracker__controls">
            <span className="action-tracker__count-badge">
              {doneCount}/{actions.length}
            </span>
            <button
              type="button"
              className="action-tracker__collapse-btn"
              onClick={toggleCollapse}
              title={isCollapsed ? 'Expand Action Items' : 'Collapse Action Items'}
              aria-label={isCollapsed ? 'Expand Action Items' : 'Collapse Action Items'}
              aria-expanded={!isCollapsed}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform var(--duration-fast) var(--ease-standard)',
                }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
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
                    <div
                      className="action-card__assignee-chip"
                      title={`Assignee: ${act.assignedTo || 'Unassigned'}`}
                    >
                      <span className="action-card__assignee-avatar" aria-hidden="true">
                        {(act.assignedTo || 'U')[0].toUpperCase()}
                      </span>
                      <span>
                        {act.assignedTo ? `@${act.assignedTo}` : 'Unassigned'}
                      </span>
                    </div>

                    <div className="action-card__sla" title="Incident Action SLA Target">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>
                        {act.eta
                          ? `${Math.max(1, Math.round((act.eta - act.timestamp) / 60000))}m SLA`
                          : '15m SLA'}
                      </span>
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
