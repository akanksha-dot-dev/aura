import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as escalatePost, PUT as escalatePut } from '@/app/api/escalate/route';
import { POST as resolvePost } from '@/app/api/incidents/resolve/route';

describe('API Route: /api/escalate', () => {
  it('should return escalation result on POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: 'incident-war-room' }),
    });

    const res = await escalatePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('action');
    expect(['escalated', 'bumped', 'notified', 'cooldown', 'skipped']).toContain(data.action);
  });

  it('should handle manual escalation with reason', async () => {
    const req = new NextRequest('http://localhost:3000/api/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: 'incident-war-room',
        reason: 'Testing manual escalation',
      }),
    });

    const res = await escalatePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe('notified');
    expect(data).toHaveProperty('speech');
  });

  it('should reject PUT without required parameters', async () => {
    const req = new NextRequest('http://localhost:3000/api/escalate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await escalatePut(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('MISSING_PARAMS');
  });
});

describe('API Route: /api/incidents/resolve', () => {
  it('should reject resolve without channelName', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await resolvePost(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('MISSING_CHANNEL');
  });

  it('should resolve an incident with full lifecycle', async () => {
    const testChannel = `test-resolve-${Date.now()}`;

    const req = new NextRequest('http://localhost:3000/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: testChannel,
        rootCause: {
          category: 'code-bug',
          description: 'Connection pool not releasing connections after timeout',
        },
        lessonsLearned: 'Need connection pool monitoring alerts',
      }),
    });

    const res = await resolvePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe(true);
    expect(data.score).toBeDefined();
    expect(data.score.overallScore).toBeGreaterThanOrEqual(0);
    expect(data.score.overallScore).toBeLessThanOrEqual(100);
    expect(data.score.mttrMs).toBeGreaterThanOrEqual(0);
    expect(data.summary).toBeDefined();
    expect(data.summary.severity).toBeTruthy();
  });

  it('should reject double resolution', async () => {
    const testChannel = `test-double-resolve-${Date.now()}`;

    // First resolve
    const req1 = new NextRequest('http://localhost:3000/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: testChannel,
        rootCause: { category: 'unknown', description: 'Test' },
      }),
    });
    await resolvePost(req1);

    // Second resolve should fail
    const req2 = new NextRequest('http://localhost:3000/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: testChannel,
        rootCause: { category: 'unknown', description: 'Test again' },
      }),
    });

    const res2 = await resolvePost(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.code).toBe('ALREADY_RESOLVED');
  });
});
