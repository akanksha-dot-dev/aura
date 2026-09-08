'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { IncidentState, ClassificationType } from '@/lib/types';

export interface AnalyticsDashboardProps {
  incident: IncidentState;
  costRate: number;
}

const CATEGORY_META: Record<ClassificationType, { label: string; color: string }> = {
  fact: { label: 'Facts', color: 'var(--color-fact)' },
  hypothesis: { label: 'Hypotheses', color: 'var(--color-hypothesis)' },
  decision: { label: 'Decisions', color: 'var(--color-decision)' },
  action: { label: 'Actions', color: 'var(--color-action)' },
  conflict: { label: 'Conflicts', color: 'var(--color-conflict)' },
};

// ── Donut chart SVG ──────────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: Array<{ value: number; color: string; label: string }> }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <svg viewBox="0 0 120 120" width={120} height={120}>
        <circle cx={60} cy={60} r={44} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={18} />
        <text x={60} y={65} textAnchor="middle" fill="var(--text-muted)" fontSize={12}>No data</text>
      </svg>
    );
  }

  const r = 44;
  const cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const arcs = slices
    .filter(s => s.value > 0)
    .map(s => {
      const pct = s.value / total;
      const len = pct * circumference;
      const arc = { ...s, pct, len, offset, dashArray: `${len} ${circumference - len}` };
      offset += len;
      return arc;
    });

  return (
    <svg viewBox="0 0 120 120" width={120} height={120}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={18} />
      {arcs.map((arc, i) => (
        <motion.circle
          key={arc.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={18}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={-arc.offset}
          strokeLinecap="butt"
          transform="rotate(-90 60 60)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
        />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize={22} fontWeight={600}>{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>EVENTS</text>
    </svg>
  );
}

// ── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ values, color, height = 40, width = 200 }: { values: number[]; color: string; height?: number; width?: number }) {
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>Insufficient data</text>
      </svg>
    );
  }

  const maxVal = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (v / maxVal) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = 'M ' + points.join(' L ');
  const areaD = `M 0,${height} L ${pathD.slice(2)} L ${width},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkgrad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <motion.path
        d={areaD}
        fill={`url(#sparkgrad-${color.replace(/[^a-z0-9]/gi, '')})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      {/* Last value dot */}
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - (values[values.length - 1] / maxVal) * (height - 4) - 2}
        r={3}
        fill={color}
      />
    </svg>
  );
}

// ── Arc Gauge (for cognitive load) ──────────────────────────────────────────
function ArcGauge({ value, max = 100, color, label }: { value: number; max?: number; color: string; label: string }) {
  const pct = Math.min(1, value / max);
  const angle = pct * 180; // 0..180 degrees
  const r = 44;
  const cx = 60, cy = 65;

  // Start at left (180°) sweep to right (0°)
  const startX = cx - r;
  const startY = cy;
  const endAngle = Math.PI - (pct * Math.PI);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy - r * Math.sin(endAngle);
  const largeArc = pct > 0.5 ? 1 : 0;

  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;

  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* Background track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} strokeLinecap="round" />
      {/* Filled arc */}
      <motion.path
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize={18} fontWeight={600}>
        {Math.round(pct * 100)}%
      </text>
      <text x={cx} y={cx + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={8}>{label}</text>
    </svg>
  );
}

