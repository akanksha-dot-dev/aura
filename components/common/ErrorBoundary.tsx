'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught component runtime exception:', error, errorInfo.componentStack);
  }

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const displayError =
        this.state.error?.message?.slice(0, 200) ||
        this.props.fallbackMessage ||
        'An operational runtime exception occurred on the bridge.';

      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232, 84, 84, 0.08) 0%, transparent 70%), var(--bg-base)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '90%',
              padding: 'var(--space-6)',
              background: 'var(--bg-glass-panel)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-glass-emphasis)',
              borderLeft: '4px solid var(--color-conflict)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-modal), 0 0 32px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ color: 'var(--color-conflict)', display: 'flex', alignItems: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              OPERATIONAL FAULT DETECTED
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {displayError}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                background: 'var(--color-aura)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 10px rgba(212, 168, 83, 0.25)',
                transition: 'all var(--duration-fast)',
              }}
            >
              Reload Command Bridge
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
