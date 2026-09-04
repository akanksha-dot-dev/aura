'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EvidenceItem } from '@/lib/types';
import { springs } from '@/lib/springs';
import { VoiceBadge } from './VoiceBadge';

export interface TimelineCardProps {
  item: EvidenceItem;
  displayConfidence: number;
  defaultExpanded?: boolean;
}

const PERSONA_COLORS: Record<string, string> = {
  sarah_ic: 'var(--color-conflict)',
  marcus_sre: 'var(--color-fact)',
  priya_pm: 'var(--color-decision)',
  aura_agent: 'var(--color-aura)',
};

function getSpeakerColor(uid: string): string {
  if (PERSONA_COLORS[uid]) return PERSONA_COLORS[uid];
  const palette = [
    'var(--color-conflict)',
    'var(--color-fact)',
    'var(--color-decision)',
    'var(--color-hypothesis)',
    'var(--color-action)',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % palette.length;
  }
  return palette[hash];
}

function getSpeakerRole(uid: string, speakerName?: string): string {
  if (uid === 'aura_agent' || speakerName?.toLowerCase().includes('aura')) return 'AURA AI';
  if (uid.includes('sarah') || speakerName?.toLowerCase().includes('sarah')) return 'Incident Commander';
  if (uid.includes('marcus') || speakerName?.toLowerCase().includes('marcus')) return 'Senior SRE';
  if (uid.includes('priya') || speakerName?.toLowerCase().includes('priya')) return 'Product Lead';
  return 'Responder';
}

