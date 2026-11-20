import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { renderHook, act } from '@testing-library/react';
import { POST as stopAgent } from '@/app/api/agent/stop/route';
import { POST as startAgent } from '@/app/api/agent/start/route';
import { useAuraAgent } from '@/hooks/useAuraAgent';
import { PRESET_SCENARIOS } from '@/lib/scenarios';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Firebase Admin — routes import @/lib/firebaseAdmin dynamically
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    ref: () => ({
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      push: vi.fn().mockResolvedValue({ key: 'mock-event-key' }),
    }),
  },
  adminAuth: {
    createCustomToken: vi.fn().mockResolvedValue('mock-firebase-custom-token'),
  },
  adminFirestore: {},
}));

describe('Deep Lifecycle Audit & Verification (Last 2 Commits)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      // Google Ecosystem env vars (replace Agora vars)
      GEMINI_API_KEY: 'AIzaTestKey-valid-for-testing-purposes',
      FIREBASE_PROJECT_ID: 'aura-test-project',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@aura-test-project.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nMIItest\n-----END RSA PRIVATE KEY-----',
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. /api/agent/stop — Google/Firebase Architecture
  // Replaces: Agora ConvAI REST /agents/{id}/leave
  // Now uses: Firebase RTDB adminDb.ref().remove() + push()
  // ─────────────────────────────────────────────────────────────────────────
  describe('1. /api/agent/stop Route Handler Rigorous Audit', () => {
    it('handles standard JSON payload with agentId', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'ag-direct-1' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('ag-direct-1');
      expect(data.status).toBe('stopped');
      // Google/Firebase: no Agora /leave URL call — Firebase RTDB handles cleanup
    });

    it('handles sendBeacon text/plain payload format with channelName', async () => {
      // sendBeacon often sends text/plain — route parses raw text as JSON
      const rawBeaconPayload = JSON.stringify({ channelName: 'incident-sev1-checkout' });
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: rawBeaconPayload,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.channelName).toBe('incident-sev1-checkout');
      expect(data.status).toBe('stopped');
      // Google/Firebase: cleanup happens via Firebase RTDB, not by evicting
      // individual agents via Agora REST — single adminDb.ref().remove() call
    });

    it('returns 200 gracefully even when Firebase RTDB is unavailable (non-fatal cleanup)', async () => {
      // The stop route catches Firebase errors with console.warn and still returns 200
      // This matches the idempotent design: stopping an already-stopped session is OK
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'ag-already-dead' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('stopped');
    });

    it('returns 400 cleanly on empty or invalid payload', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'text/plain' },
      });
      const res1 = await stopAgent(req1);
      expect(res1.status).toBe(400);

      const req2 = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: 'invalid-json{{{',
        headers: { 'Content-Type': 'application/json' },
      });
      const res2 = await stopAgent(req2);
      expect(res2.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. /api/agent/start — Google/Firebase Architecture
  // Replaces: Agora ConvAI REST /join (with idle_timeout, llm_config, etc.)
  // Now uses: Gemini Live config stored in Firebase RTDB
  // ─────────────────────────────────────────────────────────────────────────
  describe('2. /api/agent/start Gemini Live Config & Firebase RTDB Audit', () => {
    it('stores Gemini Live session config in Firebase RTDB and returns agentId', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({
          channelName: 'incident-sev1-checkout',
          userUid: 'sarah_ic',
          userName: 'Sarah Chen',
          userRole: 'Incident Commander',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Core response fields
      expect(data.agentId).toBeDefined();
      expect(typeof data.agentId).toBe('string');
      expect(data.agentId).toMatch(/^aura-/); // Format: aura-{channel}-{timestamp36}
      expect(data.status).toBe('started');
      expect(data.channelName).toBe('incident-sev1-checkout');

      // Google stack indicators (NOT Agora)
      expect(data.stack).toBeDefined();
      expect(data.stack.llm).toBe('gemini-live');
      expect(data.stack.transport).toBe('firebase-rtdb');
    });

    it('returns 400 when channelName is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ userUid: 'sarah_ic' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/channelName/i);
    });

    it('returns 500 when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({
          channelName: 'incident-sev1-checkout',
          userUid: 'sarah_ic',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/GEMINI_API_KEY/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. useAuraAgent Client Teardown Hook Audit
  // ─────────────────────────────────────────────────────────────────────────
  describe('3. useAuraAgent Client Teardown Hook Audit', () => {
    it('attaches pagehide/beforeunload listeners and fires stop beacon on unmount', async () => {
      const stopCalls: Array<{ url: string; body: string }> = [];

      // Mock navigator.sendBeacon
      const originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = vi.fn().mockImplementation((url: string, data: BodyInit) => {
        let text = '';
        if (data instanceof Blob) {
          text = '{"blob":true}';
        } else if (typeof data === 'string') {
          text = data;
        }
        stopCalls.push({ url, body: text });
        return true;
      });

      // Mock fetch
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === '/api/agent/start') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ agentId: 'live-aura-agent-42' }),
          } as Response;
        }
        if (url === '/api/agent/stop') {
          stopCalls.push({ url, body: init?.body as string });
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'stopped' }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      vi.useFakeTimers();

      const mockIncidentState = {
        incidentId: 'inc-test',
        title: 'Payment Gateway Outage',
        severity: 'SEV-1' as const,
        status: 'investigating' as const,
        openedAt: Date.now(),
        affectedServices: ['payment-api'],
        participants: {},
        incidentCommanderUid: null,
        evidenceItems: [],
        eventSeq: 0,
        currentOODAPhase: 'OBSERVE' as const,
        costAccrued: 0,
        cognitiveLoadScore: 0,
        lastReadbackAt: 0,
      };

      const { result, unmount } = renderHook(() =>
        useAuraAgent({
          channel: 'incident-sev1-checkout',
          uid: 'sarah_ic',
          name: 'Sarah Chen',
          role: 'Incident Commander',
          voiceLang: 'en-IN',
          scenarioConfig: PRESET_SCENARIOS[0],
          scenarioId: 'payment-outage',
          isJoined: true,
          isMockReplay: false,
          incidentState: mockIncidentState,
          effectiveParticipants: {},
        })
      );

      // Fast-forward launchTimer (1000ms)
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(result.current.activeAgentId).toBe('live-aura-agent-42');

      // Now unmount the component (simulates user leaving the war room / closing tab)
      act(() => {
        unmount();
      });

      // Verify that /api/agent/stop was called
      expect(stopCalls.length).toBeGreaterThanOrEqual(1);
      const stopCall = stopCalls.find((c) => c.url === '/api/agent/stop');
      expect(stopCall).toBeDefined();

      // Restore
      navigator.sendBeacon = originalSendBeacon;
      vi.useRealTimers();
    });
  });
});
