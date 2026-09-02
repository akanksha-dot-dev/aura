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
          background: var(--color-conflict-dim);
          border-left: 3px solid var(--color-conflict);
          overflow: hidden;
          transition: height var(--duration-normal) var(--ease-arrive),
                      padding var(--duration-normal) var(--ease-arrive),
                      opacity var(--duration-normal) var(--ease-arrive);
        }

        .conflict-banner--active {
          height: 52px;
          opacity: 1;
          animation: conflict-banner-pulse var(--duration-pulse) ease-in-out infinite;
        }

        .conflict-banner--inactive {
          height: 0;
          padding: 0;
          opacity: 0;
          border-left-width: 0;
        }

        @keyframes conflict-banner-pulse {
          0%, 100% {
            background: var(--color-conflict-dim);
          }
          50% {
            background: rgba(232, 84, 84, 0.22);
          }
        }

        .conflict-banner__main {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          font-weight: var(--weight-medium);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conflict-banner__badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-bold);
          color: var(--color-conflict);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }

        .conflict-banner__vs {
          color: var(--color-conflict);
          font-weight: var(--weight-bold);
          font-family: var(--font-mono);
          padding: 0 var(--space-1);
          flex-shrink: 0;
        }

        .conflict-banner__metric {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conflict-banner__speaker {
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
        }

        .conflict-banner__hypo {
          color: var(--text-secondary);
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
                <span aria-hidden="true">⚠</span> ACTIVE CONFLICT
              </span>
              <span>
                <span className="conflict-banner__speaker">{speakerAName}:</span>{' '}
                <span className="conflict-banner__hypo">
                  &ldquo;{hypothesisA}&rdquo;
                </span>
              </span>
              <span className="conflict-banner__vs" aria-label="versus">
                vs
              </span>
              <span>
                <span className="conflict-banner__speaker">{speakerBName}:</span>{' '}
                <span className="conflict-banner__hypo">
                  &ldquo;{hypothesisB}&rdquo;
                </span>
              </span>
            </div>
            {decidingMetric && (
              <div className="conflict-banner__metric">
                Deciding metric: {decidingMetric}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
