'use client';

import React from 'react';

export interface LiveCaptionsProps {
  currentSpeakerName: string | null;
  currentTranscript: string;
  onToggleTranscriptDrawer?: () => void;
}

export function LiveCaptions({
  currentSpeakerName,
  currentTranscript,
  onToggleTranscriptDrawer,
}: LiveCaptionsProps) {
  const hasContent = Boolean(currentSpeakerName || currentTranscript);

  return (
    <>
      <style>{`
        .live-captions {
          height: 100%;
          width: 100%;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          gap: var(--space-3);
          user-select: none;
          overflow: hidden;
        }

        .live-captions__content {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: 0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: var(--font-mono);
          font-size: var(--text-sm);
        }

        .live-captions__icon {
          display: flex;
          align-items: center;
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .live-captions__speaker {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: var(--weight-bold);
          color: var(--color-aura);
          background: var(--color-aura-dim);
          border: 1px solid rgba(212, 168, 83, 0.25);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .live-captions__text {
          color: var(--text-primary);
          letter-spacing: 0.02em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          flex-shrink: 1;
        }

        .live-captions__cursor {
          display: inline-block;
          width: 6px;
          height: 13px;
          background: var(--color-aura);
          margin-left: 3px;
          vertical-align: middle;
          animation: cursor-blink 1s steps(2, start) infinite;
          flex-shrink: 0;
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .live-captions__standby {
          color: var(--text-muted);
          font-style: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        .live-captions__drawer-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          margin-left: var(--space-3);
          z-index: 5;
          transition: background var(--duration-fast) var(--ease-standard),
                      color var(--duration-fast) var(--ease-standard);
        }

        .live-captions__drawer-btn:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
          border-color: var(--border-emphasis);
        }
      `}</style>
      <div
        className="live-captions"
        role="region"
        aria-live="polite"
        aria-label="Real-time speech transcription"
      >
        <div className="live-captions__content">
          <span className="live-captions__icon" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </span>
          {hasContent ? (
            <>
              {currentSpeakerName && (
                <span className="live-captions__speaker">
                  {currentSpeakerName}
                </span>
              )}
              <span className="live-captions__text">
                &ldquo;{currentTranscript}&rdquo;
              </span>
              <span className="live-captions__cursor" aria-hidden="true" />
            </>
          ) : (
            <span className="live-captions__standby">
              Awaiting voice activity on tactical bridge...
            </span>
          )}
        </div>

        {onToggleTranscriptDrawer && (
          <button
            type="button"
            className="live-captions__drawer-btn"
            onClick={onToggleTranscriptDrawer}
            title="Toggle Full Transcript Drawer (Press J)"
          >
            <span>Log</span>
            <kbd className="keyboard-hint-badge">J</kbd>
          </button>
        )}
      </div>
    </>
  );
}
