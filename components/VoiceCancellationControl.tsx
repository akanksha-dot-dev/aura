'use client';

/**
 * VoiceCancellationControl.tsx — Real-time voice cancellation control panel for AURA.
 *
 * Renders inside the StatusBar as a compact floating control with:
 * - Level selector (Off / Low / Medium / High / Aggressive)
 * - Per-category toggle switches (keyboard, chatter, echo)
 * - Live SNR indicator and noise floor readout
 * - Real-time suppression statistics
 */

import React, { useState, useCallback } from 'react';
import type {
  PipelineLevel,
  PipelineResult,
  PipelineStats,
} from '@/lib/voiceCancellationPipeline';
import {
  PIPELINE_LEVEL_DESCRIPTIONS,
  getSnrLabel,
} from '@/lib/voiceCancellationPipeline';

export interface VoiceCancellationControlProps {
  /** Current pipeline level */
  level: PipelineLevel;
  /** Latest pipeline result from most recent audio frame */
  pipelineResult?: PipelineResult | null;
  /** Pipeline lifetime stats */
  stats?: PipelineStats | null;
  /** Whether keyboard suppression is on */
  suppressKeyboard?: boolean;
  /** Whether background chatter suppression is on */
  suppressChatter?: boolean;
  /** Whether echo gate is on */
  echoGateEnabled?: boolean;
  /** Callback when level changes */
  onLevelChange: (level: PipelineLevel) => void;
  /** Callback when individual toggle changes */
  onToggle: (setting: 'suppressKeyboard' | 'suppressChatter' | 'echoGateEnabled', value: boolean) => void;
  /** Whether to render in compact mode (for StatusBar) */
  compact?: boolean;
}

const LEVELS: PipelineLevel[] = ['off', 'low', 'medium', 'high', 'aggressive'];

const LEVEL_LABELS: Record<PipelineLevel, string> = {
  off:        'Off',
  low:        'Low',
  medium:     'Med',
  high:       'High',
  aggressive: 'Max',
};

const LEVEL_COLORS: Record<PipelineLevel, string> = {
  off:        'var(--text-muted)',
  low:        'var(--color-fact)',
  medium:     'var(--color-hypothesis)',
  high:       'var(--color-orient)',
  aggressive: 'var(--color-conflict)',
};

