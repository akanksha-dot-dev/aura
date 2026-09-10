'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { IncidentState } from '@/lib/types';
import { springs } from '@/lib/springs';

export interface WarRoomSummaryCardProps {
  incident: IncidentState;
  actions: { id: string; status: string }[];
  onDismiss: () => void;
}

/**
 * WarRoomSummaryCard — a floating glassmorphism card that appears at bottom-right
 * once 5+ evidence items are logged. Shows key metrics and the top active hypothesis
 * as an AURA insight at a glance. Fully dismissible.
 */
export function WarRoomSummaryCard({ incident, actions, onDismiss }: WarRoomSummaryCardProps) {
  const activeHypotheses = useMemo(
    () => incident.evidenceItems.filter((e) => e.category === 'hypothesis' && e.status !== 'disproven'),
    [incident.evidenceItems]
  );

  const pendingActions = useMemo(
    () => actions.filter((a) => a.status === 'pending').length,
    [actions]
  );

  const conflictCount = useMemo(
    () => incident.evidenceItems.filter((e) => e.category === 'conflict').length,
    [incident.evidenceItems]
  );

  const topHypothesis = useMemo(() => {
    const sorted = [...activeHypotheses].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    return sorted[0];
  }, [activeHypotheses]);

  const elapsedMin = Math.floor((Date.now() - incident.openedAt) / 60000);

  return (
    <motion.div
      className="wrsummary-card"
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={springs.stiff}
      role="complementary"
      aria-label="War Room Summary"
    >
      {/* Header */}
      <div className="wrsummary-header">
        <div className="wrsummary-header-left">
          <div className="wrsummary-icon" aria-hidden="true">⚡</div>
          <span className="wrsummary-title">Situation Report</span>
        </div>
        <button
          type="button"
          className="wrsummary-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss situation report"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Metrics */}
      <div className="wrsummary-body">
        <div className="wrsummary-metrics">
          <div className="wrsummary-metric">
            <span className="wrsummary-metric-value">{activeHypotheses.length}</span>
            <span className="wrsummary-metric-label">Hypotheses</span>
          </div>
          <div className="wrsummary-metric">
            <span className="wrsummary-metric-value">{pendingActions}</span>
            <span className="wrsummary-metric-label">Actions</span>
          </div>
          <div className="wrsummary-metric">
            <span
              className="wrsummary-metric-value"
              style={{ color: elapsedMin >= 30 ? 'var(--color-conflict)' : elapsedMin >= 15 ? 'var(--color-orient)' : 'var(--text-primary)' }}
            >
              {elapsedMin}m
            </span>
            <span className="wrsummary-metric-label">Elapsed</span>
          </div>
        </div>

        {/* AURA insight */}
        <div className="wrsummary-insight" aria-label="AURA insight">
          <span className="wrsummary-insight-icon" aria-hidden="true">◈</span>
          <p className="wrsummary-insight-text">
            {topHypothesis ? (
              <><strong>{topHypothesis.confidence && topHypothesis.confidence >= 75 ? 'High confidence' : topHypothesis.confidence && topHypothesis.confidence >= 50 ? 'Moderate confidence' : 'Low confidence'}:</strong>{' '}
              {topHypothesis.content.length > 70 ? topHypothesis.content.slice(0, 70) + '…' : topHypothesis.content}</>
            ) : conflictCount > 0 ? (
              <><strong>{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</strong> detected — investigate diverging hypotheses to unblock progress.</>
            ) : (
              <><strong>{incident.evidenceItems.length} items</strong> classified. Continue gathering facts to form a hypothesis.</>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
