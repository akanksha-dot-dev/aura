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
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isCollapsed) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCollapsed, onToggle]);

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

  return (
    <div className="agora-telemetry-container" ref={containerRef}>
      <style>{`
        .agora-telemetry-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          user-select: none;
        }

        .agora-telemetry-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-full);
          font-family: var(--font-sans);
          font-size: 11px;
          color: var(--text-secondary);
          cursor: pointer;
          white-space: nowrap;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .agora-telemetry-pill:hover {
          background: var(--bg-glass-hover);
          border-color: var(--border-glass-emphasis);
          color: var(--text-primary);
        }

        .agora-telemetry-pill--active {
          border-color: var(--color-aura);
          background: var(--bg-glass-hover);
          color: var(--text-primary);
        }

        .agora-telemetry-pill__signal {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .agora-telemetry-pill__metric {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-weight: var(--weight-medium);
        }

        .agora-telemetry-pill__divider {
          width: 1px;
          height: 10px;
          background: var(--border-glass);
        }

        .agora-telemetry-pill__arrow {
          font-size: 0.5625rem;
          color: var(--text-muted);
          margin-left: 1px;
          transition: transform var(--duration-fast);
        }

        .agora-telemetry-popover {
          position: absolute;
          bottom: calc(100% + 12px);
          right: 0;
          width: 260px;
          background: var(--bg-glass-panel);
          border: 1px solid var(--border-glass-emphasis);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          z-index: 500;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          box-shadow: var(--shadow-modal), 0 0 32px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .agora-telemetry-popover__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-glass);
          padding-bottom: var(--space-1h);
          margin-bottom: var(--space-2);
        }

        .agora-telemetry-popover__title {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: var(--weight-semibold);
          color: var(--color-aura);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .agora-telemetry-popover__close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: var(--text-xs);
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }

        .agora-telemetry-popover__close-btn:hover {
          color: var(--text-primary);
        }

        .agora-telemetry-popover__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-1h);
          margin-bottom: var(--space-2);
        }

        .agora-telemetry-popover__stat {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 11px;
        }

        .agora-telemetry-popover__label {
          font-family: var(--font-sans);
          color: var(--text-muted);
        }

        .agora-telemetry-popover__value {
          font-family: var(--font-mono);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }

        .agora-telemetry-popover__divider {
          height: 1px;
          background: var(--border-glass);
          margin: var(--space-1h) 0 var(--space-2) 0;
        }

        .agora-telemetry-popover__pipeline-title {
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: var(--weight-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: var(--space-1h);
        }

        .agora-telemetry-popover__pipeline-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: var(--space-1h);
        }

        .agora-telemetry-popover__pipeline-row:last-child {
          margin-bottom: 0;
        }

        .agora-telemetry-popover__pipeline-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
        }

        .agora-telemetry-popover__pipeline-meta .agora-telemetry-popover__label {
          font-family: var(--font-sans);
        }

        .agora-telemetry-popover__pipeline-meta .agora-telemetry-popover__value {
          font-family: var(--font-mono);
        }

        .agora-telemetry-popover__pipeline-track {
          height: 4px;
          background: var(--bg-glass-raised);
          border-radius: var(--radius-full);
          overflow: hidden;
          width: 100%;
        }

        .agora-telemetry-popover__pipeline-bar {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width var(--duration-fast) var(--ease-standard);
        }
      `}</style>

      {/* Inline Telemetry Pill */}
      <button
        type="button"
        className={`agora-telemetry-pill ${!isCollapsed ? 'agora-telemetry-pill--active' : ''}`}
        onClick={onToggle}
        title="Agora RTC Telemetry (Click to expand AI Pipeline Latency)"
        aria-expanded={!isCollapsed}
        aria-label="Agora RTC Telemetry"
      >
        <span className="agora-telemetry-pill__signal" style={{ color: getMosColor(mos) }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 20h.01" />
            <path d="M7 20v-4" />
            <path d="M12 20v-8" />
            <path d="M17 20V4" />
          </svg>
        </span>
        <span className="agora-telemetry-pill__metric" style={{ color: getMosColor(mos) }}>
          MOS {mos.toFixed(1)}
        </span>
        <span className="agora-telemetry-pill__divider" />
        <span className="agora-telemetry-pill__metric">
          {rtt}ms
        </span>
        <span className="agora-telemetry-pill__divider" />
        <span
          className="agora-telemetry-pill__metric"
          style={packetLoss > 0 ? { color: 'var(--color-conflict)' } : undefined}
        >
          {packetLoss.toFixed(0)}% loss
        </span>
        <span className="agora-telemetry-pill__arrow" aria-hidden="true">
          {!isCollapsed ? '▾' : '▲'}
        </span>
      </button>

      {/* Anchored Detail Popover */}
      {!isCollapsed && (
        <aside
          className="agora-telemetry-popover"
          role="region"
          aria-label="Agora RTC Telemetry and AI Pipeline Latency"
        >
          <div className="agora-telemetry-popover__header">
            <span className="agora-telemetry-popover__title">Agora Voice Diagnostics</span>
            <button
              type="button"
              className="agora-telemetry-popover__close-btn"
              onClick={onToggle}
              title="Close diagnostics popover"
              aria-label="Close diagnostics"
            >
              ✕
            </button>
          </div>

          {/* Quality Metrics */}
          <div className="agora-telemetry-popover__grid">
            <div className="agora-telemetry-popover__stat">
              <span className="agora-telemetry-popover__label">MOS:</span>
              <span
                className="agora-telemetry-popover__value"
                style={{ color: getMosColor(mos) }}
              >
                {mos.toFixed(1)}
              </span>
            </div>
            <div className="agora-telemetry-popover__stat">
              <span className="agora-telemetry-popover__label">Jitter:</span>
              <span className="agora-telemetry-popover__value">{jitter}ms</span>
            </div>
            <div className="agora-telemetry-popover__stat">
              <span className="agora-telemetry-popover__label">RTT:</span>
              <span className="agora-telemetry-popover__value">{rtt}ms</span>
            </div>
            <div className="agora-telemetry-popover__stat">
              <span className="agora-telemetry-popover__label">Loss:</span>
              <span className="agora-telemetry-popover__value">
                {packetLoss.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="agora-telemetry-popover__divider" />

          {/* AI Pipeline Latency */}
          <div className="agora-telemetry-popover__pipeline-title">AI Pipeline Latency</div>

          <div className="agora-telemetry-popover__pipeline-row">
            <div className="agora-telemetry-popover__pipeline-meta">
              <span className="agora-telemetry-popover__label">STT (Speech)</span>
              <span className="agora-telemetry-popover__value">{sttMeta.label}</span>
            </div>
            <div className="agora-telemetry-popover__pipeline-track">
              <div
                className="agora-telemetry-popover__pipeline-bar"
                style={{
                  width: `${sttMeta.percent}%`,
                  background: sttMeta.color,
                }}
              />
            </div>
          </div>

          <div className="agora-telemetry-popover__pipeline-row">
            <div className="agora-telemetry-popover__pipeline-meta">
              <span className="agora-telemetry-popover__label">LLM (Reasoning)</span>
              <span className="agora-telemetry-popover__value">{llmMeta.label}</span>
            </div>
            <div className="agora-telemetry-popover__pipeline-track">
              <div
                className="agora-telemetry-popover__pipeline-bar"
                style={{
                  width: `${llmMeta.percent}%`,
                  background: llmMeta.color,
                }}
              />
            </div>
          </div>

          <div className="agora-telemetry-popover__pipeline-row">
            <div className="agora-telemetry-popover__pipeline-meta">
              <span className="agora-telemetry-popover__label">TTS (MiniMax)</span>
              <span className="agora-telemetry-popover__value">{ttsMeta.label}</span>
            </div>
            <div className="agora-telemetry-popover__pipeline-track">
              <div
                className="agora-telemetry-popover__pipeline-bar"
                style={{
                  width: `${ttsMeta.percent}%`,
                  background: ttsMeta.color,
                }}
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
