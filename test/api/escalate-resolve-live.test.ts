import { describe, it, expect } from 'vitest';

describe('/api/escalate', () => {
  const BASE_URL = 'http://localhost:3000/api/escalate';

  it('should return escalation result on POST', async () => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: 'incident-war-room' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('action');
    expect(['escalated', 'bumped', 'notified', 'cooldown', 'skipped']).toContain(data.action);
  });

  it('should handle manual escalation with reason', async () => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: 'incident-war-room',
        reason: 'Testing manual escalation',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe('notified');
    expect(data).toHaveProperty('speech');
  });

  it('should reject PUT without required parameters', async () => {
    const res = await fetch(BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('MISSING_PARAMS');
  });
});

describe('/api/incidents/resolve', () => {
  const BASE_URL = 'http://localhost:3000/api/incidents/resolve';

  it('should reject resolve without channelName', async () => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('MISSING_CHANNEL');
  });

  it('should resolve an incident with full lifecycle', async () => {
    // Use a unique channel to avoid conflicts
    const testChannel = `test-resolve-${Date.now()}`;

    const res = await fetch(BASE_URL, {
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

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resolved).toBe(true);
    expect(data.score).toBeDefined();
    expect(data.score.overallScore).toBeGreaterThanOrEqual(0);
    expect(data.score.overallScore).toBeLessThanOrEqual(100);
    expect(data.score.mttrMs).toBeGreaterThan(0);
    expect(data.summary).toBeDefined();
    expect(data.summary.severity).toBeTruthy();
  });

  it('should reject double resolution', async () => {
    const testChannel = `test-double-resolve-${Date.now()}`;

    // First resolve
    await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: testChannel,
        rootCause: { category: 'unknown', description: 'Test' },
      }),
    });

    // Second resolve should fail
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: testChannel,
        rootCause: { category: 'unknown', description: 'Test again' },
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('ALREADY_RESOLVED');
  });
});

describe('/api/dashboard/live', () => {
  const BASE_URL = 'http://localhost:3000/api/dashboard/live';

  it('should return live incident data', async () => {
    const res = await fetch(BASE_URL);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('incidents');
    expect(data).toHaveProperty('aggregate');
    expect(data.aggregate).toHaveProperty('totalActive');
    expect(data.aggregate).toHaveProperty('slaBreached');
    expect(data.aggregate).toHaveProperty('bySeverity');
    expect(data).toHaveProperty('generatedAt');
    expect(Array.isArray(data.incidents)).toBe(true);
  });

  it('should include SLA data for each incident', async () => {
    const res = await fetch(BASE_URL);
    const data = await res.json();

    if (data.incidents.length > 0) {
      const incident = data.incidents[0];
      expect(incident).toHaveProperty('sla');
      expect(incident.sla).toHaveProperty('targetMinutes');
      expect(incident.sla).toHaveProperty('remainingMinutes');
      expect(incident.sla).toHaveProperty('percentUsed');
      expect(incident.sla).toHaveProperty('status');
      expect(['ok', 'warning', 'breached']).toContain(incident.sla.status);
    }
  });
});
