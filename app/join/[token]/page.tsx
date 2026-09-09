'use client';

import React, { useCallback, useEffect, useState } from 'react';

/**
 * Join Page — Landing page for invite links.
 *
 * Flow:
 * 1. Validates the token from the URL
 * 2. Shows incident context card (title, severity, role)
 * 3. "Join as [role]" button → redirects to lobby/war room
 * 4. Expired/invalid token → shows error state
 */

interface InviteData {
  valid: boolean;
  channelName?: string;
  role?: string;
  roleInfo?: {
    label: string;
    description: string;
    permissions: string[];
  };
  persona?: string;
  incidentTitle?: string;
  severity?: string;
  expiresAt?: string;
  remainingMinutes?: number;
  error?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  'SEV-0': '#F43F5E',
  'SEV-1': '#F97316',
  'SEV-2': '#F59E0B',
  'SEV-3': '#71717A',
};

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const resolvedParams = React.use(params);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/invite?token=${resolvedParams.token}`);
        const data = await res.json();
        setInviteData(data);
      } catch {
        setInviteData({ valid: false, error: 'Unable to validate invite link.' });
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [resolvedParams.token]);

  const handleJoin = useCallback(() => {
    if (!inviteData?.channelName) return;
    setJoining(true);

    // Build lobby URL with role info
    const lobbyParams = new URLSearchParams({
      channel: inviteData.channelName,
      role: inviteData.role || 'participant',
    });
    if (inviteData.persona) lobbyParams.set('persona', inviteData.persona);
    if (inviteData.incidentTitle) lobbyParams.set('title', inviteData.incidentTitle);

    window.location.href = `/lobby?${lobbyParams.toString()}`;
  }, [inviteData]);

  const sevColor = inviteData?.severity ? SEVERITY_COLORS[inviteData.severity] || '#71717A' : '#71717A';

  return (
    <>
      <style>{`
        .join-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
        }

        .join-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .join-card__logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .join-card__logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #818cf8, #6366f1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .join-card__logo-text {
          color: #e4e4e7;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .join-card__severity {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .join-card__severity-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .join-card__title {
          color: #f4f4f5;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }

        .join-card__channel {
          color: #a1a1aa;
          font-size: 13px;
          margin-bottom: 24px;
          font-family: 'JetBrains Mono', monospace;
        }

        .join-card__role-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .join-card__role-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .join-card__role-label {
          color: #c7c7cc;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .join-card__role-name {
          color: #e4e4e7;
          font-size: 15px;
          font-weight: 600;
        }

        .join-card__role-desc {
          color: #71717a;
          font-size: 12px;
          margin-top: 4px;
          line-height: 1.4;
        }

        .join-card__permissions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 24px;
        }

        .join-card__perm-tag {
          font-size: 11px;
          color: #a1a1aa;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 3px 8px;
        }

        .join-card__expiry {
          color: #71717a;
          font-size: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .join-card__button {
          width: 100%;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .join-card__button--primary {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .join-card__button--primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        }

        .join-card__button--primary:active {
          transform: translateY(0);
        }

        .join-card__button--disabled {
          background: rgba(255, 255, 255, 0.1);
          color: #71717a;
          cursor: not-allowed;
        }

        /* Loading state */
        .join-card__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px 0;
        }

        .join-card__spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Error state */
        .join-card__error {
          text-align: center;
          padding: 20px 0;
        }

        .join-card__error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .join-card__error-title {
          color: #f4f4f5;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .join-card__error-text {
          color: #71717a;
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>

      <div className="join-page">
        <div className="join-card">
          {/* Logo */}
          <div className="join-card__logo">
            <div className="join-card__logo-icon">🤖</div>
            <span className="join-card__logo-text">AURA War Room</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="join-card__loading">
              <div className="join-card__spinner" />
              <span style={{ color: '#a1a1aa', fontSize: 14 }}>Validating invite link…</span>
            </div>
          )}

          {/* Error / Expired */}
          {!loading && (!inviteData || !inviteData.valid) && (
            <div className="join-card__error">
              <div className="join-card__error-icon">🔒</div>
              <div className="join-card__error-title">
                {inviteData?.error === 'Token expired' ? 'Invite Expired' : 'Invalid Invite'}
              </div>
              <div className="join-card__error-text">
                {inviteData?.error === 'Token expired'
                  ? 'This incident war room invite has expired. The incident may have been resolved or the link has timed out.'
                  : 'This invite link is not valid. It may have been revoked or tampered with.'}
              </div>
            </div>
          )}

          {/* Valid invite */}
          {!loading && inviteData?.valid && (
            <>
              {/* Severity badge */}
              {inviteData.severity && (
                <div
                  className="join-card__severity"
                  style={{
                    background: `${sevColor}18`,
                    color: sevColor,
                    border: `1px solid ${sevColor}30`,
                  }}
                >
                  <div className="join-card__severity-dot" style={{ background: sevColor }} />
                  {inviteData.severity}
                </div>
              )}

              {/* Title */}
              <h1 className="join-card__title">
                {inviteData.incidentTitle || 'Incident War Room'}
              </h1>
              <div className="join-card__channel">
                #{inviteData.channelName}
              </div>

              {/* Role badge */}
              <div className="join-card__role-badge">
                <div className="join-card__role-icon">
                  {inviteData.role === 'observer' ? '👁️' : inviteData.role === 'commander' ? '⭐' : '🎙️'}
                </div>
                <div>
                  <div className="join-card__role-label">Your Role</div>
                  <div className="join-card__role-name">{inviteData.roleInfo?.label || inviteData.role}</div>
                  <div className="join-card__role-desc">{inviteData.roleInfo?.description}</div>
                </div>
              </div>

              {/* Permissions */}
              {inviteData.roleInfo?.permissions && (
                <div className="join-card__permissions">
                  {inviteData.roleInfo.permissions.map((perm) => (
                    <span key={perm} className="join-card__perm-tag">
                      {perm.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* Expiry */}
              <div className="join-card__expiry">
                ⏱️ Link expires in {inviteData.remainingMinutes} minutes
              </div>

              {/* Join button */}
              <button
                className={`join-card__button ${joining ? 'join-card__button--disabled' : 'join-card__button--primary'}`}
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <>
                    <div className="join-card__spinner" style={{ width: 16, height: 16 }} />
                    Joining…
                  </>
                ) : (
                  <>🚀 Join as {inviteData.roleInfo?.label || 'Participant'}</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
