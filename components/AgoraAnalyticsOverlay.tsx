'use client';

import React from 'react';

export interface AgoraAnalyticsOverlayProps {
  mos: number;             // Mean Opinion Score 1.0-5.0
  jitter: number;          // Milliseconds
  rtt: number;             // Round-trip time ms
  packetLoss: number;      // Percentage 0-100
  sttLatencyMs: number | null;
  llmLatencyMs: number | null;
  ttsLatencyMs: number | null;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AgoraAnalyticsOverlay({
  mos,
  jitter,
  rtt,
  packetLoss,
  sttLatencyMs,
  llmLatencyMs,
  ttsLatencyMs,
  isCollapsed,
  onToggle,
}: AgoraAnalyticsOverlayProps) {
  // MOS color coding
  const getMosColor = (score: number) => {
    if (score >= 3.5) return 'var(--color-fact)';
    if (score >= 2.5) return 'var(--color-hypothesis)';
    return 'var(--color-conflict)';
  };

  // Pipeline latency bar color & percent calculations
  const getLatencyMeta = (val: number | null, maxScale: number, greenLimit: number, amberLimit: number) => {
    if (val === null) {
      return { percent: 0, color: 'var(--text-disabled)', label: '–' };
    }
    const percent = Math.min(100, Math.max(10, Math.round((val / maxScale) * 100)));
    let color = 'var(--color-fact)';
    if (val > amberLimit) {
      color = 'var(--color-conflict)';
    } else if (val > greenLimit) {
      color = 'var(--color-hypothesis)';
    }
    return { percent, color, label: `${val}ms` };
  };

  const sttMeta = getLatencyMeta(sttLatencyMs, 400, 100, 300);
  const llmMeta = getLatencyMeta(llmLatencyMs, 1200, 500, 1000);
  const ttsMeta = getLatencyMeta(ttsLatencyMs, 600, 200, 500);

  if (isCollapsed) {
    return (
      <button
        type="button"
        className="agora-analytics-btn"
        onClick={onToggle}
        title="Open Agora Telemetry & Pipeline Analytics"
        aria-label="Open Agora Telemetry Analytics"
      >
        <span className="agora-analytics-btn__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
        </span>
        <style>{`
          .agora-analytics-btn {
            position: fixed;
            bottom: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            border-radius: var(--radius-lg);
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 50;
            color: var(--text-secondary);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            transition: background-color var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast), box-shadow var(--duration-fast);
          }
          .agora-analytics-btn:hover {
            background: var(--bg-surface-hover);
            border-color: var(--color-aura);
            color: var(--color-aura);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
          }
          .agora-analytics-btn__icon {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </button>
    );
  }

  return (
    <aside
      className="agora-analytics-panel"
      role="region"
      aria-label="Agora RTC Telemetry and AI Pipeline Latency"
    >
      <style>{`
        .agora-analytics-panel {
          position: fixed;
          bottom: 12px;
          right: 12px;
          width: 220px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: var(--space-2h);
          z-index: 50;
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
          user-select: none;
        }

        .agora-analytics-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: var(--space-1h);
          margin-bottom: var(--space-2);
        }

        .agora-analytics-panel__title {
          font-size: 0.6875rem;
          font-weight: var(--weight-bold);
          color: var(--color-aura);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .agora-analytics-panel__close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: var(--text-xs);
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
        }

        .agora-analytics-panel__close-btn:hover {
          color: var(--text-primary);
        }

        .agora-analytics-panel__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-1);
          margin-bottom: var(--space-2h);
        }

        .agora-analytics-panel__stat {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 0.6875rem;
        }

        .agora-analytics-panel__label {
          color: var(--text-muted);
        }

        .agora-analytics-panel__value {
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
        }

        .agora-analytics-panel__divider {
          height: 1px;
          background: var(--border-subtle);
          margin: var(--space-1h) 0 var(--space-2) 0;
        }

        .agora-analytics-panel__pipeline-title {
          font-size: 0.6875rem;
          font-weight: var(--weight-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: var(--space-1h);
        }

        .agora-analytics-panel__pipeline-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: var(--space-1h);
        }

        .agora-analytics-panel__pipeline-row:last-child {
          margin-bottom: 0;
        }

        .agora-analytics-panel__pipeline-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.625rem;
        }

