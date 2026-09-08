'use client';

import React, { useMemo } from 'react';

/**
 * PresenceBar — Real-time avatar presence bar showing who's in the war room.
 *
 * Visual states:
 * - Green pulse:  speaking
 * - Amber dot:    connected but silent
 * - Red dot:      connection issues / high latency
 * - Dimmed:       recently left (grace period)
 */

export interface PresenceParticipant {
  uid: string;
  displayName: string;
  role: string;
  isSpeaking: boolean;
  isAI?: boolean;
  joinedAt: number;
  /** Volume level 0-100 (from Agora volume indicator) */
  volumeLevel: number;
  /** Network quality 0-5 (from Agora network quality) */
  networkQuality?: number;
}

export interface PresenceBarProps {
  participants: PresenceParticipant[];
  /** Currently active speaker UID (optional override) */
  activeSpeakerUid?: string;
  /** Whether presence bar is in compact mode */
  compact?: boolean;
}

const AVATAR_PALETTE = [
  '#F43F5E', '#10B981', '#6366F1', '#F97316', '#06B6D4',
  '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#3B82F6',
];

function getAvatarColor(uid: string): string {
  if (uid === 'aura_agent') return '#F59E0B';
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTimeInRoom(joinedAt: number): string {
  const ms = Date.now() - joinedAt;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just joined';
  if (m < 60) return `${m}m in room`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m in room`;
}

export function PresenceBar({ participants, activeSpeakerUid, compact = false }: PresenceBarProps) {
  const sorted = useMemo(() => {
    return [...participants].sort((a, b) => {
      // AURA always first
      if (a.uid === 'aura_agent') return -1;
      if (b.uid === 'aura_agent') return 1;
      // Active speaker next
      if (a.uid === activeSpeakerUid) return -1;
      if (b.uid === activeSpeakerUid) return 1;
      // Then by speaking state
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;
      // Then by join time
      return a.joinedAt - b.joinedAt;
    });
  }, [participants, activeSpeakerUid]);

  const humanCount = participants.filter(p => !p.isAI).length;
  const speakingCount = participants.filter(p => p.isSpeaking).length;

  return (
    <>
      <style>{`
        .presence-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: var(--bg-glass, rgba(255,255,255,0.03));
          border: 1px solid var(--border-glass, rgba(255,255,255,0.06));
          border-radius: 20px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          user-select: none;
          overflow: hidden;
          max-width: 100%;
        }

        .presence-bar--compact {
          padding: 2px 8px;
          gap: 4px;
        }

        .presence-avatar-group {
          display: flex;
          align-items: center;
        }

        .presence-avatar {
          position: relative;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-sans, system-ui);
          color: #fff;
          cursor: default;
          transition: transform 0.2s ease, box-shadow 0.3s ease;
          flex-shrink: 0;
          margin-left: -6px;
          border: 2px solid var(--bg-base, #0a0a1a);
        }

        .presence-avatar:first-child {
          margin-left: 0;
        }

        .presence-avatar:hover {
          transform: scale(1.15) translateY(-2px);
          z-index: 10;
        }

        .presence-avatar--compact {
          width: 22px;
          height: 22px;
          font-size: 8px;
          margin-left: -5px;
        }

        .presence-avatar--speaking {
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.6);
          animation: presence-pulse 1.5s ease-in-out infinite;
        }

        .presence-avatar--ai {
          font-size: 12px;
        }

        @keyframes presence-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.6); }
          50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3), 0 0 12px rgba(16, 185, 129, 0.2); }
        }

        .presence-status-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1.5px solid var(--bg-base, #0a0a1a);
        }

        .presence-status-dot--speaking { background: #10B981; }
        .presence-status-dot--idle { background: #F59E0B; }
        .presence-status-dot--poor { background: #EF4444; }

        .presence-count {
          font-family: var(--font-sans, system-ui);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary, #a1a1aa);
          white-space: nowrap;
          padding-left: 4px;
          flex-shrink: 0;
        }

        .presence-speaking-indicator {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          color: #10B981;
          flex-shrink: 0;
        }

        .presence-speaking-bars {
          display: flex;
          gap: 1px;
          align-items: flex-end;
          height: 10px;
        }

        .presence-speaking-bars span {
          width: 2px;
          background: #10B981;
          border-radius: 1px;
          animation: pb-bounce 0.6s ease-in-out infinite;
        }

        .presence-speaking-bars span:nth-child(1) { height: 4px; animation-delay: 0s; }
        .presence-speaking-bars span:nth-child(2) { height: 7px; animation-delay: 0.15s; }
        .presence-speaking-bars span:nth-child(3) { height: 5px; animation-delay: 0.3s; }

        @keyframes pb-bounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }

        .presence-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20, 20, 40, 0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 12px;
          white-space: nowrap;
          font-family: var(--font-sans, system-ui);
          font-size: 11px;
          color: #e4e4e7;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 100;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .presence-avatar:hover .presence-tooltip {
          opacity: 1;
        }

        .presence-tooltip__name {
          font-weight: 700;
          color: #fafafa;
        }

        .presence-tooltip__role {
          color: #71717a;
          font-size: 10px;
        }

        .presence-tooltip__stats {
          margin-top: 4px;
          font-size: 10px;
          color: #a1a1aa;
        }
      `}</style>
      <div className={`presence-bar ${compact ? 'presence-bar--compact' : ''}`}>
        <div className="presence-avatar-group">
          {sorted.map((p) => {
            const color = getAvatarColor(p.uid);
            const isSpeaking = p.isSpeaking || p.uid === activeSpeakerUid;
            const isPoorNetwork = (p.networkQuality ?? 1) >= 4;
            const statusClass = isSpeaking ? 'speaking' : isPoorNetwork ? 'poor' : 'idle';

            return (
              <div
                key={p.uid}
                className={[
                  'presence-avatar',
                  compact && 'presence-avatar--compact',
                  isSpeaking && 'presence-avatar--speaking',
                  p.isAI && 'presence-avatar--ai',
                ].filter(Boolean).join(' ')}
                style={{ background: color }}
                title={`${p.displayName} — ${p.role}`}
              >
                {p.isAI ? '🤖' : getInitials(p.displayName)}
                <div className={`presence-status-dot presence-status-dot--${statusClass}`} />
                <div className="presence-tooltip">
                  <div className="presence-tooltip__name">{p.displayName}</div>
                  <div className="presence-tooltip__role">{p.role}</div>
                  <div className="presence-tooltip__stats">
                    {formatTimeInRoom(p.joinedAt)}
                    {isSpeaking && ' · 🎙️ Speaking'}
                    {isPoorNetwork && ' · ⚠️ Poor connection'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <span className="presence-count">
          {humanCount} {humanCount === 1 ? 'responder' : 'responders'}
        </span>

        {speakingCount > 0 && (
          <div className="presence-speaking-indicator">
            <div className="presence-speaking-bars">
              <span /><span /><span />
            </div>
            {speakingCount}
          </div>
        )}
      </div>
    </>
  );
}
