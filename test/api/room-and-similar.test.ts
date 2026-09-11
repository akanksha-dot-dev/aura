import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRoomInfo } from '@/app/api/room/info/route';
import { GET as getSimilar, POST as postSimilar } from '@/app/api/incidents/similar/route';

describe('/api/room/info', () => {
  it('returns valid room info structure and persona links', async () => {
    const req = new NextRequest('http://localhost:3000/api/room/info');
    const res = await getRoomInfo(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('health');
    expect(data.health).toHaveProperty('agora');
    expect(data).toHaveProperty('network');
    expect(data.network).toHaveProperty('primaryLanIp');
    expect(data).toHaveProperty('channel');
    expect(Array.isArray(data.personaLinks)).toBe(true);
    expect(data.personaLinks.length).toBeGreaterThanOrEqual(4);
    expect(data.personaLinks[0]).toHaveProperty('uid');
    expect(data.personaLinks[0]).toHaveProperty('directUrl');
  });
});

describe('/api/incidents/similar', () => {
  it('handles GET requests with services', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/similar?services=api-gateway,auth-service');
    const res = await getSimilar(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(Array.isArray(data.matches)).toBe(true);
    expect(data.results.length).toBe(data.matches.length);
  });

  it('handles POST requests with services and symptoms', async () => {
    const req = new NextRequest('http://localhost:3000/api/incidents/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        services: ['payment-gateway'],
        symptoms: 'database connection pool exhaustion and timeout',
        channelName: 'incident-war-room',
      }),
    });
    const res = await postSimilar(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.matches)).toBe(true);
    if (data.matches.length > 0) {
      const match = data.matches[0];
      expect(match).toHaveProperty('id');
      expect(match).toHaveProperty('title');
      expect(match).toHaveProperty('score');
      expect(match).toHaveProperty('root_cause');
      expect(match).toHaveProperty('resolution_steps');
      expect(match).toHaveProperty('mttr_minutes');
    }
  });
});
