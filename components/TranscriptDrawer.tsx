'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.speakerName.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  // Auto-scroll to bottom when new entries arrive while open (and not searching)
  useEffect(() => {
    if (isOpen && !searchQuery && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isOpen, searchQuery]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isAuraSpeaker = (name: string) => {
    const n = name.toLowerCase();
    return n.includes('aura') || n.includes('ai commander') || n.includes('agent');
  };

  return (
    <>
      <style>{`
        .transcript-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(4, 5, 8, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 900;
          opacity: 0;
          pointer-events: none;
          transition: opacity 220ms ease;
        }

        .transcript-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .transcript-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(460px, 94vw);
          height: 100vh;
          background: #0A0C10;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: -12px 0 40px rgba(0, 0, 0, 0.7);
          z-index: 901;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
          font-family: var(--font-sans);
          color: var(--text-primary);
        }

        .transcript-panel.is-open {
          transform: translateX(0);
        }

        /* ─── Header ─── */
        .transcript-header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.125rem 1.25rem;
          background: #0E1015;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
        }

        .transcript-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .transcript-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .transcript-title {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-primary);
          margin: 0;
        }

        .transcript-count-badge {
          background: #14171E;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--color-aura);
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          font-family: var(--font-mono);
          font-size: 0.625rem;
          font-weight: 600;
        }

        .transcript-close-btn {
          background: #14171E;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          border-radius: var(--radius-md);
          padding: 0.35rem 0.75rem;
          font-size: 0.6875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 140ms ease;
        }

        .transcript-close-btn:hover {
          background: #1C202B;
          color: var(--text-primary);
        }

        /* Search Filter */
        .transcript-search-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #12151D;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: var(--radius-md);
          padding: 0.4rem 0.75rem;
          transition: border-color 140ms ease;
        }

        .transcript-search-wrap:focus-within {
          border-color: var(--color-aura);
        }

        .transcript-search-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.75rem;
          outline: none;
          width: 100%;
        }

        .transcript-search-input::placeholder {
          color: var(--text-muted);
        }

        /* ─── Body Stream ─── */
        .transcript-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
        }

        /* Conversational Bubble */
        .transcript-bubble {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.75rem 0.875rem;
          border-radius: var(--radius-lg);
          background: #0E1117;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          transition: all 140ms ease;
        }

        .transcript-bubble:hover {
          background: #131620;
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* AURA AI Special Card */
        .transcript-bubble--aura {
          background: linear-gradient(180deg, rgba(212, 168, 83, 0.08) 0%, #0E1117 100%);
          border-color: rgba(212, 168, 83, 0.3);
          border-left: 3px solid var(--color-aura);
        }

        .transcript-bubble-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .transcript-speaker-row {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .transcript-speaker-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6366F1;
        }

        .transcript-speaker-dot--aura {
          background: var(--color-aura);
          box-shadow: 0 0 6px var(--color-aura);
        }

        .transcript-speaker-name {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .transcript-speaker-name--aura {
          color: var(--color-aura);
        }

        .transcript-aura-badge {
          font-family: var(--font-mono);
          font-size: 0.5625rem;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: var(--radius-sm);
          background: rgba(212, 168, 83, 0.15);
          border: 1px solid rgba(212, 168, 83, 0.3);
          color: var(--color-aura);
          letter-spacing: 0.04em;
        }

        .transcript-timestamp {
          font-family: var(--font-mono);
          font-size: 0.625rem;
          color: var(--text-muted);
        }

        .transcript-message-text {
          font-size: 0.8125rem;
          color: var(--text-primary);
          line-height: 1.45;
          margin: 0;
        }

        .transcript-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          text-align: center;
          gap: 0.75rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.015);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          margin: auto 0;
        }

        .transcript-empty-desc {
          font-size: 0.75rem;
          line-height: 1.45;
          max-width: 260px;
          margin: 0;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`transcript-backdrop ${isOpen ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <section
        className={`transcript-panel ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-panel-title"
      >
        <header className="transcript-header">
          <div className="transcript-top-row">
            <div className="transcript-title-group">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--color-aura)' }}
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <h2 id="transcript-panel-title" className="transcript-title">
                Voice Transcript Log
              </h2>
              <span className="transcript-count-badge">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <button
              type="button"
              className="transcript-close-btn"
              onClick={onClose}
              aria-label="Close transcript drawer"
            >
              ✕ Close
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="transcript-search-wrap">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter by speaker or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="transcript-search-input"
              aria-label="Filter transcript entries"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </header>

        <div className="transcript-body" ref={scrollContainerRef}>
          {filteredEntries.length === 0 ? (
            <div className="transcript-empty">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--color-aura)', opacity: 0.6 }}
                aria-hidden="true"
              >
                <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                {searchQuery ? 'No matching transmissions' : 'No transmissions recorded yet'}
              </p>
              <p className="transcript-empty-desc">
                {searchQuery
                  ? `No transmissions match "${searchQuery}". Clear query to view all.`
                  : 'Transcripts populate automatically as responders transmit over the Agora voice channel.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isAura = isAuraSpeaker(entry.speakerName);

              return (
                <div
                  key={entry.id}
                  className={`transcript-bubble ${isAura ? 'transcript-bubble--aura' : ''}`}
                >
                  <div className="transcript-bubble-top">
                    <div className="transcript-speaker-row">
                      <span
                        className={`transcript-speaker-dot ${isAura ? 'transcript-speaker-dot--aura' : ''}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`transcript-speaker-name ${isAura ? 'transcript-speaker-name--aura' : ''}`}
                      >
                        {entry.speakerName}
                      </span>
                      {isAura && <span className="transcript-aura-badge">AI COMMANDER</span>}
                    </div>
                    <span className="transcript-timestamp">{formatTime(entry.timestamp)}</span>
                  </div>
                  <p className="transcript-message-text">{entry.text}</p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
