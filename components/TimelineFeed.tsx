'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EvidenceItem, getDisplayConfidence, ClassificationType } from '@/lib/types';
import { TimelineCard } from './TimelineCard';

export interface TimelineFeedProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
}

type TimelineFilter = 'all' | ClassificationType;

export function TimelineFeed({ evidenceItems }: TimelineFeedProps) {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<TimelineFilter>('all');

  useEffect(() => {
    const el = feedRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [evidenceItems.length, filter]);

  const counts = {
    all: evidenceItems.length,
    fact: evidenceItems.filter((i) => i.category === 'fact').length,
    conflict: evidenceItems.filter((i) => i.category === 'conflict').length,
    action: evidenceItems.filter((i) => i.category === 'action').length,
    hypothesis: evidenceItems.filter((i) => i.category === 'hypothesis').length,
    decision: evidenceItems.filter((i) => i.category === 'decision').length,
  };

  const filterTabs: { id: TimelineFilter; label: string; dotColor?: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'fact', label: 'Facts', dotColor: 'var(--color-fact)', count: counts.fact },
    { id: 'conflict', label: 'Conflicts', dotColor: 'var(--color-conflict, #D84C4C)', count: counts.conflict },
    { id: 'decision', label: 'Decisions', dotColor: 'var(--color-decision)', count: counts.decision },
    { id: 'action', label: 'Actions', dotColor: 'var(--color-action)', count: counts.action },
    { id: 'hypothesis', label: 'Hypotheses', dotColor: 'var(--color-hypothesis)', count: counts.hypothesis },
  ];

  const filteredItems = evidenceItems.filter(
    (item) => filter === 'all' || item.category === filter
  );

  return (
    <>
      <style>{`
        .timeline-stage {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          background: var(--bg-base);
          position: relative;
        }

        /* ─── Category Filter Pill Bar ─── */
        .timeline-filters {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-hairline);
          flex-shrink: 0;
          z-index: 5;
          overflow-x: auto;
        }

        .timeline-filter-pill {
          height: 22px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 8px;
          border-radius: var(--radius-full);
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 10.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
          user-select: none;
          white-space: nowrap;
        }

        .timeline-filter-pill:hover {
          color: var(--text-primary);
          border-color: var(--border-emphasis);
          background: var(--bg-surface-hover);
        }

        .timeline-filter-pill--active {
          background: var(--color-aura-dim);
          border-color: rgba(245, 158, 11, 0.4);
          color: var(--color-aura);
          font-weight: 600;
        }

        .timeline-filter-pill__dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .timeline-filter-pill__count {
          font-family: var(--font-mono);
          font-size: 9px;
          opacity: 0.8;
          padding: 0 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.05);
        }

        .timeline-filter-pill--active .timeline-filter-pill__count {
          background: rgba(245, 158, 11, 0.2);
          color: var(--color-aura);
        }

        .timeline-feed {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 8px 12px 16px 36px;
          gap: 3px;
        }

        /* ─── Continuous Vertical Chronological Spine ─── */
        .timeline-feed__spine {
          position: absolute;
          top: 8px;
          bottom: 16px;
          left: 17px;
          width: 1px;
          background: var(--border-hairline);
          pointer-events: none;
          z-index: 1;
        }

        .timeline-feed__empty,
        .timeline-feed__no-match {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 280px;
          color: var(--text-muted);
          font-family: var(--font-sans);
          text-align: center;
          gap: var(--space-3);
          padding: var(--space-8);
          margin-left: -19px;
        }

        .timeline-feed__empty-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          color: var(--color-aura);
          box-shadow: var(--shadow-inner-glow);
          animation: empty-pulse 2.5s ease-in-out infinite;
        }

        @keyframes empty-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); box-shadow: 0 0 0 0 rgba(212, 168, 83, 0.15); }
          50% { opacity: 1; transform: scale(1.04); box-shadow: 0 0 16px 2px rgba(212, 168, 83, 0.2); }
        }

        .timeline-feed__empty-title {
          font-size: var(--text-md);
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: var(--tracking-tight);
          margin: 0;
        }

        .timeline-feed__empty-sub {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          max-width: 320px;
          line-height: var(--leading-relaxed);
          margin: 0;
        }

        .timeline-feed__start-replay-btn,
        .timeline-feed__reset-filter {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: var(--space-2);
          padding: 5px 14px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          box-shadow: var(--shadow-inner-glow);
          border-radius: var(--radius-full);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--color-aura);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .timeline-feed__start-replay-btn:hover,
        .timeline-feed__reset-filter:hover {
          background: var(--bg-surface-hover);
          border-color: var(--color-aura);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(212, 168, 83, 0.2);
        }
      `}</style>

      <div className="timeline-stage">
        {/* Category Filters (visible when there are items) */}
        {evidenceItems.length > 0 && (
          <div className="timeline-filters" role="tablist" aria-label="Filter timeline events">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`timeline-filter-pill ${
                  filter === tab.id ? 'timeline-filter-pill--active' : ''
                }`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.dotColor && (
                  <span
                    className="timeline-filter-pill__dot"
                    style={{ background: tab.dotColor }}
                    aria-hidden="true"
                  />
                )}
                <span>{tab.label}</span>
                <span className="timeline-filter-pill__count">{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="timeline-feed" ref={feedRef} role="feed" aria-label="Incident timeline feed">
          {filteredItems.length > 0 && (
            <div className="timeline-feed__spine" aria-hidden="true" />
          )}

          {evidenceItems.length === 0 ? (
            <div className="timeline-feed__empty">
              <div className="timeline-feed__empty-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <p className="timeline-feed__empty-title">Awaiting incident telemetry</p>
              <p className="timeline-feed__empty-sub">
                AURA is listening. Speak into the bridge to begin epistemic classification and action extraction.
              </p>
              <button
                type="button"
                className="timeline-feed__start-replay-btn"
                onClick={() => {
                  router.push('/?persona=sarah_chen&channel=incident-sev1-checkout&__AURA_REPLAY_MOCK_STREAM=true&speed=1.5');
                  router.refresh();
                }}
                title="Start demo incident replay simulation"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Launch Demo Simulation</span>
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="timeline-feed__no-match">
              <p className="timeline-feed__empty-title">No {filter} events found</p>
              <p className="timeline-feed__empty-sub">
                No events in this incident match the active filter.
              </p>
              <button
                type="button"
                className="timeline-feed__reset-filter"
                onClick={() => setFilter('all')}
              >
                Reset Filter ({evidenceItems.length} Total)
              </button>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isRecent = idx >= filteredItems.length - 3;
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
      </div>
    </>
  );
}
