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
          width: 22px;
          height: 22px;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: var(--weight-bold);
          color: var(--text-inverse);
          flex-shrink: 0;
          transition: transform var(--duration-fast) var(--ease-standard);
          user-select: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .voice-badge--speaking {
          animation: voice-pulse 1.6s ease-in-out infinite;
        }
        @keyframes voice-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 212, 162, 0.4);
          }
          50% {
            box-shadow: 0 0 0 3px rgba(59, 212, 162, 0.25), 0 0 8px rgba(59, 212, 162, 0.3);
          }
        }
      `}</style>
      <span
        className={`voice-badge ${isSpeaking ? 'voice-badge--speaking' : ''}`}
        style={{
          backgroundColor: avatarColor,
          color: 'var(--text-inverse)',
        }}
        title={`${displayName} (${isSpeaking ? 'speaking' : 'silent'})`}
        aria-label={`${displayName} (${isSpeaking ? 'speaking' : 'silent'})`}
      >
        {initial}
      </span>
    </>
  );
}
