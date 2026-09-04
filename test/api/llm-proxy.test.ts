import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, buildDynamicContext } from '@/app/api/llm/proxy/route';
import { IncidentState } from '@/lib/types';

describe('API Route: /api/llm/proxy (app/api/llm/proxy/route.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('buildDynamicContext Unit Tests', () => {
    it('constructs detailed telemetry prompt injection from incident state', () => {
      const mockState: IncidentState = {
        incidentId: 'INC-999',
        title: 'Redis Cluster Split Brain',
        severity: 'SEV-0',
        status: 'investigating',
        openedAt: Date.now() - 120_000,
        affectedServices: ['redis-cluster', 'session-manager'],
        participants: {
          marcus: {
            uid: 'marcus',
            displayName: 'Marcus',
            role: 'Senior SRE',
            isIncidentCommander: true,
            joinedAt: Date.now() - 120_000,
            totalSpeakingMs: 15_000,
            lastSpokeAt: Date.now() - 10_000,
          },
        },
        incidentCommanderUid: 'marcus',
        evidenceItems: [
          {
            id: 'evt-1',
            category: 'fact',
            content: 'Master node 2 unreachable',
            speakerUid: 'marcus',
            speakerName: 'Marcus',
            confidence: 85,
            timestamp: Date.now(),
            relatedTo: [],
            status: 'confirmed',
          },
          {
            id: 'evt-2',
            category: 'conflict',
            content: 'Network partition vs OOM killer',
            speakerUid: 'aura_agent',
            speakerName: 'AURA',
            confidence: 80,
            timestamp: Date.now(),
            relatedTo: [],
            status: 'active',
            hypothesisA: 'Network partition',
            hypothesisB: 'OOM killer',
            decidingMetric: 'dmesg logs',
          },
        ],
        eventSeq: 2,
        currentOODAPhase: 'ORIENT',
        costAccrued: 18000,
        cognitiveLoadScore: 25,
        lastReadbackAt: Date.now() - 30_000,
      };

      const context = buildDynamicContext(mockState);
      expect(context).toContain('[INCIDENT CONTEXT');
      expect(context).toContain('Incident: Redis Cluster Split Brain');
      expect(context).toContain('Severity: SEV-0');
      expect(context).toContain('IC: Marcus');
      expect(context).toContain('Active conflicts:');
      expect(context).toContain('Network partition vs OOM killer');
      expect(context).toContain('[END INCIDENT CONTEXT]');
    });
  });

  describe('Proxy Request Handling & Security', () => {
    it('returns 401 when proxy secret is required but unauthorized', async () => {
      process.env.INTERNAL_PROXY_SECRET = 'secret-token-123';
      const req = new NextRequest('http://localhost:3000/api/llm/proxy', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('returns 400 on malformed JSON payload', async () => {
      delete process.env.INTERNAL_PROXY_SECRET;
      const req = new NextRequest('http://localhost:3000/api/llm/proxy', {
        method: 'POST',
        body: 'invalid{json',
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid JSON request body');
    });

    it('returns 502 when OPENAI_API_KEY is not configured', async () => {
      delete process.env.INTERNAL_PROXY_SECRET;
      delete process.env.OPENAI_API_KEY;

      const req = new NextRequest('http://localhost:3000/api/llm/proxy', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is the current status?' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain('OPENAI_API_KEY is not configured');
    });
  });

  describe('Shadow Monitor Mode & Response Suppression (D-028)', () => {
    it('suppresses NO_RESPONSE in non-streaming mode by returning empty content', async () => {
      delete process.env.INTERNAL_PROXY_SECRET;
      process.env.OPENAI_API_KEY = 'sk-test-key-mock';

      // Mock fetch to OpenAI API returning NO_RESPONSE
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-mock-1',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'NO_RESPONSE' },
              finish_reason: 'stop',
            },
          ],
        }),
      } as unknown as Response);

      const req = new NextRequest('http://localhost:3000/api/llm/proxy', {
        method: 'POST',
        body: JSON.stringify({
          stream: false,
          messages: [{ role: 'user', content: 'Listening to team conversation...' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Verifies NO_RESPONSE was suppressed to prevent TTS trigger
      expect(data.choices[0].message.content).toBe('');
    });

    it('suppresses NO_RESPONSE in SSE streaming mode by emitting empty content delta', async () => {
      delete process.env.INTERNAL_PROXY_SECRET;
      process.env.OPENAI_API_KEY = 'sk-test-key-mock';

      const sseChunks = [
        'data: {"id":"chatcmpl-1","choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"NO_RESPONSE"}}]}\n\n',
        'data: {"id":"chatcmpl-1","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          for (const chunk of sseChunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      } as unknown as Response);

      const req = new NextRequest('http://localhost:3000/api/llm/proxy', {
        method: 'POST',
        body: JSON.stringify({
          stream: true,
          messages: [{ role: 'user', content: 'Silent monitoring turn' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamedOutput = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamedOutput += decoder.decode(value);
        }
      }

      // Streamed output must contain empty delta and [DONE]
      expect(streamedOutput).toContain('{"content":""}');
      expect(streamedOutput).toContain('[DONE]');
    });
  });
});
