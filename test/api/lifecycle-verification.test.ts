import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { renderHook, act } from '@testing-library/react';
import { POST as stopAgent } from '@/app/api/agent/stop/route';
import { POST as startAgent } from '@/app/api/agent/start/route';
import { useAuraAgent } from '@/hooks/useAuraAgent';
import { PRESET_SCENARIOS } from '@/lib/scenarios';

describe('Deep Lifecycle Audit & Verification (Last 2 Commits)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AGORA_APP_ID: 'test_app_id_970ca35de60c4464',
      AGORA_APP_CERTIFICATE: 'test_app_cert_5cfd2fd1755d40ec',
      AGORA_CUSTOMER_KEY: 'test_customer_key',
      AGORA_CUSTOMER_SECRET: 'test_customer_secret',
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. /api/agent/stop Route Handler Rigorous Audit', () => {
    it('handles standard JSON payload with agentId', async () => {
      let leaveCalledUrl = '';
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/agents/ag-direct-1/leave')) {
          leaveCalledUrl = url;
          return {
            ok: true,
            status: 200,
            json: async () => ({ code: 0, message: 'Agent stopped' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

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
      expect(leaveCalledUrl).toContain('/agents/ag-direct-1/leave');
    });

    it('handles sendBeacon text/plain payload format with channelName', async () => {
      const evictedAgents: string[] = [];
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/agents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                list: [
                  { agent_id: 'ag-chan-1', channel: 'incident-sev1-checkout' },
                  { agent_id: 'ag-chan-2', channel: 'incident-sev1-checkout' },
                  { agent_id: 'ag-other', channel: 'incident-other-room' },
                ],
              },
            }),
          } as Response;
        }
        if (url.includes('/leave')) {
          const match = url.match(/\/agents\/([^/]+)\/leave/);
          if (match) evictedAgents.push(match[1]);
          return { ok: true, status: 200, json: async () => ({}) } as Response;
        }
        if (url.includes('/agents/')) {
          const id = url.split('/agents/')[1];
          const chan = id.startsWith('ag-chan') ? 'incident-sev1-checkout' : 'incident-other-room';
          return {
            ok: true,
            status: 200,
            json: async () => ({ channel: chan, name: `aura-${chan}` }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      // sendBeacon often sends text/plain
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
      // Verify both matching agents in the channel were evicted, but NOT the other channel's agent
      expect(evictedAgents).toContain('ag-chan-1');
      expect(evictedAgents).toContain('ag-chan-2');
      expect(evictedAgents).not.toContain('ag-other');
    });

    it('returns idempotent 200 even if agent already left Agora (404 from Agora)', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/leave')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ message: 'Agent not found or already terminated' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

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

  describe('2. /api/agent/start idle_timeout & Payload Audit', () => {
    it('sets idle_timeout to exactly 120 seconds in Agora ConvAI join payload', async () => {
      let capturedPayload: Record<string, unknown> | null = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (url.endsWith('/agents')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { list: [] } }),
          } as Response;
        }
        if (url.endsWith('/join')) {
          if (options?.body) {
            capturedPayload = JSON.parse(options.body as string);
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ agent_id: 'new-agent-777', status: 'RUNNING' }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

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
      expect(capturedPayload).not.toBeNull();

      const properties = (capturedPayload as unknown as { properties?: Record<string, unknown> })?.properties;
      expect(properties).toBeDefined();

      // AUDIT CHECK: idle_timeout MUST be 120s (2 minutes), not 600s (10 minutes)
      expect(properties?.idle_timeout).toBe(120);
    });
  });

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
