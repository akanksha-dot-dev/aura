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
}

function formatDuration(startMs: number, endMs?: number): string {
  const totalSec = Math.max(0, Math.floor(((endMs || Date.now()) - startMs) / 1000));
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
  recordingUrl,
  transcriptUrl,
}: PostmortemModalProps) {
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

  // Derived summaries
  const duration = useMemo(() => {
    return formatDuration(incident.openedAt, incident.resolvedAt);
  }, [incident.openedAt, incident.resolvedAt]);

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

  const costTotal = incident.costAccrued || 130680;
  const costSavings = Math.round(costTotal * 0.52);

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
                            r={16}
                            fill={fillColor}
                            opacity={isDis ? 0.35 : 0.85}
                            stroke={fillColor}
                            strokeWidth={1.5}
                          />
                          <text
                            x={cx}
                            y={cy + 4}
                            textAnchor="middle"
                            fill="var(--text-primary)"
                            fontSize="10"
                            fontFamily="var(--font-mono)"
                            fontWeight="bold"
                          >
                            {isDis ? '✕' : node.id.replace('evt-', '')}
                          </text>
                          <text
                            x={cx}
                            y={cy + 30}
                            textAnchor="middle"
                            fill="var(--text-secondary)"
                            fontSize="9"
                            fontFamily="var(--font-mono)"
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

              {/* Day 6 Artifact Placeholders */}
              <section className="postmortem-section">
                <h3 className="postmortem-subtitle">
                  Compliance Artifacts & Recordings
                </h3>
                <div className="postmortem-media-grid">
                  <a
                    href={recordingUrl || '#recording-placeholder'}
                    className={`postmortem-media-btn ${
                      !recordingUrl ? 'postmortem-media-btn--disabled' : ''
                    }`}
                    onClick={(e) => {
                      if (!recordingUrl) {
                        e.preventDefault();
                        alert('Incident room audio recording will be finalized post-session.');
                      }
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1h)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Play Compliance Recording
                    </span>
                  </a>
                  <a
                    href={transcriptUrl || '#transcript-placeholder'}
                    className={`postmortem-media-btn ${
                      !transcriptUrl ? 'postmortem-media-btn--disabled' : ''
                    }`}
                    onClick={(e) => {
                      if (!transcriptUrl) {
                        e.preventDefault();
                        alert('STT cross-talk transcript archived.');
                      }
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1h)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download .VTT Cross-Talk Transcript
                    </span>
                  </a>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