        .agora-analytics-panel__pipeline-track {
          height: 4px;
          background: var(--bg-surface-raised);
          border-radius: var(--radius-sm);
          overflow: hidden;
          width: 100%;
        }

        .agora-analytics-panel__pipeline-bar {
          height: 100%;
          border-radius: var(--radius-sm);
          transition: width var(--duration-fast) var(--ease-standard);
        }
      `}</style>

      {/* Header */}
      <div className="agora-analytics-panel__header">
        <span className="agora-analytics-panel__title">Agora Quality</span>
        <button
          type="button"
          className="agora-analytics-panel__close-btn"
          onClick={onToggle}
          title="Collapse analytics overlay"
          aria-label="Collapse analytics"
        >
          ▾
        </button>
      </div>

      {/* Quality Metrics */}
      <div className="agora-analytics-panel__grid">
        <div className="agora-analytics-panel__stat">
          <span className="agora-analytics-panel__label">MOS:</span>
          <span
            className="agora-analytics-panel__value"
            style={{ color: getMosColor(mos) }}
          >
            {mos.toFixed(1)}
          </span>
        </div>
        <div className="agora-analytics-panel__stat">
          <span className="agora-analytics-panel__label">Jitter:</span>
          <span className="agora-analytics-panel__value">{jitter}ms</span>
        </div>
        <div className="agora-analytics-panel__stat">
          <span className="agora-analytics-panel__label">RTT:</span>
          <span className="agora-analytics-panel__value">{rtt}ms</span>
        </div>
        <div className="agora-analytics-panel__stat">
          <span className="agora-analytics-panel__label">Loss:</span>
          <span className="agora-analytics-panel__value">
            {packetLoss.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="agora-analytics-panel__divider" />

      {/* AI Pipeline Latency */}
      <div className="agora-analytics-panel__pipeline-title">AI Pipeline</div>

      <div className="agora-analytics-panel__pipeline-row">
        <div className="agora-analytics-panel__pipeline-meta">
          <span className="agora-analytics-panel__label">STT (Speech)</span>
          <span className="agora-analytics-panel__value">{sttMeta.label}</span>
        </div>
        <div className="agora-analytics-panel__pipeline-track">
          <div
            className="agora-analytics-panel__pipeline-bar"
            style={{
              width: `${sttMeta.percent}%`,
              background: sttMeta.color,
            }}
          />
        </div>
      </div>

      <div className="agora-analytics-panel__pipeline-row">
        <div className="agora-analytics-panel__pipeline-meta">
          <span className="agora-analytics-panel__label">LLM (Reasoning)</span>
          <span className="agora-analytics-panel__value">{llmMeta.label}</span>
        </div>
        <div className="agora-analytics-panel__pipeline-track">
          <div
            className="agora-analytics-panel__pipeline-bar"
            style={{
              width: `${llmMeta.percent}%`,
              background: llmMeta.color,
            }}
          />
        </div>
      </div>

      <div className="agora-analytics-panel__pipeline-row">
        <div className="agora-analytics-panel__pipeline-meta">
          <span className="agora-analytics-panel__label">TTS (Voice)</span>
          <span className="agora-analytics-panel__value">{ttsMeta.label}</span>
        </div>
        <div className="agora-analytics-panel__pipeline-track">
          <div
            className="agora-analytics-panel__pipeline-bar"
            style={{
              width: `${ttsMeta.percent}%`,
              background: ttsMeta.color,
            }}
          />
        </div>
      </div>
    </aside>
  );
}
