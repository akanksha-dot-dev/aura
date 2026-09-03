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

  return (
    <div className="lobby-container">
      <div className="lobby-content">
        {/* Header */}
        <header className="lobby-header">
          <h1 className="lobby-title">
            AURA
          </h1>
          <p className="lobby-subtitle">
            Incident Command Center
          </p>
        </header>

        {/* Scenario Card */}
        <section className="lobby-scenario-card" aria-labelledby="active-scenario-title">
          <div className="lobby-scenario-header">
            <span className="lobby-scenario-tag">
              Active Scenario
            </span>
            <span className="badge badge-conflict">SEV-1 OUTAGE</span>
          </div>
          <h2 id="active-scenario-title" className="lobby-scenario-title">
            Payment Service Checkout Outage
          </h2>
          <ul className="lobby-scenario-list">
            <li className="lobby-scenario-item">
              <span style={{ color: 'var(--color-conflict)' }}>•</span> Error rates spiked to 42% on payment services.
            </li>
            <li className="lobby-scenario-item">
              <span style={{ color: 'var(--color-conflict)' }}>•</span> Checkout page is frozen for customers.
            </li>
            <li className="lobby-scenario-item">
              <span style={{ color: 'var(--color-hypothesis)' }}>•</span> Suspected: PR #492 deployed 15 minutes ago.
            </li>
          </ul>
        </section>

        {/* Dynamic Financial Loss Rate Configuration */}
        <section className="lobby-config-section" aria-label="Incident financial parameters">
          <div className="lobby-section-title">
            Incident Financial Burn Rate:
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
            <span className="lobby-custom-cost-label">Custom Rate:</span>
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
                / sec (~${new Intl.NumberFormat('en-US').format((Number(customRateInput) || selectedRate) * 3600)}/hr)
              </span>
            </div>
          </div>
        </section>

        {/* Join as section */}
        <section className="lobby-persona-list" aria-label="Participant selection">
          <div className="lobby-section-title">
            Join War Room As:
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
                  }}
                  aria-hidden="true"
                >
                  {persona.displayName[0]}
                </div>
                <div className="lobby-persona-info">
                  <span className="lobby-persona-name">
                    {persona.displayName}
                  </span>
                  <span className="lobby-persona-role">
                    {persona.role}
                  </span>
                </div>
                <div className="lobby-persona-cta">
                  <span>ENTER</span>
                  <span aria-hidden="true">→</span>
                </div>
              </button>
            ))}
          </div>

          {/* Custom Responder Option */}
          <form onSubmit={handleJoinCustom} className="lobby-custom-responder-card">
            <div className="lobby-custom-responder-header">
              Or Join With Custom Responder Callsign
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
                <span>LAUNCH</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </section>

        {/* Info Box */}
        <div className="lobby-info-box" role="note">
          <span className="lobby-info-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <span>AURA will join automatically after the first participant connects. Speak naturally.</span>
        </div>
      </div>
    </div>
  );
}

