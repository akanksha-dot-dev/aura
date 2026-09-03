'use client';

import React from 'react';

export interface CognitiveLoadMeterProps {
  score: number; // 0-100
}

export function CognitiveLoadMeter({ score }: CognitiveLoadMeterProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));

  const fillColor =
    clamped < 40
      ? 'var(--color-load-normal)'
      : clamped < 70
      ? 'var(--color-load-heavy)'
      : 'var(--color-load-critical)';

  return (
    <>
      <style>{`
        .cognitive-load-meter {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          width: 100%;
        }
        .cognitive-load-meter__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .cognitive-load-meter__value {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-weight: var(--weight-medium);
        }
        .cognitive-load-meter__track {
          width: 100%;
          height: 6px;
          background: var(--bg-surface-hover);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .cognitive-load-meter__fill {
          height: 100%;
          border-radius: var(--radius-sm);
          transition: width var(--duration-normal) var(--ease-standard),
                      background-color var(--duration-normal) var(--ease-standard);
        }
      `}</style>
      <div
        className="cognitive-load-meter"
        aria-label={`Cognitive load: ${clamped}%`}
      >
        <div className="cognitive-load-meter__header">
          <span>Cognitive Load</span>
          <span className="cognitive-load-meter__value" style={{ color: fillColor }}>
            {clamped}%
          </span>
        </div>
        <div className="cognitive-load-meter__track">
          <div
            className="cognitive-load-meter__fill"
            style={{
              width: `${clamped}%`,
              backgroundColor: fillColor,
            }}
          />
        </div>
      </div>
    </>
  );
}
