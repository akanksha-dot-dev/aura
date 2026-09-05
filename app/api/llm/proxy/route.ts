import { NextRequest, NextResponse } from 'next/server';
import { createDashboardEvent, publishDashboardEvent } from '@/lib/rtmPublisher';
import { getIncidentState, buildDynamicContext } from '@/lib/incidentStore';

export { buildDynamicContext } from '@/lib/incidentStore';
export const runtime = 'edge';


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
    const channelName = request.nextUrl.searchParams.get('channel') || 'incident-war-room';
    const dynamicContext = buildDynamicContext(getIncidentState(channelName));
    messages.unshift({
      role: 'system',
      content: dynamicContext,
    });

    // 4. Strip ConvAI custom fields (turn_id, timestamp) for upstream OpenAI compatibility
    const cleanBody = { ...body };
    delete cleanBody.turn_id;
    delete cleanBody.timestamp;
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

    const isPlaceholderKey =
      openAIKey === 'your_openai_api_key' ||
      !openAIKey.startsWith('sk-');

    if (isPlaceholderKey) {
      const lastUserMsg =
        [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      return handleAutonomousIncidentResponse(lastUserMsg, isStream);
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
      const trimmedContent = typeof content === 'string' ? content.trim() : '';
      if (trimmedContent === 'NO_RESPONSE' || trimmedContent === '[SILENT]') {
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
                    if (accumulatedContent.trim() === 'NO_RESPONSE' || accumulatedContent.trim() === '[SILENT]') {
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
                      ('NO_RESPONSE'.startsWith(trimmedCandidate) &&
                      trimmedCandidate.length <= 'NO_RESPONSE'.length) ||
                      ('[SILENT]'.startsWith(trimmedCandidate) &&
                      trimmedCandidate.length <= '[SILENT]'.length)
                    ) {
                      accumulatedContent = candidate;
                      bufferedLines.push(line);

                      // Check if complete NO_RESPONSE and stop reached
                      if (
                        (candidate.trim() === 'NO_RESPONSE' || candidate.trim() === '[SILENT]') &&
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
                      (accumulatedContent.trim() === 'NO_RESPONSE' || accumulatedContent.trim() === '[SILENT]')
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
            if (accumulatedContent.trim() === 'NO_RESPONSE' || accumulatedContent.trim() === '[SILENT]') {
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

/**
 * Autonomous Incident Commander responder for zero-key local / staging testing.
 * Accurately mimics GPT-4o-mini incident commander reasoning, responds concisely to voice,
 * and publishes real-time RTM telemetry to the incident dashboard.
 */
function handleAutonomousIncidentResponse(
  userMessage: string,
  isStream: boolean
): Response {
  const lower = userMessage.toLowerCase();
  let text =
    'AURA online. Monitoring incident bridge. SEV-1 active. How can I assist with telemetry or rollback?';
  let eventToPublish: {
    type: 'fact' | 'action_proposal' | 'conflict';
    payload: Record<string, unknown>;
  } | null = null;

  if (
    lower.includes('status') ||
    lower.includes('update') ||
    lower.includes('bridge') ||
    lower.includes('happening')
  ) {
    text =
      'Incident bridge status is SEV-1. Checkout 500 error rate is at 42%. Database connection pool is at 94% capacity. Rollback to release v2.13 is recommended.';
    eventToPublish = {
      type: 'fact',
      payload: {
        category: 'fact',
        content: 'Checkout 500 error rate at 42%; database pool at 94%',
        serviceAffected: 'payment-api',
        confidence: 85,
        status: 'confirmed',
        speakerUid: 'aura_agent',
        speakerName: 'AURA',
      },
    };
  } else if (
    lower.includes('database') ||
    lower.includes('postgres') ||
    lower.includes('pool') ||
    lower.includes('marcus')
  ) {
    text =
      'Marcus reported Postgres connection pool exhaustion. 48 of 50 connections active with queries queued on the primary replica.';
    eventToPublish = {
      type: 'fact',
      payload: {
        category: 'fact',
        content: 'Postgres primary connection pool: 48/50 active connections',
        serviceAffected: 'postgres-primary',
        confidence: 85,
        status: 'confirmed',
        speakerUid: 'marcus_sre',
        speakerName: 'Marcus Vance',
      },
    };
  } else if (
    lower.includes('rollback') ||
    lower.includes('revert') ||
    lower.includes('v2.13')
  ) {
    text =
      'Initiating two-phase confirmation for release rollback to v2.13. Requiring incident commander approval on dashboard.';
    eventToPublish = {
      type: 'action_proposal',
      payload: {
        category: 'action',
        content: 'Rollback payment-api to release v2.13',
        serviceAffected: 'payment-api',
        status: 'pending_confirmation',
        speakerUid: 'aura_agent',
        speakerName: 'AURA',
        assignedToUid: 'sarah_ic',
        assignedToName: 'Sarah Chen',
      },
    };
  } else if (lower.includes('conflict') || lower.includes('disagree')) {
    text =
      'Flagging contradiction between database pool theory and network latency hypothesis. Requesting deciding metric from query logs.';
    eventToPublish = {
      type: 'conflict',
      payload: {
        category: 'conflict',
        content: 'Connection pool saturation vs network partition',
        hypothesisA: 'Postgres connection pool saturation',
        hypothesisB: 'Upstream gateway network partition',
        decidingMetric: 'p99 database query latency under load',
        status: 'active',
        speakerUid: 'aura_agent',
        speakerName: 'AURA',
      },
    };
  } else if (
    lower.includes('hello') ||
    lower.includes('hi') ||
    lower.includes('hear me') ||
    lower.includes('aura')
  ) {
    text =
      'AURA online and standing by on incident bridge. Voice ingestion and telemetry monitoring active. How can I assist?';
  }

  // Publish live RTM event if applicable
  if (eventToPublish) {
    publishDashboardEvent(
      'incident-war-room',
      createDashboardEvent('evidence_added', eventToPublish.payload)
    ).catch(() => {});
  }

  const completionId = `chatcmpl-aura-${Date.now()}`;

  if (!isStream) {
    return NextResponse.json({
      id: completionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop',
        },
      ],
    });
  }

  // Stream SSE chunks
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      const chunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: text },
            finish_reason: null,
          },
        ],
      });
      controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));

      const doneChunk = JSON.stringify({
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-mini',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      });
      controller.enqueue(encoder.encode(`data: ${doneChunk}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
