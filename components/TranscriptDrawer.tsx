'use client';

import React, { useEffect, useRef } from 'react';

export interface TranscriptEntry {
  id: string;
  speakerName: string;
  timestamp: number;
  text: string;
}

export interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TranscriptEntry[];
}

export function TranscriptDrawer({
  isOpen,
  onClose,
  entries,
}: TranscriptDrawerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-scroll to bottom when new entries arrive while open
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isOpen]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toTimeString().split(' ')[0];
  };

  return (
    <>
      <style>{`
        .transcript-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 900;
          opacity: 0;
          pointer-events: none;
          transition: opacity var(--duration-normal) var(--ease-arrive);
        }

        .transcript-drawer-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .transcript-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: auto;
          width: min(440px, 92vw);
          height: 100vh;
          max-height: 100vh;
          background: var(--bg-glass-panel);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid var(--border-glass);
          border-top: none;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
          z-index: 901;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1);
          font-family: var(--font-sans);
        }

        .transcript-drawer.is-open {
          transform: translateX(0);
        }

        .transcript-drawer__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-4);
          background: var(--bg-glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-glass);
          flex-shrink: 0;
          gap: var(--space-2);
        }

        .transcript-drawer__title-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: 0;
        }

        .transcript-drawer__icon {
          display: flex;
          align-items: center;
          color: var(--color-aura);
          flex-shrink: 0;
        }

        .transcript-drawer__title {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-primary);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .transcript-drawer__count {
          background: var(--bg-glass-raised);
          color: var(--color-aura);
          border: 1px solid var(--border-glass);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          font-family: var(--font-mono);
          font-size: 10px;
          flex-shrink: 0;
        }

        .transcript-drawer__close-btn {
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          padding: 4px 10px;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          cursor: pointer;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all var(--duration-fast);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .transcript-drawer__close-btn:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
          border-color: var(--border-glass-emphasis);
        }

        .transcript-drawer__body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-3);
          scroll-behavior: smooth;
          display: flex;
          flex-direction: column;
        }

        .transcript-drawer__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8) var(--space-4);
          text-align: center;
          color: var(--text-muted);
          background: var(--bg-glass);
          border: 1px dashed var(--border-glass);
          border-radius: var(--radius-md);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          margin: auto var(--space-2);
        }

        .transcript-drawer__empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-2);
          color: var(--color-aura);
          opacity: 0.6;
        }

        .transcript-drawer__empty p {
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0 0 var(--space-1) 0;
        }

        .transcript-drawer__empty-sub {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          color: var(--text-muted);
          line-height: var(--leading-normal);
        }

        .transcript-drawer__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .transcript-drawer__item {
          background: var(--bg-glass-raised);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          padding: var(--space-2h) var(--space-3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: var(--shadow-card);
          transition: all var(--duration-fast);
        }

        .transcript-drawer__item:hover {
          background: var(--bg-glass-hover);
          border-color: var(--border-glass-emphasis);
          transform: translateY(-1px);
        }

        .transcript-drawer__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 3px;
        }

        .transcript-drawer__speaker {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: var(--weight-semibold);
          color: var(--color-aura);
        }

        .transcript-drawer__time {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }

        .transcript-drawer__text {
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: var(--text-primary);
          line-height: var(--leading-normal);
          margin: 0;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`transcript-drawer-backdrop ${isOpen ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <section
        className={`transcript-drawer ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-drawer-title"
      >
        <header className="transcript-drawer__header">
          <div className="transcript-drawer__title-group">
            <span className="transcript-drawer__icon">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <h2 id="transcript-drawer-title" className="transcript-drawer__title">
              VOICE TRANSCRIPT LOG
            </h2>
            <span className="transcript-drawer__count">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <button
            type="button"
            className="transcript-drawer__close-btn"
            onClick={onClose}
            aria-label="Close transcript drawer"
          >
            ✕ Close
          </button>
        </header>

        <div className="transcript-drawer__body" ref={scrollContainerRef}>
          {entries.length === 0 ? (
            <div className="transcript-drawer__empty">
              <span className="transcript-drawer__empty-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                  <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </span>
              <p>No voice transmissions recorded yet.</p>
              <span className="transcript-drawer__empty-sub">
                Transcripts will populate automatically as incident responders transmit over the voice bridge.
              </span>
            </div>
          ) : (
            <div className="transcript-drawer__list">
              {entries.map((entry) => (
                <div key={entry.id} className="transcript-drawer__item">
                  <div className="transcript-drawer__meta">
                    <span className="transcript-drawer__speaker">
                      {entry.speakerName}
                    </span>
                    <span className="transcript-drawer__time">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="transcript-drawer__text">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
