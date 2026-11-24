'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { IncidentState } from '@/lib/types';
import type { AIInsightsResponse, RecommendedAction } from '@/app/api/incidents/ai-insights/route';
import type { AICommsResponse, CommsAudience } from '@/app/api/incidents/ai-comms/route';
import { emitToast } from '@/components/indicators/NotificationToast';
import { speakLine, stopSpeech } from '@/lib/tts';

export interface AIInsightsPanelProps {
  incident: IncidentState;
  channelName?: string;
  costRate?: number;
  onCreateAction?: (title: string, detail: string) => void;
  onInjectTelemetry?: (source: string, message: string, serviceAffected?: string) => void;
}

type InsightsSection = 'tactical' | 'comms' | 'telemetry';

const PRESET_CLOUD_ALERTS = [
  {
    id: 'gcp-spanner',
    source: 'Google Cloud Monitoring',
    service: 'cloud-spanner-ledger',
    severity: 'CRITICAL',
    label: 'Cloud Spanner Lock Wait > 4,200ms',
    message: 'asia-south1 Cloud Spanner instance prod-upi-ledger lock wait latency surged to 4,280ms (threshold: 500ms) on monotonic txn_id index.',
  },
  {
    id: 'gcp-run',
    source: 'Google Cloud Run',
    service: 'upi-switch-gateway',
    severity: 'HIGH',
    label: 'Cloud Run 503 Concurrency Saturation',
    message: 'Revision upi-switch-gateway-00042 returning 24.6% HTTP 503 responses; max container instances (200) saturated in asia-south1.',
  },
  {
    id: 'gcp-armor',
    source: 'Google Cloud Armor',
    service: 'auth-service',
    severity: 'CRITICAL',
    label: 'Cloud Armor Anomalous Auth Burst',
    message: 'WAF rule rate-limit-login triggered: 14,800 req/min anomalous credential stuffing burst from 32 ASNs targeting /v2/oauth/token.',
  },
  {
    id: 'gcp-sql',
    source: 'Cloud SQL Insights',
    service: 'postgres-primary',
    severity: 'CRITICAL',
    label: 'PgBouncer Pool 99% Saturated',
    message: 'postgres-primary active connections reached 495/500 with 182 waiting client sockets; p99 checkout query time at 8,400ms.',
  },
];

const AUDIENCE_TABS: Array<{ id: CommsAudience; label: string; badge: string }> = [
  { id: 'status_page', label: 'Status Page', badge: 'EXTERNAL' },
  { id: 'executive', label: 'Executive Brief', badge: 'C-SUITE' },
  { id: 'engineering', label: 'Eng War Room', badge: 'CHAT / SLACK' },
  { id: 'regulatory', label: 'Compliance', badge: 'RBI / DORA' },
];

