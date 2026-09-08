import React from 'react';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ channel: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { channel } = await params;
  const displayChannel = decodeURIComponent(channel);
  return {
    title: `🛡️ AURA War Room — ${displayChannel}`,
    description: `Live incident response war room. AURA AI Incident Commander is active on channel: ${displayChannel}`,
  };
}

async function getWarRoomData(channel: string) {
  // In production, this would fetch from the DB/incident store.
  // For demo, we return a plausible structure.
  const decodedChannel = decodeURIComponent(channel);

  // Try to match a known scenario
  const scenarioMap: Record<string, { title: string; severity: string; status: string; affectedServices: string[] }> = {
    'incident-sev1-checkout': {
      title: 'Payment Gateway Degradation & Checkout Outage',
      severity: 'SEV-1',
      status: 'investigating',
      affectedServices: ['payment-api', 'checkout-service', 'postgres-primary'],
    },
    'incident-sev2-cdn': {
      title: 'CDN Cache Invalidation Storm — Global Latency Spike',
      severity: 'SEV-2',
      status: 'investigating',
      affectedServices: ['cdn-edge', 'static-assets', 'image-service'],
    },
    'incident-sev0-auth': {
      title: 'Authentication Service Compromise — Suspicious Token Generation',
      severity: 'SEV-0',
      status: 'investigating',
      affectedServices: ['auth-service', 'token-service', 'user-api'],
    },
    'incident-sev1-k8s': {
      title: 'Kubernetes Node Pool Exhaustion — Pod Eviction Cascade',
      severity: 'SEV-1',
      status: 'investigating',
      affectedServices: ['k8s-control-plane', 'api-gateway', 'worker-pool'],
    },
  };

  return scenarioMap[decodedChannel] ?? {
    title: `Live Incident — ${decodedChannel}`,
    severity: 'SEV-1',
    status: 'investigating',
    affectedServices: [decodedChannel],
  };
}

const SEV_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'SEV-0': { bg: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: 'rgba(244,63,94,0.35)' },
  'SEV-1': { bg: 'rgba(249,115,22,0.15)', color: '#F97316', border: 'rgba(249,115,22,0.35)' },
  'SEV-2': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.35)' },
  'SEV-3': { bg: 'rgba(113,113,122,0.15)', color: '#71717A', border: 'rgba(113,113,122,0.35)' },
};

const AVATAR_COLORS = ['#F43F5E', '#10B981', '#6366F1', '#F97316', '#F59E0B', '#9B59B6'];

export default async function WarRoomPage({ params, searchParams }: PageProps) {
  const { channel } = await params;
  const sp = await searchParams;
  const incident = await getWarRoomData(channel);
  const decodedChannel = decodeURIComponent(channel);

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/?channel=${encodeURIComponent(decodedChannel)}&uid=responder_${Math.random().toString(36).slice(2, 5)}&name=Responder&role=Incident+Responder`;

  const sevStyle = SEV_STYLES[incident.severity] ?? SEV_STYLES['SEV-1'];

  // Mock live participant data (in production, fetched from incident store)
  const liveParticipants = [
    { uid: 'aura_agent', displayName: 'AURA', role: 'AI Incident Commander', avatarColor: '#F59E0B', isAI: true },
    { uid: 'ic_001', displayName: 'Incident Commander', role: 'Command Lead', avatarColor: '#F43F5E', isAI: false },
    { uid: 'sre_001', displayName: 'On-Call SRE', role: 'Infrastructure', avatarColor: '#10B981', isAI: false },
  ];

  const startedMinsAgo = Math.floor(Math.random() * 30) + 5;
  const costPerHr = incident.severity === 'SEV-0' ? 500 : incident.severity === 'SEV-1' ? 200 : 75;
  const costAccrued = Math.floor((startedMinsAgo / 60) * costPerHr);

  return (
    <div className="war-room-status-page">
      <div className="wrs-card">
        {/* Header */}
        <div className="wrs-header">
          <div className="wrs-brand">
            <div className="wrs-logo">🛡️</div>
            <div className="wrs-brand-text">
              <span className="wrs-brand-name">AURA</span>
              <span className="wrs-brand-sub">AI Incident Commander</span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <div className="wrs-live-badge">
                <div className="wrs-live-dot" />
                Live
              </div>
            </div>
          </div>

          <h1 className="wrs-title">{incident.title}</h1>

          <div className="wrs-severity-row">
            <span
              className="wrs-severity-badge"
              style={{
                '--sev-bg': sevStyle.bg,
                '--sev-color': sevStyle.color,
                '--sev-border': sevStyle.border,
              } as React.CSSProperties}
            >
              {incident.severity}
            </span>
            <span className="wrs-channel">#{decodedChannel}</span>
          </div>
        </div>

        {/* Body */}
        <div className="wrs-body">
          {/* Stats */}
          <div className="wrs-stats-row">
            <div className="wrs-stat">
              <div className="wrs-stat-value">{startedMinsAgo}m</div>
              <div className="wrs-stat-label">Active</div>
            </div>
            <div className="wrs-stat">
              <div className="wrs-stat-value">{liveParticipants.length}</div>
              <div className="wrs-stat-label">In Room</div>
            </div>
            <div className="wrs-stat">
              <div className="wrs-stat-value" style={{ color: '#F97316' }}>${costAccrued}</div>
              <div className="wrs-stat-label">Accrued</div>
            </div>
          </div>

          {/* Affected Services */}
          <div>
            <p className="wrs-section-title">Affected Services</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {incident.affectedServices.map(svc => (
                <span
                  key={svc}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    padding: '2px 10px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#A1A1AA',
                  }}
                >
                  {svc}
                </span>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <p className="wrs-section-title">Participants in War Room</p>
            <div className="wrs-participants">
              {liveParticipants.map((p, i) => (
                <div key={p.uid} className="wrs-participant">
                  <div
                    className="wrs-participant-avatar"
                    style={{ background: p.avatarColor }}
                  >
                    {p.isAI ? '🤖' : p.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="wrs-participant-name">
                      {p.displayName}
                      {p.isAI && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>
                          AI
                        </span>
                      )}
                    </div>
                    <div className="wrs-participant-role">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <a href={dashboardUrl} className="wrs-join-btn">
            ⚡ Join the War Room
          </a>

          {/* AURA status note */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#A1A1AA',
          }}>
            <span style={{ fontSize: '16px' }}>🤖</span>
            <span>
              <strong style={{ color: '#F59E0B' }}>AURA</strong> is actively monitoring this incident,
              logging evidence, and guiding the team through the OODA loop in real-time.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="wrs-footer">
          <span className="wrs-footer-text">
            Share this link to invite additional responders
          </span>
          <div className="wrs-aura-credit">
            <span>🛡️</span>
            <span>Powered by AURA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
