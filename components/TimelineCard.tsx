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

  const isDecayedStale = isHypothesis && decayFactor < 0.5 && !isDisproven && !isConfirmed;
  const isVeryStale = (isStale || (isHypothesis && decayFactor < 0.3)) && !isDisproven && !isConfirmed;

  // Category class modifier
  const typeClass = isConfirmed
    ? 'timeline-card--fact timeline-card--confirmed'
    : `timeline-card--${item.category}`;

  const badgeSymbol = {
    fact: '●',
    hypothesis: '?',
    decision: '◆',
    action: '■',
    conflict: '⚠',
  }[item.category] ?? '●';

  const speakerRole = getSpeakerRole(item.speakerUid, item.speakerName);

  const cardContent = (
    <>
      <div className="timeline-card__header">
        <div className="timeline-card__meta-left">
          <span
            className={`badge badge-${isConfirmed ? 'fact' : item.category}`}
            style={
              isConfirmed
                ? {
                    background: 'var(--color-fact-dim)',
                    color: 'var(--color-fact)',
                    borderColor: 'var(--color-fact-border)',
                  }
                : undefined
            }
          >
            <span aria-hidden="true">{isConfirmed ? '✓' : badgeSymbol}</span>{' '}
            <span>{isConfirmed ? 'Confirmed' : item.category}</span>
          </span>

          {isDecayedStale && (
            <span className="timeline-card__stale-badge" title="Decayed confidence due to inactivity">
              Stale
            </span>
          )}

          <div className="timeline-card__speaker">
            <VoiceBadge
              displayName={item.speakerName}
              avatarColor={getSpeakerColor(item.speakerUid)}
              isSpeaking={false}
            />
            <div className="timeline-card__speaker-info">
              <span className="timeline-card__speaker-name">{item.speakerName}</span>
              <span className="timeline-card__speaker-role">{speakerRole}</span>
            </div>
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
                ✕ [DISPROVEN]
              </motion.div>
            )}
          </AnimatePresence>

          {(item.relatedTo.length > 0 ||
            item.assignedTo ||
            item.decidingMetric) && (
            <div className="timeline-card__footer">
              {item.assignedTo && (
                <span className="meta-chip meta-chip--assignee">
                  <svg className="meta-chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0-2.21-3.58-4-6-4s-6 1.79-6 4v1h12v-1zm-10.8-1c.7-1.02 2.6-2 4.8-2s4.1.98 4.8 2H3.2z"/>
                  </svg>
                  <span>{item.assignedTo}</span>
                  {item.actionStatus && (
                    <span className={`meta-chip__status meta-chip__status--${item.actionStatus}`}>
                      {item.actionStatus}
                    </span>
                  )}
                </span>
              )}
              {item.decidingMetric && (
                <span className="meta-chip meta-chip--metric" title={`Deciding Metric: ${item.decidingMetric}`}>
                  <svg className="meta-chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm7.5 1a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                  <span>{item.decidingMetric}</span>
                </span>
              )}
              {item.relatedTo.length > 0 && (
                <span className="meta-chip meta-chip--related">
                  <svg className="meta-chip__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
                    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 0 0-4.243-4.243L6.586 4.672z"/>
                  </svg>
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
                  '0 0 20px var(--color-conflict)',
                  '0 0 8px var(--color-conflict)',
                  '0 0 0px transparent',
                ],
                scale: [1, 1.02, 0.92, 0.92],
                opacity: [1, 1, 0.4, 0.4],
              }
            : isDisproven
            ? { scale: 0.92, opacity: 0.4 }
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
    <article
      className={`timeline-card ${typeClass}`}
    >
      {cardContent}
    </article>
  );
}
