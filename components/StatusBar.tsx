'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Severity, IncidentStatus, OODAPhase } from '@/lib/types';
import { CostCounter } from './CostCounter';
import styles from './StatusBar.module.css';

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
  voiceLang?: string;
  onVoiceLangChange?: (newLang: string) => void;
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
  voiceLang = 'en-IN',
  onVoiceLangChange,
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

  const sevColors: Record<Severity, { pip: string; glow: string; text: string }> = {
    'SEV-0': { pip: 'var(--color-sev0)', glow: 'rgba(244, 63, 94, 0.4)', text: 'var(--color-sev0)' },
    'SEV-1': { pip: 'var(--color-sev1)', glow: 'rgba(249, 115, 22, 0.4)', text: 'var(--color-sev1)' },
    'SEV-2': { pip: 'var(--color-sev2)', glow: 'rgba(245, 158, 11, 0.4)', text: 'var(--color-sev2)' },
    'SEV-3': { pip: 'var(--color-sev3)', glow: 'transparent', text: 'var(--text-secondary)' },
  };

  const currentSev = sevColors[severity] || sevColors['SEV-1'];

  const oodaPhases: Array<'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT'> = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT'];
  const isResolved = currentOODAPhase === 'RESOLVED';
  const currentOODAIndex = isResolved ? 4 : oodaPhases.indexOf(currentOODAPhase as 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT');

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
        .precision-bar {
          grid-area: status;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-hairline);
          box-shadow: var(--shadow-inner-glow);
          height: 48px;
          min-height: 48px;
          max-height: 48px;
          z-index: var(--z-sticky);
          user-select: none;
          gap: 12px;
          box-sizing: border-box;
        }

        .precision-bar__left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1 1 0%;
          min-width: 0;
          overflow: hidden;
        }

        .precision-bar__brand {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .precision-bar__brand-text {
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--text-primary);
        }

        .precision-bar__sep {
          color: var(--text-disabled);
          font-size: 11px;
          user-select: none;
          flex-shrink: 0;
          opacity: 0.5;
        }

        .precision-bar__id {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          background: var(--bg-surface-raised);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-hairline);
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }

        .precision-bar__sev {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          color: var(--text-secondary);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .precision-bar__sev-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .precision-bar__title {
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.015em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0;
          line-height: 1.2;
        }

        .precision-bar__center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .precision-bar__stepper {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-surface-raised);
          padding: 3px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-hairline);
          box-shadow: var(--shadow-inner-glow);
        }

        .precision-bar__step {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          transition: color 150ms ease;
          user-select: none;
        }

        .precision-bar__step--active {
          color: var(--text-primary);
          font-weight: 600;
        }

        .precision-bar__step--completed {
          color: var(--text-secondary);
        }

        .precision-bar__pip {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--text-disabled);
          display: inline-block;
        }

        .precision-bar__step--completed .precision-bar__pip {
          background: var(--text-secondary);
        }

        .precision-bar__step--active .precision-bar__pip {
          background: var(--color-aura);
          box-shadow: 0 0 5px var(--color-aura);
        }

        .precision-bar__arrow {
          color: var(--text-disabled);
          font-size: 9px;
          user-select: none;
          opacity: 0.4;
        }

        .precision-bar__right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1 1 0%;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .precision-bar__timer {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          box-shadow: var(--shadow-inner-glow);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .precision-bar__ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          box-shadow: var(--shadow-inner-glow);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .precision-bar__ghost-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-emphasis);
          background: var(--bg-surface-hover);
        }

        .precision-bar__ic {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-standard);
          border: 1px solid var(--border-hairline);
        }

        .precision-bar__ic--locked {
          background: var(--bg-surface-raised);
          color: var(--color-aura);
          font-weight: 500;
        }

        .precision-bar__ic--claim {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-weight: 500;
          cursor: pointer;
        }

        .precision-bar__ic--claim:hover {
          border-color: var(--border-emphasis);
          background: var(--bg-surface-hover);
        }
      `}</style>
      <header className={`precision-bar ${styles.statusBar}`} role="banner">
        {/* Left Section: Breadcrumb with Brand + ID + Severity + Title */}
        <div className={`precision-bar__left ${styles.left}`}>
          <div className={`precision-bar__brand ${styles.brand}`}>
            <span className={styles.brandMark} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 2 22 22 22 12 2" stroke="var(--color-aura)" fill="rgba(245, 158, 11, 0.15)" />
                <circle cx="12" cy="15" r="2.5" fill="var(--color-aura)" />
              </svg>
            </span>
            <span className={`precision-bar__brand-text ${styles.brandText}`}>AURA</span>
          </div>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <span className={`precision-bar__id ${styles.incidentId}`}>INC-492</span>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <span className={`precision-bar__sev ${styles.severity}`}>
            <span
              className={`precision-bar__sev-pip ${styles.sevDot}`}
              style={{ backgroundColor: currentSev.pip, boxShadow: `0 0 4px ${currentSev.glow}` }}
              aria-hidden="true"
            />
            <span style={{ color: currentSev.text }}>{severity}</span>
          </span>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <h1 className={`precision-bar__title ${styles.title}`} title={incidentTitle}>
            {incidentTitle}
          </h1>
        </div>

        {/* Center Section: Enterprise OODA Breadcrumb Stepper */}
        <div className={`precision-bar__center ${styles.center}`}>
          <nav className="precision-bar__stepper" aria-label="Incident OODA Phase Progression">
            {oodaPhases.map((phase, idx) => {
              const isActive = !isResolved && currentOODAPhase === phase;
              const isCompleted = isResolved || idx < currentOODAIndex;
              return (
                <React.Fragment key={phase}>
                  {idx > 0 && <span className="precision-bar__arrow" aria-hidden="true">→</span>}
                  <span
                    className={`precision-bar__step ${
                      isActive
                        ? 'precision-bar__step--active'
                        : isCompleted
                        ? 'precision-bar__step--completed'
                        : ''
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className="precision-bar__pip" aria-hidden="true" />
                    <span>{phase}</span>
                  </span>
                </React.Fragment>
              );
            })}

            {isResolved && (
              <>
                <span className="precision-bar__arrow" aria-hidden="true">→</span>
                <span className="precision-bar__step precision-bar__step--active" aria-current="step">
                  <span className="precision-bar__pip" style={{ background: 'var(--color-fact)' }} aria-hidden="true" />
                  <span style={{ color: 'var(--color-fact)' }}>RESOLVED</span>
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Right Section: Cost + Timer + IC Lock + Theme Toggle + Connection */}
        <div className={`precision-bar__right ${styles.right}`}>
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
            className={`precision-bar__timer ${styles.timer}`}
            title="Elapsed incident duration"
            aria-label={`Elapsed time: ${formatTimer(elapsedSeconds)}`}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            className={`precision-bar__ghost-btn ${styles.themeBtn}`}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'light' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {onVoiceLangChange && (
            <button
              type="button"
              className="precision-bar__ghost-btn"
              style={{ width: 'auto', padding: '0 6px', fontSize: '10px', gap: '4px', fontFamily: 'var(--font-mono)' }}
              onClick={() => onVoiceLangChange(voiceLang === 'en-IN' ? 'en-US' : 'en-IN')}
              title={`Voice Model: ${voiceLang === 'en-IN' ? 'Indian English (en-IN)' : 'US English (en-US)'}. Click to toggle.`}
              aria-label="Toggle voice model language"
            >
              <span>{voiceLang === 'en-IN' ? '🇮🇳 IN' : '🇺🇸 US'}</span>
            </button>
          )}

          {icName ? (
            <div
              className={`precision-bar__ic precision-bar__ic--locked ${styles.ic} ${styles.icLocked}`}
              title={`Incident Commander: ${icName}`}
            >
              <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.8 }}>
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
              className={`precision-bar__ic precision-bar__ic--claim ${styles.ic} ${styles.icClaim}`}
              onClick={onClaimIC}
              title="Claim Incident Commander role"
            >
              Claim IC
            </button>
          )}

          <div
            className={styles.connMeter}
            title={`Connection quality: ${connectionQuality}`}
            aria-label={`Connection quality: ${connectionQuality}`}
          >
            <span
              className={`${styles.connDot} ${activeDots >= 1 ? styles.connDotActive : ''}`}
              style={activeDots >= 1 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
            <span
              className={`${styles.connDot} ${activeDots >= 2 ? styles.connDotActive : ''}`}
              style={activeDots >= 2 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
            <span
              className={`${styles.connDot} ${activeDots >= 3 ? styles.connDotActive : ''}`}
              style={activeDots >= 3 ? { backgroundColor: connectionColor, color: connectionColor } : undefined}
            />
          </div>
        </div>
      </header>
    </>
  );
}
