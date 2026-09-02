import { NextRequest, NextResponse } from 'next/server';
import { IncidentState, calculateCognitiveLoad } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Format milliseconds into human-readable elapsed duration (e.g. "6m 12s").
 */
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * Baseline / demo scenario incident state matching SEV-1 Payment Outage.
 * Live incident state from RTM will hydrate this in subsequent stories.
 */
const DEFAULT_INCIDENT_STATE: IncidentState = {
  incidentId: 'inc-demo-001',
  title: 'Payment Gateway Degradation & Checkout Outage',
  severity: 'SEV-1',
  status: 'investigating',
  openedAt: Date.now() - 360_000,
  affectedServices: ['payment-api', 'checkout-service', 'postgres-primary'],
  participants: {
    'user-sarah': {
      uid: 'user-sarah',
      displayName: 'Sarah Chen',
      role: 'Incident Commander',
      isIncidentCommander: true,
      joinedAt: Date.now() - 360_000,
      totalSpeakingMs: 45_000,
      lastSpokeAt: Date.now() - 25_000,
    },
    'user-marcus': {
      uid: 'user-marcus',
      displayName: 'Marcus Vance',
      role: 'Lead SRE',
      isIncidentCommander: false,
      joinedAt: Date.now() - 340_000,
      totalSpeakingMs: 65_000,
      lastSpokeAt: Date.now() - 10_000,
    },
    'user-priya': {
      uid: 'user-priya',
      displayName: 'Priya Patel',
      role: 'Product Manager',
      isIncidentCommander: false,
      joinedAt: Date.now() - 300_000,
      totalSpeakingMs: 20_000,
      lastSpokeAt: Date.now() - 50_000,
    },
  },
  incidentCommanderUid: 'user-sarah',
  evidenceItems: [
    {
      id: 'evt-001',
      category: 'fact',
      content: 'Checkout error rate spiked to 42% following v2.14 release',
      speakerUid: 'user-marcus',
      speakerName: 'Marcus Vance',
      confidence: 85,
      timestamp: Date.now() - 300_000,
      serviceAffected: 'payment-api',
      relatedTo: [],
      status: 'confirmed',
    },
    {
      id: 'evt-002',
      category: 'hypothesis',
      content: 'Postgres connection pool exhaustion causing thread starvation',
      speakerUid: 'user-marcus',
      speakerName: 'Marcus Vance',
      confidence: 75,
      timestamp: Date.now() - 240_000,
      serviceAffected: 'postgres-primary',
      relatedTo: ['evt-001'],
      status: 'active',
      decidingMetric: 'active pg_stat_activity connection count',
    },
    {
      id: 'evt-003',
      category: 'hypothesis',
      content: 'Payment gateway API rate limiting after PR #492',
      speakerUid: 'user-sarah',
      speakerName: 'Sarah Chen',
      confidence: 65,
      timestamp: Date.now() - 180_000,
      serviceAffected: 'payment-api',
      relatedTo: ['evt-001'],
      status: 'active',
      decidingMetric: 'upstream gateway HTTP 429 response codes',
    },
    {
      id: 'evt-004',
      category: 'conflict',
      content: 'Connection pool exhaustion vs Gateway rate limiting',
      speakerUid: 'aura_agent',
      speakerName: 'AURA',
      confidence: 80,
      timestamp: Date.now() - 120_000,
      serviceAffected: 'payment-api',
      relatedTo: ['evt-002', 'evt-003'],
      status: 'active',
      hypothesisA: 'Postgres connection pool exhaustion',
      hypothesisB: 'Payment gateway rate limiting',
      decidingMetric: 'Database connection metrics vs HTTP 429 errors',
    },
    {
      id: 'evt-005',
      category: 'action',
      content: 'Inspect Postgres connection pool utilization via Datadog',
      speakerUid: 'user-sarah',
      speakerName: 'Sarah Chen',
      confidence: 85,
      timestamp: Date.now() - 60_000,
      serviceAffected: 'postgres-primary',
      relatedTo: ['evt-002'],
      status: 'active',
      assignedTo: 'Marcus Vance',
      actionStatus: 'in_progress',
      eta: Date.now() + 180_000,
    },
  ],
  eventSeq: 5,
  currentOODAPhase: 'ORIENT',
  costAccrued: 54000,
  cognitiveLoadScore: 65,
  lastReadbackAt: Date.now() - 90_000,
};

/**
 * Builds the dynamic incident context string injected per-turn before every LLM call (D-028).
 */
