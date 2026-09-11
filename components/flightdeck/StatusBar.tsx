'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Severity, IncidentStatus, OODAPhase } from '@/lib/types';
import { CostCounter } from '@/components/indicators/CostCounter';
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
  cognitiveLoadScore?: number;
  onResolve?: () => void;
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
  cognitiveLoadScore = 0,
  onResolve,
}: StatusBarProps) {
  const [activeElapsed, setActiveElapsed] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  // AURA Pulse: status bar breathes based on cognitive load & incident status
  const pulseClass = status === 'resolved'
    ? 'status-bar--pulse-resolved'
    : cognitiveLoadScore >= 70
    ? 'status-bar--pulse-high'
    : cognitiveLoadScore >= 40
    ? 'status-bar--pulse-med'
    : 'status-bar--pulse-low';

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
          flex: 1 1 auto;
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
          flex: 1 1 auto;
          min-width: 0;
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
          gap: 7px;
          background: var(--bg-surface-raised);
          padding: 3px 9px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-hairline);
          box-shadow: var(--shadow-inner-glow);
        }

        .precision-bar__pips {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .precision-bar__pip {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-disabled);
          display: inline-block;
          transition: all 150ms ease;
        }

        .precision-bar__pip--completed {
          background: var(--text-secondary);
        }

        .precision-bar__pip--active {
          background: var(--color-aura);
          box-shadow: 0 0 5px var(--color-aura);
        }

        .precision-bar__phase-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--text-primary);
          text-transform: uppercase;
        }

        @media (max-width: 1360px) {
          .precision-bar__ic-text {
            display: none;
          }
        }

        .precision-bar__right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
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
          flex-shrink: 0;
        }

        .precision-bar__resolve-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          height: 26px;
          padding: 0 10px;
          border-radius: var(--radius-sm, 4px);
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: #10B981;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .precision-bar__resolve-btn:hover {
          background: rgba(16, 185, 129, 0.2);
          border-color: #10B981;
          color: #34D399;
        }

        .precision-bar__ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          flex-shrink: 0;
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

        .precision-bar__ghost-btn--active {
          color: var(--color-aura);
          border-color: var(--color-aura-border);
          background: var(--color-aura-dim);
        }

        .precision-bar__settings-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .precision-bar__settings-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-float);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: var(--z-modal);
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity var(--duration-fast) var(--ease-standard),
                      transform var(--duration-fast) var(--ease-standard);
        }

        .precision-bar__settings-popover--open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .precision-bar__popover-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 6px;
        }

        .precision-bar__popover-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 11px;
          padding: 2px 4px;
        }

        .precision-bar__popover-close:hover {
          color: var(--text-primary);
        }

        .precision-bar__setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .precision-bar__setting-label {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .precision-bar__setting-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .precision-bar__setting-action:hover {
          border-color: var(--color-aura);
          color: var(--color-aura);
        }

        .precision-bar__setting-status {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-fact);
          padding: 2px 6px;
          border-radius: var(--radius-xs);
          background: var(--color-fact-dim);
          border: 1px solid var(--color-fact-border);
        }
      `}</style>
      <header className={`precision-bar ${styles.statusBar} ${pulseClass}`} role="banner">
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

        {/* Center Section: Mission-Control OODA Stepper */}
        <div className={`precision-bar__center ${styles.center}`}>
          <nav className="precision-bar__stepper" aria-label="Incident OODA Phase Progression">
            <div className="precision-bar__pips" aria-hidden="true">
              {oodaPhases.map((phase, idx) => {
                const isActive = !isResolved && currentOODAPhase === phase;
                const isCompleted = isResolved || idx < currentOODAIndex;
                return (
                  <span
                    key={phase}
                    className={`precision-bar__pip ${
                      isActive
                        ? 'precision-bar__pip--active'
                        : isCompleted
                        ? 'precision-bar__pip--completed'
                        : ''
                    }`}
                    title={`Phase ${idx + 1}: ${phase}`}
                  />
                );
              })}
            </div>
            <span className="precision-bar__phase-label">
              {isResolved ? (
                <span style={{ color: 'var(--color-fact)', fontWeight: 600 }}>RESOLVED</span>
              ) : (
                <span>{currentOODAPhase}</span>
              )}
            </span>
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

          {/* SLA Badge */}
          {status !== 'resolved' && (() => {
            const SLA_MINS: Record<string, number> = { 'SEV-0': 60, 'SEV-1': 240, 'SEV-2': 1440, 'SEV-3': 4320 };
            const slaMins = SLA_MINS[severity] ?? 240;
            const elapsedMins = Math.round(elapsedSeconds / 60);
            const remainingMins = Math.max(0, slaMins - elapsedMins);
            const pctUsed = Math.min(100, Math.round((elapsedMins / slaMins) * 100));
            const slaColor = pctUsed >= 100 ? '#F43F5E' : pctUsed >= 75 ? '#F59E0B' : '#10B981';
            const slaIcon = pctUsed >= 100 ? '🔴' : pctUsed >= 75 ? '⚠️' : '✅';

            const formatSlaRemaining = (mins: number): string => {
              if (mins <= 0) return 'SLA ❌';
              if (mins >= 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return m > 0 ? `SLA ${h}h ${m}m` : `SLA ${h}h`;
              }
              return `SLA ${mins}m`;
            };

            return (
              <div
                title={`SLA target: ${slaMins >= 60 ? `${Math.floor(slaMins / 60)}h` : `${slaMins}m`} — ${remainingMins > 0 ? `${remainingMins}m remaining` : 'BREACHED'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  fontSize: 'var(--text-xs, 11px)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  background: `${slaColor}11`,
                  border: `1px solid ${slaColor}33`,
                  color: slaColor,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10 }}>{slaIcon}</span>
                <span>{formatSlaRemaining(remainingMins)}</span>
              </div>
            );
          })()}

          {/* Resolve Button */}
          {status !== 'resolved' && onResolve && (
            <button
              type="button"
              onClick={onResolve}
              className="precision-bar__resolve-btn"
              title="Resolve this incident (R)"
              aria-label="Resolve this incident"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Resolve</span>
            </button>
          )}

          {/* Progressive Disclosure: Settings & Overflow Popover */}
          <div className="precision-bar__settings-wrap">
            <button
              type="button"
              className={`precision-bar__ghost-btn ${isSettingsOpen ? 'precision-bar__ghost-btn--active' : ''}`}
              onClick={() => setIsSettingsOpen((p) => !p)}
              title="Flight Deck settings & preferences"
              aria-label="Flight Deck settings and preferences"
              aria-expanded={isSettingsOpen}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2.2" />
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="19" cy="12" r="2.2" />
              </svg>
            </button>

            <div
              className={`precision-bar__settings-popover ${
                isSettingsOpen ? 'precision-bar__settings-popover--open' : ''
              }`}
            >
              <div className="precision-bar__popover-header">
                <span>PREFERENCES & CONTROLS</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="precision-bar__popover-close"
                  aria-label="Close preferences"
                >
                  ✕
                </button>
              </div>

              {/* Theme Toggle */}
              <div className="precision-bar__setting-row">
                <span className="precision-bar__setting-label">Theme</span>
                <button
                  type="button"
                  className={`precision-bar__setting-action ${styles.themeBtn}`}
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                  aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                >
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </div>

              {/* Voice Language Toggle */}
              {onVoiceLangChange && (
                <div className="precision-bar__setting-row">
                  <span className="precision-bar__setting-label">Voice ASR/TTS</span>
                  <button
                    type="button"
                    className="precision-bar__setting-action"
                    onClick={() => onVoiceLangChange(voiceLang === 'en-IN' ? 'en-US' : 'en-IN')}
                    title={`Voice Model: ${voiceLang === 'en-IN' ? 'Indian English (en-IN)' : 'US English (en-US)'}. Click to toggle.`}
                    aria-label="Toggle voice model language"
                  >
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 3px',
                        borderRadius: '2px',
                        background: 'rgba(212, 168, 83, 0.15)',
                        color: 'var(--color-aura)',
                      }}
                    >
                      {voiceLang === 'en-IN' ? 'IN' : 'US'}
                    </span>
                    <span>{voiceLang === 'en-IN' ? 'en-IN' : 'en-US'}</span>
                  </button>
                </div>
              )}

              {/* Soundstage Status */}
              <div className="precision-bar__setting-row">
                <span className="precision-bar__setting-label">Spatial Stage</span>
                <span className="precision-bar__setting-status">SD-RTN™ 3D</span>
              </div>
            </div>
          </div>

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
              <span className="precision-bar__ic-text">{icName} (IC)</span>
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
