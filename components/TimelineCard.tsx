'use client';

import React from 'react';
import { EvidenceItem } from '@/lib/types';
import { VoiceBadge } from './VoiceBadge';

export interface TimelineCardProps {
  item: EvidenceItem;
  displayConfidence: number;
}

const PERSONA_COLORS: Record<string, string> = {
  sarah_ic: '#E85454',
  marcus_sre: '#3BD4A2',
  priya_pm: '#7B8CFF',
  aura_agent: '#D4A853',
};

function getSpeakerColor(uid: string): string {
  if (PERSONA_COLORS[uid]) return PERSONA_COLORS[uid];
  const palette = ['#E85454', '#3BD4A2', '#7B8CFF', '#E8A838', '#E87D3E'];
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
  const isDisproven =
    item.category === 'hypothesis' && item.status === 'disproven';
  const isStale = item.category === 'hypothesis' && item.status === 'stale';
  const isConfirmed =
    item.category === 'hypothesis' && item.status === 'confirmed';

  // Category class modifier
  const typeClass = isConfirmed
    ? 'timeline-card--fact'
    : `timeline-card--${item.category}`;

  // Temporal decay factor for CSS styling (0.1 to 1.0)
  const decayFactor =
    item.category === 'hypothesis' && item.confidence > 0
      ? Math.max(0.1, Math.min(1.0, displayConfidence / item.confidence))
      : 1;

  // Max confidence is 85 per D-026, scale to percentage of 85
  const confidencePercent = Math.min(
    100,
    Math.max(0, Math.round((displayConfidence / 85) * 100))
  );

  const badgeSymbol = {
    fact: '●',
    hypothesis: '?',
    decision: '◆',
    action: '■',
    conflict: '⚠',
  }[item.category] ?? '●';

  return (
    <>
      <style>{`
        .timeline-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
          margin-bottom: var(--space-1h);
        }
        .timeline-card__meta-left {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: 0;
        }
        .timeline-card__speaker {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-primary);
        }
        .timeline-card__time {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .timeline-card__content {
          font-size: var(--text-base);
          line-height: var(--leading-normal);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .timeline-card__confidence-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-top: var(--space-1h);
        }
        .timeline-card__confidence-label {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .timeline-card__confidence-track {
          flex: 1;
          height: 4px;
          background: var(--border-subtle);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .timeline-card__confidence-fill {
          height: 100%;
          border-radius: var(--radius-sm);
          transition: width var(--duration-normal) var(--ease-standard);
        }
        .timeline-card__footer {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-top: var(--space-2);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .timeline-card__disproven-banner {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--color-conflict);
          font-weight: var(--weight-semibold);
          text-transform: uppercase;
          margin-top: var(--space-1);
        }
      `}</style>
      <article
        className={`timeline-card ${typeClass} ${
          isDisproven ? 'timeline-card--disproven' : ''
        } ${isStale ? 'timeline-card--stale' : ''}`}
        style={
          {
            '--decay-factor': decayFactor,
          } as React.CSSProperties
        }
      >
        <div className="timeline-card__header">
          <div className="timeline-card__meta-left">
            <span className={`badge badge-${item.category}`}>
              <span aria-hidden="true">{badgeSymbol}</span> {item.category}
            </span>
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

        <p className="timeline-card__content">{item.content}</p>

        {isDisproven && (
          <div className="timeline-card__disproven-banner">
            ✕ Disproven Hypothesis
          </div>
        )}

        <div className="timeline-card__confidence-wrap">
          <span className="timeline-card__confidence-label">
            Confidence: {displayConfidence}%
          </span>
          <div className="timeline-card__confidence-track">
            <div
              className="timeline-card__confidence-fill"
              style={{
                width: `${confidencePercent}%`,
                backgroundColor:
                  item.category === 'fact'
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
      </article>
    </>
  );
}
