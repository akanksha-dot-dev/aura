'use client';

import React, { useState } from 'react';
import { EvidenceItem, TopologyNode, TopologyEdge, IncidentState } from '@/lib/types';
import { TimelineFeed } from './TimelineFeed';
import { IncidentTopology } from './IncidentTopology';
import { AnalyticsDashboard } from '@/components/common/AnalyticsDashboard';
import { SimilarIncidentBanner } from '@/components/indicators/SimilarIncidentBanner';

export interface MainViewProps {
  evidenceItems: EvidenceItem[];
  incidentOpenedAt: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  isResolved?: boolean;
  activeTab?: 'timeline' | 'topology' | 'analytics';
  onTabChange?: (tab: 'timeline' | 'topology' | 'analytics') => void;
  // Analytics props
  incident?: IncidentState;
  costRate?: number;
  channelName?: string;
  suspectedCause?: string;
  scenarioSummary?: string;
  currentSpeakerName?: string | null;
  currentTranscript?: string;
}

export function MainView({
  evidenceItems,
  incidentOpenedAt,
  nodes,
  edges,
  isResolved = false,
  activeTab: controlledActiveTab,
  onTabChange,
  incident,
  costRate = 150,
  channelName,
  suspectedCause,
  scenarioSummary,
  currentSpeakerName,
  currentTranscript,
}: MainViewProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<'timeline' | 'topology' | 'analytics'>('timeline');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabSelect = (tab: 'timeline' | 'topology' | 'analytics') => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };

  const isAura = currentSpeakerName?.toLowerCase().includes('aura');
  const hasVoiceActivity = Boolean(currentSpeakerName || currentTranscript);

  return (
    <>
      <style>{`
        .main-view {
          grid-area: main;
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: rgba(8, 9, 12, 0.85);
          overflow: hidden;
          position: relative;
        }

        [data-theme="light"] .main-view {
          background: #F8FAFC;
        }

        .main-view__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          height: 38px;
          background: rgba(12, 14, 18, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
          z-index: 10;
        }

        [data-theme="light"] .main-view__header {
          background: #FFFFFF;
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .main-view__tabs {
          position: relative;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 2px;
          gap: 2px;
        }

        [data-theme="light"] .main-view__tabs {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.08);
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
          padding: 0 10px;
          border-radius: 4px;
          transition: all 0.15s ease;
          user-select: none;
        }

        .main-view__tab:hover {
          color: var(--text-primary);
        }

        .main-view__tab--active {
          background: rgba(255, 255, 255, 0.08);
          color: #D4A853;
          font-weight: 700;
          border-color: rgba(212, 168, 83, 0.3);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }

        [data-theme="light"] .main-view__tab--active {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }

        .main-view__tab-icon {
          display: flex;
          align-items: center;
        }

        .main-view__tab-count {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.06);
          padding: 1px 4.5px;
          border-radius: 3px;
          color: var(--text-muted);
        }

        .main-view__tab--active .main-view__tab-count {
          background: rgba(212, 168, 83, 0.2);
          color: #D4A853;
        }

        .main-view__meta-hint {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        /* ─── Dynamic Live Acoustic Intel Banner (Active Voice HUD) ─── */
        .main-view__acoustic-hud {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          background: rgba(14, 16, 22, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
          font-family: var(--font-sans);
          z-index: 8;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        [data-theme="light"] .main-view__acoustic-hud {
          background: rgba(248, 250, 252, 0.95);
          border-bottom-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .acoustic-hud__speaker-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(212, 168, 83, 0.1);
          border: 1px solid rgba(212, 168, 83, 0.3);
          padding: 2px 8px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .acoustic-hud__pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D4A853;
          box-shadow: 0 0 6px #D4A853;
        }

        .acoustic-hud__pulse-dot--active {
          background: #10B981;
          box-shadow: 0 0 8px #10B981;
          animation: aura-voice-dot-pulse 1.2s ease-in-out infinite;
        }

        @keyframes aura-voice-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .acoustic-hud__speaker-name {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: #D4A853;
        }

        .acoustic-hud__role-tag {
          font-family: var(--font-mono);
          font-size: 8.5px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .acoustic-hud__transcript {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }

        .acoustic-hud__eq {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
          flex-shrink: 0;
        }

        .hud-eq-bar {
          width: 2.5px;
          height: 4px;
          background: #D4A853;
          border-radius: 1px;
          animation: hud-eq-dance 0.8s ease-in-out infinite alternate;
        }

        .hud-eq-bar:nth-child(2) { animation-delay: 0.2s; height: 10px; }
        .hud-eq-bar:nth-child(3) { animation-delay: 0.4s; height: 6px; }

        @keyframes hud-eq-dance {
          0% { height: 3px; }
          100% { height: 12px; }
        }

        .acoustic-hud__text-wrap {
          display: flex;
          align-items: center;
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }

        .acoustic-hud__text {
          font-size: 11px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .acoustic-hud__cursor {
          display: inline-block;
          width: 4px;
          height: 11px;
          background: #D4A853;
          margin-left: 3px;
          animation: cursor-blink 1s steps(2, start) infinite;
          flex-shrink: 0;
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
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

            {/* Analytics Tab */}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analytics'}
              id="tab-analytics"
              aria-controls="panel-analytics"
              className={`main-view__tab ${
                activeTab === 'analytics' ? 'main-view__tab--active' : ''
              }`}
              onClick={() => handleTabSelect('analytics')}
            >
              <span className="main-view__tab-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              <span>Analytics</span>
              <span className="main-view__tab-count">{incident?.participants ? Object.keys(incident.participants).length : 4}</span>
            </button>
          </div>

          <div className="main-view__meta-hint">
            <span>CHRONOLOGICAL TELEMETRY & CAUSAL INFERENCE</span>
          </div>
        </div>

        {/* Dynamic Live Acoustic Intel Banner */}
        <div className="main-view__acoustic-hud" role="region" aria-label="Real-time acoustic intel">
          <div className="acoustic-hud__speaker-badge">
            <span className={`acoustic-hud__pulse-dot ${hasVoiceActivity ? 'acoustic-hud__pulse-dot--active' : ''}`} aria-hidden="true" />
            <span className="acoustic-hud__speaker-name">{currentSpeakerName || 'AURA'}</span>
            <span className="acoustic-hud__role-tag">
              {isAura ? 'AI COMMANDER' : currentSpeakerName ? 'VOICE INGRESS' : 'STANDBY'}
            </span>
          </div>

          <div className="acoustic-hud__transcript">
            <div className="acoustic-hud__eq" aria-hidden="true">
              <span className="hud-eq-bar" />
              <span className="hud-eq-bar" />
              <span className="hud-eq-bar" />
            </div>
            <div className="acoustic-hud__text-wrap">
              <span className="acoustic-hud__text">
                {currentTranscript || 'AURA real-time voice intelligence monitoring Agora SD-RTN™ audio bridge. Push-to-Talk or speak freely.'}
              </span>
              {currentTranscript && <span className="acoustic-hud__cursor" aria-hidden="true" />}
            </div>
          </div>
        </div>

        {/* Similar Incident Advisory Banner */}
        {incident && !isResolved && (
          <SimilarIncidentBanner
            incident={incident}
            channelName={channelName || ''}
          />
        )}

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
            incidentTitle={incident?.title}
            severity={incident?.severity}
            affectedServices={incident?.affectedServices}
            suspectedCause={suspectedCause}
            scenarioSummary={scenarioSummary}
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

        {/* Analytics Panel */}
        <div
          role="tabpanel"
          id="panel-analytics"
          aria-labelledby="tab-analytics"
          className="main-view__panel"
          style={{
            display: activeTab === 'analytics' ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {incident && activeTab === 'analytics' && (
            <AnalyticsDashboard incident={incident} costRate={costRate} />
          )}
        </div>
      </main>
    </>
  );
}
