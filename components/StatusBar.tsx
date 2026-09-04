'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Severity, IncidentStatus, OODAPhase } from '@/lib/types';
import { OODAIndicator } from './OODAIndicator';
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
    'SEV-0': styles.sev0,
    'SEV-1': styles.sev1,
    'SEV-2': styles.sev2,
    'SEV-3': styles.sev3,
  }[severity] ?? styles.sev1;

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
    <header className={styles.statusBar} role="banner">
      {/* Left Section: Breadcrumb with Brand + ID + Severity + Title */}
      <div className={styles.left}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 2 2 22 22 22 12 2" stroke="var(--color-aura)" fill="rgba(212, 168, 83, 0.15)" />
              <circle cx="12" cy="15" r="2.5" fill="var(--color-aura)" />
            </svg>
          </span>
          <span className={styles.brandText}>AURA</span>
        </div>

        <span className={styles.divider} aria-hidden="true">/</span>

        <span className={styles.incidentId}>INC-492</span>

        <span className={styles.divider} aria-hidden="true">/</span>

        <span className={`${styles.severity} ${severityClass}`}>
          <span className={styles.sevDot} aria-hidden="true" />
          <span>{severity}</span>
        </span>

        <span className={styles.divider} aria-hidden="true">/</span>

        <h1 className={styles.title} title={incidentTitle}>
          {incidentTitle}
        </h1>
      </div>

      {/* Center Section: Segmented OODA Ribbon */}
      <div className={styles.center}>
        <OODAIndicator currentPhase={currentOODAPhase} />
      </div>

      {/* Right Section: Cost + Timer + IC Lock + Theme Toggle + Connection */}
      <div className={styles.right}>
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
          className={styles.timer}
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
          className={styles.themeBtn}
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
            className={`${styles.ic} ${styles.icLocked}`}
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
            className={`${styles.ic} ${styles.icClaim}`}
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
  );
}
