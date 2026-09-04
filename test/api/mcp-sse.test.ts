import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/mcp/sse/route';

describe('API Route: /api/mcp/sse (app/api/mcp/sse/route.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MCP SSE Discovery (GET)', () => {
    it('returns SSE event-stream with endpoint discovery and tool definitions', async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamed = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamed += decoder.decode(value);
        }
      }

      expect(streamed).toContain('event: endpoint');
      expect(streamed).toContain('/api/mcp/sse');
      expect(streamed).toContain('event: message');
      expect(streamed).toContain('log_fact');
      expect(streamed).toContain('flag_conflict');
    });
  });

  describe('MCP JSON-RPC Protocol & Tool Registry (POST)', () => {
    it('handles JSON-RPC initialize method', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.serverInfo.name).toBe('aura-mcp-server');
      expect(data.result.capabilities.tools).toBeDefined();
    });

    it('handles tools/list and exposes all 8 incident management tools', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const tools = data.result.tools;

      expect(tools).toHaveLength(8);

      const toolNames = tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('log_fact');
      expect(toolNames).toContain('log_hypothesis');
      expect(toolNames).toContain('log_decision');
      expect(toolNames).toContain('log_action_item');
      expect(toolNames).toContain('flag_conflict');
      expect(toolNames).toContain('create_jira_ticket');
      expect(toolNames).toContain('post_slack_update');
      expect(toolNames).toContain('page_oncall_team');

      // Verify all tools have descriptions and valid JSON schemas
      tools.forEach((tool: { name: string; description: string; inputSchema: { type: string; properties: unknown } }) => {
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('executes log_fact tool successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'log_fact',
            arguments: {
              content: 'Kubernetes node 4 entered NotReady state',
              speaker_uid: 'marcus_devops',
              confidence: 85,
              service_affected: 'k8s-cluster',
            },
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.isError).toBe(false);
      const payload = JSON.parse(data.result.content[0].text);
      expect(payload.success).toBe(true);
      expect(payload.message).toContain('Fact logged: "Kubernetes node 4 entered NotReady state"');
      expect(payload.event.payload.confidence).toBe(85);
      expect(payload.event.payload.speakerName).toBe('Marcus');
    });

    it('executes flag_conflict tool successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'flag_conflict',
            arguments: {
              hypothesis_a: 'Memory leak in worker pool',
              speaker_a_uid: 'marcus_devops',
              hypothesis_b: 'External API throttling',
              speaker_b_uid: 'sarah_oncall',
              deciding_metric: 'Worker heap dump vs upstream 429 response rate',
            },
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.isError).toBe(false);
      const payload = JSON.parse(data.result.content[0].text);
      expect(payload.success).toBe(true);
      expect(payload.message).toContain('Conflict flagged: "Memory leak in worker pool" vs "External API throttling"');
      expect(payload.event.payload.decidingMetric).toBe('Worker heap dump vs upstream 429 response rate');
    });

    it('executes external action tool create_jira_ticket', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'create_jira_ticket',
            arguments: {
              summary: 'SEV-1 Checkout Service Degradation',
              severity: 'SEV-1',
              assigned_team: 'Core SRE',
            },
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result.isError).toBe(false);
      const payload = JSON.parse(data.result.content[0].text);
      expect(payload.id).toMatch(/^INC-\d+$/);
      expect(payload.summary).toBe('SEV-1 Checkout Service Degradation');
      expect(payload.url).toContain('https://jira.internal.example.com/browse/');
    });

    it('returns error when unknown tool is called', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'non_existent_tool',
            arguments: {},
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200); // JSON-RPC standard returns 200 with error object
      const data = await res.json();
      expect(data.error.code).toBe(-32601);
      expect(data.error.message).toContain("Method not found: unknown tool 'non_existent_tool'");
    });

    it('returns error when required parameters are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp/sse', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'log_fact',
            arguments: {
              content: 'Missing speaker_uid',
            },
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      const data = await res.json();
      expect(data.error.code).toBe(-32602);
      expect(data.error.message).toContain('log_fact requires content and speaker_uid');
    });
  });
});
