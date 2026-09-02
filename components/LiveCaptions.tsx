'use client';

import React from 'react';

export interface LiveCaptionsProps {
  currentSpeakerName: string | null;
  currentTranscript: string;
  onToggleTranscriptDrawer: () => void;
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
          grid-area: captions;
          height: 40px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-subtle);
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: var(--text-sm);
        }

        .live-captions__icon {
          font-size: var(--text-xs);
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .live-captions__speaker {
          font-family: var(--font-sans);
          font-weight: var(--weight-semibold);
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .live-captions__text {
          color: var(--text-secondary);
          font-style: italic;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .live-captions__standby {
          color: var(--text-muted);
          font-style: normal;
        }

        .live-captions__drawer-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 2px 8px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          transition: background var(--duration-fast) var(--ease-standard),
                      color var(--duration-fast) var(--ease-standard);
        }

        .live-captions__drawer-btn:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
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
            🔊
          </span>
          {hasContent ? (
            <>
              {currentSpeakerName && (
                <span className="live-captions__speaker">
                  {currentSpeakerName}:
                </span>
              )}
              <span className="live-captions__text">
                &ldquo;{currentTranscript}&rdquo;
              </span>
            </>
          ) : (
            <span className="live-captions__standby">
              Listening to voice channel...
            </span>
          )}
        </div>

        <button
          type="button"
          className="live-captions__drawer-btn"
          onClick={onToggleTranscriptDrawer}
          title="Toggle Full Transcript Drawer"
        >
          <span>▼</span>
          <span>Full</span>
        </button>
      </div>
    </>
  );
}
