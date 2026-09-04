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
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: rgba(15, 14, 18, 0.95);
          border-bottom: 1px solid var(--border-subtle);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          gap: 12px;
          overflow: hidden;
          z-index: 9;
          transition: all var(--duration-normal) var(--ease-standard);
        }

        .conflict-banner--active {
          opacity: 1;
        }

        .conflict-banner--inactive {
          display: none;
        }

        /* ─── Left Identity Cluster ─── */
        .conflict-banner__lead {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .conflict-banner__badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--color-conflict);
          background: rgba(232, 84, 84, 0.08);
          border: 1px solid rgba(232, 84, 84, 0.25);
          border-radius: var(--radius-xs);
          padding: 3px 7px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .conflict-banner__dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-conflict);
          animation: pulse-conflict-dot 1.8s ease-in-out infinite;
        }

        @keyframes pulse-conflict-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }

        .conflict-banner__subtitle {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: -0.01em;
          white-space: nowrap;
        }

        /* ─── Center Duel Comparison ─── */
        .conflict-banner__comparison {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
          justify-content: center;
        }

        .conflict-banner__claim-card {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          max-width: 320px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xs);
          padding: 4px 8px;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.02);
        }

        .conflict-banner__speaker-row {
          font-family: var(--font-sans);
          font-size: 10.5px;
          font-weight: 600;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .conflict-banner__quote {
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.35;
          letter-spacing: -0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conflict-banner__vs-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          user-select: none;
          flex-shrink: 0;
        }

        /* ─── Right Deciding Telemetry ─── */
        .conflict-banner__footer {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(212, 168, 83, 0.05);
          border: 1px solid rgba(212, 168, 83, 0.18);
          border-radius: var(--radius-xs);
          padding: 4px 8px;
          flex-shrink: 0;
        }

        .conflict-banner__metric-tag {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-aura);
          white-space: nowrap;
        }

        .conflict-banner__metric-val {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-hypothesis);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 260px;
        }

        @media (max-width: 1200px) {
          .conflict-banner {
            flex-wrap: wrap;
            padding: 8px 12px;
          }
          .conflict-banner__subtitle {
            display: none;
          }
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
            <div className="conflict-banner__lead">
              <span className="conflict-banner__badge">
                <span className="conflict-banner__dot" aria-hidden="true" />
                ACTIVE CONFLICT
              </span>
              <span className="conflict-banner__subtitle">
                Contradictory Hypothesis Detected in Bridge Audio
              </span>
            </div>

            <div className="conflict-banner__comparison">
              <div className="conflict-banner__claim-card">
                <span className="conflict-banner__speaker-row">{speakerAName}</span>
                <span className="conflict-banner__quote" title={hypothesisA}>
                  &ldquo;{hypothesisA}&rdquo;
                </span>
              </div>

              <div className="conflict-banner__vs-divider" aria-label="versus">
                VS
              </div>

              <div className="conflict-banner__claim-card">
                <span className="conflict-banner__speaker-row">{speakerBName}</span>
                <span className="conflict-banner__quote" title={hypothesisB}>
                  &ldquo;{hypothesisB}&rdquo;
                </span>
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

