import { RTMDashboardEvent, ClassificationType } from './types';
import { AGENT_UID, CONFIDENCE_CAP } from './constants';

export type MockReplayEventType =
  | 'agent_greeting'
  | 'human_speech'
  | 'tool_call'
  | 'agent_silent'
  | 'agent_speech'
  | 'state_update'
  | 'resolution_celebration';

export interface MockReplayEventBase {
  delayMs: number;
  type: MockReplayEventType;
}

export interface AgentGreetingEvent extends MockReplayEventBase {
  type: 'agent_greeting';
  spoken: string;
}

export interface HumanSpeechEvent extends MockReplayEventBase {
  type: 'human_speech';
  speakerUid: string;
  speakerName: string;
  transcript: string;
}

export interface ToolCallEvent extends MockReplayEventBase {
  type: 'tool_call';
  tool:
    | 'log_fact'
    | 'log_hypothesis'
    | 'log_decision'
    | 'log_action_item'
    | 'flag_conflict'
    | 'create_jira_ticket'
    | 'post_slack_update'
    | string;
  params: Record<string, unknown>;
}

export interface AgentSilentEvent extends MockReplayEventBase {
  type: 'agent_silent';
  spoken: string;
}

export interface AgentSpeechEvent extends MockReplayEventBase {
  type: 'agent_speech';
  spoken: string;
}

export interface StateUpdateEvent extends MockReplayEventBase {
  type: 'state_update';
  update: {
    confirmHypothesis?: string;
    disproveHypothesis?: string;
    resolveConflict?: string;
    updateStatus?: string;
    resolvedAt?: string | number;
    [key: string]: unknown;
  };
}

export interface ResolutionCelebrationEvent extends MockReplayEventBase {
  type: 'resolution_celebration';
}

export type MockReplayEvent =
  | AgentGreetingEvent
  | HumanSpeechEvent
  | ToolCallEvent
  | AgentSilentEvent
  | AgentSpeechEvent
  | StateUpdateEvent
  | ResolutionCelebrationEvent;

export interface MockReplayOptions {
  speedMultiplier?: number;
  onSpeech?: (speakerName: string | null, transcript: string) => void;
  onCelebration?: () => void;
}

const PARTICIPANT_PROFILES: Record<string, { displayName: string; role: string }> = {
  sarah_ic: { displayName: 'Sarah Chen (Incident Commander)', role: 'Incident Commander' },
  marcus_sre: { displayName: 'Marcus Vance (Database SRE)', role: 'Database SRE' },
  priya_pm: { displayName: 'Priya Sharma (Product Manager)', role: 'Product Manager' },
  aura_agent: { displayName: 'AURA (Voice Commander)', role: 'AI Incident Commander' },
};

function getSpeakerName(uid: string): string {
  return PARTICIPANT_PROFILES[uid]?.displayName ?? uid;
}

