'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { IncidentState } from '@/lib/types';
import type { AIInsightsResponse, RecommendedAction } from '@/app/api/incidents/ai-insights/route';
import { emitToast } from '@/components/indicators/NotificationToast';

export interface AIInsightsPanelProps {
  incident: IncidentState;
  channelName?: string;
  onCreateAction?: (title: string, detail: string) => void;
}

export function AIInsightsPanel({
  incident,
  channelName = 'incident-war-room',
  onCreateAction,
}: AIInsightsPanelProps) {
  const [data, setData] = useState<AIInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState<string | null>(null);

  const fetchInsights = useCallback(async (customQuery?: string) => {
    if (customQuery) {
      setQueryLoading(true);
    }

    try {
      const res = await fetch('/api/incidents/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: incident.incidentId,
          title: incident.title,
          severity: incident.severity,
          affectedServices: incident.affectedServices,
          currentOODAPhase: incident.currentOODAPhase,
          evidenceItems: incident.evidenceItems,
          query: customQuery,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AIInsightsResponse = await res.json();
      setData(json);

      if (customQuery && json.queryAnswer) {
        setQueryResponse(json.queryAnswer);
      }
    } catch (err) {
      console.error('[AIInsights] Failed to fetch:', err);
      emitToast({
        type: 'info',
        title: 'Gemini Insight Standby',
        description: 'Using deterministic SRE reasoning engine.',
      });
    } finally {
      setLoading(false);
      setQueryLoading(false);
    }
  }, [incident.incidentId, incident.title, incident.severity, incident.affectedServices, incident.currentOODAPhase, incident.evidenceItems]);

  // Initial fetch and automatic refresh on evidence change
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights, incident.evidenceItems.length, incident.currentOODAPhase]);

  const handleActionAdd = (action: RecommendedAction) => {
    if (onCreateAction) {
      onCreateAction(action.title, action.assigneeRole);
      emitToast({
        type: 'info',
        title: 'Action Added to Tracker',
        description: `"${action.title}" assigned to ${action.assigneeRole}.`,
      });
    }
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || queryLoading) return;
    fetchInsights(userQuery.trim());
  };

  const quickPrompts = [
    'What single metric settles our top hypothesis?',
    'What are the highest risk blast-radius services?',
    'Suggest a safe zero-downtime rollback verification.',
  ];

  return (
    <div className="ai-insights-panel">
      <style>{`
        .ai-insights-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 16px;
          gap: 16px;
          color: var(--text-primary);
          font-family: var(--font-sans);
          box-sizing: border-box;
          background: rgba(10, 11, 15, 0.4);
        }

        .ai-insights__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(212, 168, 83, 0.25);
          border-radius: 8px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ai-insights__engine-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ai-insights__engine-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          background: rgba(212, 168, 83, 0.15);
          border: 1px solid rgba(212, 168, 83, 0.4);
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #D4A853;
          letter-spacing: 0.04em;
        }

        .ai-insights__pulse-pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D4A853;
          box-shadow: 0 0 8px #D4A853;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .ai-insights__meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .ai-insights__refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 5px;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-insights__refresh-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(212, 168, 83, 0.4);
          color: #D4A853;
        }

        .ai-insights__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }

        .ai-card {
          background: rgba(18, 20, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .ai-card__title {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 8px;
        }

        /* SBAR Briefing */
        .sbar-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sbar-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12.5px;
          line-height: 1.45;
        }

        .sbar-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #D4A853;
        }

        /* Hypotheses Matrix */
        .hypo-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hypo-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hypo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .hypo-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .hypo-status-badge {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .hypo-status--confirmed {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
          border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .hypo-status--viable {
          background: rgba(212, 168, 83, 0.2);
          color: #D4A853;
          border: 1px solid rgba(212, 168, 83, 0.4);
        }

        .hypo-status--disproven {
          background: rgba(244, 63, 94, 0.2);
          color: #F43F5E;
          border: 1px solid rgba(244, 63, 94, 0.4);
          text-decoration: line-through;
        }

        .hypo-status--unverified {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .hypo-prob-bar-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hypo-prob-track {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 3px;
          overflow: hidden;
        }

        .hypo-prob-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }

        .hypo-prob-text {
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-secondary);
          min-width: 32px;
          text-align: right;
        }

        .hypo-test-box {
          font-family: var(--font-mono);
          font-size: 11px;
          background: rgba(0, 0, 0, 0.3);
          border-left: 2px solid #D4A853;
          padding: 4px 8px;
          border-radius: 0 4px 4px 0;
          color: var(--text-secondary);
        }

        /* Recommended Actions */
        .action-rec-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .action-rec-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 8px 12px;
          gap: 10px;
        }

        .action-rec-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
        }

        .action-rec-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .action-rec-sub {
          font-size: 11px;
          color: var(--text-muted);
        }

        .action-rec-btn {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          background: rgba(212, 168, 83, 0.15);
          color: #D4A853;
          border: 1px solid rgba(212, 168, 83, 0.35);
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .action-rec-btn:hover {
          background: #D4A853;
          color: #000;
        }

        /* Interactive Query Box */
        .ai-query-section {
          background: rgba(18, 20, 26, 0.85);
          border: 1px solid rgba(212, 168, 83, 0.25);
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ai-query-form {
          display: flex;
          gap: 8px;
        }

        .ai-query-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 12.5px;
          outline: none;
        }

        .ai-query-input:focus {
          border-color: #D4A853;
          box-shadow: 0 0 8px rgba(212, 168, 83, 0.2);
        }

        .ai-query-submit {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          background: #D4A853;
          color: #0C0B0F;
          border: none;
          border-radius: 6px;
          padding: 0 16px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ai-query-submit:hover:not(:disabled) {
          background: #E5BE6B;
        }

        .ai-query-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .ai-query-chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          font-size: 11px;
          color: var(--text-secondary);
          padding: 3px 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-query-chip:hover {
          border-color: rgba(212, 168, 83, 0.35);
          color: #D4A853;
        }

        .ai-query-response {
          background: rgba(0, 0, 0, 0.35);
          border-left: 3px solid #D4A853;
          padding: 10px 14px;
          border-radius: 0 6px 6px 0;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--text-primary);
        }
      `}</style>

      {/* Header Engine Bar */}
      <div className="ai-insights__header">
        <div className="ai-insights__engine-info">
          <div className="ai-insights__engine-badge">
            <span className="ai-insights__pulse-pip" />
            <span>{data?.engine || 'Google Gemini 2.5 Flash'}</span>
          </div>
          <span className="ai-insights__meta">
            Room: {channelName} | Latency: {data?.latencyMs || 120}ms | Epistemic Cap: {data?.confidenceCapped || 85}% Max
          </span>
        </div>
        <button
          type="button"
          className="ai-insights__refresh-btn"
          onClick={() => fetchInsights()}
          disabled={loading}
          aria-label="Re-analyze incident state with Gemini"
        >
          <span>{loading ? 'Analyzing...' : '↻ Re-evaluate'}</span>
        </button>
      </div>

      {/* 2-Column Responsive Card Grid */}
      <div className="ai-insights__grid">
        {/* SBAR Tactical Briefing */}
        <div className="ai-card">
          <div className="ai-card__title">
            <span>SBAR Tactical Briefing</span>
            <span style={{ fontSize: '9.5px', color: '#D4A853' }}>Emergency Protocol</span>
          </div>
          <div className="sbar-section">
            <div className="sbar-row">
              <span className="sbar-tag">SITUATION</span>
              <span>{data?.sbar.situation || 'Active crisis assessment in progress.'}</span>
            </div>
            <div className="sbar-row">
              <span className="sbar-tag">BACKGROUND</span>
              <span>{data?.sbar.background || 'Gathering incoming telemetry and logs.'}</span>
            </div>
            <div className="sbar-row">
              <span className="sbar-tag">ASSESSMENT</span>
              <span>{data?.sbar.assessment || 'Establishing root cause hypotheses.'}</span>
            </div>
            <div className="sbar-row">
              <span className="sbar-tag">RECOMMENDATION</span>
              <span style={{ color: '#D4A853', fontWeight: 600 }}>
                {data?.sbar.recommendation || 'Verify service status and cluster metrics.'}
              </span>
            </div>
          </div>
        </div>

        {/* Contradiction & Consensus Radar */}
        <div className="ai-card">
          <div className="ai-card__title">
            <span>Contradiction & Consensus Radar</span>
            <span style={{ fontSize: '9.5px', color: data?.contradictionRadar.hasConflict ? '#F43F5E' : '#10B981' }}>
              {data?.contradictionRadar.hasConflict ? 'CONTRADICTION DETECTED' : 'CONSENSUS ALIGNED'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: varColor(data?.contradictionRadar.hasConflict) }}>
            {data?.contradictionRadar.summary || 'Responders are aligned on telemetry.'}
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
              DECIDING ARBITRATION METRIC:
            </span>
            <div className="hypo-test-box">
              {data?.contradictionRadar.decidingMetric || 'P99 DB latency vs API 504 timeouts'}
            </div>
          </div>
        </div>
      </div>

      {/* Hypotheses Epistemic Probability Matrix */}
      <div className="ai-card">
        <div className="ai-card__title">
          <span>Epistemic Hypothesis Probability Matrix</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>85% Confidence Ceiling</span>
        </div>
        <div className="hypo-list">
          {(!data?.hypotheses || data.hypotheses.length === 0) ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hypotheses proposed yet. AURA is monitoring voice telemetry.</p>
          ) : (
            data.hypotheses.map((h) => {
              const fillBg = h.status === 'confirmed'
                ? '#10B981'
                : h.status === 'disproven'
                ? '#F43F5E'
                : '#D4A853';

              return (
                <div key={h.id} className="hypo-item">
                  <div className="hypo-header">
                    <span className="hypo-title">{h.hypothesisText}</span>
                    <span className={`hypo-status-badge hypo-status--${h.status}`}>
                      {h.status}
                    </span>
                  </div>

                  <div className="hypo-prob-bar-wrap">
                    <div className="hypo-prob-track">
                      <div
                        className="hypo-prob-fill"
                        style={{ width: `${h.probability}%`, background: fillBg }}
                      />
                    </div>
                    <span className="hypo-prob-text">{h.probability}%</span>
                  </div>

                  <div className="hypo-test-box">
                    <span>Verification Test: </span>
                    {h.recommendedTest}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recommended Tactical Actions */}
      {data?.recommendedActions && data.recommendedActions.length > 0 && (
        <div className="ai-card">
          <div className="ai-card__title">
            <span>AI Recommended Next Actions</span>
            <span style={{ fontSize: '9.5px', color: '#D4A853' }}>SRE Playbook Automation</span>
          </div>
          <div className="action-rec-list">
            {data.recommendedActions.map((act) => (
              <div key={act.id} className="action-rec-item">
                <div className="action-rec-body">
                  <span className="action-rec-title">[{act.priority}] {act.title}</span>
                  <span className="action-rec-sub">Role: {act.assigneeRole} — {act.rationale}</span>
                </div>
                {onCreateAction && (
                  <button
                    type="button"
                    className="action-rec-btn"
                    onClick={() => handleActionAdd(act)}
                  >
                    + Add to Action Tracker
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Ask Gemini Console */}
      <div className="ai-query-section">
        <div className="ai-card__title" style={{ border: 'none', padding: 0 }}>
          <span>Ask Gemini Incident Copilot</span>
          <span style={{ fontSize: '9.5px', color: '#D4A853' }}>Direct RAG Telemetry</span>
        </div>

        <form onSubmit={handlePromptSubmit} className="ai-query-form">
          <input
            type="text"
            className="ai-query-input"
            placeholder="Ask Gemini anything about this incident..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <button
            type="submit"
            className="ai-query-submit"
            disabled={queryLoading || !userQuery.trim()}
          >
            {queryLoading ? '...' : 'Ask'}
          </button>
        </form>

        <div className="ai-query-chips">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              className="ai-query-chip"
              onClick={() => {
                setUserQuery(qp);
                fetchInsights(qp);
              }}
            >
              {qp}
            </button>
          ))}
        </div>

        {queryResponse && (
          <div className="ai-query-response">
            <strong>Gemini Copilot: </strong>
            {queryResponse}
          </div>
        )}
      </div>
    </div>
  );
}

function varColor(hasConflict?: boolean) {
  if (hasConflict) return '#F43F5E';
  return 'var(--text-secondary)';
}
