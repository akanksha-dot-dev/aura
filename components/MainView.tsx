'use client';

import React, { useState } from 'react';
import { EvidenceItem, TopologyNode, TopologyEdge } from '@/lib/types';
import { TimelineFeed } from './TimelineFeed';
import { IncidentTopology } from './IncidentTopology';

export interface MainViewProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  isResolved?: boolean;
  activeTab?: 'timeline' | 'topology';
  onTabChange?: (tab: 'timeline' | 'topology') => void;
}

export function MainView({
  evidenceItems,
  incidentOpenedAt,
  nodes,
  edges,
  isResolved = false,
  activeTab: controlledActiveTab,
  onTabChange,
}: MainViewProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<'timeline' | 'topology'>('timeline');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabSelect = (tab: 'timeline' | 'topology') => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <>
      <style>{`
        .main-view {
          grid-area: main;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: var(--bg-base);
          overflow: hidden;
          position: relative;
        }

        .main-view__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          height: 40px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          z-index: 10;
        }

        .main-view__tabs {
          position: relative;
          display: inline-flex;
          align-items: center;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 2px;
          gap: 2px;
        }

        .main-view__tab {
          height: 24px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 9px;
          border-radius: 3px;
          transition: all var(--duration-fast) var(--ease-standard);
          user-select: none;
          position: relative;
          z-index: 2;
        }

        .main-view__tab:hover {
          color: var(--text-primary);
        }

        .main-view__tab--active {
          background: var(--bg-surface);
          color: var(--color-aura);
          font-weight: 600;
          border-color: var(--border-subtle);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .main-view__tab-icon {
          display: flex;
          align-items: center;
        }

        .main-view__tab-count {
          font-family: var(--font-mono);
          font-size: 9.5px;
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 4px;
          border-radius: 2px;
          color: var(--text-muted);
        }

        .main-view__tab--active .main-view__tab-count {
          background: rgba(212, 168, 83, 0.12);
          color: var(--color-aura);
        }

        .main-view__meta-hint {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .main-view__panel {
          min-height: 0;
        }
      `}</style>
      <main
        className={`main-view ${isResolved ? 'main-view--resolved' : ''}`}
        aria-label="Incident Investigation Main Canvas"
      >
        {/* Tab Navigation Header */}
        <div className="main-view__header">
          <div
            className="main-view__tabs"
            role="tablist"
            aria-label="Investigation view selection"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'timeline'}
              id="tab-timeline"
              aria-controls="panel-timeline"
              className={`main-view__tab ${
                activeTab === 'timeline' ? 'main-view__tab--active' : ''
              }`}
              onClick={() => handleTabSelect('timeline')}
            >
              <span className="main-view__tab-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              <span>Timeline</span>
              <span className="main-view__tab-count">{evidenceItems.length}</span>
              {activeTab !== 'timeline' && <kbd className="keyboard-hint-badge" title="Press T to switch view">T</kbd>}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'topology'}
              id="tab-topology"
              aria-controls="panel-topology"
              className={`main-view__tab ${
                activeTab === 'topology' ? 'main-view__tab--active' : ''
              }`}
              onClick={() => handleTabSelect('topology')}
            >
              <span className="main-view__tab-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </span>
              <span>Topology Graph</span>
              <span className="main-view__tab-count">{nodes.length}</span>
              {activeTab !== 'topology' && <kbd className="keyboard-hint-badge" title="Press T to switch view">T</kbd>}
            </button>
          </div>

          <div className="main-view__meta-hint">
            {activeTab === 'timeline' ? (
              <span>CHRONOLOGICAL TELEMETRY STREAM</span>
            ) : (
              <span>FORCE-DIRECTED CAUSAL INFERENCE</span>
            )}
          </div>
        </div>

        {/* Tab Panels: Both remain mounted to preserve simulation physics & scroll state */}
        <div
          role="tabpanel"
          id="panel-timeline"
          aria-labelledby="tab-timeline"
          className="main-view__panel"
          style={{
            display: activeTab === 'timeline' ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
          }}
        >
          <TimelineFeed
            evidenceItems={evidenceItems}
            incidentOpenedAt={incidentOpenedAt}
          />
        </div>

        <div
          role="tabpanel"
          id="panel-topology"
          aria-labelledby="tab-topology"
          className="main-view__panel"
          style={{
            display: activeTab === 'topology' ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
          }}
        >
          <IncidentTopology
            nodes={nodes}
            edges={edges}
          />
        </div>
      </main>
    </>
  );
}