export const DEMO_EVENTS: MockReplayEvent[] = [
  // ─── Beat 1: The Silent Watch ───
  {
    delayMs: 5000,   // T+0:05 — AURA joins
    type: 'agent_greeting',
    spoken: 'AURA online. Incident bridge monitoring active.',
  },
  {
    delayMs: 12000,  // T+0:12 — Sarah reports
    type: 'human_speech',
    speakerUid: 'sarah_ic',
    speakerName: 'Sarah',
    transcript: 'Sarah on-call. Error rate just spiked to 42% on payment services. Checkout page is completely unresponsive.',
  },
  {
    delayMs: 14000,  // T+0:14 — Tool call (silent)
    type: 'tool_call',
    tool: 'log_fact',
    params: {
      id: 'evt-001',
      content: 'Error rate spiked to 42% on payment services. Checkout page unresponsive.',
      speaker_uid: 'sarah_ic',
      confidence: 82,
      service_affected: 'payment-service',
      related_to: [],
    },
  },
  {
    delayMs: 15000,  // T+0:15 — AURA stays silent
    type: 'agent_silent',
    spoken: 'NO_RESPONSE',
  },

  // ─── Beat 2: The Contradiction ───
  {
    delayMs: 28000,  // T+0:28 — Marcus speaks
    type: 'human_speech',
    speakerUid: 'marcus_sre',
    speakerName: 'Marcus',
    transcript: "I'm looking at Postgres. Connection pool looks completely exhausted — connection count is at 98%.",
  },
  {
    delayMs: 30000,  // T+0:30
    type: 'tool_call',
    tool: 'log_hypothesis',
    params: {
      id: 'evt-002',
      title: 'Database connection pool exhaustion',
      proposed_by_uid: 'marcus_sre',
      supporting_evidence: 'Connection count at 98% utilization on PostgreSQL',
      deciding_metric: 'Database query latency logs',
      related_to: ['evt-001'],
    },
  },
  {
    delayMs: 38000,  // T+0:38 — Sarah contradicts
    type: 'human_speech',
    speakerUid: 'sarah_ic',
    speakerName: 'Sarah',
    transcript: "Wait — database metrics look normal on my Grafana dashboard. I think it's the load balancer. We changed the config yesterday.",
  },
  {
    delayMs: 40000,  // T+0:40
    type: 'tool_call',
    tool: 'log_hypothesis',
    params: {
      id: 'evt-003',
      title: 'Load balancer misconfiguration',
      proposed_by_uid: 'sarah_ic',
      supporting_evidence: 'Grafana shows normal DB metrics; load balancer config changed yesterday',
      deciding_metric: 'Load balancer 5xx error rate',
      related_to: ['evt-001'],
    },
  },
  {
    delayMs: 41000,  // T+0:41
    type: 'tool_call',
    tool: 'flag_conflict',
    params: {
      id: 'evt-004',
      hypothesis_a: 'Database connection pool exhaustion',
      speaker_a_uid: 'marcus_sre',
      hypothesis_b: 'Load balancer misconfiguration',
      speaker_b_uid: 'sarah_ic',
      deciding_metric: 'Database query latency logs vs load balancer 5xx rates',
      related_to: ['evt-002', 'evt-003'],
    },
  },
  {
    delayMs: 42000,  // T+0:42 — AURA breaks silence (THE WOW)
    type: 'agent_speech',
    spoken: "Flagging contradiction. Marcus proposes database connection pool exhaustion, Sarah proposes load balancer misconfiguration. Both are consistent with the symptoms we've confirmed. What single metric settles this — database query latency logs or load balancer 5xx rates?",
  },

  // ─── Beat 3: Perspective Bridge ───
  {
    delayMs: 58000,  // T+0:58 — Priya speaks
    type: 'human_speech',
    speakerUid: 'priya_pm',
    speakerName: 'Priya',
    transcript: "I don't understand the technical details, but our enterprise clients are reporting the checkout page is completely frozen. We're getting escalation emails.",
  },
  {
    delayMs: 60000,
    type: 'tool_call',
    tool: 'log_fact',
    params: {
      id: 'evt-005',
      content: 'Enterprise clients reporting checkout page frozen. Escalation emails received.',
      speaker_uid: 'priya_pm',
      confidence: 80,
      service_affected: 'checkout-frontend',
      related_to: ['evt-001'],
    },
  },
  {
    delayMs: 62000,  // AURA: Perspective Translation
    type: 'agent_speech',
    spoken: "Connecting those signals. The connection degradation Marcus noted is directly causing the checkout failures Priya reported. Same problem, two perspectives.",
  },
  {
    delayMs: 72000,  // T+1:12 — Sarah decides
    type: 'human_speech',
    speakerUid: 'sarah_ic',
    speakerName: 'Sarah',
    transcript: "Okay, let's roll back PR #492 immediately. And file a SEV-1 Jira ticket.",
  },
  {
    delayMs: 74000,
    type: 'tool_call',
    tool: 'log_decision',
    params: {
      id: 'evt-006',
      decision: 'Rollback PR #492 and file SEV-1 Jira ticket',
      authorized_by_uid: 'sarah_ic',
      rationale: 'Connection pool exhaustion correlated with PR deployment',
      affected_services: ['payment-service', 'checkout-frontend'],
      related_to: ['evt-002', 'evt-005'],
    },
  },

  // ─── Beat 4: Two-Phase Commit ───
  {
    delayMs: 76000,  // AURA: Phase 1 — Propose
    type: 'agent_speech',
    spoken: "I can create a SEV-1 Jira ticket for P-R four-nine-two rollback and broadcast status to Slack. Sarah, please confirm.",
  },
  {
    delayMs: 82000,  // Sarah confirms
    type: 'human_speech',
    speakerUid: 'sarah_ic',
    speakerName: 'Sarah',
    transcript: "Confirmed, go ahead.",
  },
  {
    delayMs: 84000,
    type: 'tool_call',
    tool: 'create_jira_ticket',
    params: {
      summary: 'SEV-1: Rollback PR #492 — Payment service connection pool exhaustion',
      severity: 'SEV-1',
      assigned_team: 'Platform Engineering',
    },
  },
  {
    delayMs: 85000,
    type: 'tool_call',
    tool: 'post_slack_update',
    params: {
      channel: '#incident-checkout',
      status_message: '[SEV-1] Payment Service Outage — Rollback PR #492 initiated. IC: Sarah.',
      impact_summary: 'Checkout page frozen. Connection pool exhaustion identified. Rollback in progress.',
    },
  },
  {
    delayMs: 87000,  // AURA: Phase 2 — Announce result
    type: 'agent_speech',
    spoken: "Ticket I-N-C four-eight-two-one created. Slack broadcast sent to incident checkout.",
  },
  {
    delayMs: 90000,
    type: 'tool_call',
    tool: 'log_action_item',
    params: {
      id: 'evt-007',
      task: 'Inspect PostgreSQL connection pool logs for query patterns',
      assigned_to_uid: 'marcus_sre',
      eta_minutes: 3,
      related_to: ['evt-006'],
    },
  },
  {
    delayMs: 91000,
    type: 'tool_call',
    tool: 'log_action_item',
    params: {
      id: 'evt-008',
      task: 'Notify enterprise accounts of service disruption and ETA',
      assigned_to_uid: 'priya_pm',
      eta_minutes: 5,
      related_to: ['evt-005'],
    },
  },
  {
    delayMs: 93000,  // AURA: Verbal Readback
    type: 'agent_speech',
    spoken: "Readback: Marcus will inspect connection pool logs. Priya will notify enterprise accounts. Sarah authorized rollback of P-R four-nine-two. Is that complete?",
  },

  // ─── Beat 5: Proactive Intelligence + Resolution of Conflict ───
  {
    delayMs: 118000, // T+1:58 — Marcus returns with evidence
    type: 'human_speech',
    speakerUid: 'marcus_sre',
    speakerName: 'Marcus',
    transcript: "Alright, I've got the query logs. Connection pool was maxed out by a single unoptimized query in PR #492. The load balancer is fine.",
  },
  {
    delayMs: 120000,
    type: 'tool_call',
    tool: 'log_fact',
    params: {
      id: 'evt-009',
      content: 'Database query logs confirm: connection pool maxed out by unoptimized query in PR #492. Load balancer functioning normally.',
      speaker_uid: 'marcus_sre',
      confidence: 85,
      service_affected: 'payment-service',
      related_to: ['evt-002', 'evt-007'],
    },
  },
  {
    delayMs: 121000,
    type: 'state_update',
    update: {
      // Confirm Marcus's hypothesis, disprove Sarah's
      confirmHypothesis: 'evt-002',
      disproveHypothesis: 'evt-003',
      resolveConflict: 'evt-004',
      updateStatus: 'identified',
    },
  },
  {
    delayMs: 123000,  // AURA: SBAR proactive brief
    type: 'agent_speech',
    spoken: "Situation: SEV-1 checkout outage, three minutes elapsed, rollback in progress. Background: database connection pool confirmed as root cause from P-R four-nine-two. Assessment: Marcus's hypothesis confirmed at 85% confidence, one hypothesis disproven. Recommendation: Marcus, what are replica lag metrics showing?",
  },

  // ─── Beat 6: Resolution ───
  {
    delayMs: 148000, // T+2:28 — Sarah resolves
    type: 'human_speech',
    speakerUid: 'sarah_ic',
    speakerName: 'Sarah',
    transcript: "Error rates are back to normal. Incident mitigated.",
  },
  {
    delayMs: 150000,
    type: 'tool_call',
    tool: 'log_fact',
    params: {
      id: 'evt-010',
      content: 'Error rates normalized. Payment service checkout page operational. Incident mitigated.',
      speaker_uid: 'sarah_ic',
      confidence: 85,
      service_affected: 'payment-service',
      related_to: ['evt-006'],
    },
  },
  {
    delayMs: 151000,
    type: 'state_update',
    update: {
      updateStatus: 'resolved',
      resolvedAt: 'NOW',
    },
  },
  {
    delayMs: 153000,  // AURA: Resolution summary
    type: 'agent_speech',
    spoken: "Incident resolved. Duration: four minutes thirty-two seconds. Root cause confirmed: database connection pool exhaustion from unoptimized query in P-R four-nine-two. Four facts logged, one hypothesis confirmed, one disproven, two actions completed, zero unresolved. Google SRE Book postmortem generated with compliance recording and cross-talk transcript.",
  },
  {
    delayMs: 155000,
    type: 'resolution_celebration',
  },
];

