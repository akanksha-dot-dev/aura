import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/token/route';

describe('API Route: /api/token (app/api/token/route.ts — Firebase custom token)', () => {
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

  it('returns 500 when Firebase Admin credentials are not configured in environment', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;

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
    expect(data.error).toMatch(/Firebase|credentials not configured/i);
  });
});
