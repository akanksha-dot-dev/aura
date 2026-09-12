'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Participant } from '@/lib/types';
import { VoiceBadge } from '@/components/indicators/VoiceBadge';
import { CognitiveLoadMeter } from '@/components/indicators/CognitiveLoadMeter';
import { TempoIndicator } from '@/components/indicators/TempoIndicator';
import { useVoiceWaveform } from '@/hooks/useVoiceWaveform';
import { getPersonaSoundstagePosition } from '@/lib/spatialAudio';

/** Animated SVG neural ring drawn around the AURA avatar when speaking */
function AuraNeuralRing({ isSpeaking, radius = 20 }: { isSpeaking: boolean; radius?: number }) {
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="aura-speaking-ring" aria-hidden="true">
      <svg
        className="aura-speaking-ring__svg"
        viewBox={`0 0 ${(radius + 6) * 2} ${(radius + 6) * 2}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="aura-speaking-ring__track"
          cx={radius + 6}
          cy={radius + 6}
          r={radius}
        />
        <circle
          className={`aura-speaking-ring__arc${isSpeaking ? ' aura-speaking-ring__arc--active' : ''}`}
          cx={radius + 6}
          cy={radius + 6}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={isSpeaking ? undefined : circumference}
        />
      </svg>
    </span>
  );
}

/** Animated three-dot processing indicator */
function AuraProcessingIndicator() {
  return (
    <span className="aura-processing-indicator" aria-label="AURA is analyzing">
      <span className="aura-processing-dot" />
      <span className="aura-processing-dot" />
      <span className="aura-processing-dot" />
      <span style={{ marginLeft: 3 }}>Synthesizing Telemetry</span>
    </span>
  );
}

/** Relative time e.g. "5s ago", "2m ago" */
function useRelativeTime(timestamp: number) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - timestamp) / 1000);
      if (diff < 5) setLabel('just now');
      else if (diff < 60) setLabel(`${diff}s ago`);
      else setLabel(`${Math.floor(diff / 60)}m ago`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [timestamp]);
  return label;
}

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
  sarah_ic: '#F43F5E',
  marcus_sre: '#10B981',
  priya_pm: '#6366F1',
  aura_agent: '#D4A853',
};

const CALLSIGN_TAGS: Record<string, string> = {
  sarah_ic: 'CMD-01',
  marcus_sre: 'SRE-02',
  priya_pm: 'PRD-03',
  aura_agent: 'AI-00',
};

function getCallsign(uid: string): string {
  if (CALLSIGN_TAGS[uid]) return CALLSIGN_TAGS[uid];
  const lower = uid.toLowerCase();
  if (lower.includes('sarah')) return 'CMD-01';
  if (lower.includes('marcus')) return 'SRE-02';
  if (lower.includes('priya')) return 'PRD-03';
  if (lower.includes('aura')) return 'AI-00';
  return 'SPEC-04';
}

function getAvatarColor(uid: string): string {
  if (PERSONA_COLORS[uid]) return PERSONA_COLORS[uid];
  const palette = [
    '#F43F5E',
    '#10B981',
    '#6366F1',
    '#F59E0B',
    '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % palette.length;
  }
  return palette[hash];
}

function getSpeakerRole(uid: string, speakerName?: string): string {
  if (uid === 'aura_agent' || speakerName?.toLowerCase().includes('aura')) return 'AURA AI';
  if (uid.includes('sarah') || speakerName?.toLowerCase().includes('sarah')) return 'Incident Commander';
  if (uid.includes('marcus') || speakerName?.toLowerCase().includes('marcus')) return 'Senior SRE';
  if (uid.includes('priya') || speakerName?.toLowerCase().includes('priya')) return 'Product Lead';
  return 'Responder';
}

function getCleanSpeakerInfo(rawName?: string, rawUid: string = '') {
  let name = rawName || 'Unknown';
  let role = '';

  const match = name.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    name = match[1].trim();
    role = match[2].trim();
  } else {
    role = getSpeakerRole(rawUid, rawName);
  }

  return { name, role };
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

  const vitalityStatus =
    cognitiveLoadScore >= 70
      ? { label: 'Elevated', color: '#F43F5E' }
      : cognitiveLoadScore >= 40
      ? { label: 'Active', color: '#F59E0B' }
      : { label: 'Calm', color: '#10B981' };

  return (
    <>
      <style>{`
        .speaker-panel {
          grid-area: speakers;
          width: 100%;
          height: 100%;
          background: rgba(10, 11, 15, 0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 12px 10px;
          overflow: hidden;
          user-select: none;
          transition: width 0.25s ease, padding 0.25s ease;
          box-sizing: border-box;
        }

        [data-theme="light"] .speaker-panel {
          background: rgba(255, 255, 255, 0.94);
          border-right-color: rgba(0, 0, 0, 0.08);
        }

        .speaker-panel--collapsed {
          padding: 8px 6px;
        }

        .speaker-panel__top {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          min-height: 0;
        }

        .speaker-panel__title {
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          min-height: 28px;
        }

        [data-theme="light"] .speaker-panel__title {
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .speaker-panel__title--collapsed {
          justify-content: center;
          padding-bottom: 4px;
        }

        .speaker-panel__title-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .speaker-panel__count {
          font-family: var(--font-mono);
          font-size: 9.5px;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          font-weight: 600;
        }

        [data-theme="light"] .speaker-panel__count {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.08);
          color: #475569;
        }

        .speaker-panel__collapse-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 10px;
          transition: all 0.15s ease;
        }

        .speaker-panel__collapse-btn:hover {
          color: var(--text-primary);
          border-color: rgba(212, 168, 83, 0.4);
        }

        .speaker-panel__roster {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .speaker-panel__roster--collapsed {
          align-items: center;
          gap: 8px;
          padding-top: 4px;
        }

        /* ─── Elevated Participant Rows ─── */
        .speaker-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 7px 9px;
          background: rgba(255, 255, 255, 0.025);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          transition: all 0.15s ease;
          position: relative;
        }

        [data-theme="light"] .speaker-row {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.07);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .speaker-row:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.14);
        }

        [data-theme="light"] .speaker-row:hover {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.12);
        }

        .speaker-row--speaking {
          border-color: rgba(16, 185, 129, 0.5) !important;
          background: rgba(16, 185, 129, 0.06) !important;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.15);
        }

        /* AURA Elevated AI Card */
        .speaker-row--aura {
          background: linear-gradient(180deg, rgba(212, 168, 83, 0.08) 0%, rgba(212, 168, 83, 0.02) 100%);
          border: 1px solid rgba(212, 168, 83, 0.35);
          box-shadow: 0 2px 14px rgba(212, 168, 83, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        [data-theme="light"] .speaker-row--aura {
          background: linear-gradient(180deg, rgba(212, 168, 83, 0.09) 0%, rgba(212, 168, 83, 0.03) 100%);
          border-color: rgba(212, 168, 83, 0.4);
        }

        .speaker-row--aura.speaker-row--speaking {
          border-color: #D4A853 !important;
          box-shadow: 0 0 18px rgba(212, 168, 83, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
        }

        .speaker-row--collapsed {
          padding: 4px;
          align-items: center;
          justify-content: center;
          background: transparent;
          border-color: transparent;
          box-shadow: none;
        }

        .speaker-row__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
        }

        .speaker-row__meta {
          display: flex;
          align-items: center;
          gap: 8px;
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
        }

        .speaker-row__avatar-wrap--speaking::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1.5px solid #10B981;
          animation: aura-voice-ring-pulse 1.4s ease-out infinite;
          pointer-events: none;
        }

        @keyframes aura-voice-ring-pulse {
          0% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        .speaker-row__info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .speaker-row__name-row {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .speaker-row__name {
          font-family: var(--font-sans);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .speaker-row__callsign-tag {
          font-family: var(--font-mono);
          font-size: 8.5px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        [data-theme="light"] .speaker-row__callsign-tag {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.08);
          color: #475569;
        }

        .speaker-row__ic-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 4px;
          background: rgba(212, 168, 83, 0.15);
          border: 1px solid rgba(212, 168, 83, 0.35);
          border-radius: 3px;
          color: #D4A853;
          font-family: var(--font-mono);
          font-size: 8.5px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .speaker-row__role-tag {
          font-family: var(--font-sans);
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .speaker-row__spatial-tag {
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 3px;
          padding: 1px 4px;
          flex-shrink: 0;
        }

        .speaker-row__heatbar-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          margin-top: 2px;
        }

        .speaker-row__heatbar-track {
          flex: 1;
          height: 2.5px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 99px;
          overflow: hidden;
        }

        [data-theme="light"] .speaker-row__heatbar-track {
          background: rgba(0, 0, 0, 0.06);
        }

        .speaker-row__heatbar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.35s ease, background-color 0.3s ease;
        }

        .speaker-row__time {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ─── AURA Voice Equalizer Strip ─── */
        .aura-voice-eq {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
          padding: 1px 0;
        }

        .aura-voice-bar {
          flex: 1;
          background: linear-gradient(180deg, #D4A853 0%, rgba(212, 168, 83, 0.35) 100%);
          border-radius: 1px;
          min-height: 2px;
          transition: height 0.08s ease;
        }

        .aura-voice-bar--active {
          animation: aura-bar-dance 0.7s ease-in-out infinite alternate;
        }

        .aura-voice-bar--idle {
          animation: aura-bar-idle 1.8s ease-in-out infinite alternate;
        }

        @keyframes aura-bar-dance {
          0% { height: 3px; }
          100% { height: 13px; }
        }

        @keyframes aura-bar-idle {
          0% { height: 3px; opacity: 0.4; }
          100% { height: 8px; opacity: 0.8; }
        }

        /* ─── Streamlined Acoustic Telemetry ─── */
        .speaker-panel__bridge-telemetry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 9.5px;
          color: var(--text-secondary);
        }

        [data-theme="light"] .speaker-panel__bridge-telemetry {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
          color: #475569;
        }

        .bridge-telemetry__dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 6px #10B981;
          flex-shrink: 0;
        }

        /* ─── Consolidated Bridge Vitality (Integrated Quadrant) ─── */
        .speaker-panel__bottom {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 0 0 0;
          background: transparent;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        [data-theme="light"] .speaker-panel__bottom {
          border-top-color: rgba(0, 0, 0, 0.08);
        }

        .bridge-vitality__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .bridge-vitality__status-pill {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid;
        }
      `}</style>

      <aside
        className={`speaker-panel ${collapsed ? 'speaker-panel--collapsed' : ''}`}
        aria-label="Responder roster and operational metrics"
      >
        <div className="speaker-panel__top">
          <div className={`speaker-panel__title ${collapsed ? 'speaker-panel__title--collapsed' : ''}`}>
            {!collapsed && <span>Voice Bridge</span>}
            <div className="speaker-panel__title-right">
              {!collapsed && (
                <span className="speaker-panel__count">
                  {participantList.length + 1} active
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
            {/* AURA Agent Card (Always Present at Top of Roster) */}
            <AuraAgentRow
              agentUid={agentUid}
              agentIsSpeaking={agentIsSpeaking}
              agentLastSpokeAt={agentLastSpokeAt}
              collapsed={collapsed}
              waveformCanvasRef={waveformCanvasRef}
            />

            {participantList.length === 0 ? (
              !collapsed && (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>
                  Awaiting squad call-in...
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
                    ? '#10B981'
                    : ratio >= 20
                    ? '#F59E0B'
                    : '#F43F5E';

                const cleanInfo = getCleanSpeakerInfo(p.displayName, p.uid);
                const callsign = getCallsign(p.uid);
                const soundstage = getPersonaSoundstagePosition(p.uid);

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
                        >
                          <VoiceBadge
                            displayName={cleanInfo.name}
                            avatarColor={getAvatarColor(p.uid)}
                            isSpeaking={isSpeaking}
                          />
                        </div>
                        {!collapsed && (
                          <div className="speaker-row__info">
                            <div className="speaker-row__name-row">
                              <span className="speaker-row__name">{p.displayName}</span>
                              <span className="speaker-row__callsign-tag">{callsign}</span>
                              {p.isIncidentCommander && (
                                <span
                                  className="speaker-row__ic-badge"
                                  title="Incident Commander"
                                >
                                  IC
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 1 }}>
                              <span className="speaker-row__role-tag">{p.role}</span>
                              <span className="speaker-row__spatial-tag" title="Spatial audio panning">
                                {soundstage?.pan !== undefined
                                  ? soundstage.pan < 0
                                    ? `${Math.abs(Math.round(soundstage.pan * 60))}°L`
                                    : soundstage.pan > 0
                                    ? `${Math.round(soundstage.pan * 60)}°R`
                                    : 'CTR'
                                  : '3D'}
                              </span>
                            </div>
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
          </div>
        </div>

        {/* Streamlined Acoustic Telemetry */}
        {!collapsed && (
          <div className="speaker-panel__bridge-telemetry" aria-label="Acoustic Bridge Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="bridge-telemetry__dot" aria-hidden="true" />
              <span>SD-RTN™ · 48kHz HD</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7 }}>
              Opus Low-Lat
            </span>
          </div>
        )}

        {/* Consolidated Bridge Vitality Card */}
        {!collapsed && (
          <div className="speaker-panel__bottom">
            <div className="bridge-vitality__header">
              <span>Bridge Vitality</span>
              <span
                className="bridge-vitality__status-pill"
                style={{
                  color: vitalityStatus.color,
                  borderColor: vitalityStatus.color,
                  backgroundColor: `${vitalityStatus.color}15`,
                }}
              >
                {vitalityStatus.label}
              </span>
            </div>
            <TempoIndicator level={tempoLevel} />
            <CognitiveLoadMeter score={cognitiveLoadScore} />
          </div>
        )}
      </aside>
    </>
  );
}

/** AURA Agent row with official emblem, radar rings, voice waveform, and relative time */
function AuraAgentRow({
  agentIsSpeaking,
  agentLastSpokeAt,
  collapsed,
  waveformCanvasRef,
}: {
  agentUid: string;
  agentIsSpeaking: boolean;
  agentLastSpokeAt: number;
  collapsed: boolean;
  waveformCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const relativeTime = useRelativeTime(agentLastSpokeAt);
  const isActive = agentIsSpeaking;
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (agentIsSpeaking || agentLastSpokeAt <= 0) {
      setIsProcessing(false);
      return;
    }
    const check = () => {
      setIsProcessing((Date.now() - agentLastSpokeAt) < 4000);
    };
    check();
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  }, [agentIsSpeaking, agentLastSpokeAt]);

  return (
    <div
      className={`speaker-row speaker-row--aura ${isActive ? 'speaker-row--speaking' : ''} ${collapsed ? 'speaker-row--collapsed' : ''}`}
      title={collapsed ? 'AURA (AI Incident Commander)' : undefined}
    >
      <div className="speaker-row__header">
        <div className="speaker-row__meta">
          {/* Avatar with official emblem */}
          <div
            style={{
              position: 'relative',
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(212, 168, 83, 0.15)',
              border: '1px solid rgba(212, 168, 83, 0.45)',
              boxShadow: isActive ? '0 0 12px rgba(212, 168, 83, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
          >
            {isActive && <AuraNeuralRing isSpeaking={isActive} radius={18} />}
            <img
              src="/logo.png"
              alt="AURA"
              width={22}
              height={22}
              style={{ objectFit: 'contain' }}
            />
          </div>
          {!collapsed && (
            <div className="speaker-row__info">
              <div className="speaker-row__name-row">
                <span className="speaker-row__name" style={{ color: '#D4A853', fontWeight: 700 }}>AURA</span>
                <span className="speaker-row__ic-badge">AI COMMANDER</span>
                {isActive && (
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: '#D4A853',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    animation: 'aura-pulse-glow 1.5s ease-in-out infinite',
                  }}>
                    ● LIVE
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 1 }}>
                {isProcessing ? (
                  <AuraProcessingIndicator />
                ) : (
                  <span className="speaker-row__role-tag" style={{ color: 'var(--text-secondary)' }}>
                    AI Incident Commander
                  </span>
                )}
                {!isActive && agentLastSpokeAt > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {relativeTime}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Voice Equalizer Strip */}
      {!collapsed && (
        <div style={{ marginTop: 4 }}>
          <div className="aura-voice-eq" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`aura-voice-bar ${isActive ? 'aura-voice-bar--active' : 'aura-voice-bar--idle'}`}
                style={{
                  animationDelay: `${(i * 65) % 600}ms`,
                  height: isActive ? `${4 + ((i * 7) % 10)}px` : `${2 + ((i * 3) % 6)}px`,
                }}
              />
            ))}
          </div>
          <canvas
            ref={waveformCanvasRef}
            className="speaker-row__waveform"
            width={210}
            height={0}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