function transformToolCallToEvent(
  tool: string,
  params: Record<string, unknown>,
  seq: number
): RTMDashboardEvent {
  const timestamp = Date.now();

  switch (tool) {
    case 'log_fact': {
      const id = String(params.id || `evt-${seq}`);
      const content = String(params.content || '');
      const speakerUid = String(params.speaker_uid || 'operator');
      const confidence = Math.min(CONFIDENCE_CAP, Number(params.confidence) || 80);
      const serviceAffected = params.service_affected ? String(params.service_affected) : undefined;
      const relatedTo = Array.isArray(params.related_to) ? (params.related_to as string[]) : [];

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'fact' as ClassificationType,
          content,
          speakerUid,
          speakerName: getSpeakerName(speakerUid),
          confidence,
          serviceAffected,
          relatedTo,
          status: 'confirmed',
        },
      };
    }

    case 'log_hypothesis': {
      const id = String(params.id || `evt-${seq}`);
      const title = String(params.title || '');
      const proposedByUid = String(params.proposed_by_uid || 'operator');
      const supportingEvidence = params.supporting_evidence ? String(params.supporting_evidence) : '';
      const decidingMetric = params.deciding_metric ? String(params.deciding_metric) : '';
      const relatedTo = Array.isArray(params.related_to) ? (params.related_to as string[]) : [];

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'hypothesis' as ClassificationType,
          content: title,
          speakerUid: proposedByUid,
          speakerName: getSpeakerName(proposedByUid),
          confidence: Math.min(CONFIDENCE_CAP, 75),
          supportingEvidence,
          decidingMetric,
          relatedTo,
          status: 'active',
        },
      };
    }

    case 'flag_conflict': {
      const id = String(params.id || `evt-${seq}`);
      const hypothesisA = String(params.hypothesis_a || '');
      const speakerAUid = String(params.speaker_a_uid || '');
      const hypothesisB = String(params.hypothesis_b || '');
      const speakerBUid = String(params.speaker_b_uid || '');
      const decidingMetric = String(params.deciding_metric || '');
      const relatedTo = Array.isArray(params.related_to) ? (params.related_to as string[]) : [];

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'conflict' as ClassificationType,
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
        },
      };
    }

    case 'log_decision': {
      const id = String(params.id || `evt-${seq}`);
      const decision = String(params.decision || '');
      const authorizedByUid = String(params.authorized_by_uid || 'sarah_ic');
      const rationale = params.rationale ? String(params.rationale) : '';
      const affectedServices = Array.isArray(params.affected_services)
        ? (params.affected_services as string[])
        : ['payment-service', 'checkout-frontend'];
      const relatedTo = Array.isArray(params.related_to) ? (params.related_to as string[]) : [];

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'decision' as ClassificationType,
          content: decision,
          speakerUid: authorizedByUid,
          speakerName: getSpeakerName(authorizedByUid),
          confidence: CONFIDENCE_CAP,
          rationale,
          affectedServices,
          relatedTo,
          status: 'confirmed',
        },
      };
    }

    case 'log_action_item': {
      const id = String(params.id || `evt-${seq}`);
      const task = String(params.task || '');
      const assignedToUid = String(params.assigned_to_uid || '');
      const etaMinutes = Number(params.eta_minutes) || 5;
      const relatedTo = Array.isArray(params.related_to) ? (params.related_to as string[]) : [];

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'action' as ClassificationType,
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
        },
      };
    }

    case 'create_jira_ticket': {
      const id = `jira-${seq}`;
      const summary = String(params.summary || 'Incident task');
      const assignedTeam = String(params.assigned_team || 'Platform Engineering');

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'action' as ClassificationType,
          content: `[Jira INC-4821] ${summary}`,
          speakerUid: AGENT_UID,
          speakerName: 'AURA',
          confidence: CONFIDENCE_CAP,
          assignedTo: assignedTeam,
          actionStatus: 'in_progress',
          relatedTo: [],
          status: 'active',
        },
      };
    }

    case 'post_slack_update': {
      const id = `slack-${seq}`;
      const channel = String(params.channel || '#incident-checkout');
      const statusMessage = String(params.status_message || '');

      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'fact' as ClassificationType,
          content: `Slack ${channel}: ${statusMessage}`,
          speakerUid: AGENT_UID,
          speakerName: 'AURA',
          confidence: CONFIDENCE_CAP,
          serviceAffected: 'payment-service',
          relatedTo: [],
          status: 'confirmed',
        },
      };
    }

    default: {
      const id = `evt-${seq}`;
      return {
        type: 'dashboard_event',
        id,
        seq,
        timestamp,
        eventType: 'evidence_added',
        payload: {
          id,
          category: 'fact' as ClassificationType,
          content: `Tool executed: ${tool}`,
          speakerUid: AGENT_UID,
          speakerName: 'AURA',
          confidence: 75,
          status: 'confirmed',
        },
      };
    }
  }
}

