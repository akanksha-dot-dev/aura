'use client';

import React, { useEffect, useState, useMemo } from 'react';

/**
 * Executive Intelligence Dashboard — Pillar 2
 *
 * Provides historical incident analytics for management visibility:
 * - Incident overview with MTTR trends
 * - Team performance rankings
 * - Repeat offender detection
 * - Service frequency analysis
 * - AI-powered similar incident suggestions
 * - Time-of-day incident heatmap
 */

interface DashboardStats {
  total: number;
  open: number;
  resolved: number;
  avgMttrMs: number;
}

interface MttrBySeverity {
  severity: string;
  count: number;
  avg_mttr: number | null;
}

interface TopService {
  service: string;
  count: number;
}

interface TeamStat {
  team_name: string;
  incident_count: number;
  avg_mttr: number | null;
  resolved_count: number;
}

interface RepeatOffender {
  service: string;
  incidentCount: number;
  severityBreakdown: Record<string, number>;
  needsAttention: boolean;
}

interface RecurringPattern {
  services: string[];
  rootCause: string;
  occurrences: number;
  lastOccurred: number;
  recommendation: string;
}

interface OverviewData {
  stats: DashboardStats;
  mttrBySeverity: MttrBySeverity[];
  topServices: TopService[];
  cost: { totalAccrued: number; averagePerIncident: number };
}

interface TeamsData {
  teams: TeamStat[];
  repeatOffenders: RepeatOffender[];
}

interface PatternsData {
  serviceFrequency: Record<string, number>;
  recurringPatterns: RecurringPattern[];
  timeHeatmap: Array<{ day: number; hour: number; count: number }>;
}

