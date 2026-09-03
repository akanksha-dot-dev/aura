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
          justify-content: center;
          padding: 0 var(--space-4);
          background: linear-gradient(90deg, rgba(232, 84, 84, 0.15) 0%, rgba(232, 84, 84, 0.06) 50%, rgba(232, 84, 84, 0.12) 100%);
          border-left: 3px solid var(--color-conflict);
          border-top: 1px solid var(--color-conflict-border);
          border-bottom: 1px solid var(--color-conflict-border);
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(232, 84, 84, 0.12);
          transition: height var(--duration-normal) var(--ease-arrive),
                      padding var(--duration-normal) var(--ease-arrive),
                      opacity var(--duration-normal) var(--ease-arrive);
        }

        .conflict-banner--active {
          height: 52px;
          opacity: 1;
          animation: conflict-banner-glow 2.4s ease-in-out infinite alternate;
        }

        .conflict-banner--inactive {
          height: 0;
          padding: 0;
          opacity: 0;
          border-width: 0;
        }

        @keyframes conflict-banner-glow {
          0% {
            background: linear-gradient(90deg, rgba(232, 84, 84, 0.14) 0%, rgba(232, 84, 84, 0.06) 50%, rgba(232, 84, 84, 0.12) 100%);
            border-left-color: var(--color-conflict);
          }
          100% {
            background: linear-gradient(90deg, rgba(232, 84, 84, 0.22) 0%, rgba(232, 84, 84, 0.10) 50%, rgba(232, 84, 84, 0.18) 100%);
            border-left-color: #ff6b6b;
          }
        }

        .conflict-banner__main {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conflict-banner__badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--weight-bold);
          color: var(--color-conflict);
          background: rgba(232, 84, 84, 0.15);
          border: 1px solid var(--color-conflict-border);
          border-radius: var(--radius-sm);
          padding: 2px 7px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }

        .conflict-banner__claim {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conflict-banner__speaker {
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          font-family: var(--font-sans);
          flex-shrink: 0;
        }

        .conflict-banner__hypo {
          color: var(--text-secondary);
          font-style: italic;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conflict-banner__vs {
          color: var(--color-conflict);
          font-weight: var(--weight-bold);
          font-family: var(--font-mono);
          font-size: 10px;
          background: rgba(232, 84, 84, 0.12);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          letter-spacing: 0.04em;
        }

        .conflict-banner__metric {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-hypothesis);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conflict-banner__metric-label {
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
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
            <div className="conflict-banner__main">
              <span className="conflict-banner__badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                ACTIVE CONFLICT
              </span>

              <span className="conflict-banner__claim">
                <span className="conflict-banner__speaker">{speakerAName}:</span>{' '}
                <span className="conflict-banner__hypo">
                  &ldquo;{hypothesisA}&rdquo;
                </span>
              </span>

              <span className="conflict-banner__vs" aria-label="versus">
                VS
              </span>

              <span className="conflict-banner__claim">
                <span className="conflict-banner__speaker">{speakerBName}:</span>{' '}
                <span className="conflict-banner__hypo">
                  &ldquo;{hypothesisB}&rdquo;
                </span>
              </span>
            </div>

            {decidingMetric && (
              <div className="conflict-banner__metric">
                <span className="conflict-banner__metric-label">Deciding Telemetry:</span>
                <span>{decidingMetric}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
