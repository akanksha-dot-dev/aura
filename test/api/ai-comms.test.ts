import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/incidents/ai-comms/route';

describe('API Route: /api/incidents/ai-comms', () => {
  const basePayload = {
    incidentId: 'inc-upi-001',
    title: 'UPI Payment Switch Degradation',
    severity: 'SEV-0',
    status: 'investigating',
    currentOODAPhase: 'ORIENT',
    affectedServices: ['upi-switch-gateway', 'cloud-spanner-ledger'],
    costRatePerSecond: 200,
    elapsedSeconds: 420,
    evidenceItems: [
      {
        category: 'fact',
        content: 'Cloud Spanner lock wait exceeded 4,200ms in asia-south1',
      },
      {
        category: 'hypothesis',
        content: 'Monotonic txn_id index hotspotting during peak UPI surge',
      },
    ],
  };

  it('generates customer-safe status_page update without internal jargon', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, audience: 'status_page' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.audience).toBe('status_page');
    expect(data.subject).toContain('Investigating');
    expect(data.message).toContain('No customer data is at risk');
    expect(data.nextUpdateMinutes).toBe(15);
    expect(data.toneGuardrails.length).toBeGreaterThan(0);
  });

  it('generates executive brief with quantified financial burn rate', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, audience: 'executive' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.audience).toBe('executive');
    expect(data.message).toContain('$12,000/min');
    expect(data.message).toContain('≤85%');
  });

  it('generates regulatory compliance advisory with UTC timestamp and audit fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, audience: 'regulatory' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.audience).toBe('regulatory');
    expect(data.message).toContain('INCIDENT REFERENCE: inc-upi-001');
    expect(data.message).toContain('CAPCOM single-authority lock');
  });

  it('generates engineering war room sync formatted for Google Chat / Slack', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, audience: 'engineering' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.audience).toBe('engineering');
    expect(data.message).toContain('upi-switch-gateway');
    expect(data.message).toContain('Cloud Spanner lock wait');
  });

  it('rejects unsupported audience with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/ai-comms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, audience: 'twitter_thread' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
