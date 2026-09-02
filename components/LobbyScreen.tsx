'use client';

import React from 'react';
import { PERSONAS, PersonaConfig } from '@/lib/constants';

interface LobbyScreenProps {
  onJoin: (persona: PersonaConfig) => void;
  isConnecting?: boolean;
}

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      background: 'var(--bg-base)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '640px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-aura)',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-1)',
          }}>
            AURA
          </h1>
          <p style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            fontWeight: 'var(--weight-medium)',
          }}>
            Incident Command Center
          </p>
        </div>

        {/* Scenario Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-1)',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-conflict)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Active Scenario
            </span>
            <span className="badge badge-conflict">SEV-1 OUTAGE</span>
          </div>
          <h2 style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
          }}>
            Payment Service Checkout Outage
          </h2>
          <ul style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1h)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-base)',
          }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-conflict)' }}>•</span> Error rates spiked to 42% on payment services.
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-conflict)' }}>•</span> Checkout page is frozen for customers.
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-hypothesis)' }}>•</span> Suspected: PR #492 deployed 15 minutes ago.
            </li>
          </ul>
        </div>

        {/* Join as section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Join War Room As:
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
            {PERSONAS.map((persona) => (
              <button
                key={persona.uid}
                disabled={isConnecting}
                onClick={() => onJoin(persona)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) var(--space-5)',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderLeft: `4px solid ${persona.avatarColor}`,
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  opacity: isConnecting ? 0.6 : 1,
                  transition: 'background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.background = 'var(--bg-surface-hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.borderColor = 'var(--border-emphasis)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConnecting) {
                    e.currentTarget.style.background = 'var(--bg-surface-raised)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  background: persona.avatarColor,
                  color: 'var(--text-inverse)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-bold)',
                  flexShrink: 0,
                }}>
                  {persona.displayName[0]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1 }}>
                  <span style={{
                    fontSize: 'var(--text-md)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--text-primary)',
                  }}>
                    {persona.displayName}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                  }}>
                    {persona.role}
                  </span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}>
                  ENTER →
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--color-aura)' }}>💡</span>
          <span>AURA will join automatically after the first participant connects. Speak naturally.</span>
        </div>
      </div>
    </div>
  );
}
