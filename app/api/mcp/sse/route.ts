import { NextRequest, NextResponse } from 'next/server';
import { CONFIDENCE_CAP, AGENT_UID, PERSONAS } from '@/lib/constants';
import { createDashboardEvent, publishDashboardEvent } from '@/lib/rtmPublisher';
import { addEvidenceToIncident } from '@/lib/incidentStore';
import { EvidenceItem, RTMDashboardEvent } from '@/lib/types';

export const runtime = 'nodejs';

function getSpeakerName(uid?: string): string {
  if (!uid) return 'Unknown';
  if (uid === AGENT_UID) return 'AURA';
  const found = PERSONAS.find((p) => p.uid === uid);
  return found ? found.displayName : uid;
}

const TOOL_DEFINITIONS = [
  {
    name: 'log_fact',
    description:
      'Logs a verified technical fact supported by telemetry, logs, or IC confirmation. Call silently whenever confirmed data is mentioned.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The verified technical fact',
        },
        speaker_uid: {
          type: 'string',
          description: 'UID of the speaker who stated the fact',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score (0-85, hard-capped at 85)',
        },
        service_affected: {
          type: 'string',
          description: 'Optional name of affected service',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of causally related events',
        },
      },
      required: ['content', 'speaker_uid', 'confidence'],
    },
  },
  {
    name: 'log_hypothesis',
    description:
      'Logs an unverified root-cause theory proposed by a responder. Always include a deciding_metric.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or short description of the root-cause theory',
        },
        proposed_by_uid: {
          type: 'string',
          description: 'UID of the responder proposing the hypothesis',
        },
        supporting_evidence: {
          type: 'string',
          description: 'Observed evidence supporting this theory',
        },
        deciding_metric: {
          type: 'string',
          description:
            'Specific metric or observation that proves/disproves this hypothesis',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of facts supporting this hypothesis',
        },
      },
      required: [
        'title',
        'proposed_by_uid',
        'supporting_evidence',
        'deciding_metric',
      ],
    },
  },
  {
    name: 'log_decision',
    description:
      'Logs an authoritative operational decision authorized by the Incident Commander.',
    inputSchema: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          description: 'Authoritative decision description',
        },
        authorized_by_uid: {
          type: 'string',
          description: 'UID of the authorizing Incident Commander',
        },
        rationale: {
          type: 'string',
          description: 'Operational reasoning behind the decision',
        },
        affected_services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of affected service names',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of facts or hypotheses driving this decision',
        },
      },
      required: [
        'decision',
        'authorized_by_uid',
        'rationale',
        'affected_services',
      ],
    },
  },
  {
    name: 'log_action_item',
    description:
      'Logs an assigned technical task with named owner and estimated completion time.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Description of the assigned task',
        },
        assigned_to_uid: {
          type: 'string',
          description: 'UID of the assigned owner',
        },
        eta_minutes: {
          type: 'number',
          description: 'Estimated completion time in minutes',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of decisions that spawned this action',
        },
      },
      required: ['task', 'assigned_to_uid', 'eta_minutes'],
    },
  },
  {
    name: 'flag_conflict',
    description:
      'Triggers sticky visual conflict alert when two responders assert contradictory claims. You MUST provide a deciding_metric.',
    inputSchema: {
      type: 'object',
      properties: {
        hypothesis_a: {
          type: 'string',
          description: 'First competing hypothesis',
        },
        speaker_a_uid: {
          type: 'string',
          description: 'UID of responder asserting hypothesis A',
        },
        hypothesis_b: {
          type: 'string',
          description: 'Second competing hypothesis',
        },
        speaker_b_uid: {
          type: 'string',
          description: 'UID of responder asserting hypothesis B',
        },
        deciding_metric: {
          type: 'string',
          description:
            'The single deciding metric distinguishing the two theories',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of the two conflicting hypotheses',
        },
      },
      required: [
        'hypothesis_a',
        'speaker_a_uid',
        'hypothesis_b',
        'speaker_b_uid',
        'deciding_metric',
      ],
    },
  },
  {
    name: 'create_jira_ticket',
    description:
      'Creates an incident tracking ticket in Jira. MANDATORY: Ask IC for verbal confirmation first.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Ticket summary / title',
        },
        severity: {
          type: 'string',
          enum: ['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3'],
          description: 'Severity level',
        },
        assigned_team: {
          type: 'string',
          description: 'Team responsible for the ticket',
        },
      },
      required: ['summary', 'severity', 'assigned_team'],
    },
  },
  {
    name: 'post_slack_update',
    description:
      'Broadcasts an executive status summary to the incident Slack channel. MANDATORY: Ask IC for verbal confirmation first.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Target Slack channel (e.g. #incident-checkout)',
        },
        status_message: {
          type: 'string',
          description: 'Executive status summary',
        },
        impact_summary: {
          type: 'string',
          description: 'Current customer and revenue impact summary',
        },
      },
      required: ['channel', 'status_message', 'impact_summary'],
    },
  },
  {
    name: 'page_oncall_team',
    description:
      'Triggers urgent escalation page via PagerDuty mock. MANDATORY: Ask IC for verbal confirmation first.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service needing escalation',
        },
        urgency: {
          type: 'string',
          enum: ['high', 'low'],
          description: 'Urgency level',
        },
        escalation_note: {
          type: 'string',
          description: 'Brief note explaining the escalation rationale',
        },
      },
      required: ['service', 'urgency', 'escalation_note'],
    },
  },
];

