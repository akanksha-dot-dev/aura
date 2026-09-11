'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EvidenceItem, getDisplayConfidence, ClassificationType } from '@/lib/types';
import { TimelineCard } from './TimelineCard';

export interface TimelineFeedProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
  incidentTitle?: string;
  severity?: string;
  affectedServices?: string[];
  suspectedCause?: string;
  scenarioSummary?: string;
}

type TimelineFilter = 'all' | ClassificationType;

export function TimelineFeed({
  evidenceItems,
  incidentTitle,
  severity,
  affectedServices = [],
  suspectedCause,
  scenarioSummary,
}: TimelineFeedProps) {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredItems = evidenceItems.filter((item) => {
    const matchesCategory = filter === 'all' || item.category === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || item.content.toLowerCase().includes(q) || (item.speakerName ?? '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const hasSearch = searchQuery.trim().length > 0;

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

        .timeline-feed__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 360px;
          color: var(--text-muted);
          font-family: var(--font-sans);
          text-align: center;
          gap: 14px;
          padding: 24px 16px;
          max-width: 580px;
          width: 100%;
          margin: auto;
          box-sizing: border-box;
        }

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

        .timeline-feed__radar-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 3px 12px;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.25);
          border-radius: var(--radius-full);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--color-aura);
          text-transform: uppercase;
        }

        .timeline-feed__radar-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-aura);
          box-shadow: 0 0 8px var(--color-aura);
          animation: radar-ping 2s ease-in-out infinite;
        }

        @keyframes radar-ping {
          0%, 100% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 1; }
        }

        .timeline-feed__dossier {
          width: 100%;
          background: var(--bg-surface-raised, #131217);
          border: 1px solid var(--border-hairline);
          border-radius: var(--radius-md, 8px);
          padding: 14px 16px;
          text-align: left;
          box-shadow: var(--shadow-card-elevated, 0 4px 16px rgba(0, 0, 0, 0.3));
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-sizing: border-box;
        }

        .timeline-feed__dossier-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-hairline);
          padding-bottom: 8px;
        }

        .timeline-feed__dossier-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .timeline-feed__dossier-sev {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          background: rgba(249, 115, 22, 0.15);
          border: 1px solid rgba(249, 115, 22, 0.4);
          color: var(--color-sev1, #F97316);
        }

        .timeline-feed__dossier-title {
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          margin: 0;
        }

        .timeline-feed__dossier-desc {
          font-family: var(--font-sans);
          font-size: 11px;
          line-height: 1.45;
          color: var(--text-secondary);
          margin: 0;
        }

        .timeline-feed__dossier-cause-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
          background: rgba(212, 168, 83, 0.06);
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-radius: var(--radius-sm);
        }

        .timeline-feed__dossier-cause-header {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--color-hypothesis);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .timeline-feed__dossier-cause-dot {
          font-size: 8px;
          color: var(--color-hypothesis);
        }

        .timeline-feed__dossier-cause-body {
          font-family: var(--font-sans);
          font-size: 11.5px;
          line-height: 1.45;
          color: var(--text-primary);
          margin: 0;
        }

        .timeline-feed__dossier-services {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .timeline-feed__service-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-hairline);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
        }

        .timeline-feed__prompt-pills {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .timeline-feed__prompt-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          background: rgba(212, 168, 83, 0.04);
          border: 1px solid rgba(212, 168, 83, 0.18);
          border-radius: var(--radius-md, 6px);
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          text-align: left;
          transition: all 150ms ease;
          user-select: none;
        }

        .timeline-feed__prompt-pill:hover {
          background: rgba(212, 168, 83, 0.09);
          border-color: rgba(212, 168, 83, 0.4);
          color: var(--color-aura);
        }

        .timeline-feed__empty-icon {
          width: 38px;
          height: 38px;
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
          font-size: var(--text-md, 14px);
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: var(--tracking-tight);
          margin: 0;
        }

        .timeline-feed__empty-sub {
          font-size: var(--text-xs, 11px);
          color: var(--text-secondary);
          max-width: 440px;
          line-height: var(--leading-relaxed, 1.5);
          margin: 4px 0 0 0;
        }

        .timeline-feed__start-replay-btn,
        .timeline-feed__reset-filter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-default);
          box-shadow: var(--shadow-inner-glow);
          border-radius: var(--radius-full);
          font-family: var(--font-sans);
          font-size: var(--text-xs, 11px);
          font-weight: 500;
          color: var(--color-aura);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
          width: fit-content;
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

        {/* Search Bar (visible when there are items) */}
        {evidenceItems.length > 0 && (
          <div className="timeline-search-bar" role="search">
            <div className="timeline-search-wrap">
              <svg
                className="timeline-search-icon"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                id="timeline-search"
                type="search"
                className="timeline-search-input"
                placeholder="Search evidence, speakers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search timeline evidence"
              />
            </div>
            {hasSearch && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                {filteredItems.length} / {evidenceItems.length}
              </span>
            )}
            {hasSearch && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="timeline-feed" ref={feedRef} role="feed" aria-label="Incident timeline feed">
          {filteredItems.length > 0 && (
            <div className="timeline-feed__spine" aria-hidden="true" />
          )}

          {evidenceItems.length === 0 ? (
            <div className="timeline-feed__empty">
              <div className="timeline-feed__radar-badge">
                <span className="timeline-feed__radar-dot" />
                <span>Agora SD-RTM™ · 48kHz HD Audio Bridge Active</span>
              </div>

              <div className="timeline-feed__empty-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>

              <div>
                <h3 className="timeline-feed__empty-title">Awaiting Incident Telemetry</h3>
                <p className="timeline-feed__empty-sub">
                  AURA is live on the bridge and listening to your voice. Speak into your microphone to discuss hypotheses, query metrics, or declare actions.
                </p>
              </div>

              {incidentTitle && (
                <div className="timeline-feed__dossier">
                  <div className="timeline-feed__dossier-top">
                    <span className="timeline-feed__dossier-tag">OPERATIONAL BRIEFING DOSSIER</span>
                    <span className="timeline-feed__dossier-sev">{severity || 'SEV-1'}</span>
                  </div>
                  <h4 className="timeline-feed__dossier-title">{incidentTitle}</h4>
                  {scenarioSummary && (
                    <p className="timeline-feed__dossier-desc">{scenarioSummary}</p>
                  )}
                  {suspectedCause && (
                    <div className="timeline-feed__dossier-cause-box">
                      <div className="timeline-feed__dossier-cause-header">
                        <span className="timeline-feed__dossier-cause-dot" aria-hidden="true">●</span>
                        <span>SUSPECTED ROOT CAUSE</span>
                      </div>
                      <p className="timeline-feed__dossier-cause-body">
                        {suspectedCause}
                      </p>
                    </div>
                  )}
                  {affectedServices.length > 0 && (
                    <div className="timeline-feed__dossier-services">
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>AFFECTED:</span>
                      {affectedServices.map((svc) => (
                        <span key={svc} className="timeline-feed__service-pill">
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-sev1, #F97316)' }} />
                          {svc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="timeline-feed__prompt-pills">
                <div className="timeline-feed__prompt-pill">
                  <span style={{ color: 'var(--color-aura)' }}>🎙</span>
                  <span>Try saying: &quot;AURA, what is our active incident status?&quot;</span>
                </div>
                <div className="timeline-feed__prompt-pill">
                  <span style={{ color: 'var(--color-aura)' }}>🎙</span>
                  <span>Try saying: &quot;AURA, check database connection pool headroom&quot;</span>
                </div>
              </div>

              <button
                type="button"
                className="timeline-feed__start-replay-btn"
                onClick={() => {
                  router.push('/?persona=sarah_chen&channel=incident-sev1-checkout&__AURA_REPLAY_MOCK_STREAM=true&speed=1.5');
                  router.refresh();
                }}
                title="Switch to scripted demo replay"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Or switch to Scripted Demo Replay</span>
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
                  sequenceIndex={idx + 1}
                  allItems={evidenceItems}
                />
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
