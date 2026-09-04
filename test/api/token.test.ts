import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/token/route';

describe('API Route: /api/token (app/api/token/route.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 400 on invalid JSON request body', async () => {
    const req = new NextRequest('http://localhost:3000/api/token', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON request body');
  });

  it('returns 400 when channelName is missing or invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/token', {
      method: 'POST',
      body: JSON.stringify({ uid: 'sarah_oncall' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid channelName');
  });

  it('returns 400 when uid is missing or invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/token', {
      method: 'POST',
      body: JSON.stringify({ channelName: 'incident-sev1-4821' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid uid');
  });

  it('returns 500 when Agora credentials are not configured in environment', async () => {
    delete process.env.AGORA_APP_ID;
    delete process.env.AGORA_APP_CERTIFICATE;

    const req = new NextRequest('http://localhost:3000/api/token', {
      method: 'POST',
      body: JSON.stringify({
        channelName: 'incident-sev1-4821',
        uid: 'sarah_oncall',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Agora server credentials not configured');
  });

  it('generates valid RTC and RTM tokens when credentials are provided', async () => {
    // Valid 32-char hex test credentials
    process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
    process.env.AGORA_APP_CERTIFICATE = '5cfd2fd1755d40ecb72977518be15d3b';

    const req = new NextRequest('http://localhost:3000/api/token', {
      method: 'POST',
      body: JSON.stringify({
        channelName: 'incident-sev1-4821',
        uid: 'sarah_oncall',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.appId).toBe('970ca35de60c44645bbae8a215061b33');
    expect(data.uid).toBe('sarah_oncall');
    expect(typeof data.rtcToken).toBe('string');
    expect(data.rtcToken.length).toBeGreaterThan(20);
    expect(typeof data.rtmToken).toBe('string');
    expect(data.rtmToken.length).toBeGreaterThan(20);
  });
});
