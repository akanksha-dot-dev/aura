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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <h2 id="transcript-drawer-title" className="transcript-drawer__title">
              Mission Voice Transcript Log
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
            ✕ Close [Esc]
          </button>
        </header>

        <div className="transcript-drawer__body" ref={scrollContainerRef}>
          {entries.length === 0 ? (
            <div className="transcript-drawer__empty">
              <span className="transcript-drawer__empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
