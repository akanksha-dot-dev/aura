import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as startAgent } from '@/app/api/agent/start/route';
import { POST as stopAgent } from '@/app/api/agent/stop/route';

describe('API Route: /api/agent (app/api/agent/start & stop routes)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('/api/agent/start POST', () => {
    it('returns 400 when channelName is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await startAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing or invalid channelName');
    });

    it('returns 500 when Agora credentials are missing', async () => {
      delete process.env.AGORA_APP_ID;
      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ channelName: 'incident-4821' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await startAgent(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Agora server credentials not configured');
    });

    it('constructs correct multi-speaker ConvAI payload and calls Agora REST API', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_APP_CERTIFICATE = '5cfd2fd1755d40ecb72977518be15d3b';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      interface ConvAIPayload {
        properties?: {
          remote_rtc_uids?: string[];
          enable_string_uid?: boolean;
          llm?: { system_messages?: Array<{ content?: string }> };
          tts?: { vendor?: string };
        };
      }
      let capturedPayload: ConvAIPayload | null = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('conversational-ai-agent/v2/projects')) {
          capturedPayload = JSON.parse(init?.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({ agent_id: 'aura_agent_12345' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ channelName: 'incident-sev1-4821' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('aura_agent_12345');
      expect(data.status).toBe('started');

      // Verify payload constraints (D-004 multi-speaker)
      expect(capturedPayload).not.toBeNull();
      const payload = capturedPayload as unknown as ConvAIPayload;
      expect(payload.properties?.remote_rtc_uids).toEqual(['*']);
      expect(payload.properties?.enable_string_uid).toBe(true);
      expect(payload.properties?.llm?.system_messages?.[0]?.content).toContain('DIRECTIVE 1: SHADOW MONITOR MODE');
      expect(payload.properties?.llm?.system_messages?.[0]?.content).toContain('DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE');
      expect(payload.properties?.tts?.vendor).toBe('openai');
    });
  });

  describe('/api/agent/stop POST', () => {
    it('returns 400 when agentId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await stopAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing or invalid agentId');
    });

    it('stops ConvAI agent cleanly via Agora REST API', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/agents/aura_agent_12345/leave')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code: 0, message: 'Success' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'aura_agent_12345' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('aura_agent_12345');
      expect(data.status).toBe('stopped');
    });
  });
});
