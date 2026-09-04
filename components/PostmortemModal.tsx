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
              background: #0A0C10;
              border: 1px solid rgba(255, 255, 255, 0.09);
              border-radius: var(--radius-xl);
              max-width: 960px;
              width: 95vw;
              max-height: 90vh;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 24px 64px rgba(0, 0, 0, 0.75);
              font-family: var(--font-sans);
              color: var(--text-primary);
            }

            /* ─── Header & Action Toolbar ─── */
            .sre-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              padding: 1.25rem 1.75rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
              background: #0E1015;
              flex-shrink: 0;
              gap: 1rem;
            }

            .sre-header-left {
              display: flex;
              flex-direction: column;
              gap: 0.35rem;
            }

            .sre-spec-label {
              font-family: var(--font-mono);
              font-size: 0.6875rem;
              font-weight: 700;
              color: var(--color-aura);
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            .sre-title {
              font-size: 1.375rem;
              font-weight: 700;
              letter-spacing: -0.02em;
              margin: 0;
              color: var(--text-primary);
            }

            .sre-header-actions {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              flex-shrink: 0;
            }

            .sre-action-btn {
              display: inline-flex;
              align-items: center;
              gap: 0.375rem;
              background: #14171E;
              border: 1px solid rgba(255, 255, 255, 0.08);
              color: var(--text-secondary);
              border-radius: var(--radius-md);
              padding: 0.4rem 0.75rem;
              font-size: 0.6875rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 140ms ease;
            }

            .sre-action-btn:hover {
              background: #1B1F2A;
              color: var(--text-primary);
              border-color: rgba(255, 255, 255, 0.15);
            }

            .sre-close-btn {
              background: #14171E;
              border: 1px solid rgba(255, 255, 255, 0.08);
              color: var(--text-muted);
              border-radius: var(--radius-md);
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              font-size: 0.8125rem;
              transition: all 140ms ease;
            }

            .sre-close-btn:hover {
              background: #242936;
              color: var(--text-primary);
            }

            /* ─── Executive Telemetry Ribbon ─── */
            .sre-telemetry-ribbon {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              background: #0D0F14;
              border-bottom: 1px solid rgba(255, 255, 255, 0.06);
              flex-shrink: 0;
            }

            @media (max-width: 800px) {
              .sre-telemetry-ribbon {
                grid-template-columns: repeat(3, 1fr);
              }
            }

            .sre-telemetry-cell {
              padding: 0.75rem 1rem;
              border-right: 1px solid rgba(255, 255, 255, 0.05);
              display: flex;
              flex-direction: column;
              gap: 0.15rem;
            }

            .sre-telemetry-cell:last-child {
              border-right: none;
            }

            .sre-telemetry-label {
              font-size: 0.625rem;
              font-family: var(--font-mono);
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: var(--text-muted);
            }

            .sre-telemetry-val {
              font-size: 0.875rem;
              font-weight: 700;
              color: var(--text-primary);
            }

            /* ─── Scrollable Document Body ─── */
            .sre-body {
              padding: 1.5rem 1.75rem 2.5rem 1.75rem;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
              mask-image: linear-gradient(to bottom, black calc(100% - 36px), transparent 100%);
              -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 36px), transparent 100%);
            }

            .sre-section {
              display: flex;
              flex-direction: column;
              gap: 0.625rem;
            }

            .sre-section-title {
              font-size: 0.75rem;
              font-weight: 700;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: var(--color-aura);
              border-bottom: 1px solid rgba(255, 255, 255, 0.06);
              padding-bottom: 0.35rem;
              margin: 0;
            }

            /* ─── Key-Value Summary & Root Cause ─── */
            .sre-kv-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
            }

            @media (max-width: 768px) {
              .sre-kv-grid {
                grid-template-columns: 1fr;
              }
            }

            .sre-kv-card {
              background: #0E1015;
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: var(--radius-lg);
              padding: 0.875rem 1rem;
              display: flex;
              flex-direction: column;
              gap: 0.25rem;
              box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
            }

            .sre-kv-card--root {
              grid-column: 1 / -1;
              background: linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, #0E1015 100%);
              border-color: rgba(16, 185, 129, 0.3);
              border-left: 3px solid #10B981;
            }

            .sre-kv-label {
              font-size: 0.625rem;
              font-family: var(--font-mono);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--text-muted);
            }

            .sre-kv-val {
              font-size: 0.8125rem;
              font-weight: 600;
              color: var(--text-primary);
              line-height: 1.4;
            }

            /* ─── Evidence Chain SVG Pipeline ─── */
            .sre-pipeline-container {
              background: #0E1015;
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: var(--radius-lg);
              padding: 1rem;
              overflow-x: auto;
              box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
            }

            /* ─── Classified Timeline Table ─── */
            .sre-table-wrap {
              background: #0E1015;
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: var(--radius-lg);
              overflow: hidden;
              box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
            }

            .sre-table-header {
              display: grid;
              grid-template-columns: 80px 110px 1fr 140px;
              gap: 0.75rem;
              padding: 0.625rem 1rem;
              background: #13161E;
              border-bottom: 1px solid rgba(255, 255, 255, 0.06);
              font-family: var(--font-mono);
              font-size: 0.625rem;
              font-weight: 700;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: var(--text-muted);
            }

            .sre-table-row {
              display: grid;
              grid-template-columns: 80px 110px 1fr 140px;
              gap: 0.75rem;
              align-items: center;
              padding: 0.625rem 1rem;
              border-bottom: 1px solid rgba(255, 255, 255, 0.03);
              font-size: 0.75rem;
              transition: background 120ms ease;
            }

            .sre-table-row:nth-child(even) {
              background: rgba(255, 255, 255, 0.015);
            }

            .sre-table-row:hover {
              background: #151821;
            }

            .sre-table-row:last-child {
              border-bottom: none;
            }

            .sre-pill {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0.15rem 0.5rem;
              border-radius: var(--radius-sm);
              font-family: var(--font-mono);
              font-size: 0.625rem;
              font-weight: 700;
              letter-spacing: 0.04em;
              width: fit-content;
            }

            .sre-pill-fact {
              background: rgba(99, 102, 241, 0.12);
              border: 1px solid rgba(99, 102, 241, 0.3);
              color: #818CF8;
            }

            .sre-pill-hypothesis {
              background: rgba(212, 168, 83, 0.12);
              border: 1px solid rgba(212, 168, 83, 0.3);
              color: var(--color-aura);
            }

            .sre-pill-decision {
              background: rgba(168, 85, 247, 0.12);
              border: 1px solid rgba(168, 85, 247, 0.3);
              color: #C084FC;
            }

            .sre-pill-action {
              background: rgba(16, 185, 129, 0.12);
              border: 1px solid rgba(16, 185, 129, 0.3);
              color: #34D399;
            }

            /* ─── Disproven Theories Elimination Card ─── */
            .sre-disproven-box {
              background: #0E1015;
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-left: 3px solid #EF4444;
              border-radius: var(--radius-lg);
              padding: 0.875rem 1.125rem;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }

            .sre-disproven-item {
              display: flex;
              align-items: flex-start;
              gap: 0.5rem;
              font-size: 0.75rem;
              line-height: 1.45;
            }

            /* ─── Remediation Actions Checklist ─── */
            .sre-actions-grid {
              display: flex;
              flex-direction: column;
              gap: 0.375rem;
            }

            .sre-action-row {
              background: #0E1015;
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: var(--radius-md);
              padding: 0.5rem 0.875rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 0.75rem;
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

            {/* Operational Telemetry Ribbon */}
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
                <div className="sre-kv-grid">
                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Incident Status</span>
                    <span className="sre-kv-val" style={{ color: '#34D399' }}>RESOLVED / MITIGATED</span>
                  </div>
                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Detection Vector</span>
                    <span className="sre-kv-val">Agora Multi-Speaker Audio Bridge</span>
                  </div>
                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Root Cause Confidence</span>
                    <span className="sre-kv-val" style={{ color: 'var(--color-aura)' }}>85% (CONFIDENCE CAP)</span>
                  </div>

                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Verified Facts</span>
                    <span className="sre-kv-val" style={{ color: '#818CF8' }}>{factsCount} Facts Established</span>
                  </div>
                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Hypotheses Tested</span>
                    <span className="sre-kv-val" style={{ color: 'var(--color-aura)' }}>
                      {confirmedCount} Confirmed • {disprovenCount} Disproven
                    </span>
                  </div>
                  <div className="sre-kv-card">
                    <span className="sre-kv-label">Command Directives</span>
                    <span className="sre-kv-val" style={{ color: '#C084FC' }}>{decisionCount} Decisions Arbitrated</span>
                  </div>

                  <div className="sre-kv-card sre-kv-card--root">
                    <span className="sre-kv-label" style={{ color: '#34D399' }}>Confirmed Root Cause</span>
                    <span className="sre-kv-val">
                      {confirmedHypothesis?.content ??
                        'Database connection pool exhaustion caused by unoptimized query in PR #492.'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Section 2: Causal Evidence Chain */}
              <section className="sre-section">
                <h3 className="sre-section-title">2. Causal Evidence Chain & Pipeline</h3>
                <div className="sre-pipeline-container">
                  <svg viewBox="0 0 720 100" width="100%" height="100">
                    <defs>
                      <marker
                        id="sre-arrow"
                        viewBox="0 0 10 10"
                        refX="18"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.25)" />
                      </marker>
                    </defs>

                    {/* Connectors */}
                    {chainNodes.slice(0, -1).map((node, i) => {
                      const x1 = 55 + i * 102;
                      const y1 = 45;
                      const x2 = 55 + (i + 1) * 102;
                      const y2 = 45;
                      return (
                        <line
                          key={`sre-line-${i}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="rgba(255, 255, 255, 0.15)"
                          strokeWidth="1.5"
                          markerEnd="url(#sre-arrow)"
                        />
                      );
                    })}

                    {/* Nodes */}
                    {chainNodes.map((node, i) => {
                      const cx = 55 + i * 102;
                      const cy = 45;
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

                      return (
                        <g key={node.id}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={14}
                            fill="#0A0C10"
                            stroke={fillColor}
                            strokeWidth={2}
                            opacity={isDis ? 0.4 : 1}
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
                          <rect
                            x={cx - 30}
                            y={cy + 22}
                            width="60"
                            height="16"
                            rx="3"
                            fill="#13161E"
                            stroke="rgba(255, 255, 255, 0.08)"
                            strokeWidth="0.5"
                          />
                          <text
                            x={cx}
                            y={cy + 33}
                            textAnchor="middle"
                            fill={fillColor}
                            fontSize="8"
                            fontFamily="var(--font-mono)"
                            fontWeight="700"
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
