'use client';

import React, { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { Severity, IncidentStatus, OODAPhase } from '@/lib/types';
import { CostCounter } from '@/components/indicators/CostCounter';
import styles from './StatusBar.module.css';

const subscribeTheme = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('aura-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('aura-theme-change', callback);
  };
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
  onInvite?: () => void;
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
  onInvite,
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

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('aura-theme', next);
      window.dispatchEvent(new CustomEvent('aura-theme-change', { detail: next }));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  }, [theme]);

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

  const sevColors: Record<Severity, { pip: string; glow: string; text: string; bg: string; border: string }> = {
    'SEV-0': { pip: '#F43F5E', glow: 'rgba(244, 63, 94, 0.45)', text: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)' },
    'SEV-1': { pip: '#F97316', glow: 'rgba(249, 115, 22, 0.45)', text: '#F97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.35)' },
    'SEV-2': { pip: '#F59E0B', glow: 'rgba(245, 158, 11, 0.45)', text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' },
    'SEV-3': { pip: '#10B981', glow: 'rgba(16, 185, 129, 0.45)', text: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' },
  };

  const currentSev = sevColors[severity] || sevColors['SEV-1'];

  const oodaPhases: Array<'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT'> = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT'];
  const isResolved = currentOODAPhase === 'RESOLVED' || status === 'resolved';
  const currentOODAIndex = isResolved ? 4 : oodaPhases.indexOf(currentOODAPhase as 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT');

  const connectionColor = {
    excellent: '#10B981',
    good: '#F59E0B',
    poor: '#F43F5E',
  }[connectionQuality];

  return (
    <>
      <style>{`
        .precision-bar {
          grid-area: status;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: rgba(10, 11, 15, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 4px 20px rgba(0, 0, 0, 0.4);
          height: 48px;
          min-height: 48px;
          max-height: 48px;
          z-index: var(--z-sticky, 20);
          user-select: none;
          gap: 12px;
          box-sizing: border-box;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        [data-theme="light"] .precision-bar {
          background: rgba(255, 255, 255, 0.96);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.02), 0 4px 16px rgba(0, 0, 0, 0.05);
        }

        /* ─── Left Section: Brand & Incident Breadcrumb ─── */
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
          gap: 7px;
          flex-shrink: 0;
        }

        .precision-bar__logo-wrap {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(212, 168, 83, 0.4);
          box-shadow: 0 0 10px rgba(212, 168, 83, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        [data-theme="light"] .precision-bar__logo-wrap {
          background: #FFFFFF;
          border-color: rgba(212, 168, 83, 0.5);
        }

        .precision-bar__logo-wrap img {
          width: 17px;
          height: 17px;
          object-fit: contain;
        }

        .precision-bar__brand-text {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 11.5px;
          letter-spacing: 0.08em;
          color: var(--text-primary);
        }

        .precision-bar__brand-text span {
          color: #D4A853;
          margin-left: 2px;
        }

        .precision-bar__sep {
          color: rgba(255, 255, 255, 0.18);
          font-size: 11px;
          user-select: none;
          flex-shrink: 0;
        }

        [data-theme="light"] .precision-bar__sep {
          color: rgba(0, 0, 0, 0.18);
        }

        .precision-bar__id {
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        [data-theme="light"] .precision-bar__id {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.09);
          color: #475569;
        }

        .precision-bar__sev {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
          border: 1px solid;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .precision-bar__sev-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
          animation: aura-sev-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes aura-sev-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
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

        /* ─── Center Section: Tactical OODA Decision Stepper ─── */
        .precision-bar__center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .precision-bar__stepper {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.03);
          padding: 3px 6px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        [data-theme="light"] .precision-bar__stepper {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .precision-bar__phase-node {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          transition: all 0.15s ease;
        }

        .precision-bar__phase-node--completed {
          color: var(--text-secondary);
        }

        .precision-bar__phase-node--active {
          background: rgba(212, 168, 83, 0.15);
          color: #D4A853;
          border: 1px solid rgba(212, 168, 83, 0.35);
          box-shadow: 0 0 8px rgba(212, 168, 83, 0.25);
          font-weight: 700;
        }

        .precision-bar__phase-node--resolved {
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
          border: 1px solid rgba(16, 185, 129, 0.35);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.25);
          font-weight: 700;
        }

        .precision-bar__phase-arrow {
          color: rgba(255, 255, 255, 0.18);
          font-size: 9px;
          user-select: none;
        }

        [data-theme="light"] .precision-bar__phase-arrow {
          color: rgba(0, 0, 0, 0.18);
        }

        /* ─── Right Section: Financial HUD, SLA, Actions, Tools ─── */
        .precision-bar__right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .precision-bar__timer {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }

        [data-theme="light"] .precision-bar__timer {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.08);
          color: #475569;
        }

        /* SLA Pill */
        .precision-bar__sla-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
          border: 1px solid;
        }

        /* Resolve CTA Button */
        .precision-bar__resolve-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 28px;
          padding: 0 11px;
          border-radius: 5px;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #064E3B;
          background: linear-gradient(180deg, #34D399 0%, #10B981 100%);
          border: 1px solid rgba(16, 185, 129, 0.5);
          box-shadow: 0 2px 10px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4);
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .precision-bar__resolve-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5);
          filter: brightness(1.06);
        }

        .precision-bar__resolve-btn kbd {
          background: rgba(0, 0, 0, 0.25);
          color: #ECFDF5;
          padding: 1px 4px;
          border-radius: 3px;
          font-family: var(--font-mono);
          font-size: 8.5px;
          font-weight: 700;
        }

        /* IC Station Pill */
        .precision-bar__ic {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          padding: 3px 8px;
          border-radius: 5px;
          white-space: nowrap;
          transition: all 0.15s ease;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #D4A853;
          font-weight: 600;
        }

        [data-theme="light"] .precision-bar__ic {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .precision-bar__ic--claim {
          color: var(--text-primary);
          cursor: pointer;
          border-color: rgba(212, 168, 83, 0.4);
        }

        .precision-bar__ic--claim:hover {
          background: rgba(212, 168, 83, 0.12);
          color: #D4A853;
          border-color: #D4A853;
        }

        /* Quick Action Chip Buttons */
        .precision-bar__btn-chip {
          height: 28px;
          padding: 0 9px;
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        [data-theme="light"] .precision-bar__btn-chip {
          border-color: rgba(0, 0, 0, 0.09);
          background: rgba(0, 0, 0, 0.03);
          color: #475569;
        }

        .precision-bar__btn-chip:hover {
          background: rgba(255, 255, 255, 0.07);
          color: var(--text-primary);
          border-color: rgba(212, 168, 83, 0.4);
        }

        .precision-bar__btn-chip kbd {
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
        }

        [data-theme="light"] .precision-bar__btn-chip kbd {
          background: rgba(0, 0, 0, 0.06);
          color: #475569;
        }

        /* Settings Popover */
        .precision-bar__settings-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .precision-bar__settings-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: rgba(14, 16, 22, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 1000;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        [data-theme="light"] .precision-bar__settings-popover {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 6px;
        }

        [data-theme="light"] .precision-bar__popover-header {
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .precision-bar__popover-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
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

        .precision-bar__setting-segmented {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px;
        }

        [data-theme="light"] .precision-bar__setting-segmented {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.09);
        }

        .precision-bar__setting-option {
          border: none;
          background: transparent;
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-muted);
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .precision-bar__setting-option--active {
          background: rgba(212, 168, 83, 0.2);
          color: #D4A853;
          font-weight: 700;
        }
      `}</style>

      <header className={`precision-bar ${styles.statusBar} ${pulseClass}`} role="banner">
        {/* Left Section: Breadcrumb with Brand + ID + Severity + Title */}
        <div className={`precision-bar__left ${styles.left}`}>
          <div className={`precision-bar__brand ${styles.brand}`}>
            <div className="precision-bar__logo-wrap" aria-hidden="true">
              <img src="/logo.png" alt="AURA Logo" width={17} height={17} />
            </div>
            <span className={`precision-bar__brand-text ${styles.brandText}`}>
              AURA<span>{'//'} FLIGHT DECK</span>
            </span>
          </div>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <span className={`precision-bar__id ${styles.incidentId}`}>INC-492</span>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <span
            className={`precision-bar__sev ${styles.severity}`}
            style={{
              backgroundColor: currentSev.bg,
              borderColor: currentSev.border,
              color: currentSev.text,
            }}
          >
            <span
              className={`precision-bar__sev-pip ${styles.sevDot}`}
              style={{ backgroundColor: currentSev.pip, boxShadow: `0 0 6px ${currentSev.glow}` }}
              aria-hidden="true"
            />
            <span>{severity}</span>
          </span>

          <span className={`precision-bar__sep ${styles.divider}`} aria-hidden="true">/</span>

          <h1 className={`precision-bar__title ${styles.title}`} title={incidentTitle}>
            {incidentTitle}
          </h1>
        </div>

        {/* Center Section: Tactical OODA Stepper */}
        <div className={`precision-bar__center ${styles.center}`}>
          <nav className="precision-bar__stepper" aria-label="Incident OODA Phase Progression">
            {isResolved ? (
              <span className="precision-bar__phase-node precision-bar__phase-node--resolved">
                ✓ RESOLVED
              </span>
            ) : (
              oodaPhases.map((phase, idx) => {
                const isActive = currentOODAPhase === phase;
                const isCompleted = idx < currentOODAIndex;
                return (
                  <React.Fragment key={phase}>
                    <span
                      className={`precision-bar__phase-node ${
                        isActive
                          ? 'precision-bar__phase-node--active'
                          : isCompleted
                          ? 'precision-bar__phase-node--completed'
                          : ''
                      }`}
                      title={`Phase ${idx + 1}: ${phase}`}
                    >
                      {isActive && <span className="precision-bar__sev-pip" style={{ backgroundColor: '#D4A853', width: 5, height: 5 }} aria-hidden="true" />}
                      <span>{phase}</span>
                    </span>
                    {idx < oodaPhases.length - 1 && (
                      <span className="precision-bar__phase-arrow" aria-hidden="true">➔</span>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </nav>
        </div>

        {/* Right Section: Cost + Timer + SLA + IC + Theme + Resolve + Settings */}
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
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.7 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          {/* SLA Pill */}
          {status !== 'resolved' && (() => {
            const SLA_MINS: Record<string, number> = { 'SEV-0': 60, 'SEV-1': 240, 'SEV-2': 1440, 'SEV-3': 4320 };
            const slaMins = SLA_MINS[severity] ?? 240;
            const elapsedMins = Math.round(elapsedSeconds / 60);
            const remainingMins = Math.max(0, slaMins - elapsedMins);
            const pctUsed = Math.min(100, Math.round((elapsedMins / slaMins) * 100));
            const slaColor = pctUsed >= 100 ? '#F43F5E' : pctUsed >= 75 ? '#F59E0B' : '#10B981';
            const slaBg = pctUsed >= 100 ? 'rgba(244, 63, 94, 0.12)' : pctUsed >= 75 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)';
            const slaBorder = pctUsed >= 100 ? 'rgba(244, 63, 94, 0.35)' : pctUsed >= 75 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)';

            const formatSlaRemaining = (mins: number): string => {
              if (mins <= 0) return 'SLA BREACHED';
              if (mins >= 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return m > 0 ? `SLA ${h}h ${m}m` : `SLA ${h}h`;
              }
              return `SLA ${mins}m`;
            };

            return (
              <div
                className="precision-bar__sla-pill"
                title={`SLA Target: ${slaMins >= 60 ? `${Math.floor(slaMins / 60)}h` : `${slaMins}m`} — ${remainingMins > 0 ? `${remainingMins}m remaining` : 'BREACHED'}`}
                style={{
                  color: slaColor,
                  backgroundColor: slaBg,
                  borderColor: slaBorder,
                }}
              >
                <span>{formatSlaRemaining(remainingMins)}</span>
              </div>
            );
          })()}

          {/* Incident Commander Station */}
          {icName ? (
            <div
              className={`precision-bar__ic precision-bar__ic--locked ${styles.icText}`}
              title={`Incident Commander assigned: ${icName}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>{icName} (IC)</span>
            </div>
          ) : (
            <button
              type="button"
              className="precision-bar__ic precision-bar__ic--claim"
              onClick={onClaimIC}
              title="Assume Incident Commander responsibility"
              aria-label="Claim IC role"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Claim IC</span>
            </button>
          )}

          {/* Resolve Incident CTA */}
          {status !== 'resolved' && onResolve && (
            <button
              type="button"
              className="precision-bar__resolve-btn"
              onClick={onResolve}
              title="Resolve Incident & Generate Postmortem (Press R)"
              aria-label="Resolve Incident"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Resolve</span>
              <kbd>R</kbd>
            </button>
          )}

          {/* Theme Switcher Button */}
          <button
            type="button"
            className="precision-bar__btn-chip"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode (T)`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            <span>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</span>
            <kbd>T</kbd>
          </button>

          {/* Invite Team Button (if provided) */}
          {onInvite && (
            <button
              type="button"
              className="precision-bar__btn-chip"
              onClick={onInvite}
              title="Share War Room Link"
              aria-label="Share War Room Link"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Invite</span>
            </button>
          )}

          {/* Settings & Voice Model Popover */}
          <div className="precision-bar__settings-wrap">
            <button
              type="button"
              className={`precision-bar__btn-chip ${isSettingsOpen ? 'precision-bar__ghost-btn--active' : ''}`}
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Mission Settings & Voice Engine"
              aria-label="Mission Settings"
              aria-expanded={isSettingsOpen}
              style={{ padding: '0 7px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <div
              className={`precision-bar__settings-popover ${
                isSettingsOpen ? 'precision-bar__settings-popover--open' : ''
              }`}
              role="dialog"
              aria-label="Mission Deck Settings"
            >
              <div className="precision-bar__popover-header">
                <span>MISSION SETTINGS</span>
                <button
                  type="button"
                  className="precision-bar__popover-close"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Close settings"
                >
                  ✕
                </button>
              </div>

              {/* Voice Model Accent */}
              {onVoiceLangChange && (
                <div className="precision-bar__setting-row">
                  <span className="precision-bar__setting-label">Voice ASR Accent</span>
                  <div className="precision-bar__setting-segmented" role="radiogroup">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={voiceLang === 'en-IN'}
                      className={`precision-bar__setting-option ${
                        voiceLang === 'en-IN' ? 'precision-bar__setting-option--active' : ''
                      }`}
                      onClick={() => onVoiceLangChange('en-IN')}
                    >
                      🇮🇳 en-IN
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={voiceLang === 'en-US'}
                      className={`precision-bar__setting-option ${
                        voiceLang === 'en-US' ? 'precision-bar__setting-option--active' : ''
                      }`}
                      onClick={() => onVoiceLangChange('en-US')}
                    >
                      🇺🇸 en-US
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Mesh Quality */}
              <div className="precision-bar__setting-row">
                <span className="precision-bar__setting-label">SD-RTN™ Audio Mesh</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: connectionColor,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: connectionColor,
                      boxShadow: `0 0 6px ${connectionColor}`,
                    }}
                  />
                  {connectionQuality.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
