'use client';

import React from 'react';
import { PERSONAS, PersonaConfig } from '@/lib/constants';

export interface LobbyScreenProps {
  onJoin: (persona: PersonaConfig, options?: { costRate?: number; simulateReplay?: boolean }) => void;
  isConnecting?: boolean;
}

const COST_PRESETS = [
  { label: 'Standard SaaS', rate: 25 },
  { label: 'Mid-Tier Service', rate: 75 },
  { label: 'E-Comm Checkout', rate: 150 },
  { label: 'Fintech / Cloud', rate: 500 },
];

const PERSONA_ROLE_DESCRIPTIONS: Record<string, { badge: string; description: string }> = {
  sarah_oncall: {
    badge: 'MISSION COMMAND',
    description: 'Leads war room triage, arbitrates contradictions, issues mitigation & rollback directives.',
  },
  marcus_devops: {
    badge: 'INFRASTRUCTURE',
    description: 'Investigates database pool exhaustion, verifies replica lag, executes canary deployment.',
  },
  priya_lead: {
    badge: 'PRODUCT IMPACT',
    description: 'Quantifies revenue loss, monitors user checkout failures, drafts executive stakeholder updates.',
  },
};

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
  const [selectedRate, setSelectedRate] = React.useState<number>(150);
  const [customRateInput, setCustomRateInput] = React.useState<string>('150');
  const [customName, setCustomName] = React.useState<string>('');
  const [customRole, setCustomRole] = React.useState<string>('');
  const [demoMode, setDemoMode] = React.useState<'simulation' | 'live'>('simulation');

  const handleJoinPersona = (persona: PersonaConfig, overrideOptions?: { simulateReplay?: boolean }) => {
    const rate = Math.max(1, Number(customRateInput) || selectedRate);
    const shouldSimulate = overrideOptions?.simulateReplay ?? (demoMode === 'simulation');
    onJoin(persona, { costRate: rate, simulateReplay: shouldSimulate });
  };

  const handleJoinCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const uid = customName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_oncall';
    const customPersona: PersonaConfig = {
      uid,
      displayName: customName.trim(),
      role: customRole.trim() || 'Incident Responder',
      avatarColor: 'var(--color-aura)',
    };
    const rate = Math.max(1, Number(customRateInput) || selectedRate);
    onJoin(customPersona, { costRate: rate, simulateReplay: demoMode === 'simulation' });
  };

  const currentEffectiveRate = Math.max(1, Number(customRateInput) || selectedRate);

  return (
    <div className="flightdeck-container">
      <style>{`
        .flightdeck-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 2.5rem 1.5rem 4rem 1.5rem;
          background:
            radial-gradient(ellipse 90% 50% at 50% -12%, rgba(212, 168, 83, 0.10) 0%, transparent 65%),
            radial-gradient(circle at 10% 80%, rgba(99, 102, 241, 0.04) 0%, transparent 45%),
            radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 45%),
            #08090C;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }

        .flightdeck-content {
          width: 100%;
          max-width: 1240px;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          position: relative;
          z-index: 1;
        }

        /* ─── Header ─── */
        .flightdeck-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 0.5rem;
        }

        .flightdeck-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.875rem;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-radius: var(--radius-full);
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-aura);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .flightdeck-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-fact);
          box-shadow: 0 0 8px var(--color-fact);
          animation: flightdeck-pulse 2s ease-in-out infinite;
        }

        .flightdeck-brand-title {
          font-size: clamp(2.5rem, 5.5vw, 3.75rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0.25rem 0;
          background: linear-gradient(180deg, #FFFFFF 25%, #D4A853 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 24px rgba(212, 168, 83, 0.25));
        }

        .flightdeck-subtitle {
          font-size: 1.0625rem;
          color: var(--text-primary);
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .flightdeck-tagline {
          font-size: 0.8125rem;
          color: var(--text-muted);
          line-height: 1.5;
          max-width: 620px;
          margin: 0;
        }

        /* ─── Connecting Banner ─── */
        .flightdeck-connecting {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1.25rem;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.35);
          border-radius: var(--radius-lg);
          box-shadow: 0 0 24px rgba(212, 168, 83, 0.15);
          animation: flightdeck-connecting-pulse 1.8s ease-in-out infinite alternate;
        }

        .flightdeck-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(212, 168, 83, 0.25);
          border-top-color: var(--color-aura);
          border-radius: 50%;
          animation: flightdeck-spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        /* ─── Briefing Card ─── */
        .flightdeck-briefing {
          background: #0E1015;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xl);
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.07), 0 8px 32px rgba(0, 0, 0, 0.45);
          position: relative;
        }

        .flightdeck-briefing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .flightdeck-chips-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .flightdeck-chip {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.2rem 0.625rem;
          border-radius: var(--radius-sm);
          letter-spacing: 0.04em;
        }

        .flightdeck-chip-incident {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
        }

        .flightdeck-chip-sev1 {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #F87171;
        }

        .flightdeck-chip-ready {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #34D399;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.2rem 0.625rem;
          border-radius: var(--radius-sm);
        }

        .flightdeck-ready-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #34D399;
          box-shadow: 0 0 6px #34D399;
        }

        .flightdeck-briefing-title {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text-primary);
          margin: 0;
        }

        .flightdeck-narrative-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.875rem;
        }

        @media (max-width: 900px) {
          .flightdeck-narrative-grid {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-narrative-card {
          background: #13161D;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-lg);
          padding: 0.875rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .flightdeck-narrative-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .flightdeck-narrative-desc {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        /* ─── Primary Simulation Launch Button ─── */
        .flightdeck-launch-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          background: linear-gradient(180deg, rgba(212, 168, 83, 0.18) 0%, rgba(212, 168, 83, 0.08) 100%);
          border: 1px solid rgba(212, 168, 83, 0.5);
          border-radius: var(--radius-lg);
          color: var(--color-aura);
          font-weight: 700;
          font-size: 0.875rem;
          letter-spacing: 0.03em;
          cursor: pointer;
          box-shadow: inset 0 1px 0 0 rgba(212, 168, 83, 0.3), 0 4px 24px rgba(212, 168, 83, 0.18);
          transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flightdeck-launch-btn:hover:not(:disabled) {
          background: linear-gradient(180deg, rgba(212, 168, 83, 0.28) 0%, rgba(212, 168, 83, 0.14) 100%);
          border-color: rgba(212, 168, 83, 0.8);
          box-shadow: inset 0 1px 0 0 rgba(212, 168, 83, 0.4), 0 6px 32px rgba(212, 168, 83, 0.3);
          transform: translateY(-1px);
        }

        .flightdeck-launch-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .flightdeck-launch-play {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--color-aura);
          color: #08090C;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .flightdeck-launch-badge {
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.25rem 0.625rem;
          border-radius: var(--radius-sm);
          background: rgba(212, 168, 83, 0.15);
          border: 1px solid rgba(212, 168, 83, 0.3);
          color: var(--color-aura);
          letter-spacing: 0.05em;
        }

        /* ─── Responder Selection Grid ─── */
        .flightdeck-section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .flightdeck-section-title {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .flightdeck-mode-toggle {
          display: inline-flex;
          align-items: center;
          background: #101218;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-full);
          padding: 3px;
          gap: 3px;
        }

        .flightdeck-mode-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.3rem 0.875rem;
          border-radius: var(--radius-full);
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .flightdeck-mode-btn:hover {
          color: var(--text-primary);
        }

        .flightdeck-mode-btn--active {
          background: #181B24;
          color: var(--color-aura);
          font-weight: 600;
          border-color: rgba(212, 168, 83, 0.35);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        }

        .flightdeck-persona-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        @media (max-width: 900px) {
          .flightdeck-persona-grid {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-persona-card {
          background: #0E1015;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: var(--radius-xl);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          cursor: pointer;
          text-align: left;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 20px rgba(0, 0, 0, 0.3);
          transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flightdeck-persona-card:hover:not(:disabled) {
          background: #13161E;
          border-color: rgba(212, 168, 83, 0.5);
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 8px 30px rgba(212, 168, 83, 0.15);
        }

        .flightdeck-persona-card:hover:not(:disabled) .flightdeck-persona-arrow {
          transform: translateX(4px);
        }

        .flightdeck-persona-top {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .flightdeck-persona-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9375rem;
          flex-shrink: 0;
          border: 2px solid rgba(255, 255, 255, 0.12);
        }

        .flightdeck-persona-meta {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          flex: 1;
          min-width: 0;
        }

        .flightdeck-persona-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .flightdeck-persona-name {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .flightdeck-persona-badge {
          font-size: 0.625rem;
          font-family: var(--font-mono);
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          letter-spacing: 0.04em;
        }

        .flightdeck-persona-role {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .flightdeck-persona-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
          flex: 1;
        }

        .flightdeck-persona-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.875rem;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-radius: var(--radius-md);
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--color-aura);
          letter-spacing: 0.05em;
          transition: all 150ms ease;
        }

        .flightdeck-persona-card:hover:not(:disabled) .flightdeck-persona-cta {
          background: rgba(212, 168, 83, 0.18);
          border-color: rgba(212, 168, 83, 0.45);
        }

        .flightdeck-persona-arrow {
          transition: transform 150ms ease;
        }

        /* ─── Bottom Grid ─── */
        .flightdeck-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .flightdeck-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-bottom-card {
          background: #0E1015;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
        }

        .flightdeck-bottom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .flightdeck-burn-readout {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--color-aura);
          font-weight: 600;
        }

        .flightdeck-preset-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }

        @media (max-width: 600px) {
          .flightdeck-preset-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .flightdeck-preset-chip {
          background: #13161D;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-md);
          padding: 0.5rem 0.375rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 150ms ease;
        }

        .flightdeck-preset-chip:hover {
          background: #181B24;
          color: var(--text-primary);
        }

        .flightdeck-preset-chip--active {
          background: rgba(212, 168, 83, 0.12);
          border-color: rgba(212, 168, 83, 0.5);
          color: var(--color-aura);
        }

        .flightdeck-preset-label {
          font-size: 0.625rem;
          font-weight: 500;
        }

        .flightdeck-preset-rate {
          font-family: var(--font-mono);
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .flightdeck-preset-chip--active .flightdeck-preset-rate {
          color: var(--color-aura);
        }

        .flightdeck-custom-burn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .flightdeck-custom-burn-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .flightdeck-custom-burn-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: #13161D;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-md);
          padding: 0.35rem 0.75rem;
          flex: 1;
          max-width: 220px;
          transition: border-color 150ms ease;
        }

        .flightdeck-custom-burn-input-wrap:focus-within {
          border-color: var(--color-aura);
        }

        .flightdeck-custom-burn-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 0.8125rem;
          font-weight: 600;
          width: 100%;
          outline: none;
        }

        .flightdeck-custom-join-form {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .flightdeck-custom-join-fields {
          display: grid;
          grid-template-columns: 1.2fr 1fr auto;
          gap: 0.5rem;
        }

        @media (max-width: 600px) {
          .flightdeck-custom-join-fields {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-input {
          background: #13161D;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-md);
          padding: 0.45rem 0.75rem;
          font-size: 0.75rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 150ms ease;
        }

        .flightdeck-input:focus {
          border-color: var(--color-aura);
        }

        .flightdeck-custom-submit-btn {
          background: var(--color-aura);
          color: #08090C;
          border: none;
          border-radius: var(--radius-md);
          padding: 0.45rem 1rem;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          transition: opacity 150ms ease;
        }

        .flightdeck-custom-submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .flightdeck-custom-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .flightdeck-tech-note {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-md);
          padding: 0.75rem 0.875rem;
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.45;
        }

        @keyframes flightdeck-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.92); }
        }

        @keyframes flightdeck-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes flightdeck-connecting-pulse {
          from { opacity: 0.85; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="flightdeck-content">
        {/* Header with Visual Badge & Wordmark */}
        <header className="flightdeck-header">
          <div className="flightdeck-status-pill" aria-label="System status">
            <span className="flightdeck-status-dot" aria-hidden="true" />
            <span>VOICE INCIDENT COMMAND SYSTEM • SEV-1 ACTIVE</span>
          </div>

          <h1 className="flightdeck-brand-title">AURA</h1>
          <p className="flightdeck-subtitle">Autonomous Voice-Directed Incident Commander</p>
          <p className="flightdeck-tagline">
            Real-time multi-speaker acoustic intelligence • Live contradiction arbitration • Continuous SRE debrief
          </p>
        </header>

        {/* Connecting Banner */}
        {isConnecting && (
          <div className="flightdeck-connecting" role="status" aria-live="polite">
            <div className="flightdeck-spinner" aria-hidden="true" />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-aura)' }}>
                CONNECTING TO AGORA VOICE BRIDGE
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Establishing sub-second SD-RTN audio channel & telemetry pipeline...
              </div>
            </div>
          </div>
        )}

        {/* Active Incident Briefing Card */}
        <section className="flightdeck-briefing" aria-labelledby="incident-briefing-title">
          <div className="flightdeck-briefing-header">
            <div className="flightdeck-chips-group">
              <span className="flightdeck-chip flightdeck-chip-incident">INCIDENT #492</span>
              <span className="flightdeck-chip flightdeck-chip-sev1">SEV-1 CRITICAL</span>
              <span className="flightdeck-chip" style={{ background: 'rgba(212, 168, 83, 0.1)', color: 'var(--color-aura)', border: '1px solid rgba(212, 168, 83, 0.25)' }}>
                CHECKOUT ROUTING
              </span>
            </div>
            <div className="flightdeck-chip-ready">
              <span className="flightdeck-ready-dot" aria-hidden="true" />
              <span>SIMULATION READY</span>
            </div>
          </div>

          <h2 id="incident-briefing-title" className="flightdeck-briefing-title">
            Payment Service Checkout Outage
          </h2>

          <div className="flightdeck-narrative-grid">
            <div className="flightdeck-narrative-card">
              <div className="flightdeck-narrative-label" style={{ color: '#F87171' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Live Impact</span>
              </div>
              <p className="flightdeck-narrative-desc">
                Error rates surged to 42% on payment services. Checkout flow frozen for ~1,420 checkout sessions.
              </p>
            </div>

            <div className="flightdeck-narrative-card">
              <div className="flightdeck-narrative-label" style={{ color: 'var(--color-hypothesis)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                  <line x1="6" y1="9" x2="6" y2="21" />
                </svg>
                <span>Suspected Root Cause</span>
              </div>
              <p className="flightdeck-narrative-desc">
                PR #492 deployed 15m ago. Stripe webhook v2 migration causing connection pool starvation.
              </p>
            </div>

            <div className="flightdeck-narrative-card">
              <div className="flightdeck-narrative-label" style={{ color: 'var(--color-fact)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>AURA Mission Directives</span>
              </div>
              <p className="flightdeck-narrative-desc">
                Arbitrate conflicting responder statements, enforce evidence before canary rollback, synthesize SRE postmortem.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isConnecting}
            onClick={() => handleJoinPersona(PERSONAS[0], { simulateReplay: true })}
            className="flightdeck-launch-btn"
          >
            <div className="flightdeck-launch-left">
              <span className="flightdeck-launch-play" aria-hidden="true">▶</span>
              <span>
                {isConnecting ? 'INITIALIZING SIMULATION...' : 'LAUNCH INCIDENT SIMULATION (RECOMMENDED FOR JUDGES)'}
              </span>
            </div>
            <span className="flightdeck-launch-badge">12 EVENTS · SUB-SECOND AGORA VOICE</span>
          </button>
        </section>

        {/* Responder Selection */}
        <section aria-label="Responder callsign selection" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="flightdeck-section-bar">
            <span className="flightdeck-section-title">Select Responder Callsign:</span>

            <div className="flightdeck-mode-toggle" role="radiogroup" aria-label="Operational Mode">
              <button
                type="button"
                role="radio"
                aria-checked={demoMode === 'simulation'}
                className={`flightdeck-mode-btn ${demoMode === 'simulation' ? 'flightdeck-mode-btn--active' : ''}`}
                onClick={() => setDemoMode('simulation')}
                title="Streams realistic 12-event multi-responder incident timeline with voice transcripts and postmortem"
              >
                <span>⚡ Interactive Simulation</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={demoMode === 'live'}
                className={`flightdeck-mode-btn ${demoMode === 'live' ? 'flightdeck-mode-btn--active' : ''}`}
                onClick={() => setDemoMode('live')}
                title="Connects to Agora RTC channel for live microphone streaming"
              >
                <span>🎙 Live Microphone</span>
              </button>
            </div>
          </div>

          <div className="flightdeck-persona-grid">
            {PERSONAS.map((persona) => {
              const roleMeta = PERSONA_ROLE_DESCRIPTIONS[persona.uid] || {
                badge: 'RESPONDER',
                description: 'Active incident participant on audio bridge.',
              };

              return (
                <button
                  key={persona.uid}
                  disabled={isConnecting}
                  onClick={() => handleJoinPersona(persona)}
                  className="flightdeck-persona-card"
                  type="button"
                >
                  <div className="flightdeck-persona-top">
                    <div
                      className="flightdeck-persona-avatar"
                      style={{
                        backgroundColor: persona.avatarColor,
                        color: 'var(--text-inverse)',
                        boxShadow: `0 0 16px color-mix(in srgb, ${persona.avatarColor} 40%, transparent)`,
                      }}
                      aria-hidden="true"
                    >
                      {persona.displayName[0]}
                    </div>
                    <div className="flightdeck-persona-meta">
                      <div className="flightdeck-persona-name-row">
                        <span className="flightdeck-persona-name">{persona.displayName}</span>
                        <span className="flightdeck-persona-badge">{roleMeta.badge}</span>
                      </div>
                      <span className="flightdeck-persona-role">{persona.role}</span>
                    </div>
                  </div>

                  <p className="flightdeck-persona-desc">{roleMeta.description}</p>

                  <div className="flightdeck-persona-cta">
                    <span>{isConnecting ? 'CONNECTING...' : 'ENTER BRIDGE'}</span>
                    <span aria-hidden="true" className="flightdeck-persona-arrow">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bottom Grid: Financial Telemetry & Custom Responder */}
        <div className="flightdeck-bottom-grid">
          {/* Financial Loss Rate Config */}
          <section className="flightdeck-bottom-card" aria-label="Financial burn rate telemetry">
            <div className="flightdeck-bottom-header">
              <span className="flightdeck-section-title">Financial Burn Rate Telemetry:</span>
              <span className="flightdeck-burn-readout">
                ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 60)}/min • ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 3600)}/hr
              </span>
            </div>

            <div className="flightdeck-preset-grid">
              {COST_PRESETS.map((p) => (
                <button
                  key={p.rate}
                  type="button"
                  className={`flightdeck-preset-chip ${selectedRate === p.rate ? 'flightdeck-preset-chip--active' : ''}`}
                  onClick={() => {
                    setSelectedRate(p.rate);
                    setCustomRateInput(p.rate.toString());
                  }}
                >
                  <span className="flightdeck-preset-label">{p.label}</span>
                  <span className="flightdeck-preset-rate">${p.rate}/s</span>
                </button>
              ))}
            </div>

            <div className="flightdeck-custom-burn">
              <span className="flightdeck-custom-burn-label">Custom Loss Rate:</span>
              <div className="flightdeck-custom-burn-input-wrap">
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>$</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={customRateInput}
                  onChange={(e) => {
                    setCustomRateInput(e.target.value);
                    const val = Number(e.target.value);
                    if (val > 0) setSelectedRate(val);
                  }}
                  className="flightdeck-custom-burn-input"
                  placeholder="150"
                  aria-label="Custom loss rate in dollars per second"
                />
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>/s</span>
              </div>
            </div>
          </section>

          {/* Custom Responder + Architecture Note */}
          <section className="flightdeck-bottom-card" aria-label="Custom responder registration">
            <span className="flightdeck-section-title">Custom Responder Callsign:</span>

            <form onSubmit={handleJoinCustom} className="flightdeck-custom-join-form">
              <div className="flightdeck-custom-join-fields">
                <input
                  type="text"
                  placeholder="Your Name (e.g. Alex)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flightdeck-input"
                  aria-label="Custom responder name"
                />
                <input
                  type="text"
                  placeholder="Role (e.g. SecOps Lead)"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="flightdeck-input"
                  aria-label="Custom responder role"
                />
                <button
                  type="submit"
                  disabled={!customName.trim() || isConnecting}
                  className="flightdeck-custom-submit-btn"
                >
                  <span>{isConnecting ? 'CONNECTING...' : 'JOIN'}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>

            <div className="flightdeck-tech-note" role="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-aura)', flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Zero-Friction Audio Bridge:</strong> AURA voice AI activates automatically on entry. Multi-speaker audio is powered by Agora SD-RTN 48kHz HD Audio. Speak naturally to test live contradiction arbitration and SRE postmortem extraction.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
