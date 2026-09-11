'use client';

import React from 'react';
import type { OODAPhase } from '@/lib/types';
import type { AgoraNetworkStats } from '@/hooks/useAgoraRTC';
import { NarrativeBar } from '@/components/indicators/NarrativeBar';
import { LiveCaptions } from '@/components/indicators/LiveCaptions';
import { IncidentStats } from '@/components/indicators/IncidentStats';
import { AgoraAnalyticsOverlay } from '@/components/common/AgoraAnalyticsOverlay';

export interface MissionDeckProps {
  tensionHistory: { timestamp: number; value: number }[];
  oodaPhase: OODAPhase;
  inflectionPoints: { timestamp: number; label: string }[];
  captionSpeakerName: string | null;
  currentTranscript: string;
  factCount: number;
  hypothesisCount: number;
  decisionCount: number;
  actionCompletedCount: number;
  actionTotalCount: number;
  conflictCount: number;
  networkStats: AgoraNetworkStats;
  pipelineLatency: { stt: number | null; llm: number | null; tts: number | null };
  isAnalyticsCollapsed: boolean;
  onToggleAnalytics: () => void;
  onToggleTranscript: () => void;
  onToggleShortcuts: () => void;
  onOpenQuickCapture: () => void;
  onOpenInvite: () => void;
}

export function MissionDeck({
  tensionHistory,
  oodaPhase,
  inflectionPoints,
  captionSpeakerName,
  currentTranscript,
  factCount,
  hypothesisCount,
  decisionCount,
  actionCompletedCount,
  actionTotalCount,
  conflictCount,
  networkStats,
  pipelineLatency,
  isAnalyticsCollapsed,
  onToggleAnalytics,
  onToggleTranscript,
  onToggleShortcuts,
  onOpenQuickCapture,
  onOpenInvite,
}: MissionDeckProps) {
  return (
    <footer className="mission-deck" role="region" aria-label="Incident Mission Deck">
      <div className="mission-deck__tension">
        <NarrativeBar
          tensionHistory={tensionHistory}
          oodaPhase={oodaPhase}
          inflectionPoints={inflectionPoints}
        />
      </div>
      <div className="mission-deck__captions">
        <LiveCaptions
          currentSpeakerName={captionSpeakerName}
          currentTranscript={currentTranscript}
        />
      </div>
      <div className="mission-deck__right">
        <div className="mission-deck__stats">
          <IncidentStats
            factCount={factCount}
            hypothesisCount={hypothesisCount}
            decisionCount={decisionCount}
            actionCompletedCount={actionCompletedCount}
            actionTotalCount={actionTotalCount}
            conflictCount={conflictCount}
          />
        </div>
        <button
          type="button"
          className="mission-deck__log-btn"
          onClick={onToggleTranscript}
          title="Toggle Voice Transcript Log (Press J)"
          aria-label="Toggle Voice Transcript Log"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Log</span>
          <kbd className="keyboard-hint-badge">J</kbd>
        </button>
        <button
          type="button"
          className="mission-deck__log-btn"
          onClick={onToggleShortcuts}
          title="Keyboard Shortcuts Cheat Sheet (Press ?)"
          aria-label="Toggle Keyboard Shortcuts"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Keys</span>
          <kbd className="keyboard-hint-badge">?</kbd>
        </button>
        <button
          id="quick-capture-btn"
          type="button"
          className="mission-deck__log-btn"
          onClick={onOpenQuickCapture}
          title="Quick Capture — Log evidence instantly (Press /)"
          aria-label="Open Quick Capture"
          style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--color-aura)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span>Capture</span>
          <kbd className="keyboard-hint-badge">/</kbd>
        </button>
        <button
          id="war-room-share-btn"
          type="button"
          className="mission-deck__log-btn"
          onClick={onOpenInvite}
          title="Share War Room & Invite Team"
          aria-label="Share War Room"
          style={{ borderColor: 'rgba(108,92,231,0.5)', color: '#A29BFE' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span>Share</span>
        </button>
        <AgoraAnalyticsOverlay
          mos={networkStats.mos}
          jitter={networkStats.jitter}
          rtt={networkStats.rtt}
          packetLoss={networkStats.packetLoss}
          sttLatencyMs={pipelineLatency.stt}
          llmLatencyMs={pipelineLatency.llm}
          ttsLatencyMs={pipelineLatency.tts}
          isCollapsed={isAnalyticsCollapsed}
          onToggle={onToggleAnalytics}
        />
      </div>
    </footer>
  );
}
