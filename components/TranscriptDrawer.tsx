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
            <span className="transcript-drawer__icon">📜</span>
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
              <span className="transcript-drawer__empty-icon">📡</span>
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