/**
 * GET /api/mcp/sse — Returns MCP server capabilities and tool list via SSE stream
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial endpoint discovery event
      controller.enqueue(encoder.encode('event: endpoint\ndata: /api/mcp/sse\n\n'));

      // 2. Capabilities and tools announcement
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'capabilities',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          tools: TOOL_DEFINITIONS,
        },
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initMessage}\n\n`));

      // Keep stream open / end gracefully
      controller.close();
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
}

/**
 * POST /api/mcp/sse — Handles MCP JSON-RPC 2.0 tool invocations via Streamable HTTP transport
 */
export async function POST(request: NextRequest) {
  let body: {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: {
      name?: string;
      arguments?: Record<string, unknown>;
      [key: string]: unknown;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: invalid JSON',
        },
      },
      { status: 400 }
    );
  }

  const { jsonrpc = '2.0', id = null, method, params } = body;

  // 1. Handle initialize
  if (method === 'initialize') {
    return NextResponse.json({
      jsonrpc,
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'aura-mcp-server',
          version: '1.0.0',
        },
      },
    });
  }

  // 2. Handle notifications/initialized
  if (method === 'notifications/initialized') {
    return NextResponse.json({ jsonrpc, id, result: {} });
  }

  // 3. Handle tools/list
  if (method === 'tools/list') {
    return NextResponse.json({
      jsonrpc,
      id,
      result: {
        tools: TOOL_DEFINITIONS,
      },
    });
  }

  // 4. Handle tools/call
  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const queryChannel = request.nextUrl.searchParams.get('channel');
    const channelName =
      queryChannel ||
      (typeof args.channelName === 'string' ? args.channelName : undefined) ||
      'incident-war-room';

    const broadcastDashboardEvent = (targetChannel: string, ev: RTMDashboardEvent) => {
      publishDashboardEvent(targetChannel, ev).catch((err) => {
        console.warn(`[MCP Server] Error publishing event to ${targetChannel}:`, err);
      });
      if (targetChannel !== 'incident-war-room') {
        publishDashboardEvent('incident-war-room', ev).catch(() => {});
      }
    };

    if (!toolName) {
      return NextResponse.json({
        jsonrpc,
        id,
        error: {
          code: -32602,
          message: 'Invalid params: missing tool name',
        },
      });
    }

    try {
      let resultData: Record<string, unknown>;

      switch (toolName) {
        case 'log_fact': {
          const content = String(args.content || '');
          const speakerUid = String(args.speaker_uid || '');
          const rawConfidence = Number(args.confidence) || 80;
          const confidence = Math.min(CONFIDENCE_CAP, Math.max(0, rawConfidence));
          const serviceAffected =
            typeof args.service_affected === 'string'
              ? args.service_affected
              : undefined;
          const relatedTo = Array.isArray(args.related_to)
            ? (args.related_to as string[])
            : [];

          if (!content || !speakerUid) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: 'log_fact requires content and speaker_uid',
              },
            });
          }

          const event = createDashboardEvent('evidence_added', {
            category: 'fact',
            content,
            speakerUid,
            speakerName: getSpeakerName(speakerUid),
            confidence,
            serviceAffected,
            relatedTo,
            status: 'confirmed',
          });

          // Update server-side incident state
          addEvidenceToIncident(channelName, {
            id: event.id,
            category: 'fact',
            content,
            speakerUid,
            speakerName: getSpeakerName(speakerUid),
            confidence,
            serviceAffected,
            relatedTo,
            status: 'confirmed',
            timestamp: event.timestamp,
          });

          // Non-blocking broadcast to RTM channel
          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            eventId: event.id,
            seq: event.seq,
            event,
            message: `Fact logged: "${content}"`,
          };
          break;
        }

        case 'log_hypothesis': {
          const title = String(args.title || '');
          const proposedByUid = String(args.proposed_by_uid || '');
          const supportingEvidence = String(args.supporting_evidence || '');
          const decidingMetric = String(args.deciding_metric || '');
          const relatedTo = Array.isArray(args.related_to)
            ? (args.related_to as string[])
            : [];

          if (!title || !proposedByUid || !decidingMetric) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message:
                  'log_hypothesis requires title, proposed_by_uid, and deciding_metric',
              },
            });
          }

          const event = createDashboardEvent('evidence_added', {
            category: 'hypothesis',
            content: title,
            speakerUid: proposedByUid,
            speakerName: getSpeakerName(proposedByUid),
            confidence: Math.min(CONFIDENCE_CAP, 75),
            supportingEvidence,
            decidingMetric,
            relatedTo,
            status: 'active',
          });

          // Update server-side incident state
          addEvidenceToIncident(channelName, {
            id: event.id,
            category: 'hypothesis',
            content: title,
            speakerUid: proposedByUid,
            speakerName: getSpeakerName(proposedByUid),
            confidence: Math.min(CONFIDENCE_CAP, 75),
            decidingMetric,
            relatedTo,
            status: 'active',
            timestamp: event.timestamp,
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            eventId: event.id,
            seq: event.seq,
            event,
            message: `Hypothesis logged: "${title}"`,
          };
          break;
        }

        case 'log_decision': {
          const decision = String(args.decision || '');
          const authorizedByUid = String(args.authorized_by_uid || '');
          const rationale = String(args.rationale || '');
          const affectedServices = Array.isArray(args.affected_services)
            ? (args.affected_services as string[])
            : [];
          const relatedTo = Array.isArray(args.related_to)
            ? (args.related_to as string[])
            : [];

          if (!decision || !authorizedByUid) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: 'log_decision requires decision and authorized_by_uid',
              },
            });
          }

          const event = createDashboardEvent('evidence_added', {
            category: 'decision',
            content: decision,
            speakerUid: authorizedByUid,
            speakerName: getSpeakerName(authorizedByUid),
            confidence: CONFIDENCE_CAP,
            rationale,
            affectedServices,
            relatedTo,
            status: 'confirmed',
          });

          // Update server-side incident state
          addEvidenceToIncident(channelName, {
            id: event.id,
            category: 'decision',
            content: decision,
            speakerUid: authorizedByUid,
            speakerName: getSpeakerName(authorizedByUid),
            confidence: CONFIDENCE_CAP,
            relatedTo,
            status: 'confirmed',
            timestamp: event.timestamp,
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            eventId: event.id,
            seq: event.seq,
            event,
            message: `Decision logged: "${decision}"`,
          };
          break;
        }

        case 'log_action_item': {
          const task = String(args.task || '');
          const assignedToUid = String(args.assigned_to_uid || '');
          const etaMinutes = Number(args.eta_minutes) || 5;
          const relatedTo = Array.isArray(args.related_to)
            ? (args.related_to as string[])
            : [];

          if (!task || !assignedToUid) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: 'log_action_item requires task and assigned_to_uid',
              },
            });
          }

          const event = createDashboardEvent('evidence_added', {
            category: 'action',
            content: task,
            speakerUid: AGENT_UID,
            speakerName: 'AURA',
            confidence: CONFIDENCE_CAP,
            assignedTo: getSpeakerName(assignedToUid),
            assignedToUid,
            eta: Date.now() + etaMinutes * 60_000,
            actionStatus: 'pending',
            relatedTo,
            status: 'active',
          });

          // Update server-side incident state
          addEvidenceToIncident(channelName, {
            id: event.id,
            category: 'action',
            content: task,
            speakerUid: AGENT_UID,
            speakerName: 'AURA',
            confidence: CONFIDENCE_CAP,
            assignedTo: getSpeakerName(assignedToUid),
            eta: Date.now() + etaMinutes * 60_000,
            actionStatus: 'pending',
            relatedTo,
            status: 'active',
            timestamp: event.timestamp,
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            eventId: event.id,
            seq: event.seq,
            event,
            message: `Action assigned to ${getSpeakerName(assignedToUid)}: "${task}"`,
          };
          break;
        }

        case 'flag_conflict': {
          const hypothesisA = String(args.hypothesis_a || '');
          const speakerAUid = String(args.speaker_a_uid || '');
          const hypothesisB = String(args.hypothesis_b || '');
          const speakerBUid = String(args.speaker_b_uid || '');
          const decidingMetric = String(args.deciding_metric || '');
          const relatedTo = Array.isArray(args.related_to)
            ? (args.related_to as string[])
            : [];

          if (!hypothesisA || !hypothesisB || !decidingMetric) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message:
                  'flag_conflict requires hypothesis_a, hypothesis_b, and deciding_metric',
              },
            });
          }

          const event = createDashboardEvent('evidence_added', {
            category: 'conflict',
            content: `${hypothesisA} vs ${hypothesisB}`,
            speakerUid: AGENT_UID,
            speakerName: 'AURA',
            confidence: 80,
            hypothesisA,
            speakerAUid,
            hypothesisB,
            speakerBUid,
            decidingMetric,
            relatedTo,
            status: 'active',
          });

          // Update server-side incident state
          addEvidenceToIncident(channelName, {
            id: event.id,
            category: 'conflict',
            content: `${hypothesisA} vs ${hypothesisB}`,
            speakerUid: AGENT_UID,
            speakerName: 'AURA',
            confidence: 80,
            hypothesisA,
            speakerAUid,
            hypothesisB,
            speakerBUid,
            decidingMetric,
            relatedTo,
            status: 'active',
            timestamp: event.timestamp,
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            eventId: event.id,
            seq: event.seq,
            event,
            message: `Conflict flagged: "${hypothesisA}" vs "${hypothesisB}"`,
          };
          break;
        }

        case 'create_jira_ticket': {
          const summary = String(args.summary || '');
          const severity = String(args.severity || 'SEV-1');
          const assignedTeam = String(args.assigned_team || 'Core SRE');

          if (!summary) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: 'create_jira_ticket requires summary',
              },
            });
          }

          const ticketId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
          const createdAt = new Date().toISOString();

          const event = createDashboardEvent('action_status_changed', {
            actionType: 'create_jira_ticket',
            ticketId,
            summary,
            severity,
            assignedTeam,
            status: 'created',
            createdAt,
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            id: ticketId,
            summary,
            severity,
            assignee: assignedTeam,
            created_at: createdAt,
            url: `https://jira.internal.example.com/browse/${ticketId}`,
            event,
          };
          break;
        }

        case 'post_slack_update': {
          const channel = String(args.channel || '#incident-war-room');
          const statusMessage = String(args.status_message || '');
          const impactSummary = String(args.impact_summary || '');

          if (!statusMessage) {
            return NextResponse.json({
              jsonrpc,
              id,
              error: {
                code: -32602,
                message: 'post_slack_update requires status_message',
              },
            });
          }

          let webhookDelivered = false;
          let webhookNote = 'Slack webhook not configured (mock broadcast)';

          const slackUrl = process.env.SLACK_WEBHOOK_URL;
          if (slackUrl && slackUrl.startsWith('https://hooks.slack.com/')) {
            try {
              const slackRes = await fetch(slackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `🚨 *AURA Incident Commander Update* (${channel})\n>${statusMessage}\n*Impact:* ${impactSummary}`,
                }),
              });
              if (slackRes.ok) {
                webhookDelivered = true;
                webhookNote = 'Delivered to live Slack channel';
              } else {
                webhookNote = `Slack webhook returned HTTP ${slackRes.status}`;
              }
            } catch (slackErr) {
              webhookNote = `Slack network error: ${
                slackErr instanceof Error ? slackErr.message : String(slackErr)
              }`;
            }
          }

          const event = createDashboardEvent('action_status_changed', {
            actionType: 'post_slack_update',
            channel,
            statusMessage,
            impactSummary,
            webhookDelivered,
            timestamp: Date.now(),
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            channel,
            delivered: webhookDelivered,
            note: webhookNote,
            event,
          };
          break;
        }

        case 'page_oncall_team': {
          const service = String(args.service || 'platform-service');
          const urgency = String(args.urgency || 'high');
          const escalationNote = String(args.escalation_note || '');

          const pageId = `PD-${Math.floor(10000 + Math.random() * 90000)}`;

          const event = createDashboardEvent('action_status_changed', {
            actionType: 'page_oncall_team',
            service,
            urgency,
            escalationNote,
            pageId,
            status: 'paged',
            timestamp: Date.now(),
          });

          broadcastDashboardEvent(channelName, event);

          resultData = {
            success: true,
            service,
            urgency,
            pageId,
            status: 'paged',
            note: escalationNote,
            event,
          };
          break;
        }

        default:
          return NextResponse.json({
            jsonrpc,
            id,
            error: {
              code: -32601,
              message: `Method not found: unknown tool '${toolName}'`,
            },
          });
      }

      // Return MCP standard tool call response
      return NextResponse.json({
        jsonrpc,
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultData, null, 2),
            },
          ],
          isError: false,
        },
      });
    } catch (err) {
      return NextResponse.json({
        jsonrpc,
        id,
        error: {
          code: -32603,
          message:
            err instanceof Error ? err.message : 'Internal tool execution error',
        },
      });
    }
  }

  // Unknown JSON-RPC method
  return NextResponse.json({
    jsonrpc,
    id,
    error: {
      code: -32601,
      message: `Method not found: '${method}'`,
    },
  });
}
