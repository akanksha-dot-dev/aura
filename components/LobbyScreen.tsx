'use client';

import React from 'react';
import { PERSONAS, PersonaConfig } from '@/lib/constants';

interface LobbyScreenProps {
  onJoin: (persona: PersonaConfig) => void;
  isConnecting?: boolean;
}

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
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
                onClick={() => onJoin(persona)}
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