export function buildDynamicContext(state: IncidentState): string {
  const elapsed = formatElapsedTime(Date.now() - state.openedAt);
  const ic = state.incidentCommanderUid
    ? state.participants[state.incidentCommanderUid]?.displayName ?? 'Unassigned'
    : 'Unassigned';

  const participants = Object.values(state.participants)
    .map((p) => {
      const silentFor = Math.round((Date.now() - p.lastSpokeAt) / 1000);
      return `${p.displayName} (${p.role}, silent ${silentFor}s)`;
    })
    .join(', ');

  const recentEvents =
    state.evidenceItems
      .slice(-5)
      .map(
        (e) =>
          `  [${e.id}] ${e.category.toUpperCase()}: "${e.content}" (by ${e.speakerName}, confidence ${e.confidence})`
      )
      .join('\n') || '  None';

  const conflicts =
    state.evidenceItems
      .filter((e) => e.category === 'conflict' && e.status === 'active')
      .map(
        (e) =>
          `  ${e.hypothesisA ?? 'Unknown'} vs ${e.hypothesisB ?? 'Unknown'} — deciding metric: ${e.decidingMetric ?? 'None'}`
      )
      .join('\n') || '  None';

  const pendingActions =
    state.evidenceItems
      .filter(
        (e) =>
          e.category === 'action' &&
          (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')
      )
      .map(
        (e) =>
          `  ${e.content} → ${e.assignedTo ?? 'unassigned'} (${e.actionStatus ?? 'pending'})`
      )
      .join('\n') || '  None';

  const secsSinceReadback = Math.round((Date.now() - state.lastReadbackAt) / 1000);

  return `[INCIDENT CONTEXT — INJECTED AT ${new Date().toISOString()}]
Incident: ${state.title} | Severity: ${state.severity} | Status: ${state.status} | Elapsed: ${elapsed}
IC: ${ic} (${state.incidentCommanderUid ?? 'none'}) | OODA Phase: ${state.currentOODAPhase}
Active Participants: ${participants || 'None'}
Facts: ${state.evidenceItems.filter((e) => e.category === 'fact').length} | Hypotheses: ${state.evidenceItems.filter((e) => e.category === 'hypothesis' && e.status === 'active').length} | Decisions: ${state.evidenceItems.filter((e) => e.category === 'decision').length} | Pending Actions: ${state.evidenceItems.filter((e) => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')).length} | Conflicts: ${state.evidenceItems.filter((e) => e.category === 'conflict' && e.status === 'active').length}
Last readback: ${secsSinceReadback}s ago
Cognitive Load: ${calculateCognitiveLoad(state)}/100

Recent evidence (last 5):
${recentEvents}

Active conflicts:
${conflicts}

Pending actions:
${pendingActions}
[END INCIDENT CONTEXT]`;
}

interface ProxyRequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  turn_id?: number;
  timestamp?: number;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Authorization header against INTERNAL_PROXY_SECRET
    const proxySecret = process.env.INTERNAL_PROXY_SECRET;
    if (proxySecret) {
      const authHeader = request.headers.get('authorization');
      const expected = `Bearer ${proxySecret}`;
      if (!authHeader || (authHeader !== expected && authHeader !== proxySecret)) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid proxy secret' },
          { status: 401 }
        );
      }
    }

    // 2. Parse incoming OpenAI-format request
    let body: ProxyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const messages = Array.isArray(body.messages) ? [...body.messages] : [];

    // 3. Inject dynamic incident context into system messages
    const dynamicContext = buildDynamicContext(DEFAULT_INCIDENT_STATE);
    messages.unshift({
      role: 'system',
      content: dynamicContext,
    });

    // 4. Strip ConvAI custom fields (turn_id, timestamp) for upstream OpenAI compatibility
    const { turn_id: _turnId, timestamp: _ts, ...cleanBody } = body;
    const isStream = body.stream !== false;
    const modelToUse = body.model || 'gpt-4o-mini';

    const upstreamPayload = {
      ...cleanBody,
      model: modelToUse,
      messages,
      stream: isStream,
    };

    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured on the proxy' },
        { status: 502 }
      );
    }

    // 5. Forward request to OpenAI API
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify(upstreamPayload),
        signal: request.signal,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Failed to connect to OpenAI API',
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'OpenAI API error',
          status: upstreamResponse.status,
          details: errorText,
        },
        { status: upstreamResponse.status >= 500 ? 502 : upstreamResponse.status }
      );
    }

    // 6. Handle non-streaming response
    if (!isStream) {
      const json = await upstreamResponse.json();
      const content = json.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim() === 'NO_RESPONSE') {
        json.choices[0].message.content = '';
      }
      return NextResponse.json(json);
    }

    // 7. Handle SSE streaming with NO_RESPONSE suppression and tool_calls pass-through
    const upstreamBody = upstreamResponse.body;
    if (!upstreamBody) {
      return NextResponse.json(
        { error: 'OpenAI upstream response has no body' },
        { status: 502 }
      );
    }

    const reader = upstreamBody.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let sseBuffer = '';
        let accumulatedContent = '';
        let isBufferingPrefix = true;
        let bufferedLines: string[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;

              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();

                if (dataStr === '[DONE]') {
                  if (isBufferingPrefix) {
                    if (accumulatedContent.trim() === 'NO_RESPONSE') {
                      // Suppress TTS audio by emitting an empty content delta
                      const emptyChunk = JSON.stringify({
                        id: 'chatcmpl-no-response',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: modelToUse,
                        choices: [
                          {
                            index: 0,
                            delta: { content: '' },
                            finish_reason: 'stop',
                          },
                        ],
                      });
                      controller.enqueue(encoder.encode(`data: ${emptyChunk}\n\n`));
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                      return;
                    } else {
                      // Flush remaining buffered lines
                      for (const bLine of bufferedLines) {
                        controller.enqueue(encoder.encode(`${bLine}\n\n`));
                      }
                      bufferedLines = [];
                    }
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  return;
                }

                // Parse SSE JSON chunk
                let chunkObj: {
                  id?: string;
                  created?: number;
                  model?: string;
                  choices?: Array<{
                    index?: number;
                    delta?: {
                      content?: string;
                      tool_calls?: unknown[];
                    };
                    finish_reason?: string | null;
                  }>;
                } | null = null;

                try {
                  chunkObj = JSON.parse(dataStr);
                } catch {
                  // If JSON parse fails, forward or buffer line directly
                  if (isBufferingPrefix) {
                    bufferedLines.push(line);
                  } else {
                    controller.enqueue(encoder.encode(`${line}\n\n`));
                  }
                  continue;
                }

                const choice = chunkObj?.choices?.[0];
                const delta = choice?.delta;
                const deltaContent = delta?.content;
                const hasToolCalls =
                  Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0;

                // Tool calls must pass through immediately to ConvAI for MCP execution
                if (hasToolCalls) {
                  controller.enqueue(encoder.encode(`${line}\n\n`));
                  continue;
                }

                if (typeof deltaContent === 'string' && deltaContent.length > 0) {
                  if (isBufferingPrefix) {
                    const candidate = accumulatedContent + deltaContent;
                    const trimmedCandidate = candidate.trimStart().toUpperCase();

                    if (
                      'NO_RESPONSE'.startsWith(trimmedCandidate) &&
                      trimmedCandidate.length <= 'NO_RESPONSE'.length
                    ) {
                      accumulatedContent = candidate;
                      bufferedLines.push(line);

                      // Check if complete NO_RESPONSE and stop reached
                      if (
                        candidate.trim() === 'NO_RESPONSE' &&
                        choice?.finish_reason === 'stop'
                      ) {
                        const emptyChunk = JSON.stringify({
                          id: chunkObj?.id || 'chatcmpl-no-response',
                          object: 'chat.completion.chunk',
                          created: chunkObj?.created || Math.floor(Date.now() / 1000),
                          model: chunkObj?.model || modelToUse,
                          choices: [
                            {
                              index: 0,
                              delta: { content: '' },
                              finish_reason: 'stop',
                            },
                          ],
                        });
                        controller.enqueue(encoder.encode(`data: ${emptyChunk}\n\n`));
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        return;
                      }
                    } else {
                      // Diverged from NO_RESPONSE pattern — flush buffered lines and stream normally
                      isBufferingPrefix = false;
                      for (const bLine of bufferedLines) {
                        controller.enqueue(encoder.encode(`${bLine}\n\n`));
                      }
                      bufferedLines = [];
                      controller.enqueue(encoder.encode(`${line}\n\n`));
                    }
                  } else {
                    controller.enqueue(encoder.encode(`${line}\n\n`));
                  }
                } else {
                  // Chunk without content (e.g. role announcement or finish_reason)
                  if (isBufferingPrefix) {
                    if (
                      choice?.finish_reason === 'stop' &&
                      accumulatedContent.trim() === 'NO_RESPONSE'
                    ) {
                      const emptyChunk = JSON.stringify({
                        id: chunkObj?.id || 'chatcmpl-no-response',
                        object: 'chat.completion.chunk',
                        created: chunkObj?.created || Math.floor(Date.now() / 1000),
                        model: chunkObj?.model || modelToUse,
                        choices: [
                          {
                            index: 0,
                            delta: { content: '' },
                            finish_reason: 'stop',
                          },
                        ],
                      });
                      controller.enqueue(encoder.encode(`data: ${emptyChunk}\n\n`));
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                      return;
                    }
                    bufferedLines.push(line);
                  } else {
                    controller.enqueue(encoder.encode(`${line}\n\n`));
                  }
                }
              }
            }
          }

          // If stream finished without explicit [DONE]
          if (isBufferingPrefix) {
            if (accumulatedContent.trim() === 'NO_RESPONSE') {
              const emptyChunk = JSON.stringify({
                id: 'chatcmpl-no-response',
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: modelToUse,
                choices: [
                  {
                    index: 0,
                    delta: { content: '' },
                    finish_reason: 'stop',
                  },
                ],
              });
              controller.enqueue(encoder.encode(`data: ${emptyChunk}\n\n`));
            } else {
              for (const bLine of bufferedLines) {
                controller.enqueue(encoder.encode(`${bLine}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal Custom LLM Proxy error',
      },
      { status: 500 }
    );
  }
}
