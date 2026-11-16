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

  // Detect filler word state for visual indicators
  const transcriptLower = (currentTranscript || '').trim().toLowerCase();
  const isThinking = /^(h+m+|u+h+|u+m+|e+r+m*|m+h+m+)\s*\.?\s*$/.test(transcriptLower);
  const isPausing = /^(wait|hold on|one sec|let me think|give me a moment|hang on)\s*\.?\s*$/.test(transcriptLower);
  const isDiscovery = /^(a+h+|o+h+!?|oh wait|oh!|aha)\s*\.?\s*$/.test(transcriptLower);
  const fillerState = isThinking ? 'thinking' : isPausing ? 'pausing' : isDiscovery ? 'discovery' : null;

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
          padding: 0 8px;
          gap: 8px;
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
          font-family: var(--font-sans);
          font-size: var(--text-sm);
        }

        .live-captions__icon {
          display: flex;
          align-items: center;
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .live-captions__speaker {
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: var(--weight-semibold);
          color: var(--color-aura);
          background: var(--color-aura-dim);
          border: 1px solid rgba(212, 168, 83, 0.25);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }

        .live-captions__text {
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: var(--text-primary);
          letter-spacing: 0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          flex-shrink: 1;
        }

        .live-captions__cursor {
          display: inline-block;
          width: 5px;
          height: 12px;
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

        .live-captions__wave {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          height: 12px;
          margin-left: 2px;
          flex-shrink: 0;
        }

        .live-captions__wave-bar {
          width: 2px;
          height: 3px;
          background: var(--color-aura);
          border-radius: 1px;
          animation: wave-bounce 0.8s ease-in-out infinite;
        }

        .live-captions__wave-bar:nth-child(1) { animation-delay: 0.05s; }
        .live-captions__wave-bar:nth-child(2) { animation-delay: 0.25s; }
        .live-captions__wave-bar:nth-child(3) { animation-delay: 0.15s; }

        @keyframes wave-bounce {
          0%, 100% { height: 3px; opacity: 0.4; }
          50% { height: 11px; opacity: 1; }
        }

        .live-captions__standby {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
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
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          margin-left: var(--space-3);
          z-index: 5;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .live-captions__drawer-btn:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
          border-color: var(--border-glass-emphasis);
        }

        .live-captions__filler-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          animation: filler-fade-in 0.3s ease;
          flex-shrink: 0;
        }

        .live-captions__filler-indicator--thinking {
          color: #FFA726;
          background: rgba(255, 167, 38, 0.12);
        }

        .live-captions__filler-indicator--pausing {
          color: #42A5F5;
          background: rgba(66, 165, 245, 0.12);
        }

        .live-captions__filler-indicator--discovery {
          color: #66BB6A;
          background: rgba(102, 187, 106, 0.12);
          animation: filler-flash 0.6s ease;
        }

        @keyframes filler-fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes filler-flash {
          0% { opacity: 0; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }

        .live-captions__thinking-dots {
          display: inline-flex;
          gap: 2px;
          margin-left: 2px;
        }

        .live-captions__thinking-dots span {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #FFA726;
          animation: thinking-bounce 1.2s ease-in-out infinite;
        }

        .live-captions__thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .live-captions__thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes thinking-bounce {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
      <div
        className="live-captions"
        role="region"
        aria-live="polite"
        aria-label="Real-time speech transcription"
        title={currentTranscript || undefined}
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
                <>
                  <span className="live-captions__speaker">
                    {currentSpeakerName}
                  </span>
                  <span className="live-captions__wave" aria-hidden="true">
                    <span className="live-captions__wave-bar" />
                    <span className="live-captions__wave-bar" />
                    <span className="live-captions__wave-bar" />
                  </span>
                </>
              )}
              <span className="live-captions__text">
                &ldquo;{currentTranscript}&rdquo;
              </span>
              {fillerState && (
                <span className={`live-captions__filler-indicator live-captions__filler-indicator--${fillerState}`} aria-label={`Speaker is ${fillerState}`}>
                  {fillerState === 'thinking' && (
                    <>
                      🤔
                      <span className="live-captions__thinking-dots"><span /><span /><span /></span>
                    </>
                  )}
                  {fillerState === 'pausing' && '⏸ Paused'}
                  {fillerState === 'discovery' && '💡 Found something!'}
                </span>
              )}
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