export function VoiceCancellationControl({
  level,
  pipelineResult,
  stats,
  suppressKeyboard = true,
  suppressChatter = true,
  echoGateEnabled = true,
  onLevelChange,
  onToggle,
  compact = false,
}: VoiceCancellationControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const snr = pipelineResult?.estimatedSnrDb ?? 0;
  const snrInfo = getSnrLabel(snr);
  const noiseFloor = pipelineResult?.noiseFloorDb ?? -60;
  const category = pipelineResult?.detectedCategory ?? 'silence';
  const calibrated = pipelineResult?.calibrated ?? false;
  const echoGateActive = pipelineResult?.echoGateActive ?? false;

  const suppressionRate = stats ? Math.round(stats.suppressionRate * 100) : 0;

  const levelColor = LEVEL_COLORS[level];

  const handleToggleExpand = useCallback(() => setIsExpanded(v => !v), []);

  return (
    <div className={`vc-control${compact ? ' vc-control--compact' : ''}${isExpanded ? ' vc-control--expanded' : ''}`}>
      <style>{`
        .vc-control {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          font-family: var(--font-mono);
        }

        .vc-control-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xs);
          padding: 4px 8px;
          transition: border-color 0.15s, background 0.15s;
          user-select: none;
        }

        .vc-control-trigger:hover {
          border-color: var(--border-muted);
          background: var(--bg-surface-overlay);
        }

        .vc-control-icon {
          font-size: 13px;
          line-height: 1;
        }

        .vc-control-label {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .vc-control-level {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .vc-control-snr {
          font-size: 9px;
          color: var(--text-muted);
        }

        .vc-control-echo-badge {
          font-size: 8px;
          padding: 1px 4px;
          border-radius: 2px;
          background: rgba(255,80,80,0.15);
          border: 1px solid rgba(255,80,80,0.3);
          color: #ff5050;
          animation: vc-echo-pulse 0.8s ease-in-out infinite alternate;
        }

        @keyframes vc-echo-pulse {
          from { opacity: 0.7; }
          to { opacity: 1; }
        }

        /* ─── Expanded Panel ─── */
        .vc-panel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 200;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-muted);
          border-radius: var(--radius-sm);
          padding: 12px;
          width: 240px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: vc-panel-in 0.15s var(--ease-standard);
        }

        @keyframes vc-panel-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .vc-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .vc-panel-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-primary);
          text-transform: uppercase;
        }

        .vc-panel-close {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1;
          padding: 0;
        }

        /* ─── Level Selector ─── */
        .vc-level-row {
          display: flex;
          gap: 4px;
        }

        .vc-level-btn {
          flex: 1;
          padding: 4px 0;
          font-size: 9px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: 0.04em;
          border-radius: var(--radius-xs);
          border: 1px solid var(--border-subtle);
          background: transparent;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.12s;
          text-align: center;
        }

        .vc-level-btn:hover {
          border-color: var(--border-muted);
          color: var(--text-primary);
        }

        .vc-level-btn--active {
          color: var(--text-primary);
          font-weight: 700;
        }

        /* ─── Toggles ─── */
        .vc-toggle-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .vc-toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .vc-toggle-label {
          font-size: 10px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .vc-toggle {
          position: relative;
          width: 26px;
          height: 14px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .vc-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .vc-toggle-track {
          position: absolute;
          inset: 0;
          border-radius: 7px;
          background: var(--bg-surface-overlay);
          border: 1px solid var(--border-subtle);
          transition: background 0.15s, border-color 0.15s;
        }

        .vc-toggle input:checked + .vc-toggle-track {
          background: rgba(var(--aura-rgb, 212 168 83) / 0.25);
          border-color: var(--color-aura);
        }

        .vc-toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: transform 0.15s, background 0.15s;
        }

        .vc-toggle input:checked ~ .vc-toggle-thumb {
          transform: translateX(12px);
          background: var(--color-aura);
        }

        /* ─── Stats Bar ─── */
        .vc-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .vc-stat {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xs);
          padding: 5px 7px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .vc-stat-label {
          font-size: 8px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .vc-stat-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .vc-category-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          font-family: var(--font-mono);
          padding: 2px 5px;
          border-radius: 2px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .vc-category-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .vc-calibration-bar {
          height: 2px;
          border-radius: 1px;
          background: var(--border-subtle);
          overflow: hidden;
        }

        .vc-calibration-fill {
          height: 100%;
          border-radius: 1px;
          background: var(--color-fact);
          transition: width 0.3s;
        }

        .vc-desc {
          font-size: 9px;
          color: var(--text-muted);
          line-height: 1.5;
          border-top: 1px solid var(--border-subtle);
          padding-top: 8px;
        }
      `}</style>

      {/* ─── Trigger Button ─── */}
      <button
        id="vc-control-trigger"
        type="button"
        className="vc-control-trigger"
        onClick={handleToggleExpand}
        aria-expanded={isExpanded}
        aria-label="Voice cancellation controls"
        title={PIPELINE_LEVEL_DESCRIPTIONS[level]}
      >
        <span className="vc-control-icon">🎙</span>
        <span className="vc-control-label">Voice Focus</span>
        <span className="vc-control-level" style={{ color: levelColor }}>
          {LEVEL_LABELS[level]}
        </span>
        {calibrated && (
          <span className="vc-control-snr" style={{ color: snrInfo.color }}>
            {snr.toFixed(0)}dB
          </span>
        )}
        {echoGateActive && (
          <span className="vc-control-echo-badge">ECHO</span>
        )}
      </button>

      {/* ─── Expanded Panel ─── */}
      {isExpanded && (
        <div className="vc-panel" role="dialog" aria-label="Voice cancellation settings">
          <div className="vc-panel-header">
            <span className="vc-panel-title">🎙 Voice Focus</span>
            <button
              type="button"
              className="vc-panel-close"
              onClick={handleToggleExpand}
              aria-label="Close voice cancellation panel"
            >×</button>
          </div>

          {/* Level Selector */}
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cancellation Level</div>
            <div className="vc-level-row">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  id={`vc-level-${l}`}
                  type="button"
                  className={`vc-level-btn${level === l ? ' vc-level-btn--active' : ''}`}
                  style={level === l ? {
                    background: `${LEVEL_COLORS[l]}20`,
                    borderColor: LEVEL_COLORS[l],
                    color: LEVEL_COLORS[l],
                  } : {}}
                  onClick={() => onLevelChange(l)}
                  aria-pressed={level === l}
                  title={PIPELINE_LEVEL_DESCRIPTIONS[l]}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {level !== 'off' && (
            <div className="vc-toggle-row">
              <ToggleRow
                id="vc-toggle-keyboard"
                label="Suppress keyboard typing"
                checked={suppressKeyboard}
                onChange={(v) => onToggle('suppressKeyboard', v)}
                disabled={level === 'off'}
              />
              <ToggleRow
                id="vc-toggle-chatter"
                label="Suppress background chatter"
                checked={suppressChatter}
                onChange={(v) => onToggle('suppressChatter', v)}
                disabled={level === 'off'}
              />
              <ToggleRow
                id="vc-toggle-echo"
                label="Echo gate (AURA TTS feedback)"
                checked={echoGateEnabled}
                onChange={(v) => onToggle('echoGateEnabled', v)}
                disabled={false}
              />
            </div>
          )}

          {/* Live Stats */}
          <div className="vc-stats-grid">
            <div className="vc-stat">
              <span className="vc-stat-label">SNR</span>
              <span className="vc-stat-value" style={{ color: snrInfo.color }}>
                {snr.toFixed(1)} dB
              </span>
            </div>
            <div className="vc-stat">
              <span className="vc-stat-label">Noise Floor</span>
              <span className="vc-stat-value">{noiseFloor.toFixed(1)} dBFS</span>
            </div>
            <div className="vc-stat">
              <span className="vc-stat-label">Suppressed</span>
              <span className="vc-stat-value">{suppressionRate}%</span>
            </div>
            <div className="vc-stat">
              <span className="vc-stat-label">Category</span>
              <span className="vc-stat-value" style={{ fontSize: 10 }}>{category}</span>
            </div>
          </div>

          {/* Calibration indicator */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Noise Profile
              </span>
              <span style={{ fontSize: 9, color: calibrated ? 'var(--color-fact)' : 'var(--color-orient)' }}>
                {calibrated ? '✓ Calibrated' : 'Calibrating…'}
              </span>
            </div>
            <div className="vc-calibration-bar">
              <div
                className="vc-calibration-fill"
                style={{ width: calibrated ? '100%' : '40%' }}
              />
            </div>
          </div>

          {/* Description */}
          <p className="vc-desc">{PIPELINE_LEVEL_DESCRIPTIONS[level]}</p>

          {/* Stats detail */}
          {stats && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
              <span>⌨️ {stats.keyboardEventsBlocked} kbd blocked</span>
              <span>🔊 {stats.chatterFramesBlocked} chatter blocked</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toggle Row sub-component ──────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="vc-toggle-item">
      <span className="vc-toggle-label" style={{ opacity: disabled ? 0.4 : 1 }}>{label}</span>
      <label className="vc-toggle" aria-label={label}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="vc-toggle-track" />
        <span className="vc-toggle-thumb" />
      </label>
    </div>
  );
}
