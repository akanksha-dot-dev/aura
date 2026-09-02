'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EvidenceItem } from '@/lib/types';
import { springs } from '@/lib/springs';
import { VoiceBadge } from './VoiceBadge';

export interface TimelineCardProps {
  item: EvidenceItem;
  displayConfidence: number;
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

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function TimelineCard({ item, displayConfidence }: TimelineCardProps) {
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

  // Scaled percentage of 85 (CONFIDENCE_CAP)
  const confidencePercent = isConfirmed
    ? 100
    : Math.min(100, Math.max(0, Math.round((displayConfidence / 85) * 100)));

  const badgeSymbol = {
    fact: '●',
    hypothesis: '?',
    decision: '◆',
    action: '■',
    conflict: '⚠',
  }[item.category] ?? '●';

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
            {isConfirmed ? 'Confirmed' : item.category}
          </span>

          {isDecayedStale && (
            <span className="timeline-card__stale-tag" title="Decayed confidence due to inactivity">
              (stale)
            </span>
          )}

          <div className="timeline-card__speaker">
            <VoiceBadge
              displayName={item.speakerName}
              avatarColor={getSpeakerColor(item.speakerUid)}
              isSpeaking={false}
            />
            <span>{item.speakerName}</span>
          </div>
        </div>

        <span className="timeline-card__time">
          {formatTime(item.timestamp)}
        </span>
      </div>

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

      <div className="timeline-card__confidence-wrap">
        <span className="timeline-card__confidence-label">
          {isConfirmed
            ? '✓ Confirmed (100%)'
            : isDisproven
            ? 'Disproven (0%)'
            : `Confidence: ${displayConfidence}%`}
        </span>
        <div className="timeline-card__confidence-track">
          <div
            className="timeline-card__confidence-fill"
            style={{
              width: `${isDisproven ? 0 : confidencePercent}%`,
              backgroundColor: isConfirmed
                ? 'var(--color-fact)'
                : isDisproven
                ? 'var(--color-conflict)'
                : item.category === 'fact'
                ? 'var(--color-fact)'
                : item.category === 'hypothesis'
                ? 'var(--color-hypothesis)'
                : item.category === 'decision'
                ? 'var(--color-decision)'
                : item.category === 'action'
                ? 'var(--color-action)'
                : 'var(--color-conflict)',
            }}
          />
        </div>
      </div>

      {(item.relatedTo.length > 0 ||
        item.assignedTo ||
        item.decidingMetric) && (
        <div className="timeline-card__footer">
          {item.assignedTo && (
            <div>
              Assignee: {item.assignedTo}{' '}
              {item.actionStatus ? `[${item.actionStatus}]` : ''}
            </div>
          )}
          {item.decidingMetric && (
            <div>Deciding Metric: {item.decidingMetric}</div>
          )}
          {item.relatedTo.length > 0 && (
            <div>Related: {item.relatedTo.join(', ')}</div>
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
