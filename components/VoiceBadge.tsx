'use client';

import React from 'react';

export interface VoiceBadgeProps {
  displayName: string;
  avatarColor: string;
  isSpeaking: boolean;
}

export function VoiceBadge({
  displayName,
  avatarColor,
  isSpeaking,
}: VoiceBadgeProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <style>{`
        .voice-badge {
          width: 20px;
          height: 20px;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-sans);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-inverse);
          flex-shrink: 0;
          transition: all var(--duration-fast) var(--ease-standard);
          user-select: none;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .voice-badge--speaking {
          animation: voice-presence-ring 1.8s ease-in-out infinite;
        }

        @keyframes voice-presence-ring {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35), 0 0 8px rgba(16, 185, 129, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
          }
        }
      `}</style>
      <span
        className={`voice-badge ${isSpeaking ? 'voice-badge--speaking' : ''}`}
        style={{
          backgroundColor: avatarColor,
        }}
        title={`${displayName} (${isSpeaking ? 'speaking' : 'silent'})`}
        aria-label={`${displayName} (${isSpeaking ? 'speaking' : 'silent'})`}
      >
        {initial}
      </span>
    </>
  );
}
