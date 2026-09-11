'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { IncidentState } from '@/lib/types';
import { emitToast } from '@/components/indicators/NotificationToast';

export interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentState;
  channelName: string;
  onResolved?: (result: ResolveResult) => void;
}

interface ResolveResult {
  resolved: boolean;
  incidentId: string;
  score: {
    overallScore: number;
    mttrMs: number;
    slaMet: boolean;
    participantCount: number;
    evidenceCount: number;
  };
  summary: {
    severity: string;
    mttrMinutes: number;
    rootCauseCategory: string;
  };
}

const ROOT_CAUSE_CATEGORIES = [
  { value: 'code-bug', label: 'Code Bug', icon: '🐛', desc: 'Logic error, null pointer, race condition' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🏗️', desc: 'Server, network, cloud provider issue' },
  { value: 'configuration', label: 'Configuration', icon: '⚙️', desc: 'Misconfigured setting, env variable, feature flag' },
  { value: 'dependency', label: 'Dependency', icon: '🔗', desc: 'Third-party service, library, or API failure' },
  { value: 'capacity', label: 'Capacity', icon: '📊', desc: 'Resource exhaustion, scaling, traffic spike' },
  { value: 'security', label: 'Security', icon: '🔒', desc: 'Vulnerability, unauthorized access, DDoS' },
  { value: 'process', label: 'Process', icon: '📋', desc: 'Deployment, change management, human error' },
  { value: 'unknown', label: 'Unknown', icon: '❓', desc: 'Root cause could not be determined' },
] as const;

const SLA_RESOLVE_MINUTES: Record<string, number> = {
  'SEV-0': 60,
  'SEV-1': 240,
  'SEV-2': 1440,
  'SEV-3': 4320,
};

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: 'A+', color: '#10B981' };
  if (score >= 80) return { letter: 'A', color: '#10B981' };
  if (score >= 70) return { letter: 'B', color: '#F59E0B' };
  if (score >= 60) return { letter: 'C', color: '#F97316' };
  if (score >= 50) return { letter: 'D', color: '#F43F5E' };
  return { letter: 'F', color: '#F43F5E' };
}

