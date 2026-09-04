'use client';

import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EvidenceItem, getDisplayConfidence } from '@/lib/types';
import { TimelineCard } from './TimelineCard';

export interface TimelineFeedProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
}

export function TimelineFeed({ evidenceItems }: TimelineFeedProps) {
  const router = useRouter();
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
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: var(--space-3) var(--space-3) var(--space-4) 38px;
          gap: 6px;
        }

        /* ─── Continuous Vertical Chronological Spine ─── */
        .timeline-feed__spine {
          position: absolute;
          top: var(--space-3);
          bottom: var(--space-3);
          left: 19px;
          width: 1px;
          background: linear-gradient(
            to bottom,
            var(--border-subtle) 0%,
            rgba(255, 255, 255, 0.12) 15%,
            rgba(255, 255, 255, 0.08) 85%,
            transparent 100%
          );
          pointer-events: none;
          z-index: 1;
        }

        .timeline-feed__empty {
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

        .timeline-feed__start-replay-btn {
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

        .timeline-feed__start-replay-btn:hover {
          background: var(--bg-surface-hover);
          border-color: var(--color-aura);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(212, 168, 83, 0.2);
        }
      `}</style>
      <div className="timeline-feed" ref={feedRef} role="feed" aria-label="Incident timeline feed">
        {evidenceItems.length > 0 && (
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