function getCleanSpeakerInfo(rawName?: string, rawUid: string = '') {
  let name = rawName || 'Unknown';
  let role = '';

  const match = name.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    name = match[1].trim();
    role = match[2].trim();
  } else {
    role = getSpeakerRole(rawUid, rawName);
  }

  return { name, role };
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function TimelineCard({
  item,
  displayConfidence,
  defaultExpanded = true,
}: TimelineCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isHypothesis = item.category === 'hypothesis';
  const isDisproven = isHypothesis && item.status === 'disproven';
  const isConfirmed = isHypothesis && item.status === 'confirmed';
  const isStale = isHypothesis && item.status === 'stale';

  const prevStatusRef = useRef(item.status);
  const [justDisproven, setJustDisproven] = useState(false);

  // Detect active → disproven transition for 3-phase 800ms animation
  useEffect(() => {
    if (isHypothesis && prevStatusRef.current === 'active' && item.status === 'disproven') {
      setJustDisproven(true);
      const timer = setTimeout(() => setJustDisproven(false), 850);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = item.status;
  }, [item.status, isHypothesis]);

  // Temporal decay factor (0.1 to 1.0)
  const decayFactor =
    isHypothesis && item.confidence > 0
      ? Math.max(0.1, Math.min(1.0, displayConfidence / item.confidence))
      : 1;

  const isVeryStale = (isStale || (isHypothesis && decayFactor < 0.3)) && !isDisproven && !isConfirmed;

  // Category class modifier
  const typeClass = isConfirmed
    ? 'timeline-card--fact timeline-card--confirmed'
    : `timeline-card--${item.category}`;

  const speakerInfo = getCleanSpeakerInfo(item.speakerName, item.speakerUid);

  // Node glyph rendered on the vertical spine
  const renderSpineGlyph = () => {
    if (isConfirmed) {
      return (
        <span className="timeline-card__spine-node timeline-card__spine-node--fact" title="Confirmed Fact">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    }

    switch (item.category) {
      case 'fact':
        return (
          <span className="timeline-card__spine-node timeline-card__spine-node--fact" title="Confirmed Fact">
            <span className="timeline-card__node-dot" />
          </span>
        );
      case 'hypothesis':
        return (
          <span
            className={`timeline-card__spine-node timeline-card__spine-node--hypothesis ${
              isDisproven ? 'timeline-card__spine-node--disproven' : ''
            }`}
            title={isDisproven ? 'Disproven Hypothesis' : 'Active Hypothesis'}
          >
            {isDisproven ? '✕' : '?'}
          </span>
        );
      case 'decision':
        return (
          <span className="timeline-card__spine-node timeline-card__spine-node--decision" title="IC Decision">
            <span className="timeline-card__node-diamond" />
          </span>
        );
      case 'action':
        return (
          <span className="timeline-card__spine-node timeline-card__spine-node--action" title="Assigned Action">
            <span className="timeline-card__node-square" />
          </span>
        );
      case 'conflict':
        return (
          <span className="timeline-card__spine-node timeline-card__spine-node--conflict" title="Active Conflict">
            ⚠
          </span>
        );
      default:
        return (
          <span className="timeline-card__spine-node">
            <span className="timeline-card__node-dot" />
          </span>
        );
    }
  };

  const cardContent = (
    <>
      <style>{`
        .timeline-card {
          position: relative;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          box-shadow: var(--shadow-inner-glow);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          margin-bottom: 0;
          transition: background-color var(--duration-fast) var(--ease-standard),
                      border-color var(--duration-fast) var(--ease-standard),
                      box-shadow var(--duration-fast) var(--ease-standard);
        }

        .timeline-card:hover {
          background: var(--bg-surface-raised);
          border-color: var(--border-emphasis);
          box-shadow: var(--shadow-card-elevated);
        }

        /* ─── Spine Node Positioned on Vertical Spine ─── */
        .timeline-card__spine-node {
          position: absolute;
          left: -27px;
          top: 10px;
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: var(--bg-base);
          border: 1px solid var(--border-default);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          z-index: 2;
          box-shadow: 0 0 0 3px var(--bg-base);
          transition: transform var(--duration-fast) var(--ease-standard);
        }

        .timeline-card:hover .timeline-card__spine-node {
          transform: scale(1.1);
        }

        .timeline-card__spine-node--fact {
          color: var(--color-fact);
          border-color: var(--color-fact-border);
          background: var(--color-fact-dim);
        }

        .timeline-card__spine-node--hypothesis {
          color: var(--color-hypothesis);
          border-color: var(--color-hypothesis-border);
          background: var(--color-hypothesis-dim);
        }

        .timeline-card__spine-node--disproven {
          color: var(--color-conflict);
          border-color: var(--color-conflict-border);
          background: var(--color-conflict-dim);
        }

        .timeline-card__spine-node--decision {
          color: var(--color-decision);
          border-color: var(--color-decision-border);
          background: var(--color-decision-dim);
        }

        .timeline-card__spine-node--action {
          color: var(--color-action);
          border-color: var(--color-action-border);
          background: var(--color-action-dim);
        }

        .timeline-card__spine-node--conflict {
          color: var(--color-conflict);
          border-color: var(--color-conflict-border);
          background: var(--color-conflict-dim);
        }

        .timeline-card__node-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .timeline-card__node-diamond {
          width: 5px;
          height: 5px;
          transform: rotate(45deg);
          background: currentColor;
        }

        .timeline-card__node-square {
          width: 5px;
          height: 5px;
          border-radius: 1px;
          background: currentColor;
        }

        /* ─── Header Elements ─── */
        .timeline-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: 4px;
        }

        .timeline-card__meta-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .timeline-card__category-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-radius: var(--radius-xs);
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .timeline-card__category-badge--fact {
          color: var(--color-fact);
          background: var(--color-fact-dim);
          border-color: var(--color-fact-border);
        }

        .timeline-card__category-badge--hypothesis {
          color: var(--color-hypothesis);
          background: var(--color-hypothesis-dim);
          border-color: var(--color-hypothesis-border);
        }

        .timeline-card__category-badge--decision {
          color: var(--color-decision);
          background: var(--color-decision-dim);
          border-color: var(--color-decision-border);
        }

        .timeline-card__category-badge--action {
          color: var(--color-action);
          background: var(--color-action-dim);
          border-color: var(--color-action-border);
        }

        .timeline-card__category-badge--conflict {
          color: var(--color-conflict);
          background: var(--color-conflict-dim);
          border-color: var(--color-conflict-border);
        }

        .timeline-card__speaker {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .timeline-card__speaker-name {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: var(--tracking-tight);
        }

        .timeline-card__speaker-role {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        .timeline-card__header-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .timeline-card__confidence-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          padding: 1px 5px;
          border-radius: var(--radius-xs);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .timeline-card__confidence-pill--confirmed {
          color: var(--color-fact);
          border-color: var(--color-fact-border);
          background: var(--color-fact-dim);
        }

        .timeline-card__confidence-pill--disproven {
          color: var(--color-conflict);
          border-color: var(--color-conflict-border);
          background: var(--color-conflict-dim);
        }

        .timeline-card__time {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }

        .timeline-card__toggle-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          color: var(--text-muted);
          border-radius: var(--radius-xs);
          cursor: pointer;
          transition: color var(--duration-fast) var(--ease-standard);
        }

        .timeline-card__toggle-btn:hover {
          color: var(--text-primary);
        }

        .timeline-card__chevron {
          transition: transform var(--duration-fast) var(--ease-standard);
        }

        .timeline-card__chevron--expanded {
          transform: rotate(180deg);
        }

        /* ─── Body Content ─── */
        .timeline-card__content {
          font-family: var(--font-sans);
          font-size: 12.5px;
          line-height: 1.4;
          letter-spacing: var(--tracking-tight);
          color: var(--text-primary);
          margin: 0;
        }

        .timeline-card__content--collapsed {
          cursor: pointer;
          color: var(--text-secondary);
        }

        .timeline-card__content--disproven {
          text-decoration: line-through;
          text-decoration-color: var(--color-conflict);
          text-decoration-thickness: 1.5px;
          color: var(--text-muted);
        }

        .timeline-card__disproven-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          color: var(--color-conflict);
          background: var(--color-conflict-dim);
          border: 1px solid var(--color-conflict-border);
          padding: 1px 5px;
          border-radius: var(--radius-xs);
        }

        .timeline-card__footer {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid var(--border-subtle);
        }

        .meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-sans);
          font-size: 10px;
          padding: 1px 6px;
          border-radius: var(--radius-xs);
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .meta-chip--assignee {
          color: var(--color-action);
          border-color: rgba(232, 125, 62, 0.2);
          background: rgba(232, 125, 62, 0.08);
        }

        .meta-chip--metric {
          color: var(--color-hypothesis);
          border-color: rgba(232, 168, 56, 0.2);
          background: rgba(232, 168, 56, 0.08);
        }

        .meta-chip--related {
          font-family: var(--font-mono);
          font-size: 9px;
        }

        .meta-chip__status {
          font-family: var(--font-mono);
          font-size: 8.5px;
          text-transform: uppercase;
          padding: 0 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.08);
          margin-left: 2px;
        }
      `}</style>

      {renderSpineGlyph()}

      <div className="timeline-card__header">
        <div className="timeline-card__meta-left">
          <span
            className={`timeline-card__category-badge timeline-card__category-badge--${
              isConfirmed ? 'fact' : item.category
            }`}
          >
            <span>{isConfirmed ? 'Confirmed Fact' : item.category}</span>
          </span>

          <div className="timeline-card__speaker">
            <VoiceBadge
              displayName={speakerInfo.name}
              avatarColor={getSpeakerColor(item.speakerUid)}
              isSpeaking={false}
            />
            <span className="timeline-card__speaker-name">{speakerInfo.name}</span>
            <span className="timeline-card__speaker-role">({speakerInfo.role})</span>
          </div>
        </div>

        <div className="timeline-card__header-right">
          {displayConfidence != null && (
            <span
              className={`timeline-card__confidence-pill ${
                isConfirmed
                  ? 'timeline-card__confidence-pill--confirmed'
                  : isDisproven
                  ? 'timeline-card__confidence-pill--disproven'
                  : ''
              }`}
              title={`Confidence: ${isConfirmed ? '100% (Confirmed)' : isDisproven ? '0% (Disproven)' : `${displayConfidence}%`}`}
            >
              {isConfirmed ? '100%' : isDisproven ? '0%' : `${displayConfidence}%`}
            </span>
          )}
          <span className="timeline-card__time">
            {formatTime(item.timestamp)}
          </span>
          <button
            type="button"
            className="timeline-card__toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            aria-label={isExpanded ? 'Collapse card details' : 'Expand card details'}
            aria-expanded={isExpanded}
          >
            <svg
              className={`timeline-card__chevron ${isExpanded ? 'timeline-card__chevron--expanded' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {!isExpanded ? (
        <p
          className={`timeline-card__content timeline-card__content--collapsed ${
            isDisproven ? 'timeline-card__content--disproven' : ''
          }`}
          onClick={() => setIsExpanded(true)}
          title="Click to expand details"
        >
          {item.content.length > 90 ? `${item.content.slice(0, 90)}…` : item.content}
        </p>
      ) : (
        <div className="timeline-card__expanded-body">
          <p
            className={`timeline-card__content ${
              isDisproven ? 'timeline-card__content--disproven' : ''
            }`}
          >
            {item.content}
          </p>

          {/* Disproven Badge entrance animated with Motion springs.disprove */}
          <AnimatePresence>
            {isDisproven && (
              <motion.div
                className="timeline-card__disproven-badge"
                initial={{ opacity: 0, scale: 0.6, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: springs.disprove.stiffness,
                  damping: springs.disprove.damping,
                  mass: springs.disprove.mass,
                }}
              >
                ✕ [DISPROVEN BY TELEMETRY]
              </motion.div>
            )}
          </AnimatePresence>

          {(item.relatedTo.length > 0 ||
            item.assignedTo ||
            item.decidingMetric) && (
            <div className="timeline-card__footer">
              {item.assignedTo && (
                <span className="meta-chip meta-chip--assignee">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0-2.21-3.58-4-6-4s-6 1.79-6 4v1h12v-1zm-10.8-1c.7-1.02 2.6-2 4.8-2s4.1.98 4.8 2H3.2z"/>
                  </svg>
                  <span>{item.assignedTo}</span>
                  {item.actionStatus && (
                    <span className="meta-chip__status">
                      {item.actionStatus}
                    </span>
                  )}
                </span>
              )}
              {item.decidingMetric && (
                <span className="meta-chip meta-chip--metric" title={`Deciding Metric: ${item.decidingMetric}`}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm7.5 1a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                  <span>{item.decidingMetric}</span>
                </span>
              )}
              {item.relatedTo.length > 0 && (
                <span className="meta-chip meta-chip--related">
                  <span>{item.relatedTo.join(', ')}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  // If this is a hypothesis, wrap with motion.article for 3-phase disproval animation
  if (isHypothesis) {
    return (
      <motion.article
        className={`timeline-card ${typeClass} ${
          isDisproven ? 'timeline-card--disproven' : ''
        } ${isVeryStale ? 'timeline-card--stale' : ''}`}
        style={
          {
            '--decay-factor': decayFactor,
          } as React.CSSProperties
        }
        animate={
          justDisproven
            ? {
                boxShadow: [
                  '0 0 0px transparent',
                  '0 0 16px var(--color-conflict)',
                  '0 0 6px var(--color-conflict)',
                  '0 0 0px transparent',
                ],
                scale: [1, 1.01, 0.94, 0.94],
                opacity: [1, 1, 0.5, 0.5],
              }
            : isDisproven
            ? { scale: 0.94, opacity: 0.5 }
            : undefined
        }
        transition={
          justDisproven
            ? {
                duration: 0.8,
                times: [0, 0.25, 0.6, 1],
                ease: 'easeInOut',
              }
            : { duration: 0.3 }
        }
      >
        {cardContent}
      </motion.article>
    );
  }

  // Non-hypothesis cards render standard article element (high performance)
  return (
    <article className={`timeline-card ${typeClass}`}>
      {cardContent}
    </article>
  );
}
