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
}

export function MainView({
  evidenceItems,
  incidentOpenedAt,
  nodes,
  edges,
  isResolved = false,
}: MainViewProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'topology'>('timeline');

  return (
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
            onClick={() => setActiveTab('timeline')}
          >
            <span className="main-view__tab-icon" aria-hidden="true">
              ⚡
            </span>
            <span>Timeline</span>
            <span className="main-view__tab-count">{evidenceItems.length}</span>
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
            onClick={() => setActiveTab('topology')}
          >
            <span className="main-view__tab-icon" aria-hidden="true">
              🕸
            </span>
            <span>Topology Graph</span>
            <span className="main-view__tab-count">{nodes.length}</span>
          </button>

          {/* Sliding Underline Indicator */}
          <div
            className="main-view__tab-indicator"
            style={{
              transform:
                activeTab === 'timeline'
                  ? 'translateX(0%)'
                  : 'translateX(100%)',
            }}
          />
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
  );
}