// ── Speaker contribution bar chart ──────────────────────────────────────────
function SpeakerBars({ participants }: { participants: IncidentState['participants'] }) {
  const entries = Object.values(participants)
    .sort((a, b) => b.totalSpeakingMs - a.totalSpeakingMs)
    .slice(0, 6);
  const maxMs = Math.max(...entries.map(p => p.totalSpeakingMs), 1);

  return (
    <div className="analytics-speaker-bars">
      {entries.map((p, i) => {
        const pct = (p.totalSpeakingMs / maxMs) * 100;
        const isAura = p.uid === 'aura_agent';
        return (
          <div key={p.uid} className="analytics-speaker-row">
            <span className="analytics-speaker-name">{p.displayName}</span>
            <div className="analytics-speaker-track">
              <motion.div
                className="analytics-speaker-fill"
                style={{ background: isAura ? 'var(--color-aura)' : `hsl(${200 + i * 30}, 70%, 60%)` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
              />
            </div>
            <span className="analytics-speaker-ms">
              {p.totalSpeakingMs > 0 ? `${Math.round(p.totalSpeakingMs / 1000)}s` : '—'}
            </span>
          </div>
        );
      })}
      {entries.length === 0 && <p className="analytics-empty">No speaking data yet</p>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function AnalyticsDashboard({ incident, costRate }: AnalyticsDashboardProps) {
  const now = Date.now();
  const elapsedMs = now - incident.openedAt;
  const elapsedMin = Math.max(1, elapsedMs / 60000);

  // Evidence breakdown
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ClassificationType, number>> = {};
    for (const item of incident.evidenceItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [incident.evidenceItems]);

  const donutSlices = (Object.entries(CATEGORY_META) as Array<[ClassificationType, { label: string; color: string }]>)
    .map(([cat, meta]) => ({ value: categoryCounts[cat] ?? 0, color: meta.color, label: meta.label }))
    .filter(s => s.value > 0);

  // Cost accrual sparkline (sample every ~30s of elapsed time, max 20 points)
  const costSparkline = useMemo(() => {
    const totalCostPerSec = costRate / 3600;
    const steps = Math.min(20, Math.max(2, Math.floor(elapsedMin / 0.5)));
    const msPerStep = elapsedMs / steps;
    return Array.from({ length: steps }, (_, i) => {
      const elapsedAtPoint = msPerStep * (i + 1);
      return (totalCostPerSec * elapsedAtPoint) / 1000;
    });
  }, [elapsedMs, elapsedMin, costRate]);

  const totalCost = (costRate / 3600) * (elapsedMs / 1000);

  // Evidence rate over time
  const evidenceRateSparkline = useMemo(() => {
    if (incident.evidenceItems.length < 2) return [];
    const steps = Math.min(20, Math.max(2, Math.floor(elapsedMin)));
    const msPerStep = elapsedMs / steps;
    return Array.from({ length: steps }, (_, i) => {
      const windowEnd = incident.openedAt + msPerStep * (i + 1);
      const windowStart = windowEnd - msPerStep;
      return incident.evidenceItems.filter(ev => ev.timestamp >= windowStart && ev.timestamp < windowEnd).length;
    });
  }, [incident.evidenceItems, incident.openedAt, elapsedMs, elapsedMin]);

  // Cognitive load score
  const cogLoad = incident.cognitiveLoadScore;
  const cogLoadColor = cogLoad >= 70 ? 'var(--color-conflict)' : cogLoad >= 40 ? 'var(--color-hypothesis)' : 'var(--color-fact)';

  // MTTR estimate
  const resolvedActions = incident.evidenceItems.filter(e => e.category === 'action' && e.actionStatus === 'done').length;
  const totalActions = incident.evidenceItems.filter(e => e.category === 'action').length;
  const actionCompletionRate = totalActions > 0 ? Math.round((resolvedActions / totalActions) * 100) : 0;

  function fmt(ms: number) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div className="analytics-dashboard">

      {/* ── Row 1: Key Metrics ── */}
      <div className="analytics-metrics-row">
        <div className="analytics-metric-card">
          <div className="analytics-metric-value" style={{ color: 'var(--color-action)' }}>
            ${totalCost.toFixed(0)}
          </div>
          <div className="analytics-metric-label">Total Cost Accrued</div>
          <div className="analytics-metric-sub">${costRate}/hr burn rate</div>
        </div>
        <div className="analytics-metric-card">
          <div className="analytics-metric-value" style={{ color: 'var(--color-fact)' }}>
            {fmt(elapsedMs)}
          </div>
          <div className="analytics-metric-label">Time Elapsed</div>
          <div className="analytics-metric-sub">Since incident opened</div>
        </div>
        <div className="analytics-metric-card">
          <div className="analytics-metric-value" style={{ color: 'var(--color-decision)' }}>
            {incident.evidenceItems.length}
          </div>
          <div className="analytics-metric-label">Total Events</div>
          <div className="analytics-metric-sub">{Object.keys(incident.participants).length} participants</div>
        </div>
        <div className="analytics-metric-card">
          <div className="analytics-metric-value" style={{ color: actionCompletionRate >= 80 ? 'var(--color-fact)' : 'var(--color-hypothesis)' }}>
            {actionCompletionRate}%
          </div>
          <div className="analytics-metric-label">Action Completion</div>
          <div className="analytics-metric-sub">{resolvedActions}/{totalActions} actions done</div>
        </div>
      </div>

      {/* ── Row 2: Charts ── */}
      <div className="analytics-charts-row">
        {/* Evidence Breakdown Donut */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Evidence Breakdown</div>
          <div className="analytics-donut-wrap">
            <DonutChart slices={donutSlices} />
            <div className="analytics-donut-legend">
              {(Object.entries(CATEGORY_META) as Array<[ClassificationType, { label: string; color: string }]>).map(([cat, meta]) => {
                const count = categoryCounts[cat] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={cat} className="analytics-legend-row">
                    <span className="analytics-legend-dot" style={{ background: meta.color }} />
                    <span className="analytics-legend-label">{meta.label}</span>
                    <span className="analytics-legend-val">{count}</span>
                  </div>
                );
              })}
              {incident.evidenceItems.length === 0 && <p className="analytics-empty">No events yet</p>}
            </div>
          </div>
        </div>

        {/* Cognitive Load Gauge */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Cognitive Load</div>
          <div className="analytics-gauge-wrap">
            <ArcGauge value={cogLoad} label="COGNITIVE LOAD" color={cogLoadColor} />
          </div>
          <div className="analytics-gauge-desc">
            {cogLoad >= 70
              ? '🔴 Critical — simplify before deciding'
              : cogLoad >= 40
              ? '🟡 Elevated — monitor team focus'
              : '🟢 Normal — team has good bandwidth'}
          </div>
        </div>

        {/* Cost Accrual Sparkline */}
        <div className="analytics-chart-card analytics-chart-card--wide">
          <div className="analytics-chart-title">Cost Accrual Over Time</div>
          <Sparkline values={costSparkline} color="var(--color-action)" height={60} />
          <div className="analytics-chart-axis">
            <span>Incident Start</span><span>Now</span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Evidence Rate + Speaker Contribution ── */}
      <div className="analytics-charts-row">
        {/* Evidence activity rate */}
        <div className="analytics-chart-card analytics-chart-card--wide">
          <div className="analytics-chart-title">Evidence Capture Rate</div>
          <Sparkline values={evidenceRateSparkline.length ? evidenceRateSparkline : [0, 0]} color="var(--color-fact)" height={50} />
          <div className="analytics-chart-axis">
            <span>Incident Start</span><span>Now</span>
          </div>
          <div className="analytics-chart-subtitle">Events captured per time window</div>
        </div>

        {/* Speaker contribution */}
        <div className="analytics-chart-card analytics-chart-card--wide">
          <div className="analytics-chart-title">Speaker Contribution</div>
          <SpeakerBars participants={incident.participants} />
        </div>
      </div>

    </div>
  );
}
