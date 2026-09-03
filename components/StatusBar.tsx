'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Severity, IncidentStatus, OODAPhase } from '@/lib/types';
import { OODAIndicator } from './OODAIndicator';
import { CostCounter } from './CostCounter';

const subscribeTheme = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

const getThemeSnapshot = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('aura-theme') as 'dark' | 'light') || 'dark';
};

const getServerThemeSnapshot = (): 'dark' | 'light' => 'dark';

export interface StatusBarProps {
  incidentTitle: string;
  severity: Severity;
  status: IncidentStatus;
  openedAt: number;
  resolvedAt?: number;
  currentOODAPhase: OODAPhase;
  icName: string | null;
  connectionQuality: 'excellent' | 'good' | 'poor';
  onClaimIC?: () => void;
  costRate?: number;
  onRateChange?: (newRate: number) => void;
  isCostPaused?: boolean;
  onToggleCostPause?: () => void;
}

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StatusBar({
  incidentTitle,
  severity,
  status,
  openedAt,
  resolvedAt,
  currentOODAPhase,
  icName,
  connectionQuality,
  onClaimIC,
  costRate,
  onRateChange,
  isCostPaused,
  onToggleCostPause,
}: StatusBarProps) {
  const [activeElapsed, setActiveElapsed] = useState<number>(0);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('aura-theme', next);
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (status === 'resolved') {
      return;
    }

    const tick = () => {
      setActiveElapsed(Math.max(0, Math.floor((Date.now() - openedAt) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, openedAt]);

  const elapsedSeconds =
    status === 'resolved' && resolvedAt !== undefined
      ? Math.max(0, Math.floor((resolvedAt - openedAt) / 1000))
      : activeElapsed;

  const severityClass = {
    'SEV-0': 'status-bar__severity--sev0',
    'SEV-1': 'status-bar__severity--sev1',
    'SEV-2': 'status-bar__severity--sev2',
    'SEV-3': 'status-bar__severity--sev3',
  }[severity] ?? 'status-bar__severity--sev1';

  const connectionColor = {
    excellent: 'var(--color-fact)',
    good: 'var(--color-orient)',
    poor: 'var(--color-conflict)',
  }[connectionQuality];

  const activeDots = {
    excellent: 3,
    good: 2,
    poor: 1,
  }[connectionQuality] ?? 2;

  return (
    <>
      <style>{`
        .status-bar {
          grid-area: status;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-4);
          background: var(--bg-glass-panel);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-glass);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
          height: 52px;
          z-index: var(--z-sticky);
          user-select: none;
        }

        .status-bar__left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          min-width: 0;
        }

        .status-bar__severity {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: var(--radius-md);
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
          border: 1px solid transparent;
        }

        .status-bar__sev-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: sev-pulse 1.8s ease-in-out infinite;
        }

        .status-bar__severity--sev0 {
          background: rgba(232, 84, 84, 0.15);
          color: var(--color-sev0);
          border-color: rgba(232, 84, 84, 0.3);
        }
        .status-bar__severity--sev1 {
          background: rgba(232, 125, 62, 0.15);
          color: var(--color-sev1);
          border-color: rgba(232, 125, 62, 0.3);
        }
        .status-bar__severity--sev2 {
          background: rgba(232, 168, 56, 0.15);
          color: var(--color-sev2);
          border-color: rgba(232, 168, 56, 0.3);
        }
        .status-bar__severity--sev3 {
          background: rgba(142, 138, 157, 0.15);
          color: var(--text-secondary);
          border-color: var(--border-glass);
        }

        @keyframes sev-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        .status-bar__title {
          font-family: var(--font-sans);
          font-size: var(--text-md);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-bar__center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .status-bar__right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .status-bar__timer {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: var(--weight-medium);
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .status-bar__ic {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          padding: 4px 8px;
          border-radius: var(--radius-md);
          white-space: nowrap;
        }

        .status-bar__ic--locked {
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          color: var(--color-aura);
          font-weight: var(--weight-medium);
        }

        .status-bar__ic--claim {
          background: var(--bg-glass);
          border: 1px solid var(--color-decision-border);
          color: var(--color-decision);
          font-weight: var(--weight-semibold);
          cursor: pointer;
          transition: background var(--duration-fast) var(--ease-standard);
        }

        .status-bar__ic--claim:hover {
          background: var(--color-decision);
          color: var(--text-inverse);
        }

        .status-bar__theme-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .status-bar__theme-btn:hover {
          color: var(--color-aura);
          border-color: var(--border-glass-emphasis);
          background: var(--bg-glass-hover);
        }

        .status-bar__conn-meter {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 4px 6px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .status-bar__conn-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--border-subtle);
          transition: background-color 0.3s ease;
        }

        .status-bar__conn-dot--active {
          box-shadow: 0 0 4px currentColor;
        }
      `}</style>
      <header className="status-bar" role="banner">
        {/* Left Section: Severity + Incident Title */}
        <div className="status-bar__left">
          <span className={`status-bar__severity ${severityClass}`}>
            <span className="status-bar__sev-dot" aria-hidden="true" /> {severity}
          </span>
          <h1 className="status-bar__title" title={incidentTitle}>
            {incidentTitle}
          </h1>
        </div>

        {/* Center Section: OODA Indicator */}
        <div className="status-bar__center">
          <OODAIndicator currentPhase={currentOODAPhase} />
        </div>

        {/* Right Section: Cost + Timer + IC Lock + Theme Toggle + Connection */}
        <div className="status-bar__right">
          <CostCounter
            incidentStatus={status}
            openedAt={openedAt}
            resolvedAt={resolvedAt}
            baseRate={costRate}
            onRateChange={onRateChange}
            isPaused={isCostPaused}
            onTogglePause={onToggleCostPause}
          />

          <div
            className="status-bar__timer"
            title="Elapsed incident duration"
            aria-label={`Elapsed time: ${formatTimer(elapsedSeconds)}`}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            className="status-bar__theme-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'light' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {icName ? (
            <div
              className="status-bar__ic status-bar__ic--locked"
              title={`Incident Commander: ${icName}`}
            >
              <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <span>{icName} (IC)</span>
            </div>
          ) : (
            <button
              type="button"
              className="status-bar__ic status-bar__ic--claim"
              onClick={onClaimIC}
              title="Claim Incident Commander role"
            >
              Claim IC
            </button>
          )}

          <div
            className="status-bar__conn-meter"
            title={`Connection quality: ${connectionQuality}`}
            aria-label={`Connection quality: ${connectionQuality}`}
          >
            <span
              className={`status-bar__conn-dot ${activeDots >= 1 ? 'status-bar__conn-dot--active' : ''}`}
              style={activeDots >= 1 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
            <span
              className={`status-bar__conn-dot ${activeDots >= 2 ? 'status-bar__conn-dot--active' : ''}`}
              style={activeDots >= 2 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
            <span
              className={`status-bar__conn-dot ${activeDots >= 3 ? 'status-bar__conn-dot--active' : ''}`}
              style={activeDots >= 3 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
          </div>
        </div>
      </header>
    </>
  );
}
