'use client';

import React, { useRef } from 'react';
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
}: SpeakerPanelProps) {
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
          width: 220px;
          height: 100%;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: var(--space-3);
          overflow: hidden;
          user-select: none;
        }

        .speaker-panel__top {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          overflow-y: auto;
        }

        .speaker-panel__title {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-semibold);
          color: var(--text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .speaker-panel__roster {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
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
          background: var(--bg-surface-raised);
          border-radius: var(--radius-sm);
          border-left: 3px solid transparent;
          transition: border-color var(--duration-fast) var(--ease-standard),
                      background var(--duration-fast) var(--ease-standard);
        }

        .speaker-row--speaking {
          border-left-color: var(--color-fact);
          background: var(--bg-surface-hover);
        }

        .speaker-row--aura {
          border-left: 3px solid var(--color-aura);
          background: rgba(212, 168, 83, 0.04);
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
          gap: var(--space-1h);
          min-width: 0;
          overflow: hidden;
        }

        .speaker-row__indicator {
          font-size: var(--text-xs);
          line-height: 1;
        }

        .speaker-row__indicator--speaking {
          color: var(--color-fact);
        }

        .speaker-row__indicator--silent {
          color: var(--text-muted);
        }

        .speaker-row__name {
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .speaker-row__ic-badge {
          font-size: var(--text-xs);
          color: var(--color-aura);
        }

        .speaker-row__heatbar-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
        }

        .speaker-row__heatbar-track {
          flex: 1;
          height: 4px;
          background: var(--border-subtle);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .speaker-row__heatbar-fill {
          height: 100%;
          border-radius: var(--radius-sm);
          transition: width var(--duration-normal) var(--ease-standard);
        }

        .speaker-row__time {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .speaker-row__waveform-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 20px;
          margin-top: var(--space-1);
        }

        .speaker-row__waveform {
          display: block;
          width: 100%;
          height: 20px;
        }

        .speaker-panel__bottom {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>
      <aside className="speaker-panel" aria-label="Responder roster and operational metrics">
        <div className="speaker-panel__top">
          <div className="speaker-panel__title">Responders</div>

          <div className="speaker-panel__roster">
            {participantList.length === 0 ? (
              <div className="speaker-panel__empty">
                Waiting for responders...
              </div>
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
                    }`}
                  >
                    <div className="speaker-row__header">
                      <div className="speaker-row__meta">
                        <span
                          className={`speaker-row__indicator ${
                            isSpeaking
                              ? 'speaker-row__indicator--speaking'
                              : 'speaker-row__indicator--silent'
                          }`}
                          aria-hidden="true"
                        >
                          {isSpeaking ? '●' : '○'}
                        </span>
                        <VoiceBadge
                          displayName={p.displayName}
                          avatarColor={getAvatarColor(p.uid)}
                          isSpeaking={isSpeaking}
                        />
                        <span className="speaker-row__name">
                          {p.displayName} ({p.role})
                        </span>
                      </div>
                      {p.isIncidentCommander && (
                        <span
                          className="speaker-row__ic-badge"
                          title="Incident Commander"
                          aria-label="Incident Commander"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                      )}
                    </div>

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
                  </div>
                );
              })
            )}

            {/* AURA Agent Row (Always Present) */}
            <div className="speaker-row speaker-row--aura">
              <div className="speaker-row__header">
                <div className="speaker-row__meta">
                  <span
                    className={`speaker-row__indicator ${
                      agentIsSpeaking
                        ? 'speaker-row__indicator--speaking'
                        : 'speaker-row__indicator--silent'
                    }`}
                    aria-hidden="true"
                  >
                    {agentIsSpeaking ? '●' : '○'}
                  </span>
                  <VoiceBadge
                    displayName="AURA"
                    avatarColor="var(--color-aura)"
                    isSpeaking={agentIsSpeaking}
                  />
                  <span className="speaker-row__name" style={{ color: 'var(--color-aura)' }}>
                    AURA
                  </span>
                </div>
                <SilenceCounter
                  agentLastSpokeAt={agentLastSpokeAt}
                  agentIsSpeaking={agentIsSpeaking}
                />
              </div>

              {/* Golden Voice Waveform (Star 1 Visual Proof) */}
              <div className="speaker-row__waveform-wrap">
                <canvas
                  ref={waveformCanvasRef}
                  className="speaker-row__waveform"
                  width={180}
                  height={20}
                  aria-label="AURA voice activity waveform"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="speaker-panel__bottom">
          <TempoIndicator level={tempoLevel} />
          <CognitiveLoadMeter score={cognitiveLoadScore} />
        </div>
      </aside>
    </>
  );
}
