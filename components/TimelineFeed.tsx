'use client';

import React, { useRef, useEffect } from 'react';
import { EvidenceItem, getDisplayConfidence } from '@/lib/types';
import { TimelineCard } from './TimelineCard';

export interface TimelineFeedProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
}

export function TimelineFeed({ evidenceItems }: TimelineFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      <div className="timeline-feed" role="feed" aria-label="Incident timeline feed">
        {evidenceItems.length === 0 ? (
          <div className="timeline-feed__empty">
            <div className="timeline-feed__empty-icon" aria-hidden="true">
              📋
            </div>
            <div>Waiting for incident telemetry and responder speech...</div>
          </div>
        ) : (
          evidenceItems.map((item) => (
            <TimelineCard
              key={item.id}
              item={item}
              displayConfidence={getDisplayConfidence(item)}
            />
          ))
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </>
  );
}
