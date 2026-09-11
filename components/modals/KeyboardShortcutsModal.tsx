'use client';

import React, { useEffect } from 'react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutGroup {
  category: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Panels & Layout',
    items: [
      { key: '[', description: 'Toggle Left Voice Bridge Rail (48px / 280px)' },
      { key: ']', description: 'Toggle Right Mitigating Actions Rail (48px / 290px)' },
      { key: '\\', description: 'Dual-Rail Focus Mode (Collapse both for 1430px canvas)' },
    ],
  },
  {
    category: 'Audio & Mission Control',
    items: [
      { key: 'Space', description: 'Push-to-Talk (Hold while speaking to stream audio)' },
      { key: 'J', description: 'Toggle Live Speech-to-Text Transcript Drawer' },
    ],
  },
  {
    category: 'Investigation Canvas',
    items: [
      { key: 'T', description: 'Switch between Incident Timeline and Topology Graph' },
      { key: '?', description: 'Toggle this Command-Center Hotkey Cheat Sheet' },
      { key: 'Esc', description: 'Close any active modal, drawer, or quick menu' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .shortcut-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 5, 8, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: shortcut-fade-in 150ms ease-out forwards;
        }

        @keyframes shortcut-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        .shortcut-modal {
          width: 520px;
          max-width: 92vw;
          background: var(--bg-surface-raised, #111015);
          border: 1px solid var(--border-default, rgba(255, 255, 255, 0.1));
          border-radius: var(--radius-md, 8px);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65), var(--shadow-inner-glow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .shortcut-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: var(--bg-surface, #0E0D12);
          border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
        }

        .shortcut-modal__title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .shortcut-modal__icon {
          color: var(--color-aura, #D4A853);
          display: flex;
          align-items: center;
        }

        .shortcut-modal__title {
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--text-primary, #EDECEF);
          margin: 0;
          text-transform: uppercase;
        }

        .shortcut-modal__badge {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.3);
          color: var(--color-aura, #D4A853);
          border-radius: 3px;
        }

        .shortcut-modal__close-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted, #7A7885);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all var(--duration-fast);
        }

        .shortcut-modal__close-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .shortcut-modal__body {
          padding: 16px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 70vh;
          overflow-y: auto;
        }

        .shortcut-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .shortcut-group__title {
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted, #7A7885);
          margin: 0;
        }

        .shortcut-group__list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .shortcut-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 4px;
        }

        .shortcut-row__desc {
          font-family: var(--font-sans);
          font-size: 11.5px;
          color: var(--text-secondary, #A3A0B0);
        }

        .shortcut-row__kbd {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-aura, #D4A853);
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.25);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          padding: 2px 7px;
          border-radius: 3px;
          min-width: 20px;
          text-align: center;
        }

        .shortcut-modal__footer {
          padding: 10px 20px;
          background: var(--bg-surface, #0E0D12);
          border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted, #7A7885);
        }
      `}</style>

      <div
        className="shortcut-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="shortcut-modal">
          <header className="shortcut-modal__header">
            <div className="shortcut-modal__title-group">
              <span className="shortcut-modal__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8h.001" />
                  <path d="M10 8h.001" />
                  <path d="M14 8h.001" />
                  <path d="M18 8h.001" />
                  <path d="M8 12h.001" />
                  <path d="M12 12h.001" />
                  <path d="M16 12h.001" />
                  <path d="M7 16h10" />
                </svg>
              </span>
              <h2 id="shortcut-modal-title" className="shortcut-modal__title">Command Hotkeys</h2>
              <span className="shortcut-modal__badge">OPERATIONAL CALM</span>
            </div>
            <button
              type="button"
              className="shortcut-modal__close-btn"
              onClick={onClose}
              aria-label="Close shortcuts"
            >
              [ESC]
            </button>
          </header>

          <div className="shortcut-modal__body">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.category} className="shortcut-group">
                <h3 className="shortcut-group__title">{group.category}</h3>
                <div className="shortcut-group__list">
                  {group.items.map((item) => (
                    <div key={item.key} className="shortcut-row">
                      <span className="shortcut-row__desc">{item.description}</span>
                      <kbd className="shortcut-row__kbd">{item.key}</kbd>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="shortcut-modal__footer">
            <span>NASA Mission Control Ergonomics</span>
            <span>AURA Voice Commander</span>
          </footer>
        </div>
      </div>
    </>
  );
}
