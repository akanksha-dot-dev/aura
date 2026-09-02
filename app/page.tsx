'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function DashboardContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || 'anonymous_responder';
  const name = searchParams.get('name') || 'Operator';
  const role = searchParams.get('role') || 'Incident Responder';
  const channel = searchParams.get('channel') || 'incident-war-room';

  const [hasConflict, setHasConflict] = useState(true);

  return (
    <div className={`command-center ${hasConflict ? 'has-conflict' : ''}`}>
      {/* 1. STATUS BAR */}
      <header
        className="status-bar"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          padding: '0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 'var(--z-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--color-aura)',
              letterSpacing: '0.1em',
              fontSize: 'var(--text-md)',
            }}
          >
            AURA
          </span>
          <span
            className="badge badge-conflict"
            style={{ fontSize: 'var(--text-xs)' }}
          >
            SEV-1 ACTIVE
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--text-primary)',
            }}
          >
            Incident Command Bridge: #{channel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setHasConflict(!hasConflict)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-emphasis)',
              background: hasConflict ? 'var(--color-conflict-dim)' : 'var(--bg-surface-raised)',
              color: hasConflict ? 'var(--color-conflict)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {hasConflict ? 'Conflict: Active' : 'Conflict: None'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'var(--bg-surface-raised)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-fact)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-primary)',
              }}
            >
              {name} ({role}) [{uid}]
            </span>
          </div>
        </div>
      </header>

      {/* 2. SPEAKER PANEL */}
      <aside
        className="speaker-panel"
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-default)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-1)',
          }}
        >
          SPEAKER PANEL (220px)
        </div>

        <div
          style={{
            background: 'var(--bg-surface-raised)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--color-aura)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-aura)',
            }}
          >
            AURA (AI Commander)
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Shadow Monitor Mode
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-raised)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--color-decision)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {role} (Active)
          </div>
        </div>
      </aside>

      {/* 3. CONFLICT BANNER */}
      {hasConflict && (
        <div
          className="conflict-banner"
          style={{
            background: 'var(--color-conflict-dim)',
            borderBottom: '1px solid var(--color-conflict-border)',
            padding: 'var(--space-2) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="badge badge-conflict">CONFLICT DETECTED</span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}
            >
              Theory A (Connection Pool) vs Theory B (Load Balancer Config)
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-hypothesis)',
            }}
          >
            Deciding Metric: Active DB Connections
          </span>
        </div>
      )}

      {/* 4. MAIN VIEW */}
      <main
        className="main-view"
        style={{
          background: 'var(--bg-base)',
          padding: 'var(--space-4)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}
          >
            MAIN VIEW / INCIDENT TIMELINE (1fr)
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Epistemic Stream (5-Type)
          </span>
        </div>

        <div className="timeline-card timeline-card--fact">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="badge badge-fact">FACT</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              14:02:15 • Confidence 85
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
            Database connection pool saturation reached 98% across primary cluster.
          </div>
        </div>

        <div className="timeline-card timeline-card--hypothesis">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="badge badge-hypothesis">HYPOTHESIS</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              14:03:00 • Confidence 70
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
            PR #492 migration introduced unindexed query causing slow transaction locks.
          </div>
        </div>

        <div className="timeline-card timeline-card--decision">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span className="badge badge-decision">DECISION</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              14:04:10 • Incident Commander
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
            Authorized immediate rollback of PR #492 and failover to replica.
          </div>
        </div>
      </main>

      {/* 5. ACTION TRACKER */}
      <aside
        className="action-tracker"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-1)',
          }}
        >
          ACTION TRACKER (240px)
        </div>

        <div
          style={{
            background: 'var(--bg-surface-raised)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            borderLeft: '3px solid var(--color-action)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span className="badge badge-action">ACTION</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-hypothesis)' }}>
              ETA 4m
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
            Execute rollback script for PR #492
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Assigned: Marcus (SRE)
          </div>
        </div>
      </aside>

      {/* 6. NARRATIVE BAR */}
      <div
        className="narrative-bar"
        style={{
          background: 'var(--bg-surface-raised)',
          borderTop: '1px solid var(--border-default)',
          padding: 'var(--space-2) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-aura)',
            fontWeight: 'var(--weight-semibold)',
            whiteSpace: 'nowrap',
          }}
        >
          SBAR SUMMARY:
        </span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Situation: SEV-1 Postgres pool exhaustion. Background: PR #492 deployed 14:00. Assessment: Rollback in progress. Recommendation: Verify connection count drops below 40%.
        </span>
      </div>

      {/* 7. INCIDENT STATS */}
      <div
        className="incident-stats"
        style={{
          background: 'var(--bg-surface-raised)',
          borderTop: '1px solid var(--border-default)',
          borderLeft: '1px solid var(--border-default)',
          padding: 'var(--space-2) var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            OODA PHASE
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-act)', fontWeight: 'var(--weight-bold)' }}>
            ACT
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            BURN RATE
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-sev0)', fontWeight: 'var(--weight-bold)' }}>
            $150/s
          </div>
        </div>
      </div>

      {/* 8. LIVE CAPTIONS */}
      <footer
        className="live-captions"
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-emphasis)',
          padding: '0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-aura)' }}>
            LIVE CAPTIONS:
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
            &quot;Marcus: Connection pool utilization dropped to 72% following container restart...&quot;
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          RTC Audio Active
        </span>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Loading Incident Command Bridge...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