export function ResolveIncidentModal({
  isOpen,
  onClose,
  incident,
  channelName,
  onResolved,
}: ResolveIncidentModalProps) {
  const [rootCauseCategory, setRootCauseCategory] = useState('');
  const [rootCauseDescription, setRootCauseDescription] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest root cause from confirmed hypotheses
  const suggestedRootCause = useMemo(() => {
    const confirmed = incident.evidenceItems.find(
      (e) => e.category === 'hypothesis' && e.status === 'confirmed',
    );
    return confirmed?.content || '';
  }, [incident.evidenceItems]);

  // SLA info
  const elapsedMinutes = Math.round((Date.now() - incident.openedAt) / 60_000);
  const slaTargetMinutes = SLA_RESOLVE_MINUTES[incident.severity] ?? 240;
  const slaMet = elapsedMinutes <= slaTargetMinutes;

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !result) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, result]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setRootCauseCategory('');
      setRootCauseDescription(suggestedRootCause);
      setLessonsLearned('');
      setResult(null);
      setError(null);
    }
  }, [isOpen, suggestedRootCause]);

  const handleSubmit = async () => {
    if (!rootCauseCategory || !rootCauseDescription.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/incidents/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          rootCause: {
            category: rootCauseCategory,
            description: rootCauseDescription.trim(),
          },
          lessonsLearned: lessonsLearned.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Resolution failed (HTTP ${res.status})`);
        return;
      }

      setResult(data);
      onResolved?.(data);

      emitToast({
        type: 'resolution',
        title: 'Incident Resolved',
        description: `Response Grade: ${getGrade(data.score?.overallScore || 0).letter} — MTTR: ${data.summary?.mttrMinutes || 0}m — SLA ${data.score?.slaMet ? 'Met ✅' : 'Breached ❌'}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !result) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              width: result ? 480 : 560,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--bg-surface, #0D0E11)',
              border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
              borderRadius: 'var(--radius-xl, 12px)',
              boxShadow: '0 24px 80px -16px rgba(0,0,0,0.8), inset 0 1px 0 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* ── Scorecard View (After Resolution) ── */}
            {result ? (
              <div style={{ padding: 28 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                  <h2
                    style={{
                      fontSize: 'var(--text-xl, 20px)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    Incident Resolved
                  </h2>
                  <p
                    style={{
                      fontSize: 'var(--text-sm, 12px)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {incident.title}
                  </p>
                </div>

                {/* Score Circle */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `conic-gradient(${getGrade(result.score.overallScore).color} ${result.score.overallScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                      boxShadow: `0 0 30px ${getGrade(result.score.overallScore).color}33`,
                    }}
                  >
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'var(--bg-surface, #0D0E11)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          color: getGrade(result.score.overallScore).color,
                        }}
                      >
                        {getGrade(result.score.overallScore).letter}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {result.score.overallScore}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: 'MTTR',
                      value: `${result.summary.mttrMinutes}m`,
                      color: result.score.slaMet ? '#10B981' : '#F43F5E',
                    },
                    {
                      label: 'SLA',
                      value: result.score.slaMet ? 'Met ✅' : 'Breached ❌',
                      color: result.score.slaMet ? '#10B981' : '#F43F5E',
                    },
                    {
                      label: 'Evidence',
                      value: `${result.score.evidenceCount} items`,
                      color: '#6366F1',
                    },
                    {
                      label: 'Participants',
                      value: `${result.score.participantCount}`,
                      color: '#F59E0B',
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-surface-raised, #13151A)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md, 6px)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 'var(--text-xs, 11px)',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 4,
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-lg, 16px)',
                          fontWeight: 600,
                          color: m.color,
                        }}
                      >
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md, 6px)',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: 'var(--text-base, 13px)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface-raised)';
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              /* ── Resolution Form ── */
              <div style={{ padding: 28 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h2
                      style={{
                        fontSize: 'var(--text-lg, 16px)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 4,
                      }}
                    >
                      🎯 Resolve Incident
                    </h2>
                    <p
                      style={{
                        fontSize: 'var(--text-sm, 12px)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {incident.title}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontSize: 'var(--text-xs, 11px)',
                      fontWeight: 600,
                      background: slaMet ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                      color: slaMet ? '#10B981' : '#F43F5E',
                      border: `1px solid ${slaMet ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                    }}
                  >
                    {slaMet ? `✅ SLA OK — ${elapsedMinutes}m / ${slaTargetMinutes}m` : `⚠️ SLA BREACHED — ${elapsedMinutes}m / ${slaTargetMinutes}m`}
                  </div>
                </div>

                {/* Root Cause Category */}
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm, 12px)',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  Root Cause Category *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {ROOT_CAUSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setRootCauseCategory(cat.value)}
                      title={cat.desc}
                      style={{
                        padding: '8px 4px',
                        background:
                          rootCauseCategory === cat.value
                            ? 'rgba(99, 102, 241, 0.12)'
                            : 'var(--bg-surface-raised)',
                        border: `1px solid ${rootCauseCategory === cat.value ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md, 6px)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s',
                        color: rootCauseCategory === cat.value ? '#6366F1' : 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <span style={{ fontSize: 'var(--text-xs, 11px)', fontWeight: 500 }}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Root Cause Description */}
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm, 12px)',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Root Cause Description *
                </label>
                <textarea
                  value={rootCauseDescription}
                  onChange={(e) => setRootCauseDescription(e.target.value)}
                  placeholder="Describe the root cause..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md, 6px)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-base, 13px)',
                    fontFamily: 'var(--font-sans)',
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: 14,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                />

                {suggestedRootCause && rootCauseDescription !== suggestedRootCause && (
                  <button
                    onClick={() => setRootCauseDescription(suggestedRootCause)}
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-xs, 11px)',
                      color: '#6366F1',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.15)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      marginTop: -8,
                      marginBottom: 14,
                    }}
                  >
                    🧠 Use confirmed hypothesis: &quot;{suggestedRootCause.slice(0, 60)}…&quot;
                  </button>
                )}

                {/* Lessons Learned */}
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm, 12px)',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Lessons Learned (optional)
                </label>
                <textarea
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  placeholder="What should we do differently next time?"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md, 6px)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-base, 13px)',
                    fontFamily: 'var(--font-sans)',
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: 18,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                />

                {/* Error */}
                {error && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      borderRadius: 'var(--radius-md, 6px)',
                      color: '#F43F5E',
                      fontSize: 'var(--text-sm, 12px)',
                      marginBottom: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={onClose}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: 'var(--bg-surface-raised)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md, 6px)',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      fontSize: 'var(--text-base, 13px)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!rootCauseCategory || !rootCauseDescription.trim() || isSubmitting}
                    style={{
                      flex: 2,
                      padding: '10px 0',
                      background:
                        !rootCauseCategory || !rootCauseDescription.trim()
                          ? 'rgba(16, 185, 129, 0.1)'
                          : '#10B981',
                      border: 'none',
                      borderRadius: 'var(--radius-md, 6px)',
                      color:
                        !rootCauseCategory || !rootCauseDescription.trim()
                          ? 'rgba(16, 185, 129, 0.4)'
                          : '#08090A',
                      fontWeight: 600,
                      fontSize: 'var(--text-base, 13px)',
                      cursor:
                        !rootCauseCategory || !rootCauseDescription.trim()
                          ? 'not-allowed'
                          : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isSubmitting ? '⏳ Resolving...' : '✅ Resolve Incident'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