/**
 * Starts in-browser mock replay sequence for rapid UI testing and demo-day failover.
 * Returns a cleanup function that cancels all pending timeouts.
 */
export function startMockReplay(
  processEvent: (event: RTMDashboardEvent) => void,
  dispatchStateUpdate: (update: Record<string, unknown>) => void,
  options?: MockReplayOptions
): () => void {
  const timeouts: NodeJS.Timeout[] = [];
  const multiplier = Math.max(0.1, options?.speedMultiplier ?? 1);
  let seqCounter = 1;

  // 1. Initial State Setup: Join all participants immediately
  const joinEvents: Array<{ uid: string; displayName: string; role: string; isIC: boolean }> = [
    { uid: 'sarah_ic', displayName: 'Sarah Chen', role: 'Incident Commander', isIC: true },
    { uid: 'marcus_sre', displayName: 'Marcus Vance', role: 'Database SRE', isIC: false },
    { uid: 'priya_pm', displayName: 'Priya Sharma', role: 'Product Manager', isIC: false },
    { uid: 'aura_agent', displayName: 'AURA', role: 'AI Incident Commander', isIC: false },
  ];

  joinEvents.forEach((p) => {
    processEvent({
      type: 'dashboard_event',
      id: `join-${p.uid}`,
      seq: seqCounter++,
      timestamp: Date.now(),
      eventType: 'participant_joined',
      payload: {
        uid: p.uid,
        displayName: p.displayName,
        role: p.role,
        joinedAt: Date.now(),
      },
    });
  });

  // Claim IC for Sarah Chen
  processEvent({
    type: 'dashboard_event',
    id: 'claim-ic-sarah',
    seq: seqCounter++,
    timestamp: Date.now(),
    eventType: 'ic_claimed',
    payload: {
      uid: 'sarah_ic',
    },
  });

  // 2. Schedule DEMO_EVENTS
  DEMO_EVENTS.forEach((event) => {
    const adjustedDelay = Math.round(event.delayMs / multiplier);

    const timer = setTimeout(() => {
      switch (event.type) {
        case 'agent_greeting':
        case 'agent_speech': {
          options?.onSpeech?.('AURA', event.spoken);
          break;
        }

        case 'agent_silent': {
          options?.onSpeech?.('AURA', '[Monitoring incident bridge — silence maintained]');
          break;
        }

        case 'human_speech': {
          options?.onSpeech?.(event.speakerName, event.transcript);
          break;
        }

        case 'tool_call': {
          const dashboardEvent = transformToolCallToEvent(
            event.tool,
            event.params,
            seqCounter++
          );
          processEvent(dashboardEvent);
          break;
        }

        case 'state_update': {
          dispatchStateUpdate(event.update);
          break;
        }

        case 'resolution_celebration': {
          options?.onCelebration?.();
          break;
        }
      }
    }, adjustedDelay);

    timeouts.push(timer);
  });

  return () => {
    timeouts.forEach(clearTimeout);
  };
}
