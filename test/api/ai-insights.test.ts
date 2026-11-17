import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/incidents/ai-insights/route';

describe('API Route: /api/incidents/ai-insights', () => {
  it('returns valid SBAR, hypotheses matrix, and capped confidence under 85%', async () => {
    const payload = {
      incidentId: 'inc-test-42',
      title: 'SEV-1 Checkout API Outage',
      severity: 'SEV-1',
      affectedServices: ['checkout-api', 'postgres-primary'],
      currentOODAPhase: 'ORIENT',
      evidenceItems: [
        {
          id: 'ev-1',
          category: 'fact',
          content: 'Database connection pool wait queue reached 2400ms',
          speakerUid: 'marcus_devops',
          timestamp: Date.now() - 60000,
        },
        {
          id: 'ev-2',
          category: 'hypothesis',
          content: 'Connection starvation in PgBouncer pool',
          speakerUid: 'marcus_devops',
          status: 'viable',
          timestamp: Date.now() - 30000,
        },
      ],
    };

    const req = new NextRequest('http://localhost:3000/api/incidents/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.confidenceCapped).toBeLessThanOrEqual(85);
    expect(data.sbar).toBeDefined();
    expect(data.sbar.situation).toContain('SEV-1');
    expect(data.sbar.recommendation).toBeDefined();
    expect(data.hypotheses).toBeInstanceOf(Array);
    expect(data.hypotheses.length).toBeGreaterThanOrEqual(1);
    expect(data.hypotheses[0].probability).toBeLessThanOrEqual(85);
    expect(data.hypotheses[0].recommendedTest).toBeDefined();
    expect(data.contradictionRadar).toBeDefined();
    expect(data.recommendedActions).toBeInstanceOf(Array);
  });

  it('handles custom user prompt with expert SRE response', async () => {
    const payload = {
      incidentId: 'inc-test-43',
      title: 'SEV-1 Checkout Outage',
      severity: 'SEV-1',
      query: 'What single metric settles our top hypothesis?',
      evidenceItems: [
        {
          id: 'ev-1',
          category: 'fact',
          content: 'Latency spike on DB node 2',
          timestamp: Date.now(),
        },
      ],
    };

    const req = new NextRequest('http://localhost:3000/api/incidents/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.queryAnswer).toBeDefined();
    expect(typeof data.queryAnswer).toBe('string');
  });

  it('returns 400 on malformed JSON payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-insights', {
      method: 'POST',
      body: 'invalid-json{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
