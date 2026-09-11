import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as startAgent } from '@/app/api/agent/start/route';
import { POST as stopAgent } from '@/app/api/agent/stop/route';
import { POST as interruptAgent } from '@/app/api/agent/interrupt/route';
import { POST as updateAgent } from '@/app/api/agent/update/route';
import { POST as thinkAgent } from '@/app/api/agent/think/route';

describe('API Route: /api/agent (app/api/agent/start, stop & interrupt routes)', () => {
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
          interruption?: { enable?: boolean; mode?: string };
          turn_detection?: { mode?: string; config?: { start_of_speech?: { vad_config?: { speaking_interrupt_duration_ms?: number } } } };
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

      // Verify payload constraints (D-004 multi-speaker & AIVAD)
      expect(capturedPayload).not.toBeNull();
      const payload = capturedPayload as unknown as ConvAIPayload;
      expect(payload.properties?.remote_rtc_uids).toEqual(['*']);
      expect(payload.properties?.enable_string_uid).toBe(true);
      expect(payload.properties?.interruption?.enable).toBe(true);
      expect(payload.properties?.interruption?.mode).toBe('start_of_speech');
      expect(payload.properties?.turn_detection?.config?.start_of_speech?.vad_config?.speaking_interrupt_duration_ms).toBe(400);
      expect(payload.properties?.llm?.system_messages?.[0]?.content).toContain('DIRECTIVE 1: SHADOW MONITOR MODE');
      expect(payload.properties?.llm?.system_messages?.[0]?.content).toContain('DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE');
      expect(payload.properties?.llm?.system_messages?.[0]?.content).toContain('CURRENT INCIDENT SITUATION');
      expect(['minimax', 'openai']).toContain(payload.properties?.tts?.vendor);
    });

    it('dynamically injects selected scenario and capability awareness into system prompt', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_APP_CERTIFICATE = '5cfd2fd1755d40ecb72977518be15d3b';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      let capturedPayload: any = null;
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('conversational-ai-agent/v2/projects')) {
          capturedPayload = JSON.parse(init?.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({ agent_id: 'aura_agent_cdn_999' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const cdnScenario = {
        title: 'CDN Cache Invalidation Storm — Global Latency Spike',
        severity: 'SEV-2',
        affectedServices: ['cdn-edge', 'static-assets', 'image-service'],
        description: 'CDN cache invalidation storm causing global latency spikes.',
        impact: 'p95 page load time at 12.4s.',
        suspectedCause: 'Automated cache purge job triggered full invalidation.',
      };

      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({
          channelName: 'incident-sev2-cdn',
          userUid: 'jordan_sre',
          userName: 'Jordan',
          userRole: 'Platform SRE',
          scenario: cdnScenario,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(200);

      const prompt = capturedPayload?.properties?.llm?.system_messages?.[0]?.content;
      expect(prompt).toContain('CDN Cache Invalidation Storm — Global Latency Spike');
      expect(prompt).toContain('cdn-edge, static-assets, image-service');
      expect(prompt).toContain('CAPABILITIES & VOICE-QUERYABLE TOOLS');
      expect(prompt).toContain('Live Incident Topology');
      expect(prompt).toContain('Epistemic Classification');
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

  describe('/api/agent/interrupt POST', () => {
    it('returns 400 when agentId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/interrupt', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await interruptAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing or invalid agentId');
    });

    it('interrupts ConvAI agent mid-speech via Agora REST API', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/agents/aura_agent_12345/interrupt')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ code: 0, message: 'Agent interrupted successfully' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const req = new NextRequest('http://localhost:3000/api/agent/interrupt', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'aura_agent_12345' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await interruptAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('aura_agent_12345');
      expect(data.status).toBe('interrupted');
    });
  });

  describe('/api/agent/update POST', () => {
    it('returns 400 when agentId or channelName is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/update', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await updateAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing agentId or channelName');
    });

    it('returns 500 when Agora credentials are missing', async () => {
      delete process.env.AGORA_APP_ID;
      const req = new NextRequest('http://localhost:3000/api/agent/update', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'ag-123', channelName: 'incident-war-room' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await updateAgent(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Agora credentials not configured');
    });

    it('pushes rich dynamic incident context while preserving all directives', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      let capturedUpdatePayload: any = null;
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/update')) {
          capturedUpdatePayload = JSON.parse(init?.body as string);
          return {
            ok: true,
            status: 200,
            json: async () => ({ code: 0, message: 'Updated' }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const updatedEvidence = [
        {
          id: 'evt-dyn-101',
          category: 'fact',
          content: 'Database connection pool reached 100% saturation',
          speakerUid: 'operator_1',
          speakerName: 'Operator Kai',
          confidence: 85,
          timestamp: Date.now(),
          serviceAffected: 'postgres-primary',
          relatedTo: [],
          status: 'confirmed',
        },
        {
          id: 'evt-dyn-102',
          category: 'hypothesis',
          content: 'Leaked connections from unclosed cursor in billing service',
          speakerUid: 'operator_1',
          speakerName: 'Operator Kai',
          confidence: 80,
          timestamp: Date.now(),
          serviceAffected: 'postgres-primary',
          relatedTo: ['evt-dyn-101'],
          status: 'active',
          decidingMetric: 'pg_stat_activity idle in transaction count',
        },
      ];

      const req = new NextRequest('http://localhost:3000/api/agent/update', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'ag-test-hot-update-456',
          channelName: 'incident-hot-update',
          operatorUid: 'operator_1',
          evidenceItems: updatedEvidence,
          participants: [
            {
              uid: 'operator_1',
              displayName: 'Operator Kai',
              role: 'Staff SRE',
              isIncidentCommander: true,
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await updateAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('updated');
      expect(data.agentId).toBe('ag-test-hot-update-456');
      expect(data.evidenceCount).toBeGreaterThanOrEqual(2);

      // Verify the updated system prompt was built and contains both the core directives AND the live evidence
      const updatedPrompt = capturedUpdatePayload?.properties?.llm?.system_messages?.[0]?.content;
      expect(updatedPrompt).toBeDefined();
      expect(updatedPrompt).toContain('DIRECTIVE 1: SHADOW MONITOR MODE');
      expect(updatedPrompt).toContain('DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE');
      expect(updatedPrompt).toContain('Database connection pool reached 100% saturation');
      expect(updatedPrompt).toContain('Leaked connections from unclosed cursor in billing service');
      expect(updatedPrompt).toContain('Active Responders on Bridge: Operator Kai');
    });
  });

  describe('/api/agent/think POST', () => {
    it('returns 400 when message is missing or empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/think', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await thinkAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing or empty message');
    });

    it('broadcasts alert to RTM stream when agentId is absent', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/think', {
        method: 'POST',
        body: JSON.stringify({
          channelName: 'incident-war-room',
          message: 'Datadog latency spike: 450ms',
          source: 'Datadog Alert',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await thinkAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('broadcasted_to_rtm');
      expect(data.message).toBe('Datadog latency spike: 450ms');
    });

    it('injects alert into Agora ConvAI /think REST endpoint when credentials and agentId exist', async () => {
      process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061b33';
      process.env.AGORA_CUSTOMER_KEY = 'test_key';
      process.env.AGORA_CUSTOMER_SECRET = 'test_secret';

      let capturedUrl = '';
      let capturedBody = '';

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = String(init?.body || '');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ code: 'success' }),
          text: () => Promise.resolve('{"code":"success"}'),
        });
      }));

      const req = new NextRequest('http://localhost:3000/api/agent/think', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'ag-test-think-123',
          channelName: 'incident-war-room',
          message: 'Kubernetes node 4 entered NotReady state',
          source: 'Prometheus',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await thinkAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('injected');
      expect(data.agentId).toBe('ag-test-think-123');
      expect(capturedUrl).toContain('/agents/ag-test-think-123/think');
      expect(capturedBody).toContain('Kubernetes node 4 entered NotReady state');
    });
  });
});
