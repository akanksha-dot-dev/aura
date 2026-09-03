'use client';

import React from 'react';
import { PERSONAS, PersonaConfig } from '@/lib/constants';

export interface LobbyScreenProps {
  onJoin: (persona: PersonaConfig, options?: { costRate?: number }) => void;
  isConnecting?: boolean;
}

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
  const [selectedRate, setSelectedRate] = React.useState<number>(150);
  const [customRateInput, setCustomRateInput] = React.useState<string>('150');
  const [customName, setCustomName] = React.useState<string>('');
  const [customRole, setCustomRole] = React.useState<string>('');

  const COST_PRESETS = [
    { label: 'Standard SaaS', rate: 25 },
    { label: 'Mid-Tier Service', rate: 75 },
    { label: 'E-Comm Checkout', rate: 150 },
    { label: 'Fintech / Cloud', rate: 500 },
  ];

  const handleJoinPersona = (persona: PersonaConfig) => {
    const rate = Math.max(1, Number(customRateInput) || selectedRate);
    onJoin(persona, { costRate: rate });
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
    onJoin(customPersona, { costRate: rate });
  };

  const currentEffectiveRate = Math.max(1, Number(customRateInput) || selectedRate);

  return (
    <div className="lobby-container">
      <div className="lobby-content">
        {/* Header with Visual Badge & Golden Glow Title */}
        <header className="lobby-header">
          <div className="lobby-badge" aria-label="System operational status">
            <span className="lobby-badge-dot" aria-hidden="true" />
            <span className="lobby-badge-text">MISSION CONTROL • SEV-1 VOICE INCIDENT COMMAND</span>
          </div>

          <h1 className="lobby-title">
            AURA
          </h1>
          <p className="lobby-subtitle">
            Autonomous Voice-Directed Incident Commander
          </p>
          <p className="lobby-tagline">
            Real-time multi-speaker acoustic intelligence • Live conflict detection • Continuous postmortem synthesis
          </p>
        </header>

        {/* Connecting Banner when connecting */}
        {isConnecting && (
          <div className="lobby-connecting-banner" role="status" aria-live="polite">
            <div className="lobby-connecting-spinner" aria-hidden="true" />
            <div className="lobby-connecting-text">
              <span className="lobby-connecting-title">ESTABLISHING AUDIO BRIDGE & TELEMETRY</span>
              <span className="lobby-connecting-desc">Connecting to Agora Real-Time Voice Channel...</span>
            </div>
          </div>
        )}

        {/* Active Scenario Card */}
        <section className="lobby-scenario-card" aria-labelledby="active-scenario-title">
          <div className="lobby-scenario-header">
            <div className="lobby-scenario-badge-group">
              <span className="lobby-scenario-tag">INCIDENT #492</span>
              <span className="badge badge-conflict">SEV-1 OUTAGE</span>
            </div>
            <div className="lobby-scenario-live-badge">
              <span className="lobby-scenario-pulse-dot" aria-hidden="true" />
              <span>SIMULATION READY</span>
            </div>
          </div>
          <h2 id="active-scenario-title" className="lobby-scenario-title">
            Payment Service Checkout Outage
          </h2>
          <ul className="lobby-scenario-list">
            <li className="lobby-scenario-item">
              <span className="lobby-scenario-icon" style={{ color: 'var(--color-conflict)' }} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span><strong>Impact:</strong> Error rates spiked to 42% on payment services. Checkout page is frozen for customers.</span>
            </li>
            <li className="lobby-scenario-item">
              <span className="lobby-scenario-icon" style={{ color: 'var(--color-hypothesis)' }} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                  <line x1="6" y1="9" x2="6" y2="21" />
                </svg>
              </span>
              <span><strong>Suspected Cause:</strong> PR #492 deployed 15 minutes ago to core checkout routing.</span>
            </li>
            <li className="lobby-scenario-item">
              <span className="lobby-scenario-icon" style={{ color: 'var(--color-fact)' }} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              <span><strong>AURA Objective:</strong> Coordinate multi-responder audio, triage contradictions, track mitigation actions.</span>
            </li>
          </ul>
        </section>

        {/* Dynamic Financial Loss Rate Configuration */}
        <section className="lobby-config-section" aria-label="Incident financial parameters">
          <div className="lobby-section-header">
            <span className="lobby-section-title">
              Financial Burn Rate Telemetry:
            </span>
            <span className="lobby-section-meta">
              ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 60)}/min • ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 3600)}/hr
            </span>
          </div>

          <div className="lobby-cost-presets">
            {COST_PRESETS.map((p) => (
              <button
                key={p.rate}
                type="button"
                className={`lobby-cost-chip ${selectedRate === p.rate ? 'lobby-cost-chip--active' : ''}`}
                onClick={() => {
                  setSelectedRate(p.rate);
                  setCustomRateInput(p.rate.toString());
                }}
              >
                <span className="lobby-cost-chip-label">{p.label}</span>
                <span className="lobby-cost-chip-rate">${p.rate}/s</span>
              </button>
            ))}
          </div>

          <div className="lobby-custom-cost">
            <span className="lobby-custom-cost-label">Custom Loss Rate:</span>
            <div className="lobby-custom-cost-input-wrapper">
              <span className="lobby-custom-cost-prefix">$</span>
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
                className="lobby-custom-cost-input"
                placeholder="150"
                aria-label="Custom loss rate in dollars per second"
              />
              <span className="lobby-custom-cost-suffix">
                / sec
              </span>
            </div>
          </div>
        </section>

        {/* Join as section */}
        <section className="lobby-join-section" aria-label="Participant selection">
          <div className="lobby-section-title">
            Select Responder Callsign to Enter Bridge:
          </div>

          <div className="lobby-persona-list">
            {PERSONAS.map((persona) => (
              <button
                key={persona.uid}
                disabled={isConnecting}
                onClick={() => handleJoinPersona(persona)}
                className="lobby-persona-btn"
                type="button"
              >
                <div
                  className="lobby-persona-avatar"
                  style={{
                    backgroundColor: persona.avatarColor,
                    color: 'var(--text-inverse)',
                    boxShadow: `0 0 12px color-mix(in srgb, ${persona.avatarColor} 35%, transparent)`,
                  }}
                  aria-hidden="true"
                >
                  {persona.displayName[0]}
                </div>
                <div className="lobby-persona-info">
                  <div className="lobby-persona-name-row">
                    <span className="lobby-persona-name">
                      {persona.displayName}
                    </span>
                    <span className="lobby-persona-uid">
                      {persona.uid}
                    </span>
                  </div>
                  <span className="lobby-persona-role">
                    {persona.role}
                  </span>
                </div>
                <div className="lobby-persona-cta">
                  <span>{isConnecting ? 'CONNECTING' : 'ENTER BRIDGE'}</span>
                  <span aria-hidden="true" className="lobby-persona-arrow">→</span>
                </div>
              </button>
            ))}
          </div>

          {/* Custom Responder Option */}
          <form onSubmit={handleJoinCustom} className="lobby-custom-responder-card">
            <div className="lobby-custom-responder-header">
              <span>Or Enter Bridge With Custom Responder Callsign</span>
            </div>
            <div className="lobby-custom-responder-fields">
              <input
                type="text"
                placeholder="Your Name (e.g. Alex)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="lobby-custom-input"
                aria-label="Custom responder name"
              />
              <input
                type="text"
                placeholder="Role (e.g. SecOps Lead)"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="lobby-custom-input"
                aria-label="Custom responder role"
              />
              <button
                type="submit"
                disabled={!customName.trim() || isConnecting}
                className="lobby-custom-join-btn"
              >
                <span>{isConnecting ? 'CONNECTING...' : 'LAUNCH BRIDGE'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </section>

        {/* Info Box */}
        <div className="lobby-info-box" role="note">
          <span className="lobby-info-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <div className="lobby-info-text">
            <span><strong>Zero-Friction Audio Bridge:</strong> AURA AI activates automatically upon participant entry. Speak naturally across voice channels to test real-time epistemic classification and action extraction.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
