'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlaybookStep } from '@/lib/scenarios';
import { springs } from '@/lib/springs';

export interface SmartPlaybookProps {
  steps: PlaybookStep[];
  onCreateAction: (title: string, detail: string) => void;
  incidentStatus: 'investigating' | 'identified' | 'monitoring' | 'resolved';
}

const PHASE_LABELS: Record<PlaybookStep['phase'], string> = {
  diagnose: 'Diagnose',
  mitigate: 'Mitigate',
  resolve: 'Resolve',
  communicate: 'Communicate',
};

const PHASE_COLORS: Record<PlaybookStep['phase'], string> = {
  diagnose: 'var(--color-fact)',
  mitigate: 'var(--color-action)',
  resolve: 'var(--color-hypothesis)',
  communicate: 'var(--color-decision)',
};

const PRIORITY_COLORS: Record<PlaybookStep['priority'], string> = {
  critical: 'var(--color-conflict)',
  high: 'var(--color-action)',
  medium: 'var(--color-hypothesis)',
};

const PHASE_ORDER: PlaybookStep['phase'][] = ['diagnose', 'mitigate', 'communicate', 'resolve'];

export function SmartPlaybook({ steps, onCreateAction, incidentStatus }: SmartPlaybookProps) {
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<PlaybookStep['phase'] | 'all'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredSteps = useMemo(() => {
    const base = activePhase === 'all' ? steps : steps.filter(s => s.phase === activePhase);
    return base.sort((a, b) => {
      const priorityRank = { critical: 0, high: 1, medium: 2 };
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      return PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase);
    });
  }, [steps, activePhase]);

  const completedCount = completedStepIds.size;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const phasesPresent = useMemo(() => {
    return PHASE_ORDER.filter(ph => steps.some(s => s.phase === ph));
  }, [steps]);

  function toggleComplete(id: string) {
    setCompletedStepIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleCreateAction(step: PlaybookStep) {
    onCreateAction(step.title, step.detail);
    toggleComplete(step.id);
  }

  async function copyCommand(step: PlaybookStep) {
    if (!step.command) return;
    try {
      await navigator.clipboard.writeText(step.command);
      setCopiedCmdId(step.id);
      setTimeout(() => setCopiedCmdId(null), 2000);
    } catch { /* ignore */ }
  }

  if (steps.length === 0) return null;

  return (
    <div className="smart-playbook">
      {/* Header */}
      <div className="playbook-header" onClick={() => setIsCollapsed(p => !p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setIsCollapsed(p => !p)}>
        <div className="playbook-header-left">
          <span className="playbook-icon">📋</span>
          <span className="playbook-title">AURA Smart Playbook</span>
          <span className="playbook-badge">{completedCount}/{totalCount}</span>
        </div>
        <div className="playbook-header-right">
          <div className="playbook-progress-wrap">
            <div className="playbook-progress-bar">
              <motion.div
                className="playbook-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="playbook-progress-pct">{progressPct}%</span>
          </div>
          <span className="playbook-chevron" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {/* Phase filter tabs */}
            <div className="playbook-phase-tabs">
              <button
                className={`playbook-phase-tab ${activePhase === 'all' ? 'playbook-phase-tab--active' : ''}`}
                onClick={() => setActivePhase('all')}
              >
                All
              </button>
              {phasesPresent.map(ph => (
                <button
                  key={ph}
                  className={`playbook-phase-tab ${activePhase === ph ? 'playbook-phase-tab--active' : ''}`}
                  style={{ '--phase-color': PHASE_COLORS[ph] } as React.CSSProperties}
                  onClick={() => setActivePhase(ph)}
                >
                  {PHASE_LABELS[ph]}
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="playbook-steps">
              {filteredSteps.map((step, i) => {
                const isComplete = completedStepIds.has(step.id);
                const isExpanded = expandedStepId === step.id;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.stiff, delay: i * 0.04 }}
                    className={`playbook-step ${isComplete ? 'playbook-step--done' : ''}`}
                    style={{ '--step-phase-color': PHASE_COLORS[step.phase] } as React.CSSProperties}
                  >
                    <div className="playbook-step-main" onClick={() => setExpandedStepId(isExpanded ? null : step.id)}>
                      <button
                        className="playbook-step-check"
                        onClick={e => { e.stopPropagation(); toggleComplete(step.id); }}
                        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
                        title={isComplete ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {isComplete ? '✓' : ''}
                      </button>

                      <div className="playbook-step-info">
                        <div className="playbook-step-meta">
                          <span className="playbook-step-phase" style={{ color: PHASE_COLORS[step.phase] }}>
                            {PHASE_LABELS[step.phase]}
                          </span>
                          <span className="playbook-step-priority" style={{ color: PRIORITY_COLORS[step.priority] }}>
                            {step.priority === 'critical' ? '● CRITICAL' : step.priority === 'high' ? '● HIGH' : '● MED'}
                          </span>
                        </div>
                        <span className={`playbook-step-title ${isComplete ? 'playbook-step-title--done' : ''}`}>
                          {step.title}
                        </span>
                      </div>

                      <span className="playbook-step-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                          className="playbook-step-detail"
                        >
                          <p className="playbook-step-desc">{step.detail}</p>
                          {step.command && (
                            <div className="playbook-step-cmd">
                              <code className="playbook-step-cmd-text">{step.command}</code>
                              <button
                                className="playbook-step-copy-btn"
                                onClick={() => copyCommand(step)}
                                title="Copy command"
                              >
                                {copiedCmdId === step.id ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                          <div className="playbook-step-actions">
                            {incidentStatus !== 'resolved' && (
                              <button
                                className="playbook-step-action-btn"
                                onClick={() => handleCreateAction(step)}
                              >
                                ＋ Add as Action Item
                              </button>
                            )}
                            {!isComplete && (
                              <button
                                className="playbook-step-done-btn"
                                onClick={() => toggleComplete(step.id)}
                              >
                                ✓ Mark Done
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
