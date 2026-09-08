'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springs } from '@/lib/springs';
import { ClassificationType } from '@/lib/types';

export interface QuickCapturePayload {
  category: ClassificationType;
  content: string;
}

export interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: QuickCapturePayload) => void;
  speakerName: string;
}

const COMMAND_MAP: Record<string, ClassificationType> = {
  '/fact': 'fact',
  '/f': 'fact',
  '/hypothesis': 'hypothesis',
  '/hyp': 'hypothesis',
  '/h': 'hypothesis',
  '/decision': 'decision',
  '/dec': 'decision',
  '/d': 'decision',
  '/action': 'action',
  '/act': 'action',
  '/a': 'action',
};

const CATEGORY_META: Record<ClassificationType, { label: string; color: string; icon: string; hint: string }> = {
  fact: { label: 'Fact', color: 'var(--color-fact)', icon: '◆', hint: 'A confirmed, observed data point' },
  hypothesis: { label: 'Hypothesis', color: 'var(--color-hypothesis)', icon: '◈', hint: 'A theory that needs validation' },
  decision: { label: 'Decision', color: 'var(--color-decision)', icon: '◉', hint: 'An authoritative team directive' },
  action: { label: 'Action', color: 'var(--color-action)', icon: '▶', hint: 'A task assigned to someone' },
  conflict: { label: 'Conflict', color: 'var(--color-conflict)', icon: '⚡', hint: 'A contradiction to flag' },
};

const SUGGESTIONS: Array<{ prefix: string; example: string; category: ClassificationType }> = [
  { prefix: '/fact', example: 'DB connection pool at 100% utilization', category: 'fact' },
  { prefix: '/hypothesis', example: 'PR #492 may be causing pool starvation', category: 'hypothesis' },
  { prefix: '/decision', example: 'Rolling back PR #492 immediately', category: 'decision' },
  { prefix: '/action', example: '@marcus verify replica lag on postgres-primary', category: 'action' },
];

function parseInput(value: string): { category: ClassificationType | null; content: string } {
  const trimmed = value.trim();
  for (const [cmd, cat] of Object.entries(COMMAND_MAP)) {
    if (trimmed.toLowerCase().startsWith(cmd + ' ') || trimmed.toLowerCase() === cmd) {
      return { category: cat, content: trimmed.slice(cmd.length).trim() };
    }
  }
  return { category: null, content: trimmed };
}

export function QuickCapture({ isOpen, onClose, onSubmit, speakerName }: QuickCaptureProps) {
  const [value, setValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ClassificationType>('fact');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { category: detectedCategory, content } = parseInput(value);
  const effectiveCategory = detectedCategory ?? selectedCategory;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
      setValue('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Please enter some content.');
      return;
    }
    onSubmit({ category: effectiveCategory, content: trimmed });
    setValue('');
    setError(null);
    onClose();
  }, [content, effectiveCategory, onSubmit, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (sug: typeof SUGGESTIONS[0]) => {
    setValue(sug.prefix + ' ' + sug.example);
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const meta = CATEGORY_META[effectiveCategory];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="quick-capture-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="quick-capture-modal"
            initial={{ opacity: 0, y: -24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={springs.stiff}
            role="dialog"
            aria-label="Quick evidence capture"
          >
            {/* Top bar */}
            <div className="qc-top">
              <span className="qc-label">⚡ AURA Quick Capture</span>
              <span className="qc-speaker">as {speakerName}</span>
            </div>

            {/* Input row */}
            <div
              className="qc-input-row"
              style={{ '--qc-accent': meta.color } as React.CSSProperties}
            >
              <div className="qc-category-indicator" title={meta.hint}>
                <span className="qc-cat-icon" style={{ color: meta.color }}>{meta.icon}</span>
                <span className="qc-cat-label" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <input
                ref={inputRef}
                className="qc-input"
                placeholder='Type /fact, /hypothesis, /decision, or /action followed by content…'
                value={value}
                onChange={e => { setValue(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="qc-submit" onClick={handleSubmit} title="Submit (Enter)">
                ↵
              </button>
            </div>

            {error && <p className="qc-error">{error}</p>}

            {/* Category quick-select buttons */}
            <div className="qc-cat-row">
              {(Object.entries(CATEGORY_META) as Array<[ClassificationType, typeof CATEGORY_META[ClassificationType]]>)
                .filter(([k]) => k !== 'conflict')
                .map(([cat, m]) => (
                  <button
                    key={cat}
                    className={`qc-cat-btn ${effectiveCategory === cat && !detectedCategory ? 'qc-cat-btn--active' : ''}`}
                    style={{ '--cat-color': m.color } as React.CSSProperties}
                    onClick={() => setSelectedCategory(cat as ClassificationType)}
                    title={m.hint}
                  >
                    <span style={{ color: m.color }}>{m.icon}</span> {m.label}
                  </button>
                ))}
            </div>

            {/* Suggestions */}
            {!value && (
              <div className="qc-suggestions">
                <p className="qc-suggestions-label">Examples</p>
                {SUGGESTIONS.map(sug => (
                  <button key={sug.prefix} className="qc-suggestion" onClick={() => handleSuggestionClick(sug)}>
                    <span className="qc-sug-prefix" style={{ color: CATEGORY_META[sug.category].color }}>{sug.prefix}</span>
                    <span className="qc-sug-text">{sug.example}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="qc-footer">
              <kbd>Enter</kbd> to submit &nbsp;·&nbsp; <kbd>Esc</kbd> to dismiss &nbsp;·&nbsp;
              Use <kbd>/fact</kbd> <kbd>/hyp</kbd> <kbd>/dec</kbd> <kbd>/action</kbd> prefixes
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
