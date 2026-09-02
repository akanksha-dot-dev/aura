'use client';

import React from 'react';
import { OODAPhase } from '@/lib/types';

export interface NarrativeBarProps {
  tensionHistory: { timestamp: number; value: number }[];
  oodaPhase: OODAPhase;
  inflectionPoints: { timestamp: number; label: string }[];
}

export function NarrativeBar({
  tensionHistory,
  inflectionPoints,
}: NarrativeBarProps) {
  const width = 600;
  const height = 44;

  const minTime =
    tensionHistory.length > 0 ? tensionHistory[0].timestamp : 0;
  const maxTime =
    tensionHistory.length > 0
      ? Math.max(
          tensionHistory[tensionHistory.length - 1].timestamp,
          minTime + 1000
        )
      : 1000;
  const timeSpan = Math.max(1, maxTime - minTime);

  const coords =
    tensionHistory.length > 1
      ? tensionHistory.map((p) => {
          const x = ((p.timestamp - minTime) / timeSpan) * width;
          const y =
            height -
            (Math.min(100, Math.max(0, p.value)) / 100) * (height - 10) -
            5;
          return [x, y] as [number, number];
        })
      : [
          [0, height * 0.75] as [number, number],
          [width, height * 0.75] as [number, number],
        ];

  const linePath = coords.reduce((acc, [x, y], idx) => {
    return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <>
      <style>{`
        .narrative-bar {
          grid-area: narrative;
          height: 64px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          gap: var(--space-4);
          user-select: none;
          overflow: hidden;
        }

        .narrative-bar__left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          min-width: 0;
        }

        .narrative-bar__label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .narrative-bar__svg-wrap {
          flex: 1;
          height: 44px;
          max-width: 600px;
          display: flex;
          align-items: center;
        }

        .narrative-bar__svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .narrative-bar__markers {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
          overflow-x: auto;
        }

        .narrative-marker {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          white-space: nowrap;
        }

        .narrative-marker__icon--conflict {
          color: var(--color-conflict);
        }

        .narrative-marker__icon--decision {
          color: var(--color-decision);
        }

        .narrative-marker__icon--resolved {
          color: var(--color-fact);
        }

        .narrative-marker__icon--default {
          color: var(--color-aura);
        }
      `}</style>
      <footer className="narrative-bar" aria-label="Incident cognitive tension narrative">
        <div className="narrative-bar__left">
          <span className="narrative-bar__label">Tension</span>

          <div className="narrative-bar__svg-wrap">
            <svg
              className="narrative-bar__svg"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="narrative-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-aura)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-aura)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path d={areaPath} fill="url(#narrative-grad)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-aura)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="narrative-bar__markers">
          {inflectionPoints.map((pt, idx) => {
            const isConflict = pt.label.toLowerCase().includes('conflict');
            const isDecision = pt.label.toLowerCase().includes('decid');
            const isResolved = pt.label.toLowerCase().includes('resolv');

            const iconClass = isConflict
              ? 'narrative-marker__icon--conflict'
              : isDecision
              ? 'narrative-marker__icon--decision'
              : isResolved
              ? 'narrative-marker__icon--resolved'
              : 'narrative-marker__icon--default';

            const symbol = isConflict
              ? '◆'
              : isDecision
              ? '▲'
              : isResolved
              ? '✓'
              : '●';

            return (
              <div key={idx} className="narrative-marker">
                <span className={iconClass} aria-hidden="true">
                  {symbol}
                </span>
                <span>{pt.label}</span>
              </div>
            );
          })}
        </div>
      </footer>
    </>
  );
}
