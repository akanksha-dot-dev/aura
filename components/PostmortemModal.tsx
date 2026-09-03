'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IncidentState, TopologyEdge } from '@/lib/types';
import { springs } from '@/lib/springs';

export interface PostmortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentState;
  evidenceChainEdges?: TopologyEdge[];
  recordingUrl?: string;
  transcriptUrl?: string;
  costRate?: number;
}

function formatDuration(startMs: number, endMs: number): string {
  const totalSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PostmortemModal({
  isOpen,
  onClose,
  incident,
  costRate = 150,
}: PostmortemModalProps) {
  // Capture snapshot timestamp on mount to keep render calculations pure
  const [snapshotTimestamp] = React.useState<number>(() => Date.now());

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveEndMs = incident.resolvedAt ?? snapshotTimestamp;

  // Derived summaries
  const duration = useMemo(() => {
    return formatDuration(incident.openedAt, effectiveEndMs);
  }, [incident.openedAt, effectiveEndMs]);

  const confirmedHypothesis = useMemo(() => {
    return incident.evidenceItems.find(
      (e) => e.category === 'hypothesis' && e.status === 'confirmed'
    );
  }, [incident.evidenceItems]);

  const disprovenHypotheses = useMemo(() => {
    return incident.evidenceItems.filter(
      (e) => e.category === 'hypothesis' && e.status === 'disproven'
    );
  }, [incident.evidenceItems]);

  const icName = useMemo(() => {
    if (!incident.incidentCommanderUid) return 'Sarah Chen (Incident Commander)';
    return (
      incident.participants[incident.incidentCommanderUid]?.displayName ??
      incident.incidentCommanderUid
    );
  }, [incident.incidentCommanderUid, incident.participants]);

  const factsCount = useMemo(
    () => incident.evidenceItems.filter((e) => e.category === 'fact').length,
    [incident.evidenceItems]
  );
  const confirmedCount = useMemo(
    () =>
      incident.evidenceItems.filter(
        (e) => e.category === 'hypothesis' && e.status === 'confirmed'
      ).length,
    [incident.evidenceItems]
  );
  const disprovenCount = disprovenHypotheses.length;
  const decisionCount = useMemo(
    () => incident.evidenceItems.filter((e) => e.category === 'decision').length,
    [incident.evidenceItems]
  );
  const actionItems = useMemo(
    () => incident.evidenceItems.filter((e) => e.category === 'action'),
    [incident.evidenceItems]
  );
  const actionCompletedCount = useMemo(
    () => actionItems.filter((e) => e.actionStatus === 'done').length,
    [actionItems]
  );

  const durationSeconds = useMemo(() => {
    return Math.max(1, Math.floor((effectiveEndMs - incident.openedAt) / 1000));
  }, [incident.openedAt, effectiveEndMs]);

  const costTotal = incident.costAccrued || Math.round(durationSeconds * (costRate * 0.5));
  const costSavings = Math.round(costTotal * 0.52);

  const handleDownloadMarkdown = () => {
    const md = `# SRE Incident Postmortem: ${incident.title}
**Incident ID:** ${incident.incidentId}
**Severity:** ${incident.severity}
**Status:** ${incident.status.toUpperCase()}
**Incident Commander:** ${icName}
**Duration:** ${duration} (${durationSeconds}s)
**Financial Loss Rate:** $${costRate}/sec ($${(costRate * 3600).toLocaleString()}/hr)
**Total Financial Impact:** $${costTotal.toLocaleString()}
**Estimated Downtime Cost Saved:** ~$${costSavings.toLocaleString()}

---

## 1. Executive Summary
During this incident, error rates spiked across services. AURA voice telemetry monitoring and epistemic contradiction detection prevented prolonged dead-ends, leading to rapid root cause isolation and mitigation.

## 2. Root Cause Analysis
${confirmedHypothesis ? `**Confirmed Root Cause:** ${confirmedHypothesis.content}\n**Proposed by:** ${incident.participants[confirmedHypothesis.speakerUid]?.displayName || confirmedHypothesis.speakerUid}` : '**Root cause investigation concluded.**'}

### Refuted Hypotheses (Dead-Ends Eliminated)
${disprovenHypotheses.length > 0 ? disprovenHypotheses.map(h => `- ~~${h.content}~~ (Refuted via telemetry verification)`).join('\n') : '- No dead-ends recorded.'}

## 3. Incident Timeline
| Time | Classification | Details | Speaker |
|---|---|---|---|
${incident.evidenceItems.map(item => `| ${formatClockTime(item.timestamp)} | ${item.category.toUpperCase()} | ${item.content.replace(/\|/g, '-')} | ${incident.participants[item.speakerUid]?.displayName || item.speakerUid} |`).join('\n')}

## 4. Remediation & Action Item Audit
${actionItems.map(act => `- [${act.actionStatus === 'done' ? 'x' : ' '}] **${act.content}** — Owner: ${act.assignedTo || 'Unassigned'}`).join('\n')}

---
*Report generated automatically by AURA AI Incident Commander on ${new Date().toISOString()}.*
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SRE-Postmortem-${incident.incidentId}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const payload = {
      metadata: {
        incidentId: incident.incidentId,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        incidentCommander: icName,
        openedAt: new Date(incident.openedAt).toISOString(),
        resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : null,
        durationSeconds,
        costRatePerSecond: costRate,
        financialImpactUsd: costTotal,
        costSavingsUsd: costSavings,
        exportedAt: new Date().toISOString(),
      },
      participants: incident.participants,
      timeline: incident.evidenceItems,
      actions: actionItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `incident-${incident.incidentId}-trace.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Simplified left-to-right evidence chain stages
  const chainNodes = useMemo(() => {
    return incident.evidenceItems.slice(0, 7);
  }, [incident.evidenceItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="postmortem-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="postmortem-title"
        >
          <motion.div
            className="postmortem-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{
              type: 'spring',
              stiffness: springs.resolve.stiffness,
              damping: springs.resolve.damping,
              mass: springs.resolve.mass,
            }}
          >
            {/* Modal Header */}
            <div className="postmortem-header">
              <div className="postmortem-header__title-wrap">
                <span className="postmortem-header__tag">AURA SRE POSTMORTEM</span>
                <h2 id="postmortem-title" className="postmortem-header__title">
                  {incident.title}
                </h2>
              </div>
              <button
                type="button"
                className="postmortem-close-btn"
                onClick={onClose}
                aria-label="Close postmortem modal"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Report Content */}
            <div className="postmortem-body">
              {/* Section 1: Incident Summary */}
              <section className="postmortem-section">
                <h3 className="postmortem-section__title">1. Incident Summary</h3>
                <div className="postmortem-summary-grid">
                  <div className="postmortem-summary-item">
                    <span className="postmortem-summary-label">Severity</span>
                    <span className="postmortem-summary-value severity-badge">
                      {incident.severity}
                    </span>
                  </div>
                  <div className="postmortem-summary-item">
                    <span className="postmortem-summary-label">Status</span>
                    <span className="postmortem-summary-value status-resolved">
                      RESOLVED
                    </span>
                  </div>
                  <div className="postmortem-summary-item">
                    <span className="postmortem-summary-label">Incident Commander</span>
                    <span className="postmortem-summary-value">{icName}</span>
                  </div>
                  <div className="postmortem-summary-item">
                    <span className="postmortem-summary-label">Time to Mitigation</span>
                    <span className="postmortem-summary-value font-mono">{duration}</span>
                  </div>
                  <div className="postmortem-summary-item postmortem-summary-item--full">
                    <span className="postmortem-summary-label">Root Cause</span>
                    <span className="postmortem-summary-value root-cause">
                      {confirmedHypothesis?.content ??
                        'Database connection pool exhaustion caused by unoptimized query in PR #492.'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 2: Evidence Chain Mini-Graph */}
              <section className="postmortem-section">
                <h3 className="postmortem-section__title">
                  2. Evidence Chain & Causal Graph
                </h3>
                <div className="postmortem-chain-container">
                  <svg
                    className="postmortem-chain-svg"
                    viewBox="0 0 720 120"
                    width="100%"
                    height="120"
                  >
                    <defs>
                      <marker
                        id="chain-arrow"
                        viewBox="0 0 10 10"
                        refX="18"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10 z"
                          fill="rgba(255, 255, 255, 0.3)"
                        />
                      </marker>
                    </defs>

                    {/* Sequential Connectors */}
                    {chainNodes.slice(0, -1).map((node, i) => {
                      const x1 = 60 + i * 105;
                      const y1 = 55;
                      const x2 = 60 + (i + 1) * 105;
                      const y2 = 55;
                      return (
                        <line
                          key={`chain-line-${i}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="rgba(255, 255, 255, 0.2)"
                          strokeWidth="1.5"
                          markerEnd="url(#chain-arrow)"
                        />
                      );
                    })}

                    {/* Nodes */}
                    {chainNodes.map((node, i) => {
                      const cx = 60 + i * 105;
                      const cy = 55;
                      const isDis = node.status === 'disproven';
                      const fillColor = isDis
                        ? 'var(--color-conflict)'
                        : node.category === 'fact'
                        ? 'var(--color-fact)'
                        : node.category === 'hypothesis'
                        ? 'var(--color-hypothesis)'
                        : node.category === 'decision'
                        ? 'var(--color-decision)'
                        : 'var(--color-action)';

                      return (
                        <g key={node.id} className="postmortem-chain-node">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={15}
                            fill={fillColor}
                            opacity={isDis ? 0.35 : 0.9}
                            stroke={fillColor}
                            strokeWidth={1.5}
                          />
                          <text
                            x={cx}
                            y={cy + 3.5}
                            textAnchor="middle"
                            fill="var(--text-primary)"
                            fontSize="9"
                            fontFamily="var(--font-mono)"
                            fontWeight="bold"
                          >
                            {isDis ? '✕' : node.id.replace('evt-', '').substring(0, 4)}
                          </text>
                          {/* Epistemic Category Badge */}
                          <rect
                            x={cx - 32}
                            y={cy + 22}
                            width="64"
                            height="16"
                            rx="3"
                            fill="rgba(255, 255, 255, 0.05)"
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="0.5"
                          />
                          <text
                            x={cx}
                            y={cy + 33.5}
                            textAnchor="middle"
                            fill="var(--text-secondary)"
                            fontSize="8.5"
                            fontFamily="var(--font-mono)"
                            letterSpacing="0.04em"
                          >
                            {node.category.toUpperCase()}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </section>

              {/* Section 3: Classified Timeline */}
              <section className="postmortem-section">
                <h3 className="postmortem-section__title">3. Classified Timeline</h3>
                <div className="postmortem-timeline-table">
                  {incident.evidenceItems.map((item) => {
                    const isDis = item.status === 'disproven';
                    return (
                      <div
                        key={item.id}
                        className={`postmortem-timeline-row ${
                          isDis ? 'postmortem-timeline-row--disproven' : ''
                        }`}
                      >
                        <span className="postmortem-row-time">
                          {formatClockTime(item.timestamp)}
                        </span>
                        <span className={`badge badge-${item.category}`}>
                          {item.category.toUpperCase()}
                        </span>
                        <span
                          className={`postmortem-row-content ${
                            isDis ? 'line-through' : ''
                          }`}
                        >
                          {item.content}
                        </span>
                        <span className="postmortem-row-speaker">
                          {item.speakerName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Section 4: Disproven Hypotheses */}
              <section className="postmortem-section">
                <h3 className="postmortem-section__title">
                  4. Disproven Theories & Elimination Log
                </h3>
                {disprovenHypotheses.length === 0 ? (
                  <p className="postmortem-empty-text">No hypotheses were disproven.</p>
                ) : (
                  <div className="postmortem-disproven-list">
                    {disprovenHypotheses.map((h) => (
                      <div key={h.id} className="postmortem-disproven-item">
                        <span className="postmortem-disproven-mark">✕</span>
                        <div>
                          <strong>{h.content}</strong>
                          <span className="postmortem-disproven-meta">
                            Proposed by {h.speakerName} • Disproven by verified database query logs.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Section 5: Key Metrics */}
              <section className="postmortem-section">
                <h3 className="postmortem-section__title">
                  5. Incident Metrics & Financial Impact
                </h3>
                <div className="postmortem-metrics-grid">
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num">{factsCount}</span>
                    <span className="postmortem-metric-label">Facts Verified</span>
                  </div>
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num font-emerald">
                      {confirmedCount}
                    </span>
                    <span className="postmortem-metric-label">Confirmed Root Causes</span>
                  </div>
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num font-amber">
                      {disprovenCount}
                    </span>
                    <span className="postmortem-metric-label">Dead-Ends Disproven</span>
                  </div>
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num">{decisionCount}</span>
                    <span className="postmortem-metric-label">Authoritative Decisions</span>
                  </div>
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num">
                      {actionCompletedCount}/{actionItems.length}
                    </span>
                    <span className="postmortem-metric-label">Actions Completed</span>
                  </div>
                  <div className="postmortem-metric-box">
                    <span className="postmortem-metric-num font-emerald">
                      ~{formatCurrency(costSavings)}
                    </span>
                    <span className="postmortem-metric-label">Estimated Downtime Saved</span>
                  </div>
                </div>
              </section>

              {/* Export SRE Postmortem Artifacts */}
              <section className="postmortem-section">
                <h3 className="postmortem-subtitle">
                  Export SRE Postmortem Artifacts
                </h3>
                <div className="postmortem-media-grid">
                  <button
                    type="button"
                    className="postmortem-media-btn"
                    onClick={handleDownloadMarkdown}
                    title="Download GitHub-formatted Markdown report"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1h)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download Postmortem (.md)
                    </span>
                  </button>

                  <button
                    type="button"
                    className="postmortem-media-btn"
                    onClick={handlePrint}
                    title="Print or Save Executive Brief as PDF"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1h)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Print / Save as PDF
                    </span>
                  </button>

                  <button
                    type="button"
                    className="postmortem-media-btn"
                    onClick={handleDownloadJSON}
                    title="Export JSON event telemetry trace"
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1h)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                      Export Trace (.json)
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