type TabView = 'overview' | 'teams' | 'patterns';

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '—';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function formatCost(cost: number): string {
  if (cost >= 1_000_000) return `$${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `$${(cost / 1_000).toFixed(1)}K`;
  return `$${cost.toLocaleString()}`;
}

const SEV_COLORS: Record<string, string> = {
  'SEV-0': '#F43F5E',
  'SEV-1': '#F97316',
  'SEV-2': '#F59E0B',
  'SEV-3': '#71717A',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [daysBack, setDaysBack] = useState(90);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [patternsData, setPatternsData] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const [ovRes, tmRes, ptRes] = await Promise.all([
          fetch(`/api/dashboard?view=overview&days=${daysBack}`),
          fetch(`/api/dashboard?view=teams&days=${daysBack}`),
          fetch(`/api/dashboard?view=patterns&days=${daysBack}`),
        ]);

        if (ovRes.ok) setOverview(await ovRes.json());
        if (tmRes.ok) setTeamsData(await tmRes.json());
        if (ptRes.ok) setPatternsData(await ptRes.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [daysBack]);

  return (
    <>
      <style>{dashboardStyles}</style>
      <div className="dash">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header__left">
            <a href="/lobby" className="dash-logo">
              <span className="dash-logo__icon">🛡️</span>
              <span className="dash-logo__text">AURA</span>
            </a>
            <div className="dash-header__divider" />
            <h1 className="dash-header__title">Incident Intelligence</h1>
          </div>
          <div className="dash-header__right">
            <select
              className="dash-select"
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="dash-tabs">
          {(['overview', 'teams', 'patterns'] as TabView[]).map((tab) => (
            <button
              key={tab}
              className={`dash-tab ${activeTab === tab ? 'dash-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '📊'}
              {tab === 'teams' && '👥'}
              {tab === 'patterns' && '🔄'}
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="dash-content">
          {loading && <div className="dash-loading"><div className="dash-spinner" />Loading intelligence data…</div>}
          {error && <div className="dash-error">⚠️ {error}</div>}
          {!loading && !error && activeTab === 'overview' && overview && (
            <OverviewTab data={overview} />
          )}
          {!loading && !error && activeTab === 'teams' && teamsData && (
            <TeamsTab data={teamsData} />
          )}
          {!loading && !error && activeTab === 'patterns' && patternsData && (
            <PatternsTab data={patternsData} />
          )}
        </main>
      </div>
    </>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div className="dash-grid">
      {/* Stat Cards */}
      <div className="dash-stat-row">
        <StatCard label="Total Incidents" value={String(data.stats.total)} icon="📋" />
        <StatCard label="Open" value={String(data.stats.open)} icon="🔴" accent="#F43F5E" />
        <StatCard label="Resolved" value={String(data.stats.resolved)} icon="✅" accent="#10B981" />
        <StatCard label="Avg MTTR" value={formatDuration(data.stats.avgMttrMs)} icon="⏱️" accent="#6366F1" />
        <StatCard label="Total Cost" value={formatCost(data.cost.totalAccrued)} icon="💰" accent="#F59E0B" />
      </div>

      {/* MTTR by Severity */}
      <div className="dash-card">
        <h3 className="dash-card__title">MTTR by Severity</h3>
        <div className="dash-mttr-bars">
          {data.mttrBySeverity.map((item) => {
            const maxMttr = Math.max(...data.mttrBySeverity.map(m => m.avg_mttr || 0), 1);
            const width = item.avg_mttr ? (item.avg_mttr / maxMttr) * 100 : 0;
            return (
              <div key={item.severity} className="dash-mttr-row">
                <span className="dash-mttr-label" style={{ color: SEV_COLORS[item.severity] || '#71717A' }}>
                  {item.severity}
                </span>
                <div className="dash-mttr-bar-track">
                  <div
                    className="dash-mttr-bar-fill"
                    style={{
                      width: `${Math.max(2, width)}%`,
                      background: `linear-gradient(90deg, ${SEV_COLORS[item.severity] || '#71717A'}, ${SEV_COLORS[item.severity] || '#71717A'}88)`,
                    }}
                  />
                </div>
                <span className="dash-mttr-value">
                  {formatDuration(item.avg_mttr)} <span className="dash-mttr-count">({item.count})</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Affected Services */}
      <div className="dash-card">
        <h3 className="dash-card__title">Top Affected Services</h3>
        <div className="dash-service-list">
          {data.topServices.map((svc, i) => {
            const maxCount = data.topServices[0]?.count || 1;
            return (
              <div key={svc.service} className="dash-service-row">
                <span className="dash-service-rank">#{i + 1}</span>
                <span className="dash-service-name">{svc.service}</span>
                <div className="dash-service-bar-track">
                  <div
                    className="dash-service-bar-fill"
                    style={{ width: `${(svc.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="dash-service-count">{svc.count}</span>
              </div>
            );
          })}
          {data.topServices.length === 0 && (
            <p className="dash-empty">No incident data yet. Resolve incidents to populate analytics.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab({ data }: { data: TeamsData }) {
  return (
    <div className="dash-grid">
      {/* Repeat Offenders Panel */}
      {data.repeatOffenders.length > 0 && (
        <div className="dash-card dash-card--alert">
          <h3 className="dash-card__title">⚠️ Repeat Offenders — Services Needing Attention</h3>
          <p className="dash-card__subtitle">Services with 3+ incidents in the selected period</p>
          <div className="dash-offender-list">
            {data.repeatOffenders.map((ro) => (
              <div key={ro.service} className={`dash-offender ${ro.needsAttention ? 'dash-offender--critical' : ''}`}>
                <div className="dash-offender__header">
                  <span className="dash-offender__name">{ro.service}</span>
                  <span className="dash-offender__count">{ro.incidentCount} incidents</span>
                </div>
                <div className="dash-offender__breakdown">
                  {Object.entries(ro.severityBreakdown).map(([sev, count]) => (
                    <span key={sev} className="dash-offender__sev" style={{ color: SEV_COLORS[sev] }}>
                      {sev}: {count}
                    </span>
                  ))}
                </div>
                {ro.needsAttention && (
                  <div className="dash-offender__alert">
                    🚨 This service needs immediate engineering attention
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Performance */}
      <div className="dash-card">
        <h3 className="dash-card__title">Team Performance</h3>
        {data.teams.length > 0 ? (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Incidents</th>
                <th>Avg MTTR</th>
                <th>Resolved</th>
                <th>Resolution Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((team) => {
                const resRate = team.incident_count > 0
                  ? Math.round((team.resolved_count / team.incident_count) * 100)
                  : 0;
                return (
                  <tr key={team.team_name}>
                    <td className="dash-table__team">{team.team_name}</td>
                    <td>{team.incident_count}</td>
                    <td>{formatDuration(team.avg_mttr)}</td>
                    <td>{team.resolved_count}</td>
                    <td>
                      <div className="dash-rate-bar">
                        <div className="dash-rate-fill" style={{ width: `${resRate}%` }} />
                        <span>{resRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="dash-empty">
            No team data yet. Assign teams to incidents using the postmortem workflow.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Patterns Tab ─────────────────────────────────────────────────────────────

function PatternsTab({ data }: { data: PatternsData }) {
  const maxHeatmapCount = useMemo(
    () => Math.max(...data.timeHeatmap.map(h => h.count), 1),
    [data.timeHeatmap]
  );

  return (
    <div className="dash-grid">
      {/* Recurring Patterns */}
      {data.recurringPatterns.length > 0 && (
        <div className="dash-card">
          <h3 className="dash-card__title">🔄 Recurring Incident Patterns</h3>
          <p className="dash-card__subtitle">Service + root cause combinations that repeat</p>
          <div className="dash-pattern-list">
            {data.recurringPatterns.map((pat, i) => (
              <div key={i} className="dash-pattern">
                <div className="dash-pattern__header">
                  <div className="dash-pattern__services">
                    {pat.services.map((s) => (
                      <span key={s} className="dash-tag">{s}</span>
                    ))}
                  </div>
                  <span className="dash-pattern__occurrences">{pat.occurrences}× occurrences</span>
                </div>
                <div className="dash-pattern__cause">Root cause: {pat.rootCause}</div>
                <div className="dash-pattern__recommendation">
                  💡 {pat.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Heatmap */}
      <div className="dash-card">
        <h3 className="dash-card__title">🕐 Incident Frequency Heatmap</h3>
        <p className="dash-card__subtitle">When do incidents most frequently occur?</p>
        <div className="dash-heatmap">
          <div className="dash-heatmap__header">
            <div className="dash-heatmap__corner" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="dash-heatmap__hour">{h}</div>
            ))}
          </div>
          {DAY_NAMES.map((day, dayIdx) => (
            <div key={day} className="dash-heatmap__row">
              <div className="dash-heatmap__day">{day}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const entry = data.timeHeatmap.find(
                  h => h.day === dayIdx && h.hour === hour
                );
                const count = entry?.count || 0;
                const intensity = count > 0 ? Math.max(0.15, count / maxHeatmapCount) : 0;
                return (
                  <div
                    key={hour}
                    className="dash-heatmap__cell"
                    style={{
                      background: count > 0
                        ? `rgba(249, 115, 22, ${intensity})`
                        : 'rgba(255,255,255,0.02)',
                    }}
                    title={`${day} ${hour}:00 — ${count} incident${count !== 1 ? 's' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Service Frequency */}
      <div className="dash-card">
        <h3 className="dash-card__title">Service Incident Frequency</h3>
        <div className="dash-freq-grid">
          {Object.entries(data.serviceFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12)
            .map(([svc, count]) => (
              <div key={svc} className="dash-freq-item">
                <span className="dash-freq-name">{svc}</span>
                <span className="dash-freq-count">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="dash-stat-card" style={{ '--stat-accent': accent || '#6366F1' } as React.CSSProperties}>
      <div className="dash-stat-card__icon">{icon}</div>
      <div className="dash-stat-card__value">{value}</div>
      <div className="dash-stat-card__label">{label}</div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const dashboardStyles = `
  .dash {
    min-height: 100vh;
    background: #0a0a1a;
    color: #e4e4e7;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }

  .dash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .dash-header__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dash-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }

  .dash-logo__icon { font-size: 22px; }
  .dash-logo__text { font-size: 18px; font-weight: 800; color: #F59E0B; letter-spacing: 2px; }

  .dash-header__divider {
    width: 1px;
    height: 24px;
    background: rgba(255,255,255,0.1);
  }

  .dash-header__title {
    font-size: 16px;
    font-weight: 600;
    color: #a1a1aa;
  }

  .dash-select {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e4e4e7;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }

  .dash-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .dash-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: #71717a;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dash-tab:hover { background: rgba(255,255,255,0.05); color: #a1a1aa; }
  .dash-tab--active { background: rgba(245,158,11,0.1); color: #F59E0B; font-weight: 600; }

  .dash-content { padding: 24px; }

  .dash-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 80px 24px;
    color: #71717a;
    font-size: 14px;
  }

  .dash-spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.1);
    border-top-color: #F59E0B;
    border-radius: 50%;
    animation: dash-spin 0.8s linear infinite;
  }

  @keyframes dash-spin { to { transform: rotate(360deg); } }

  .dash-error {
    padding: 16px 24px;
    background: rgba(244,63,94,0.1);
    border: 1px solid rgba(244,63,94,0.2);
    border-radius: 8px;
    color: #F43F5E;
    font-size: 13px;
  }

  .dash-grid { display: flex; flex-direction: column; gap: 20px; }

  .dash-stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .dash-stat-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s;
  }

  .dash-stat-card:hover { border-color: var(--stat-accent, rgba(255,255,255,0.12)); }
  .dash-stat-card__icon { font-size: 20px; }
  .dash-stat-card__value { font-size: 28px; font-weight: 800; color: #fafafa; font-variant-numeric: tabular-nums; }
  .dash-stat-card__label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

  .dash-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 20px;
  }

  .dash-card--alert { border-color: rgba(249,115,22,0.25); }

  .dash-card__title { font-size: 14px; font-weight: 700; color: #fafafa; margin: 0 0 4px; }
  .dash-card__subtitle { font-size: 12px; color: #71717a; margin: 0 0 16px; }

  .dash-empty { color: #52525b; font-size: 13px; text-align: center; padding: 24px; }

  /* MTTR Bars */
  .dash-mttr-bars { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
  .dash-mttr-row { display: flex; align-items: center; gap: 12px; }
  .dash-mttr-label { font-size: 12px; font-weight: 700; width: 50px; text-align: right; }
  .dash-mttr-bar-track { flex: 1; height: 20px; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; }
  .dash-mttr-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .dash-mttr-value { font-size: 12px; font-weight: 600; color: #a1a1aa; width: 100px; }
  .dash-mttr-count { color: #52525b; font-weight: 400; }

  /* Service List */
  .dash-service-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .dash-service-row { display: flex; align-items: center; gap: 10px; }
  .dash-service-rank { font-size: 11px; color: #52525b; width: 24px; }
  .dash-service-name { font-size: 12px; font-family: 'JetBrains Mono', monospace; color: #a1a1aa; width: 180px; overflow: hidden; text-overflow: ellipsis; }
  .dash-service-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.03); border-radius: 3px; overflow: hidden; }
  .dash-service-bar-fill { height: 100%; background: linear-gradient(90deg, #6366F1, #8B5CF6); border-radius: 3px; transition: width 0.5s ease; }
  .dash-service-count { font-size: 12px; font-weight: 600; color: #71717a; width: 30px; text-align: right; }

  /* Repeat Offenders */
  .dash-offender-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
  .dash-offender {
    padding: 12px 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
  }
  .dash-offender--critical { border-color: rgba(244,63,94,0.3); background: rgba(244,63,94,0.04); }
  .dash-offender__header { display: flex; justify-content: space-between; align-items: center; }
  .dash-offender__name { font-size: 13px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
  .dash-offender__count { font-size: 12px; color: #F97316; font-weight: 600; }
  .dash-offender__breakdown { display: flex; gap: 12px; margin-top: 6px; }
  .dash-offender__sev { font-size: 11px; font-weight: 600; }
  .dash-offender__alert { font-size: 11px; color: #F43F5E; margin-top: 8px; font-weight: 600; }

  /* Table */
  .dash-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .dash-table th { font-size: 11px; color: #52525b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: left; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .dash-table td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .dash-table__team { font-weight: 600; }
  .dash-rate-bar { position: relative; height: 18px; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; }
  .dash-rate-fill { height: 100%; background: linear-gradient(90deg, #10B981, #34D399); border-radius: 4px; }
  .dash-rate-bar span { position: absolute; right: 6px; top: 1px; font-size: 10px; font-weight: 700; color: #fafafa; }

  /* Patterns */
  .dash-pattern-list { display: flex; flex-direction: column; gap: 12px; }
  .dash-pattern {
    padding: 14px 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
  }
  .dash-pattern__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .dash-pattern__services { display: flex; gap: 6px; flex-wrap: wrap; }
  .dash-tag { font-size: 11px; font-family: 'JetBrains Mono', monospace; padding: 2px 8px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 4px; color: #818CF8; }
  .dash-pattern__occurrences { font-size: 12px; color: #F97316; font-weight: 600; }
  .dash-pattern__cause { font-size: 12px; color: #a1a1aa; margin-top: 6px; }
  .dash-pattern__recommendation { font-size: 12px; color: #10B981; margin-top: 8px; padding: 8px 12px; background: rgba(16,185,129,0.06); border-radius: 6px; }

  /* Heatmap */
  .dash-heatmap { margin-top: 12px; overflow-x: auto; }
  .dash-heatmap__header { display: flex; margin-bottom: 2px; }
  .dash-heatmap__corner { width: 36px; flex-shrink: 0; }
  .dash-heatmap__hour { width: 24px; font-size: 9px; color: #52525b; text-align: center; flex-shrink: 0; }
  .dash-heatmap__row { display: flex; margin-bottom: 2px; }
  .dash-heatmap__day { width: 36px; font-size: 10px; color: #71717a; display: flex; align-items: center; flex-shrink: 0; }
  .dash-heatmap__cell {
    width: 24px; height: 16px;
    border-radius: 2px;
    margin: 0 1px;
    flex-shrink: 0;
    cursor: default;
    transition: transform 0.15s;
  }
  .dash-heatmap__cell:hover { transform: scale(1.3); z-index: 1; }

  /* Frequency Grid */
  .dash-freq-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  .dash-freq-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255,255,255,0.02);
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .dash-freq-name { font-size: 12px; font-family: 'JetBrains Mono', monospace; color: #a1a1aa; }
  .dash-freq-count { font-size: 14px; font-weight: 700; color: #fafafa; }
`;
