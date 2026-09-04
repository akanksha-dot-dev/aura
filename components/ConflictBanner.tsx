'use client';

import React from 'react';

export interface ConflictBannerProps {
  isActive: boolean;
  hypothesisA: string;
  speakerAName: string;
  hypothesisB: string;
  speakerBName: string;
  decidingMetric: string;
}

export function ConflictBanner({
  isActive,
  hypothesisA,
  speakerAName,
  hypothesisB,
  speakerBName,
  decidingMetric,
}: ConflictBannerProps) {
  return (
    <>
      <style>{`
        .conflict-banner {
          grid-area: conflict;
          display: flex;
          flex-direction: column;
          padding: var(--space-3) var(--space-4);
          background: var(--bg-surface-raised);
          border: 1px solid rgba(232, 84, 84, 0.25);
          border-left: 3px solid var(--color-conflict);
          border-radius: var(--radius-md);
          margin: 6px var(--space-4) 4px var(--space-4);
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(232, 84, 84, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          overflow: hidden;
          transition: all var(--duration-normal) var(--ease-standard);
        }

        .conflict-banner--active {
          opacity: 1;
        }

        .conflict-banner--inactive {
          display: none;
        }

        .conflict-banner__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .conflict-banner__title-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .conflict-banner__badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 700;
          color: var(--color-conflict);
          background: var(--color-conflict-dim);
          border: 1px solid var(--color-conflict-border);
          border-radius: var(--radius-sm);
          padding: 2px 7px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .conflict-banner__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-conflict);
          box-shadow: 0 0 6px var(--color-conflict);
          animation: pulse-conflict-dot 1.6s ease-in-out infinite;
        }

        @keyframes pulse-conflict-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .conflict-banner__subtitle {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: var(--tracking-tight);
        }

        /* ─── Side-by-Side Comparison Grid ─── */
        .conflict-banner__comparison {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: var(--space-3);
          padding: 8px 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          margin-bottom: 6px;
        }

        .conflict-banner__claim-card {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .conflict-banner__speaker-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .conflict-banner__quote {
          font-family: var(--font-sans);
          font-size: 12px;
          color: var(--text-primary);
          line-height: 1.35;
          letter-spacing: var(--tracking-tight);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conflict-banner__vs-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--color-conflict);
          background: rgba(232, 84, 84, 0.12);
          border: 1px solid rgba(232, 84, 84, 0.25);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          user-select: none;
          flex-shrink: 0;
        }

        /* ─── Deciding Telemetry Footer ─── */
        .conflict-banner__footer {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--color-hypothesis);
          padding-top: 4px;
        }

        .conflict-banner__metric-tag {
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .conflict-banner__metric-val {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-hypothesis);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div
        className={`conflict-banner ${
          isActive ? 'conflict-banner--active' : 'conflict-banner--inactive'
        }`}
        role="alert"
        aria-live="assertive"
        aria-hidden={!isActive}
      >
        {isActive && (
          <>
            <div className="conflict-banner__header">
              <div className="conflict-banner__title-cluster">
                <span className="conflict-banner__badge">
                  <span className="conflict-banner__dot" aria-hidden="true" />
                  ACTIVE CONFLICT
                </span>
                <span className="conflict-banner__subtitle">
                  Contradictory Hypothesis Detected in Bridge Audio
                </span>
              </div>
            </div>

            <div className="conflict-banner__comparison">
              <div className="conflict-banner__claim-card">
                <div className="conflict-banner__speaker-row">
                  <span>{speakerAName}</span>
                </div>
                <div className="conflict-banner__quote" title={hypothesisA}>
                  &ldquo;{hypothesisA}&rdquo;
                </div>
              </div>

              <div className="conflict-banner__vs-divider" aria-label="versus">
                VS
              </div>

              <div className="conflict-banner__claim-card">
                <div className="conflict-banner__speaker-row">
                  <span>{speakerBName}</span>
                </div>
                <div className="conflict-banner__quote" title={hypothesisB}>
                  &ldquo;{hypothesisB}&rdquo;
                </div>
              </div>
            </div>

            {decidingMetric && (
              <div className="conflict-banner__footer">
                <span className="conflict-banner__metric-tag">Deciding Telemetry:</span>
                <span className="conflict-banner__metric-val">{decidingMetric}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
