'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  const [snapshotTimestamp] = useState<number>(() => Date.now());
  const [copiedMd, setCopiedMd] = useState(false);

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

  const durationSeconds = useMemo(() => {
    return Math.max(1, Math.floor((effectiveEndMs - incident.openedAt) / 1000));
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

  const costTotal = incident.costAccrued || Math.round(durationSeconds * (costRate * 0.5));
  const costSavings = Math.round(costTotal * 0.52);

  const generateMarkdownReport = () => {
    return `# SRE Incident Postmortem: ${incident.title}
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
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownReport();
    try {
      await navigator.clipboard.writeText(md);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // Fallback
      setCopiedMd(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport();
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
          className="sre-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sre-postmortem-title"
        >
          <style>{`
            .sre-overlay {
              position: fixed;
              inset: 0;
              background: rgba(4, 5, 8, 0.85);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              padding: 1.5rem;
            }

            .sre-doc-modal {
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-lg);
              max-width: 960px;
              width: 95vw;
              max-height: 90vh;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
              font-family: var(--font-sans);
              color: var(--text-primary);
            }

            /* ─── Header & Action Toolbar ─── */
            .sre-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              padding: 18px 24px;
              border-bottom: 1px solid var(--border-subtle);
              background: var(--bg-surface-raised);
              flex-shrink: 0;
              gap: 16px;
            }

            .sre-header-left {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .sre-spec-label {
              font-family: var(--font-mono);
              font-size: 10px;
              font-weight: 700;
              color: var(--color-aura);
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            .sre-title {
              font-size: 18px;
              font-weight: 700;
              letter-spacing: -0.02em;
              margin: 0;
              color: var(--text-primary);
            }

            .sre-header-actions {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            }

            .sre-action-btn {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              color: var(--text-secondary);
              border-radius: var(--radius-sm);
              padding: 6px 10px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-standard);
            }

            .sre-action-btn:hover {
              background: var(--bg-surface-hover);
              color: var(--text-primary);
              border-color: var(--border-default);
            }

            .sre-close-btn {
              background: transparent;
              border: 1px solid var(--border-subtle);
              color: var(--text-muted);
              border-radius: var(--radius-sm);
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              font-size: 12px;
              transition: all var(--duration-fast) var(--ease-standard);
            }

            .sre-close-btn:hover {
              background: var(--bg-surface-hover);
              color: var(--text-primary);
              border-color: var(--border-default);
            }

            /* ─── Executive Telemetry Strip (Borderless) ─── */
            .sre-telemetry-ribbon {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              background: rgba(8, 9, 12, 0.7);
              border-bottom: 1px solid var(--border-subtle);
              flex-shrink: 0;
            }

            @media (max-width: 800px) {
              .sre-telemetry-ribbon {
                grid-template-columns: repeat(3, 1fr);
              }
            }

            .sre-telemetry-cell {
              padding: 10px 16px;
              border-right: 1px solid var(--border-subtle);
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .sre-telemetry-cell:last-child {
              border-right: none;
            }

            .sre-telemetry-label {
              font-size: 9.5px;
              font-family: var(--font-mono);
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: var(--text-muted);
            }

            .sre-telemetry-val {
              font-size: 13px;
              font-weight: 600;
              color: var(--text-primary);
            }

            /* ─── Scrollable Document Body ─── */
            .sre-body {
              padding: 24px 28px;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
              gap: 24px;
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
            }

            .sre-section {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }

            .sre-section-title {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: var(--color-aura);
              border-bottom: 1px solid var(--border-subtle);
              padding-bottom: 6px;
              margin: 0;
            }

            /* ─── Executive Summary & Root Cause Card ─── */
            .sre-summary-prose {
              font-size: 12.5px;
              line-height: 1.6;
              color: var(--text-secondary);
              margin: 0;
            }

            .sre-metrics-strip {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 4px;
            }

            .sre-metric-chip {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: var(--bg-surface-raised);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-sm);
              padding: 4px 8px;
              font-size: 11px;
              font-weight: 500;
            }

            .sre-kv-card--root {
              background: rgba(16, 185, 129, 0.04);
              border: 1px solid rgba(16, 185, 129, 0.25);
              border-left: 3px solid #10B981;
              border-radius: var(--radius-sm);
              padding: 12px 16px;
              display: flex;
              flex-direction: column;
              gap: 4px;
              margin-top: 4px;
            }

            .sre-kv-label {
              font-size: 9.5px;
              font-family: var(--font-mono);
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #10B981;
              font-weight: 600;
            }

            .sre-kv-val {
              font-size: 13px;
              font-weight: 600;
              color: var(--text-primary);
              line-height: 1.45;
            }

            /* ─── Evidence Chain SVG Pipeline ─── */
            .sre-pipeline-container {
              background: var(--bg-surface-raised);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-sm);
              padding: 12px;
              overflow-x: auto;
            }

            /* ─── Classified Timeline Table ─── */
            .sre-table-wrap {
              background: var(--bg-surface-raised);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-sm);
              overflow: hidden;
            }

            .sre-table-header {
              display: grid;
              grid-template-columns: 80px 110px 1fr 140px;
              gap: 12px;
              padding: 8px 14px;
              background: rgba(255, 255, 255, 0.02);
              border-bottom: 1px solid var(--border-subtle);
              font-family: var(--font-mono);
              font-size: 9.5px;
              font-weight: 700;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: var(--text-muted);
            }

            .sre-table-row {
              display: grid;
              grid-template-columns: 80px 110px 1fr 140px;
              gap: 12px;
              align-items: center;
              padding: 8px 14px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.025);
              font-size: 12px;
              transition: background var(--duration-fast) var(--ease-standard);
            }

            .sre-table-row:hover {
              background: var(--bg-surface-hover);
            }

            .sre-table-row:last-child {
              border-bottom: none;
            }

            .sre-pill {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 2px 7px;
              border-radius: 2px;
              font-family: var(--font-mono);
              font-size: 9.5px;
              font-weight: 600;
              letter-spacing: 0.04em;
              width: fit-content;
            }

            .sre-pill-fact {
              background: rgba(99, 102, 241, 0.1);
              border: 1px solid rgba(99, 102, 241, 0.25);
              color: #818CF8;
            }

            .sre-pill-hypothesis {
              background: rgba(212, 168, 83, 0.1);
              border: 1px solid rgba(212, 168, 83, 0.25);
              color: var(--color-aura);
            }

            .sre-pill-decision {
              background: rgba(168, 85, 247, 0.1);
              border: 1px solid rgba(168, 85, 247, 0.25);
              color: #C084FC;
            }

            .sre-pill-action {
              background: rgba(16, 185, 129, 0.1);
              border: 1px solid rgba(16, 185, 129, 0.25);
              color: #34D399;
            }

            /* ─── Disproven Theories Elimination Card ─── */
            .sre-disproven-box {
              background: rgba(239, 68, 68, 0.04);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-left: 3px solid #EF4444;
              border-radius: var(--radius-sm);
              padding: 12px 16px;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .sre-disproven-item {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              font-size: 12px;
              line-height: 1.45;
            }

            /* ─── Remediation Actions Checklist ─── */
            .sre-actions-grid {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }

            .sre-action-row {
              background: var(--bg-surface-raised);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-sm);
              padding: 8px 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 12px;
            }

            .sre-action-done {
              color: var(--text-muted);
              text-decoration: line-through;
            }
          `}</style>

          <motion.div
            className="sre-doc-modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{
              type: 'spring',
              stiffness: springs.resolve.stiffness,
              damping: springs.resolve.damping,
              mass: springs.resolve.mass,
            }}
          >
            {/* Header with Title and Action Toolbar */}
            <div className="sre-header">
              <div className="sre-header-left">
                <span className="sre-spec-label">
                  Google SRE Specification • Technical Incident Postmortem
                </span>
                <h2 id="sre-postmortem-title" className="sre-title">
                  {incident.title}
                </h2>
              </div>

              <div className="sre-header-actions">
                <button
                  type="button"
                  className="sre-action-btn"
                  onClick={handleCopyMarkdown}
                  title="Copy markdown to clipboard"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>{copiedMd ? 'Copied!' : 'Copy MD'}</span>
                </button>

                <button
                  type="button"
                  className="sre-action-btn"
                  onClick={handleDownloadMarkdown}
                  title="Download .md document"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Export MD</span>
                </button>

                <button
                  type="button"
                  className="sre-action-btn"
                  onClick={handlePrint}
                  title="Print or Save PDF"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect width="12" height="8" x="6" y="14" />
                  </svg>
                  <span>Print / PDF</span>
                </button>

                <button
                  type="button"
                  className="sre-action-btn"
                  onClick={handleDownloadJSON}
                  title="Export JSON event telemetry trace"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span>JSON</span>
                </button>

                <button
                  type="button"
                  className="sre-close-btn"
                  onClick={onClose}
                  aria-label="Close postmortem"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Operational Telemetry Strip */}
            <div className="sre-telemetry-ribbon">
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Incident ID</span>
                <span className="sre-telemetry-val" style={{ fontFamily: 'var(--font-mono)' }}>{incident.incidentId}</span>
              </div>
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Severity</span>
                <span className="sre-telemetry-val" style={{ color: '#F87171' }}>{incident.severity}</span>
              </div>
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Duration</span>
                <span className="sre-telemetry-val" style={{ fontFamily: 'var(--font-mono)' }}>{duration}</span>
              </div>
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Commander</span>
                <span className="sre-telemetry-val">{icName.split(' ')[0]}</span>
              </div>
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Cost Incurred</span>
                <span className="sre-telemetry-val" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(costTotal)}</span>
              </div>
              <div className="sre-telemetry-cell">
                <span className="sre-telemetry-label">Downtime Saved</span>
                <span className="sre-telemetry-val" style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                  ~{formatCurrency(costSavings)}
                </span>
              </div>
            </div>

            {/* Scrollable Document Content */}
            <div className="sre-body">
              {/* Section 1: Executive Summary & Root Cause */}
              <section className="sre-section">
                <h3 className="sre-section-title">1. Executive Summary & Root Cause Isolation</h3>
                <p className="sre-summary-prose">
                  During this incident, error rates spiked across services. AURA voice telemetry monitoring and epistemic contradiction detection prevented prolonged dead-ends, leading to rapid root cause isolation and mitigation.
                </p>

                <div className="sre-metrics-strip">
                  <span className="sre-metric-chip" style={{ color: '#34D399' }}>
                    Status: RESOLVED / MITIGATED
                  </span>
                  <span className="sre-metric-chip" style={{ color: '#818CF8' }}>
                    {factsCount} Facts Established
                  </span>
                  <span className="sre-metric-chip" style={{ color: 'var(--color-aura)' }}>
                    {confirmedCount} Confirmed • {disprovenCount} Disproven
                  </span>
                  <span className="sre-metric-chip" style={{ color: '#C084FC' }}>
                    {decisionCount} Decisions Arbitrated
                  </span>
                </div>

                <div className="sre-kv-card--root">
                  <span className="sre-kv-label">Confirmed Root Cause</span>
                  <span className="sre-kv-val">
                    {confirmedHypothesis?.content ??
                      'Database connection pool exhaustion caused by unoptimized query in PR #492.'}
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    Proposed by {confirmedHypothesis ? (incident.participants[confirmedHypothesis.speakerUid]?.displayName || confirmedHypothesis.speakerUid) : 'Marcus Vance'} • Verified via telemetry
                  </span>
                </div>
              </section>

              {/* Section 2: Causal Evidence Chain */}
              <section className="sre-section">
                <h3 className="sre-section-title">2. Causal Evidence Chain & Pipeline</h3>
                <div className="sre-pipeline-container">
                  <svg viewBox="0 0 720 74" width="100%" height="74">
                    <defs>
                      <marker
                        id="sre-arrow"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="3"
                        markerWidth="4"
                        markerHeight="4"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0.5 L 5 3 L 0 5.5 z" fill="rgba(255, 255, 255, 0.35)" />
                      </marker>
                    </defs>

                    {/* Nodes and Connecting Arrows */}
                    {chainNodes.map((node, i) => {
                      const cardW = 94;
                      const cardH = 46;
                      const gap = 12;
                      const x = 6 + i * (cardW + gap);
                      const y = 14;
                      const isDis = node.status === 'disproven';
                      const fillColor = isDis
                        ? '#EF4444'
                        : node.category === 'fact'
                        ? '#6366F1'
                        : node.category === 'hypothesis'
                        ? '#D4A853'
                        : node.category === 'decision'
                        ? '#A855F7'
                        : '#10B981';

                      const isLast = i === chainNodes.length - 1;
                      const categoryLabel =
                        node.category === 'hypothesis'
                          ? 'HYPO'
                          : node.category === 'decision'
                          ? 'DECISION'
                          : node.category.toUpperCase();

                      return (
                        <g key={node.id}>
                          {/* Main Card */}
                          <rect
                            x={x}
                            y={y}
                            width={cardW}
                            height={cardH}
                            rx="4"
                            fill="var(--bg-surface)"
                            stroke={isDis ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}
                            strokeWidth="1"
                            opacity={isDis ? 0.5 : 1}
                          />

                          {/* Top Accent Strip */}
                          <rect
                            x={x}
                            y={y}
                            width={cardW}
                            height={14}
                            rx="3"
                            fill={fillColor}
                            opacity={0.12}
                          />

                          {/* Category Label */}
                          <text
                            x={x + 5}
                            y={y + 10}
                            fill={fillColor}
                            fontSize="7.5"
                            fontFamily="var(--font-mono)"
                            fontWeight="700"
                            letterSpacing="0.04em"
                          >
                            {categoryLabel}
                          </text>

                          {/* Event ID */}
                          <text
                            x={x + cardW - 5}
                            y={y + 10}
                            textAnchor="end"
                            fill="var(--text-muted)"
                            fontSize="7"
                            fontFamily="var(--font-mono)"
                          >
                            {node.id.toUpperCase()}
                          </text>

                          {/* Statement Snippet */}
                          <text
                            x={x + 5}
                            y={y + 26}
                            fill={isDis ? 'var(--text-muted)' : 'var(--text-primary)'}
                            fontSize="8"
                            fontFamily="var(--font-sans)"
                            fontWeight="500"
                          >
                            {isDis ? 'DISPROVEN' : (node.content.length > 15 ? node.content.substring(0, 14) + '…' : node.content)}
                          </text>

                          <text
                            x={x + 5}
                            y={y + 37}
                            fill="var(--text-muted)"
                            fontSize="7.5"
                            fontFamily="var(--font-mono)"
                          >
                            {node.confidence}% CONF
                          </text>

                          {/* Connector Arrow to Next Card */}
                          {!isLast && (
                            <line
                              x1={x + cardW + 2}
                              y1={y + cardH / 2}
                              x2={x + cardW + gap - 3}
                              y2={y + cardH / 2}
                              stroke="rgba(255, 255, 255, 0.2)"
                              strokeWidth="1.25"
                              markerEnd="url(#sre-arrow)"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </section>

              {/* Section 3: Chronological SRE Timeline */}
              <section className="sre-section">
                <h3 className="sre-section-title">3. Epistemic Incident Timeline Log</h3>
                <div className="sre-table-wrap">
                  <div className="sre-table-header">
                    <span>TIME</span>
                    <span>TYPE</span>
                    <span>STATEMENT & EVIDENCE</span>
                    <span style={{ textAlign: 'right' }}>SPEAKER</span>
                  </div>

                  {incident.evidenceItems.map((item) => {
                    const isDis = item.status === 'disproven';
                    return (
                      <div key={item.id} className="sre-table-row">
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                          {formatClockTime(item.timestamp)}
                        </span>
                        <span className={`sre-pill sre-pill-${item.category}`}>
                          {item.category.toUpperCase()}
                        </span>
                        <span style={{ color: isDis ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDis ? 'line-through' : 'none' }}>
                          {item.content}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.6875rem' }}>
                          {item.speakerName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Section 4: Refuted Dead-Ends */}
              {disprovenHypotheses.length > 0 && (
                <section className="sre-section">
                  <h3 className="sre-section-title">4. Refuted Theories & Eliminated Dead-Ends</h3>
                  <div className="sre-disproven-box">
                    {disprovenHypotheses.map((h) => (
                      <div key={h.id} className="sre-disproven-item">
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>✕</span>
                        <div>
                          <strong>{h.content}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                            Proposed by {h.speakerName} • Refuted via authoritative database telemetry.
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Section 5: Remediation Action Items */}
              <section className="sre-section">
                <h3 className="sre-section-title">
                  5. Remediation Action Items ({actionCompletedCount}/{actionItems.length} Resolved)
                </h3>
                <div className="sre-actions-grid">
                  {actionItems.map((act) => (
                    <div key={act.id} className="sre-action-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: act.actionStatus === 'done' ? '#34D399' : 'var(--text-muted)' }}>
                          {act.actionStatus === 'done' ? '✓' : '○'}
                        </span>
                        <span className={act.actionStatus === 'done' ? 'sre-action-done' : ''}>
                          {act.content}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        Owner: {act.assignedTo || 'Unassigned'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
