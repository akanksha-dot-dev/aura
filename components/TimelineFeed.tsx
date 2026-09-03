'use client';

import React, { useRef, useEffect } from 'react';
import { EvidenceItem, getDisplayConfidence } from '@/lib/types';
import { TimelineCard } from './TimelineCard';

export interface TimelineFeedProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
}

export function TimelineFeed({ evidenceItems }: TimelineFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [evidenceItems.length]);

  return (
    <>
      <style>{`
        .timeline-feed {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: var(--space-4);
          gap: var(--space-2);
        }

        .timeline-feed__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          text-align: center;
          gap: var(--space-2);
        }

        .timeline-feed__empty-icon {
          font-size: var(--text-2xl);
          color: var(--border-emphasis);
        }
      `}</style>
      <div className="timeline-feed" ref={feedRef} role="feed" aria-label="Incident timeline feed">
        {evidenceItems.length === 0 ? (
          <div className="timeline-feed__empty">
            <div className="timeline-feed__empty-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>Waiting for incident telemetry and responder speech...</div>
          </div>
        ) : (
          evidenceItems.map((item, idx) => {
            const isRecent = idx >= evidenceItems.length - 3;
            return (
              <TimelineCard
                key={item.id}
                item={item}
                displayConfidence={getDisplayConfidence(item)}
                defaultExpanded={isRecent}
              />
            );
          })
        )}
      </div>
    </>
  );
}
