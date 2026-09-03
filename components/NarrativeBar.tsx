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
  const width = 300;
  const height = 36;

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
            (Math.min(100, Math.max(0, p.value)) / 100) * (height - 8) -
            4;
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
          height: 100%;
          width: 100%;
          background: transparent;
          border: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: var(--space-2) var(--space-3);
          gap: 2px;
          user-select: none;
          overflow: hidden;
        }

        .narrative-bar__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          line-height: 1;
        }

        .narrative-bar__label {
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: var(--weight-medium);
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .narrative-bar__val {
          font-family: var(--font-sans);
          font-size: 10px;
          color: var(--color-aura);
          font-weight: var(--weight-semibold);
          white-space: nowrap;
        }

        .narrative-bar__svg-wrap {
          width: 100%;
          height: 36px;
          display: flex;
          align-items: center;
        }

        .narrative-bar__svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
      `}</style>
      <div className="narrative-bar" aria-label="Incident cognitive tension narrative">
        <div className="narrative-bar__header">
          <span className="narrative-bar__label">Tension Index</span>
          {inflectionPoints.length > 0 ? (
            <span className="narrative-bar__val">
              {inflectionPoints[inflectionPoints.length - 1].label}
            </span>
          ) : (
            <span className="narrative-bar__val" style={{ color: 'var(--text-disabled)' }}>
              Nominal
            </span>
          )}
        </div>

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
    </>
  );
}
