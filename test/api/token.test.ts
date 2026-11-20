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

  it('returns dev-mode token (200) when Firebase Admin credentials are not configured', async () => {
    // The route gracefully degrades: when Firebase creds are absent/placeholder,
    // it returns a dev-mode token (200) instead of a 500. This allows local
    // development without a live Firebase project.
    // See route.ts: "Firebase Admin not configured. Returning dev-mode token."
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
    // Dev-mode fallback returns 200 with a prefixed dev token
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toMatch(/^dev-token-sarah_oncall-/);
    expect(data.mode).toBe('dev');
    expect(data.uid).toBe('sarah_oncall');
    expect(data.channelName).toBe('incident-sev1-4821');
  });
});
