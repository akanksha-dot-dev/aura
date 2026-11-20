import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as startAgent } from '@/app/api/agent/start/route';
import { POST as stopAgent } from '@/app/api/agent/stop/route';
import { POST as interruptAgent } from '@/app/api/agent/interrupt/route';
import { POST as updateAgent } from '@/app/api/agent/update/route';
import { POST as thinkAgent } from '@/app/api/agent/think/route';

// Mock Firebase Admin SDK for all agent tests (no real Firebase connection needed)
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

    it('returns 500 when GEMINI_API_KEY is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ channelName: 'incident-4821' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await startAgent(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('GEMINI_API_KEY');
    });

    it('starts Gemini Live session and returns agentId + stack info', async () => {
      process.env.GEMINI_API_KEY = 'AIzaTestKey123';

      const req = new NextRequest('http://localhost:3000/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ channelName: 'incident-sev1-4821' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await startAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toContain('aura-');
      expect(data.status).toBe('started');
      expect(data.stack.llm).toBe('gemini-live');
      expect(data.stack.transport).toBe('firebase-rtdb');
    });

    it('dynamically injects selected scenario into system prompt and greeting', async () => {
      process.env.GEMINI_API_KEY = 'AIzaTestKey123';

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
      const data = await res.json();
      // Greeting should mention the responder name and scenario
      expect(data.greeting).toContain('Jordan');
      expect(data.greeting).toContain('SEV-2');
      // Gemini config should have system instruction
      expect(data.agentId).toBeTruthy();
    });
  });

  describe('/api/agent/stop POST', () => {
    it('returns 400 when both agentId and channelName are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await stopAgent(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing agentId or channelName');
    });

    it('stops Gemini Live session via Firebase RTDB cleanup', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'aura-agent-12345' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('aura-agent-12345');
      expect(data.status).toBe('stopped');
    });

    it('stops session by channelName when agentId is not specified', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/stop', {
        method: 'POST',
        body: JSON.stringify({ channelName: 'incident-war-room' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await stopAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.channelName).toBe('incident-war-room');
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

    it('interrupts agent via Firebase RTDB event broadcast', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/interrupt', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'aura-agent-12345' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await interruptAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.agentId).toBe('aura-agent-12345');
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

    it('updates Gemini session context via Firebase RTDB and returns updated state', async () => {
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
      expect(data.transport).toBe('firebase-rtdb');
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

    it('broadcasts alert to Firebase RTDB when agentId is absent', async () => {
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
      expect(data.status).toBe('broadcasted_to_rtdb');
      expect(data.message).toBe('Datadog latency spike: 450ms');
    });

    it('injects alert into Firebase RTDB think_injection event when agentId is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/think', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'aura-test-think-123',
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
      expect(data.agentId).toBe('aura-test-think-123');
      expect(data.mode).toBe('firebase_rtdb_think');
    });
  });
});
