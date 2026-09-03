'use client';

import React, { useRef, useState } from 'react';
import { Participant } from '@/lib/types';
import { VoiceBadge } from './VoiceBadge';
import { SilenceCounter } from './SilenceCounter';
import { CognitiveLoadMeter } from './CognitiveLoadMeter';
import { TempoIndicator } from './TempoIndicator';
import { useVoiceWaveform } from '@/hooks/useVoiceWaveform';

export interface SpeakerPanelProps {
  participants: Record<string, Participant>;
  localVolumeLevel: Record<string, number>; // UID → 0-100
  agentUid: string; // "aura_agent"
  agentLastSpokeAt: number;
  agentIsSpeaking: boolean;
  cognitiveLoadScore: number; // 0-100
  tempoLevel: number; // 1-5
  agentAudioTrack?: MediaStreamTrack | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PERSONA_COLORS: Record<string, string> = {
  sarah_ic: 'var(--color-conflict)',
  marcus_sre: 'var(--color-fact)',
  priya_pm: 'var(--color-decision)',
  aura_agent: 'var(--color-aura)',
};

function getAvatarColor(uid: string): string {
  if (PERSONA_COLORS[uid]) return PERSONA_COLORS[uid];
  const palette = [
    'var(--color-conflict)',
    'var(--color-fact)',
    'var(--color-decision)',
    'var(--color-hypothesis)',
    'var(--color-action)',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % palette.length;
  }
  return palette[hash];
}

function formatSpeakingTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

export function SpeakerPanel({
  participants,
  localVolumeLevel,
  agentUid,
  agentLastSpokeAt,
  agentIsSpeaking,
  cognitiveLoadScore,
  tempoLevel,
  agentAudioTrack,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalOnToggleCollapse,
}: SpeakerPanelProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const collapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const toggleCollapse = () => {
    if (externalOnToggleCollapse) {
      externalOnToggleCollapse();
    } else {
      setInternalIsCollapsed((prev) => !prev);
    }
  };

  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useVoiceWaveform({
    canvasRef: waveformCanvasRef,
    audioTrack: agentAudioTrack,
    isSpeaking: agentIsSpeaking,
  });

  const participantList = Object.values(participants).filter(
    (p) => p.uid !== agentUid
  );

  // Compute maximum speaking time among participants for relative engagement bar
  const maxSpeakingMs = Math.max(
    60_000,
    ...participantList.map((p) => p.totalSpeakingMs)
  );

  return (
    <>
      <style>{`
        .speaker-panel {
          grid-area: speakers;
          width: 100%;
          height: 100%;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-glass);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: var(--space-3);
          overflow: hidden;
          user-select: none;
          transition: width var(--transition-panel), padding var(--transition-panel);
        }

        .speaker-panel--collapsed {
          padding: var(--space-2) 6px;
        }

        .speaker-panel__top {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          overflow-y: auto;
          min-height: 0;
        }

        .speaker-panel__title {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--space-1h);
          border-bottom: 1px solid var(--border-glass);
          min-height: 28px;
        }

        .speaker-panel__title--collapsed {
          justify-content: center;
          padding-bottom: var(--space-1);
        }

        .speaker-panel__title-right {
          display: flex;
          align-items: center;
          gap: var(--space-1h);
        }

        .speaker-panel__count {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--text-disabled);
        }

        .speaker-panel__collapse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--border-glass);
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 11px;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .speaker-panel__collapse-btn:hover {
          color: var(--text-primary);
          background: var(--bg-glass-hover);
          border-color: var(--border-glass-emphasis);
        }

        .speaker-panel__roster {
          display: flex;
          flex-direction: column;
          gap: var(--space-1h);
        }

        .speaker-panel__roster--collapsed {
          align-items: center;
          gap: var(--space-2);
          padding-top: var(--space-1);
        }

        .speaker-panel__empty {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-style: normal;
          padding: var(--space-2) 0;
        }

        .speaker-row {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-2);
          background: transparent;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          border-left: 3px solid transparent;
          transition: border-color var(--duration-fast) var(--ease-standard),
                      background var(--duration-fast) var(--ease-standard),
                      box-shadow var(--duration-fast) var(--ease-standard);
        }

        .speaker-row:hover {
          background: var(--bg-glass);
          border-color: var(--border-glass);
        }

        .speaker-row--speaking {
          border-left-color: var(--color-fact);
          background: var(--bg-glass-hover);
          border-color: var(--border-glass);
        }

        .speaker-row--aura {
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-left: 3px solid var(--color-aura);
          background: rgba(212, 168, 83, 0.04);
          box-shadow: 0 0 10px rgba(212, 168, 83, 0.05);
        }

        .speaker-row--collapsed {
          padding: 4px;
          align-items: center;
          justify-content: center;
          border-left: none;
          background: transparent;
          box-shadow: none;
        }

        .speaker-row--collapsed:hover {
          background: var(--bg-glass-hover);
        }

        .speaker-row__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          min-width: 0;
        }

        .speaker-row__meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: 0;
          flex: 1;
        }

        .speaker-row__avatar-wrap {
          position: relative;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.2s ease;
        }

        .speaker-row__avatar-wrap--speaking {
          animation: speaker-ring-pulse 1.5s ease-in-out infinite;
        }

        @keyframes speaker-ring-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0px var(--ring-color, var(--color-fact));
          }
          50% {
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring-color, var(--color-fact)) 60%, transparent),
                        0 0 8px 1px color-mix(in srgb, var(--ring-color, var(--color-fact)) 30%, transparent);
          }
        }

        .speaker-row__info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1;
        }

        .speaker-row__name-row {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }

        .speaker-row__name {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .speaker-row__role-tag {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .speaker-row__role-tag--aura {
          color: var(--color-aura);
        }

        .speaker-row__ic-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 4px;
          background: var(--color-aura-dim);
          border: 1px solid rgba(212, 168, 83, 0.3);
          border-radius: 2px;
          color: var(--color-aura);
          font-family: var(--font-mono);
          font-size: 0.5625rem;
          font-weight: var(--weight-bold);
          flex-shrink: 0;
        }

        .speaker-row__heatbar-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
        }

        .speaker-row__heatbar-track {
          flex: 1;
          height: 3px;
          background: var(--bg-surface);
          border-radius: 99px;
          overflow: hidden;
        }

        .speaker-row__heatbar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.35s ease, background-color 0.3s ease;
        }

        .speaker-row__time {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .speaker-row__waveform-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 22px;
          margin-top: 2px;
          background: rgba(0, 0, 0, 0.25);
          border-radius: var(--radius-sm);
          border: 1px solid rgba(212, 168, 83, 0.15);
        }

        .speaker-row__waveform {
          display: block;
          width: 100%;
          height: 22px;
        }

        .speaker-panel__bridge-telemetry {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: var(--space-2) 0;
          padding: 6px var(--space-2);
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          opacity: 0.85;
        }

        .bridge-telemetry__dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-fact);
          box-shadow: 0 0 6px var(--color-fact);
          flex-shrink: 0;
        }

        .bridge-telemetry__line {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .speaker-panel__bottom {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border-glass);
          flex-shrink: 0;
        }
      `}</style>
      <aside
        className={`speaker-panel ${collapsed ? 'speaker-panel--collapsed' : ''}`}
        aria-label="Responder roster and operational metrics"
      >
        <div className="speaker-panel__top">
          <div className={`speaker-panel__title ${collapsed ? 'speaker-panel__title--collapsed' : ''}`}>
            {!collapsed && <span>Bridge Participants</span>}
            <div className="speaker-panel__title-right">
              {!collapsed && (
                <span className="speaker-panel__count">
                  {participantList.length + 1}
                </span>
              )}
              <button
                type="button"
                className="speaker-panel__collapse-btn"
                onClick={toggleCollapse}
                title={collapsed ? "Expand participant panel" : "Collapse to icon rail"}
                aria-label={collapsed ? "Expand participant panel" : "Collapse to icon rail"}
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>
          </div>

          <div className={`speaker-panel__roster ${collapsed ? 'speaker-panel__roster--collapsed' : ''}`}>
            {participantList.length === 0 ? (
              !collapsed && (
                <div className="speaker-panel__empty">
                  Waiting for responders...
                </div>
              )
            ) : (
              participantList.map((p) => {
                const volume = localVolumeLevel[p.uid] ?? 0;
                const isSpeaking = volume > 20;
                const ratio = Math.min(
                  100,
                  Math.round((p.totalSpeakingMs / maxSpeakingMs) * 100)
                );
                const heatColor =
                  ratio >= 50
                    ? 'var(--color-fact)'
                    : ratio >= 20
                    ? 'var(--color-orient)'
                    : 'var(--color-conflict)';

                return (
                  <div
                    key={p.uid}
                    className={`speaker-row ${
                      isSpeaking ? 'speaker-row--speaking' : ''
                    } ${collapsed ? 'speaker-row--collapsed' : ''}`}
                    title={collapsed ? `${p.displayName} (${p.role})` : undefined}
                  >
                    <div className="speaker-row__header">
                      <div className="speaker-row__meta">
                        <div
                          className={`speaker-row__avatar-wrap ${
                            isSpeaking ? 'speaker-row__avatar-wrap--speaking' : ''
                          }`}
                          style={
                            {
                              '--ring-color': getAvatarColor(p.uid),
                            } as React.CSSProperties
                          }
                        >
                          <VoiceBadge
                            displayName={p.displayName}
                            avatarColor={getAvatarColor(p.uid)}
                            isSpeaking={isSpeaking}
                          />
                        </div>
                        {!collapsed && (
                          <div className="speaker-row__info">
                            <div className="speaker-row__name-row">
                              <span className="speaker-row__name">{p.displayName}</span>
                              {p.isIncidentCommander && (
                                <span
                                  className="speaker-row__ic-badge"
                                  title="Incident Commander"
                                >
                                  IC
                                </span>
                              )}
                            </div>
                            <span className="speaker-row__role-tag">{p.role}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!collapsed && (
                      <div className="speaker-row__heatbar-wrap">
                        <div className="speaker-row__heatbar-track">
                          <div
                            className="speaker-row__heatbar-fill"
                            style={{
                              width: `${Math.max(4, ratio)}%`,
                              backgroundColor: heatColor,
                            }}
                          />
                        </div>
                        <span className="speaker-row__time">
                          {formatSpeakingTime(p.totalSpeakingMs)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* AURA Agent Row (Always Present) */}
            <div
              className={`speaker-row speaker-row--aura ${collapsed ? 'speaker-row--collapsed' : ''}`}
              title={collapsed ? "AURA (AI Commander)" : undefined}
            >
              <div className="speaker-row__header">
                <div className="speaker-row__meta">
                  <div
                    className={`speaker-row__avatar-wrap ${
                      agentIsSpeaking ? 'speaker-row__avatar-wrap--speaking' : ''
                    }`}
                    style={
                      {
                        '--ring-color': 'var(--color-aura)',
                      } as React.CSSProperties
                    }
                  >
                    <VoiceBadge
                      displayName="AURA"
                      avatarColor="var(--color-aura)"
                      isSpeaking={agentIsSpeaking}
                    />
                  </div>
                  {!collapsed && (
                    <div className="speaker-row__info">
                      <div className="speaker-row__name-row">
                        <span
                          className="speaker-row__name"
                          style={{ color: 'var(--color-aura)' }}
                        >
                          AURA
                        </span>
                        <span className="speaker-row__ic-badge" style={{ borderColor: 'var(--color-aura)' }}>
                          AI
                        </span>
                      </div>
                      <span className="speaker-row__role-tag speaker-row__role-tag--aura">
                        AI Commander
                      </span>
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <SilenceCounter
                    agentLastSpokeAt={agentLastSpokeAt}
                    agentIsSpeaking={agentIsSpeaking}
                  />
                )}
              </div>

              {/* Golden Voice Waveform (Star 1 Visual Proof) */}
              {!collapsed && (
                <div className="speaker-row__waveform-wrap">
                  <canvas
                    ref={waveformCanvasRef}
                    className="speaker-row__waveform"
                    width={210}
                    height={22}
                    aria-label="AURA voice activity waveform"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compressed Single-Line Acoustic Bridge Telemetry */}
        {!collapsed && (
          <div className="speaker-panel__bridge-telemetry" aria-label="Acoustic Bridge Status">
            <span className="bridge-telemetry__dot" aria-hidden="true" />
            <span className="bridge-telemetry__line">● SD-RTN · OPUS 48kHz · AEC</span>
          </div>
        )}

        {!collapsed && (
          <div className="speaker-panel__bottom">
            <TempoIndicator level={tempoLevel} />
            <CognitiveLoadMeter score={cognitiveLoadScore} />
          </div>
        )}
      </aside>
    </>
  );
}