export function AIInsightsPanel({
  incident,
  channelName = 'incident-war-room',
  costRate = 150,
  onCreateAction,
  onInjectTelemetry,
}: AIInsightsPanelProps) {
  const [activeSection, setActiveSection] = useState<InsightsSection>('tactical');
  const [data, setData] = useState<AIInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState<string | null>(null);

  // Stakeholder Comms Studio state
  const [selectedAudience, setSelectedAudience] = useState<CommsAudience>('executive');
  const [commsData, setCommsData] = useState<AICommsResponse | null>(null);
  const [commsLoading, setCommsLoading] = useState(false);
  const [copiedComms, setCopiedComms] = useState(false);

  // Custom Telemetry Injector state
  const [customService, setCustomService] = useState(incident.affectedServices[0] || 'payment-api');
  const [customAlertText, setCustomAlertText] = useState('');
  const [injectedCount, setInjectedCount] = useState(0);

  const [isSpeakingSbar, setIsSpeakingSbar] = useState(false);
  const [isSpeakingComms, setIsSpeakingComms] = useState(false);

  const handleReadSbarAloud = async () => {
    if (isSpeakingSbar) {
      stopSpeech();
      setIsSpeakingSbar(false);
      return;
    }
    const situation = data?.sbar.situation || 'Active crisis assessment in progress';
    const background = data?.sbar.background || 'Gathering incoming telemetry';
    const assessment = data?.sbar.assessment || 'Establishing root cause';
    const recommendation = data?.sbar.recommendation || 'Verify service status';
    const text = `Situation: ${situation}. Background: ${background}. Assessment: ${assessment}. Recommendation: ${recommendation}.`;
    setIsSpeakingSbar(true);
    try {
      await speakLine(text, true, 1.0);
    } finally {
      setIsSpeakingSbar(false);
    }
  };

  const handleReadCommsAloud = async () => {
    if (!commsData?.message) return;
    if (isSpeakingComms) {
      stopSpeech();
      setIsSpeakingComms(false);
      return;
    }
    setIsSpeakingComms(true);
    try {
      await speakLine(commsData.message, true, 1.0);
    } finally {
      setIsSpeakingComms(false);
    }
  };

  const requestInsights = useCallback(async (customQuery?: string): Promise<AIInsightsResponse | null> => {
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
    return (await res.json()) as AIInsightsResponse;
  }, [incident.incidentId, incident.title, incident.severity, incident.affectedServices, incident.currentOODAPhase, incident.evidenceItems]);

  // Auto-sync insights when evidence or OODA phase updates
  useEffect(() => {
    let active = true;
    requestInsights()
      .then((json) => {
        if (active && json) {
          setData(json);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('[AIInsights] Failed to fetch:', err);
      });
    return () => {
      active = false;
    };
  }, [requestInsights, incident.evidenceItems.length, incident.currentOODAPhase]);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const json = await requestInsights();
      if (json) setData(json);
    } catch (err) {
      console.error('[AIInsights] Refresh failed:', err);
      emitToast({
        type: 'info',
        title: 'Gemini Insight Standby',
        description: 'Using deterministic SRE reasoning engine.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || queryLoading) return;
    setQueryLoading(true);
    try {
      const json = await requestInsights(userQuery.trim());
      if (json) {
        setData(json);
        if (json.queryAnswer) setQueryResponse(json.queryAnswer);
      }
    } catch (err) {
      console.error('[AIInsights] Query failed:', err);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleQuickPrompt = async (promptText: string) => {
    setUserQuery(promptText);
    setQueryLoading(true);
    try {
      const json = await requestInsights(promptText);
      if (json) {
        setData(json);
        if (json.queryAnswer) setQueryResponse(json.queryAnswer);
      }
    } catch (err) {
      console.error('[AIInsights] Quick prompt failed:', err);
    } finally {
      setQueryLoading(false);
    }
  };

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

  const generateCommsDraft = useCallback(async (audience: CommsAudience) => {
    setCommsLoading(true);
    setCopiedComms(false);
    try {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - incident.openedAt) / 1000));
      const res = await fetch('/api/incidents/ai-comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: incident.incidentId,
          title: incident.title,
          severity: incident.severity,
          status: incident.status,
          currentOODAPhase: incident.currentOODAPhase,
          affectedServices: incident.affectedServices,
          costRatePerSecond: costRate,
          elapsedSeconds,
          audience,
          evidenceItems: incident.evidenceItems,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AICommsResponse = await res.json();
      setCommsData(json);
    } catch (err) {
      console.error('[AIInsights] Comms generation failed:', err);
      emitToast({
        type: 'info',
        title: 'Comms Studio Error',
        description: 'Could not generate stakeholder update draft.',
      });
    } finally {
      setCommsLoading(false);
    }
  }, [incident, costRate]);

  const handleSelectSection = (section: InsightsSection) => {
    setActiveSection(section);
    if (section === 'comms' && !commsData) {
      generateCommsDraft(selectedAudience);
    }
  };

  const handleSelectAudience = (audience: CommsAudience) => {
    setSelectedAudience(audience);
    generateCommsDraft(audience);
  };

  const handleCopyComms = async () => {
    if (!commsData) return;
    const text = `${commsData.subject}\n\n${commsData.message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedComms(true);
      setTimeout(() => setCopiedComms(false), 2000);
      emitToast({
        type: 'info',
        title: 'Update Copied',
        description: `${selectedAudience.replace('_', ' ').toUpperCase()} draft copied to clipboard.`,
      });
    } catch {
      setCopiedComms(false);
    }
  };

  const handleInjectPreset = (alert: (typeof PRESET_CLOUD_ALERTS)[number]) => {
    if (onInjectTelemetry) {
      onInjectTelemetry(alert.source, alert.message, alert.service);
      setInjectedCount((c) => c + 1);
    } else {
      fetch('/api/agent/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, source: alert.source, message: alert.message }),
      }).catch(() => {});
      setInjectedCount((c) => c + 1);
    }
  };

  const handleInjectCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAlertText.trim()) return;
    if (onInjectTelemetry) {
      onInjectTelemetry('Google Cloud Monitoring', customAlertText.trim(), customService.trim() || undefined);
    }
    setCustomAlertText('');
    setInjectedCount((c) => c + 1);
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
          width: 100%;
          overflow-y: auto;
          padding: 16px;
          gap: 14px;
          color: var(--text-primary);
          font-family: var(--font-sans);
          box-sizing: border-box;
          background: rgba(10, 11, 15, 0.4);
          container-type: inline-size;
        }

        [data-theme="light"] .ai-insights-panel {
          background: #F8FAFC;
        }

        .ai-insights__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(212, 168, 83, 0.25);
          border-radius: 8px;
          gap: 12px;
          flex-wrap: wrap;
        }

        [data-theme="light"] .ai-insights__header {
          background: #FFFFFF;
          border-color: rgba(212, 168, 83, 0.35);
        }

        .ai-insights__engine-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
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
          animation: ai-pulse 1.5s infinite;
        }

        @keyframes ai-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .ai-insights__meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .ai-insights__subnav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ai-insights__pills {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 3px;
          border-radius: 6px;
        }

        [data-theme="light"] .ai-insights__pills {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .ai-insights__pill {
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .ai-insights__pill:hover {
          color: var(--text-primary);
        }

        .ai-insights__pill--active {
          background: rgba(212, 168, 83, 0.16);
          border-color: rgba(212, 168, 83, 0.35);
          color: #D4A853;
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

        .ai-insights__voice-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.35);
          border-radius: 4px;
          color: #D4A853;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-insights__voice-btn:hover {
          background: rgba(212, 168, 83, 0.22);
          border-color: #D4A853;
          box-shadow: 0 0 8px rgba(212, 168, 83, 0.3);
        }

        .ai-insights__voice-btn--active {
          background: rgba(244, 63, 94, 0.2);
          border-color: #F43F5E;
          color: #F43F5E;
          box-shadow: 0 0 8px rgba(244, 63, 94, 0.3);
        }

        .ai-insights__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 14px;
        }

        .ai-card {
          background: rgba(18, 20, 26, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        [data-theme="light"] .ai-card {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
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
          gap: 8px;
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
          font-variant-numeric: tabular-nums;
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

        [data-theme="light"] .ai-query-section {
          background: #FFFFFF;
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

        [data-theme="light"] .ai-query-input {
          background: #F1F5F9;
          border-color: rgba(0, 0, 0, 0.14);
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

        /* Comms Studio */
        .comms-audience-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .comms-audience-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .comms-audience-btn--active {
          border-color: rgba(212, 168, 83, 0.45);
          background: rgba(212, 168, 83, 0.14);
          color: #D4A853;
        }

        .comms-audience-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.07);
        }

        .comms-draft-box {
          background: rgba(0, 0, 0, 0.38);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 12px 14px;
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          color: var(--text-primary);
        }

        [data-theme="light"] .comms-draft-box {
          background: #F1F5F9;
          border-color: rgba(0, 0, 0, 0.1);
        }

        .comms-guardrails {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .comms-guardrail-chip {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        /* Cloud Telemetry Simulator */
        .telemetry-alert-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }

        .telemetry-alert-sev {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          background: rgba(244, 63, 94, 0.16);
          color: #F43F5E;
          border: 1px solid rgba(244, 63, 94, 0.35);
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

        <div className="ai-insights__subnav">
          <div className="ai-insights__pills" role="tablist" aria-label="Gemini Copilot Modules">
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'tactical'}
              className={`ai-insights__pill ${activeSection === 'tactical' ? 'ai-insights__pill--active' : ''}`}
              onClick={() => handleSelectSection('tactical')}
            >
              ⚡ Tactical RCA
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'comms'}
              className={`ai-insights__pill ${activeSection === 'comms' ? 'ai-insights__pill--active' : ''}`}
              onClick={() => handleSelectSection('comms')}
            >
              📣 Comms Studio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'telemetry'}
              className={`ai-insights__pill ${activeSection === 'telemetry' ? 'ai-insights__pill--active' : ''}`}
              onClick={() => handleSelectSection('telemetry')}
            >
              📡 Cloud Telemetry{injectedCount > 0 ? ` (${injectedCount})` : ''}
            </button>
          </div>

          <button
            type="button"
            className="ai-insights__refresh-btn"
            onClick={handleManualRefresh}
            disabled={loading}
            aria-label="Re-analyze incident state with Gemini"
          >
            <span>{loading ? 'Analyzing...' : '↻ Re-evaluate'}</span>
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: TACTICAL RCA & EPISTEMIC INTELLIGENCE ─── */}
      {activeSection === 'tactical' && (
        <>
          <div className="ai-insights__grid">
            {/* SBAR Tactical Briefing */}
            <div className="ai-card">
              <div className="ai-card__title">
                <span>SBAR Tactical Briefing</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className={`ai-insights__voice-btn ${isSpeakingSbar ? 'ai-insights__voice-btn--active' : ''}`}
                    onClick={handleReadSbarAloud}
                    title="Listen to SBAR voice briefing"
                  >
                    {isSpeakingSbar ? '⏹ Stop' : '🔊 Read Aloud'}
                  </button>
                  <span style={{ fontSize: '9.5px', color: '#D4A853' }}>Emergency Protocol</span>
                </div>
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
                  onClick={() => handleQuickPrompt(qp)}
                >
                  {qp}
                </button>
              ))}
            </div>

            {queryResponse && (
              <div className="ai-query-response">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong>Gemini Copilot:</strong>
                  <button
                    type="button"
                    className="ai-insights__voice-btn"
                    onClick={() => speakLine(queryResponse, true, 1.0)}
                    title="Listen to Gemini response"
                  >
                    🔊 Read Answer
                  </button>
                </div>
                <div>{queryResponse}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── SECTION 2: STAKEHOLDER COMMS STUDIO ─── */}
      {activeSection === 'comms' && (
        <div className="ai-card">
          <div className="ai-card__title">
            <span>Gemini Multi-Audience Stakeholder Comms Studio</span>
            <span style={{ fontSize: '9.5px', color: '#D4A853' }}>Live Telemetry Synced</span>
          </div>

          <div className="comms-audience-row" role="tablist" aria-label="Target Communication Audience">
            {AUDIENCE_TABS.map((aud) => (
              <button
                key={aud.id}
                type="button"
                role="tab"
                aria-selected={selectedAudience === aud.id}
                className={`comms-audience-btn ${selectedAudience === aud.id ? 'comms-audience-btn--active' : ''}`}
                onClick={() => handleSelectAudience(aud.id)}
              >
                <span>{aud.label}</span>
                <span className="comms-audience-badge">{aud.badge}</span>
              </button>
            ))}
          </div>

          {commsLoading ? (
            <div className="comms-draft-box" style={{ color: 'var(--text-muted)' }}>
              Synthesizing {selectedAudience.replace('_', ' ')} advisory with Gemini 2.5 Flash...
            </div>
          ) : commsData ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{commsData.subject}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`ai-insights__voice-btn ${isSpeakingComms ? 'ai-insights__voice-btn--active' : ''}`}
                    onClick={handleReadCommsAloud}
                    title="Listen to Comms broadcast draft"
                  >
                    {isSpeakingComms ? '⏹ Stop' : '🔊 Read Aloud'}
                  </button>
                  <button
                    type="button"
                    className="ai-insights__refresh-btn"
                    onClick={() => generateCommsDraft(selectedAudience)}
                  >
                    ↻ Regenerate
                  </button>
                  <button
                    type="button"
                    className="action-rec-btn"
                    onClick={handleCopyComms}
                  >
                    {copiedComms ? '✓ Copied Draft' : '📋 Copy Update'}
                  </button>
                </div>
              </div>

              <div className="comms-draft-box">{commsData.message}</div>

              <div className="comms-guardrails">
                {commsData.toneGuardrails.map((g, idx) => (
                  <span key={idx} className="comms-guardrail-chip">✓ {g}</span>
                ))}
                {commsData.nextUpdateMinutes > 0 && (
                  <span className="comms-guardrail-chip" style={{ color: '#D4A853', borderColor: 'rgba(212,168,83,0.35)', background: 'rgba(212,168,83,0.1)' }}>
                    ⏱ Next update cadence: {commsData.nextUpdateMinutes}m
                  </span>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              className="action-rec-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => generateCommsDraft(selectedAudience)}
            >
              Generate Stakeholder Draft
            </button>
          )}
        </div>
      )}

      {/* ─── SECTION 3: GOOGLE CLOUD MONITORING TELEMETRY SIMULATOR ─── */}
      {activeSection === 'telemetry' && (
        <>
          <div className="ai-card">
            <div className="ai-card__title">
              <span>Google Cloud Monitoring Live Alert Stream</span>
              <span style={{ fontSize: '9.5px', color: '#10B981' }}>PUB/SUB BRIDGE ACTIVE</span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Inject live infrastructure telemetry alerts directly into AURA&apos;s Timeline, Topology Graph, and Gemini reasoning loop (`/api/agent/think`).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRESET_CLOUD_ALERTS.map((alert) => (
                <div key={alert.id} className="telemetry-alert-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="telemetry-alert-sev">{alert.severity}</span>
                      <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{alert.label}</strong>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                        [{alert.service}]
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{alert.message}</span>
                  </div>
                  <button
                    type="button"
                    className="action-rec-btn"
                    onClick={() => handleInjectPreset(alert)}
                  >
                    + Inject Alert
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-query-section">
            <div className="ai-card__title" style={{ border: 'none', padding: 0 }}>
              <span>Inject Custom Cloud Telemetry Fact</span>
              <span style={{ fontSize: '9.5px', color: '#D4A853' }}>Direct Ingestion</span>
            </div>
            <form onSubmit={handleInjectCustom} className="ai-query-form" style={{ flexWrap: 'wrap' }}>
              <input
                type="text"
                className="ai-query-input"
                style={{ maxWidth: 180 }}
                placeholder="Service (e.g. upi-switch)"
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
              />
              <input
                type="text"
                className="ai-query-input"
                placeholder="Metric alert details (e.g. p99 latency 4.8s on asia-south1)"
                value={customAlertText}
                onChange={(e) => setCustomAlertText(e.target.value)}
              />
              <button
                type="submit"
                className="ai-query-submit"
                disabled={!customAlertText.trim()}
              >
                Dispatch
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function varColor(hasConflict?: boolean) {
  if (hasConflict) return '#F43F5E';
  return 'var(--text-secondary)';
}
