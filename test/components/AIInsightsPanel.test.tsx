import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AIInsightsPanel } from '@/components/flightdeck/AIInsightsPanel';
import type { IncidentState } from '@/lib/types';

describe('AIInsightsPanel Component (components/flightdeck/AIInsightsPanel.tsx)', () => {
  const mockIncident: IncidentState = {
    incidentId: 'inc-test-99',
    title: 'Edge CDN Cache Collapse',
    severity: 'SEV-1',
    status: 'investigating',
    currentOODAPhase: 'ORIENT',
    openedAt: Date.now() - 120000,
    affectedServices: ['cdn-edge', 'origin-api'],
    incidentCommanderUid: 'sarah_ic',
    costAccrued: 3000,
    lastReadbackAt: 0,
    evidenceItems: [
      {
        id: 'ev-1',
        category: 'fact',
        content: 'Cache hit ratio dropped from 94% to 12%',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus DevOps',
        confidence: 85,
        status: 'active',
        timestamp: Date.now() - 100000,
        relatedTo: [],
      },
      {
        id: 'ev-2',
        category: 'hypothesis',
        content: 'Origin SSL certificate mismatch on edge nodes',
        speakerUid: 'sarah_ic',
        speakerName: 'Sarah Chen',
        confidence: 85,
        status: 'active',
        timestamp: Date.now() - 50000,
        relatedTo: [],
      },
    ],
    participants: {},
    cognitiveLoadScore: 60,
    eventSeq: 5,
  };

  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/incidents/ai-insights')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            engine: 'Google Gemini 2.5 Flash',
            latencyMs: 110,
            confidenceCapped: 85,
            executiveBrief: 'SEV-1 Edge CDN Cache Collapse in progress.',
            hypotheses: [
              {
                id: 'ev-2',
                hypothesisText: 'Origin SSL certificate mismatch on edge nodes',
                probability: 70,
                status: 'viable',
                proposedBy: 'Sarah',
                supportingEvidence: ['Cache hit ratio dropped to 12%'],
                disprovingEvidence: [],
                recommendedTest: 'Query edge TLS handshake error rate.',
              },
            ],
            contradictionRadar: {
              hasConflict: false,
              summary: 'Responders aligned on edge TLS inspection.',
              decidingMetric: 'TLS handshake error rate vs origin 502s',
            },
            sbar: {
              situation: 'Active SEV-1 cache collapse.',
              background: 'Cache hit ratio dropped to 12%.',
              assessment: 'Leading hypothesis is SSL certificate mismatch.',
              recommendation: 'Verify edge TLS handshake error rate.',
            },
            recommendedActions: [
              {
                id: 'rec-1',
                priority: 'P0',
                title: 'Verify edge TLS handshake error rate',
                assigneeRole: 'Platform / Edge Lead',
                rationale: 'Confirm SSL handshake failures.',
              },
            ],
            latentRiskFactors: ['Origin overload due to un-cached requests'],
          }),
        };
      }
      if (url.includes('/api/incidents/ai-comms')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            engine: 'Google Gemini 2.5 Flash (Comms Studio)',
            audience: 'executive',
            subject: 'SEV-1 Executive Brief: Edge CDN Cache Collapse',
            message: 'BUSINESS IMPACT: Estimated burn rate $9,000/min.',
            nextUpdateMinutes: 10,
            generatedAt: new Date().toISOString(),
            toneGuardrails: ['Financial impact quantified', 'Epistemic confidence honesty'],
          }),
        };
      }
      return { ok: false, status: 404 };
    });
  });

  it('renders Google Gemini Engine badge and SBAR crisis briefing', async () => {
    render(<AIInsightsPanel incident={mockIncident} />);

    await waitFor(() => {
      expect(screen.getByText(/Google Gemini 2.5 Flash/i)).toBeInTheDocument();
      expect(screen.getByText(/SBAR Tactical Briefing/i)).toBeInTheDocument();
      expect(screen.getByText(/Origin SSL certificate mismatch on edge nodes/i)).toBeInTheDocument();
      expect(screen.getByText(/70%/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Verify edge TLS handshake error rate/i).length).toBeGreaterThan(0);
    });
  });

  it('switches to Comms Studio and generates stakeholder advisory draft', async () => {
    render(<AIInsightsPanel incident={mockIncident} />);

    const commsTab = await screen.findByRole('tab', { name: /Comms Studio/i });
    fireEvent.click(commsTab);

    await waitFor(() => {
      expect(screen.getByText(/Gemini Multi-Audience Stakeholder Comms Studio/i)).toBeInTheDocument();
      expect(screen.getByText(/SEV-1 Executive Brief: Edge CDN Cache Collapse/i)).toBeInTheDocument();
      expect(screen.getByText(/Financial impact quantified/i)).toBeInTheDocument();
    });
  });

  it('switches to Cloud Telemetry and injects Google Cloud Monitoring alert', async () => {
    const onInjectTelemetry = vi.fn();
    render(<AIInsightsPanel incident={mockIncident} onInjectTelemetry={onInjectTelemetry} />);

    const telemetryTab = await screen.findByRole('tab', { name: /Cloud Telemetry/i });
    fireEvent.click(telemetryTab);

    const injectButtons = await screen.findAllByRole('button', { name: /\+ Inject Alert/i });
    fireEvent.click(injectButtons[0]);

    expect(onInjectTelemetry).toHaveBeenCalledTimes(1);
    expect(onInjectTelemetry).toHaveBeenCalledWith(
      'Google Cloud Monitoring',
      expect.stringContaining('Cloud Spanner'),
      'cloud-spanner-ledger'
    );
  });
});
