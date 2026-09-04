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
    } else {
      next = 'pending';
    }
    onStatusChange(action.id, next);
  };

  const doneCount = actions.filter((a) => a.actionStatus === 'done').length;
  const progressPercent = actions.length > 0 ? Math.round((doneCount / actions.length) * 100) : 0;

  return (
    <>
      <style>{`
        .action-tracker {
          grid-area: actions;
          width: 100%;
          height: 100%;
          background: var(--bg-surface);
          border-left: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          padding: 12px 14px;
          overflow-y: auto;
          user-select: none;
          gap: 12px;
        }

        .action-tracker.is-collapsed {
          padding-bottom: 8px;
        }

        /* ─── Header Section ─── */
        .action-tracker__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-subtle);
          gap: 8px;
        }

        .action-tracker__title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-tracker__title {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .action-tracker__controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .action-tracker__count-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          padding: 2px 7px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--color-aura);
          letter-spacing: 0.02em;
        }

        .action-tracker__collapse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .action-tracker__collapse-btn:hover {
          color: var(--text-primary);
          background: var(--bg-surface-hover);
          border-color: var(--border-default);
        }

        /* ─── Slim Precision Progress Bar ─── */
        .action-tracker__progress-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .action-tracker__progress-track {
          height: 2px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 99px;
          overflow: hidden;
        }

        .action-tracker__progress-fill {
          height: 100%;
          background: var(--color-fact);
          border-radius: 99px;
          transition: width 0.35s var(--ease-standard);
        }

        /* ─── Linear-Grade Action Item Checklist Rows ─── */
        .action-tracker__list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .action-tracker.is-collapsed .action-tracker__list,
        .action-tracker.is-collapsed .action-tracker__progress-wrap,
        .action-tracker.is-collapsed .hypothesis-board {
          display: none;
        }

        .action-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 9px 11px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
          position: relative;
        }

        .action-item:hover {
          background: var(--bg-surface-hover);
          border-color: rgba(255, 255, 255, 0.09);
        }

        .action-item--done {
          opacity: 0.65;
          background: rgba(14, 16, 21, 0.5);
          border-color: rgba(59, 212, 162, 0.15);
        }

        .action-item--in_progress {
          border-color: rgba(123, 140, 255, 0.28);
          background: rgba(123, 140, 255, 0.035);
        }

        /* Interactive Status Check Ring */
        .action-item__ring {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1.25px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          flex-shrink: 0;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .action-item:hover .action-item__ring {
          border-color: rgba(212, 168, 83, 0.4);
        }

        .action-item--done .action-item__ring {
          background: var(--color-fact);
          border-color: var(--color-fact);
          color: #08090C;
        }

        .action-item--in_progress .action-item__ring {
          border-color: var(--color-decision);
          border-top-color: transparent;
          border-radius: 50%;
          animation: ring-spin 1s linear infinite;
        }

        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }

        .action-item__body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }

        .action-item__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .action-item__ticket {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1px 5px;
          border-radius: 2px;
          letter-spacing: 0.03em;
        }

        .action-item__title {
          font-family: var(--font-sans);
          font-size: 12px;
          line-height: 1.42;
          letter-spacing: var(--tracking-tight);
          color: var(--text-primary);
          margin: 0;
        }

        .action-item--done .action-item__title {
          text-decoration: line-through;
          color: var(--text-muted);
        }

        .action-item__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-top: 1px;
        }

        .action-item__assignee {
          font-family: var(--font-sans);
          font-size: 10.5px;
          font-weight: 500;
          color: var(--color-action);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .action-item__sla {
          font-family: var(--font-mono);
          font-size: 9.5px;
          color: var(--text-muted);
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }

        /* ─── Hypothesis Board & Context Matrix ─── */
        .hypothesis-board {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 4px;
          padding-top: 10px;
          border-top: 1px solid var(--border-subtle);
        }

        .hypothesis-board__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .hypothesis-board__badge {
          font-family: var(--font-mono);
          font-size: 9px;
          padding: 1px 5px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 2px;
          color: var(--text-muted);
        }

        .hypothesis-board__list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .hypothesis-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-family: var(--font-sans);
          font-size: 11px;
          line-height: 1.38;
          letter-spacing: var(--tracking-tight);
          padding: 6px 9px;
          background: var(--bg-surface-raised);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
          transition: border-color var(--duration-fast) var(--ease-standard);
        }

        .hypothesis-item:hover {
          border-color: rgba(255, 255, 255, 0.08);
        }

        .hypothesis-item--confirmed {
          border-left: 2px solid var(--color-fact);
          color: var(--text-primary);
        }

        .hypothesis-item--disproven {
          border-left: 2px solid rgba(232, 84, 84, 0.6);
          color: var(--text-muted);
          text-decoration: line-through;
        }

        .hypothesis-item--active {
          border-left: 2px solid var(--color-hypothesis);
          color: var(--text-primary);
        }

        .hypothesis-item__icon {
          flex-shrink: 0;
          font-weight: 700;
          font-size: 10px;
          margin-top: 1px;
        }

        .hypothesis-item--confirmed .hypothesis-item__icon {
          color: var(--color-fact);
        }

        .hypothesis-item--disproven .hypothesis-item__icon {
          color: var(--color-conflict);
        }

        .hypothesis-item--active .hypothesis-item__icon {
          color: var(--color-hypothesis);
        }

        /* ─── Empty State (Acoustic Pulse) ─── */
        .action-tracker__empty-state {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px;
          background: rgba(20, 23, 30, 0.4);
          border: 1px dashed rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-sm);
        }

        .action-tracker__empty-icon {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(212, 168, 83, 0.08);
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .action-tracker__empty-pulse {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1px solid rgba(212, 168, 83, 0.25);
          animation: empty-pulse 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes empty-pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 0.15; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }

        .action-tracker__empty-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .action-tracker__empty-headline {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: -0.01em;
        }

        .action-tracker__empty-sub {
          font-size: 10px;
          line-height: 1.35;
          color: var(--text-muted);
        }
      `}</style>

      <section
        className={`action-tracker ${isCollapsed ? 'is-collapsed' : ''}`}
        aria-label="Incident action items and investigation matrix"
      >
        <div className="action-tracker__header">
          <div className="action-tracker__title-group">
            <span className="action-tracker__title">Mitigation Actions</span>
          </div>
          <div className="action-tracker__controls">
            <span className="action-tracker__count-badge">
              {doneCount} of {actions.length} Done
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
                width="10"
                height="10"
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

        {!isCollapsed && (
          <div className="action-tracker__progress-wrap">
            <div className="action-tracker__progress-track">
              <div
                className="action-tracker__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="action-tracker__list">
          {actions.length === 0 ? (
            <div className="action-tracker__empty-state">
              <div className="action-tracker__empty-icon">
                <span className="action-tracker__empty-pulse" />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <div className="action-tracker__empty-text">
                <span className="action-tracker__empty-headline">Listening for Directives</span>
                <span className="action-tracker__empty-sub">
                  AURA AI synthesizes verbal tasks into Jira &amp; Slack action items in real time.
                </span>
              </div>
            </div>
          ) : (
            actions.map((act) => {
              const status = act.actionStatus ?? 'pending';
              const ticketNumber = (act.id.replace(/[^0-9]/g, '') || '492').slice(-3);

              return (
                <div
                  key={act.id}
                  className={`action-item action-item--${status}`}
                  onClick={() => handleCycleStatus(act)}
                  title="Click to advance status (Pending → Active → Done)"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCycleStatus(act);
                    }
                  }}
                >
                  <div className="action-item__ring" aria-hidden="true">
                    {status === 'done' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  <div className="action-item__body">
                    <div className="action-item__top">
                      <span className="action-item__ticket">ACT-{ticketNumber}</span>
                      <span className="action-item__sla">
                        {act.eta
                          ? `${Math.max(1, Math.round((act.eta - act.timestamp) / 60000))}m SLA`
                          : '15m SLA'}
                      </span>
                    </div>

                    <p className="action-item__title">{act.content}</p>

                    <div className="action-item__footer">
                      <span className="action-item__assignee" title={`Assigned to ${act.assignedTo || 'Unassigned'}`}>
                        {act.assignedTo ? `@${act.assignedTo}` : '@unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Incident Hypotheses & Findings Board */}
        {!isCollapsed && (
          <div className="hypothesis-board">
            <div className="hypothesis-board__header">
              <span>Active Hypotheses &amp; Findings</span>
              <span className="hypothesis-board__badge">3 tracked</span>
            </div>
            <div className="hypothesis-board__list">
              <div className="hypothesis-item hypothesis-item--confirmed">
                <span className="hypothesis-item__icon">✓</span>
                <span>Redis connection pool starvation at 99.8% capacity</span>
              </div>
              <div className="hypothesis-item hypothesis-item--disproven">
                <span className="hypothesis-item__icon">✕</span>
                <span>Stripe webhook signature mismatch (Refuted by 200 OKs)</span>
              </div>
              <div className="hypothesis-item hypothesis-item--active">
                <span className="hypothesis-item__icon">●</span>
                <span>Checkout queue worker thread exhaustion</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

