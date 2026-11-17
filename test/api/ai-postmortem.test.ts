import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/incidents/ai-postmortem/route';
import type { IncidentState } from '@/lib/types';

describe('API Route: /api/incidents/ai-postmortem', () => {
  it('generates Swiss Cheese defect matrix, 5-Whys, and preventative roadmap', async () => {
    const mockIncident: IncidentState = {
      incidentId: 'inc-resolved-88',
      title: 'Payment Gateway SEV-1 Outage',
      severity: 'SEV-1',
      status: 'resolved',
      currentOODAPhase: 'RESOLVED',
      openedAt: Date.now() - 3600000,
      resolvedAt: Date.now(),
      affectedServices: ['payment-api', 'db-primary'],
      incidentCommanderUid: 'sarah_ic',
      costAccrued: 4500,
      lastReadbackAt: 0,
      evidenceItems: [
        {
          id: 'ev-1',
          category: 'fact',
          content: '504 Gateway Timeout rate exceeded 35%',
          speakerUid: 'marcus_devops',
          speakerName: 'Marcus DevOps',
          status: 'active',
          confidence: 85,
          timestamp: Date.now() - 3500000,
          relatedTo: [],
        },
        {
          id: 'ev-2',
          category: 'hypothesis',
          content: 'PgBouncer connection pool max connection starvation',
          speakerUid: 'sarah_ic',
          speakerName: 'Sarah Chen',
          status: 'confirmed',
          confidence: 85,
          timestamp: Date.now() - 2500000,
          relatedTo: [],
        },
      ],
      participants: {
        sarah_ic: {
          uid: 'sarah_ic',
          displayName: 'Sarah Chen',
          role: 'Incident Commander',
          isIncidentCommander: true,
          joinedAt: Date.now() - 3600000,
          totalSpeakingMs: 12000,
          lastSpokeAt: Date.now() - 100000,
        },
      },
      cognitiveLoadScore: 45,
      eventSeq: 12,
    };

    const req = new NextRequest('http://localhost:3000/api/incidents/ai-postmortem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident: mockIncident, costRate: 150 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.executiveSummary).toBeDefined();
    expect(data.rootCause5Whys).toBeInstanceOf(Array);
    expect(data.rootCause5Whys.length).toBeGreaterThanOrEqual(3);
    expect(data.swissCheeseDefects).toBeDefined();
    expect(data.swissCheeseDefects.latentDeficiencies.length).toBeGreaterThan(0);
    expect(data.swissCheeseDefects.retainedSafeguards.length).toBeGreaterThan(0);
    expect(data.humanFactorsAnalysis).toBeDefined();
    expect(data.preventativeActions.length).toBeGreaterThan(0);
    expect(data.preventativeActions[0].priority).toBe('P0');
  });

  it('rejects missing incident parameter with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-postmortem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
