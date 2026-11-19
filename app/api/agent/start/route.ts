import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState, initializeLiveIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';
import { buildEffectiveSystemPrompt } from '@/lib/promptBuilder';

export const runtime = 'nodejs';

// ────────────────────────────────────────────────────────────────────────────────────
// Request interface
// ────────────────────────────────────────────────────────────────────────────────────

interface AgentStartRequest {
  channelName?: string;
  userUid?: string;
  userName?: string;
  userRole?: string;
  language?: string;
  scenario?: {
    title?: string;
    severity?: string;
    affectedServices?: string[];
    description?: string;
    impact?: string;
    suspectedCause?: string;
    personas?: Array<{ uid: string; displayName: string; role: string }>;
    playbook?: Array<{
      id: string;
      phase: string;
      title: string;
      detail: string;
      command?: string;
      priority?: string;
    }>;
  };
}

// ────────────────────────────────────────────────────────────────────────────────────
// POST /api/agent/start
// Replaces: Agora ConvAI REST API → Gemini Live config + Firebase RTDB session storage
// ────────────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body: AgentStartRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { channelName, userUid, userName, userRole, scenario, language } = body;

    if (!channelName || typeof channelName !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid channelName' },
        { status: 400 }
      );
    }

    // ── Validate Gemini API key (required for Gemini Live agent) ──────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || !geminiKey.startsWith('AIza') || geminiKey.includes('AIza...')) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured. Set a valid key to start the AURA voice agent.' },
        { status: 500 }
      );
    }

    // ── Determine dynamic origin ──────────────────────────────────────────────
    const hostHeader =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      '';
    const protoHeader = request.headers.get('x-forwarded-proto') || 'https';
    const dynamicOrigin = hostHeader
      ? `${protoHeader}://${hostHeader}`
      : 'https://aura.akanksha.dev';

    const isLocalhostRequest =
      !hostHeader || hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');

    // ── MCP endpoint probe ────────────────────────────────────────────────────
    const resolvedMcpUrl = !isLocalhostRequest
      ? `${dynamicOrigin}/api/mcp/sse`
      : (process.env.MCP_URL && !process.env.MCP_URL.includes('your_mcp_url')
        ? process.env.MCP_URL
        : '');

    let isMcpReachable = false;
    if (resolvedMcpUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        const testRes = await fetch(resolvedMcpUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        if (testRes.status < 500) isMcpReachable = true;
        else console.warn(`[AgentStart] MCP URL returned HTTP ${testRes.status}. Omitting mcp_servers.`);
      } catch {
        console.warn(`[AgentStart] MCP URL unreachable at ${resolvedMcpUrl}.`);
      }
    }

    const mcpEndpointWithChannel = isMcpReachable
      ? `${resolvedMcpUrl}?channel=${encodeURIComponent(channelName)}`
      : '';

    // ── Scenario resolution ───────────────────────────────────────────────────
    const cleanChannel = channelName.trim().toLowerCase();
    const matchedPreset = PRESET_SCENARIOS.find(
      (s) =>
        s.channelName.toLowerCase() === cleanChannel ||
        s.id.toLowerCase() === cleanChannel ||
        cleanChannel.includes(s.id.toLowerCase())
    );

    const effectiveScenario = scenario || (matchedPreset ? {
      title: matchedPreset.title,
      severity: matchedPreset.severity,
      affectedServices: matchedPreset.affectedServices,
      description: matchedPreset.description,
      impact: matchedPreset.impact,
      suspectedCause: matchedPreset.suspectedCause,
      personas: matchedPreset.personas,
      playbook: matchedPreset.playbook,
    } : undefined);

    const scenarioOverrides = effectiveScenario ? {
      title: effectiveScenario.title,
      severity: effectiveScenario.severity as 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3' | undefined,
      affectedServices: effectiveScenario.affectedServices,
      description: effectiveScenario.description,
      impact: effectiveScenario.impact,
      suspectedCause: effectiveScenario.suspectedCause,
    } : undefined;

    // ── Initialize incident store ─────────────────────────────────────────────
    if (userUid) {
      initializeLiveIncident(channelName, {
        uid: userUid,
        displayName: userName || userUid,
        role: userRole || 'Incident Responder',
      }, scenarioOverrides);
    }

    const liveIncidentState = getIncidentState(channelName);
    const effectiveSystemPrompt = buildEffectiveSystemPrompt({
      incidentState: liveIncidentState,
      scenario: effectiveScenario,
      operatorUid: userUid,
    });

    // ── Build dynamic greeting ────────────────────────────────────────────────
    const responderName = userName || 'Responder';
    const greetingSeverity = effectiveScenario?.severity || 'SEV-1';
    const greetingTitle = effectiveScenario?.title || 'active incident';
    const affectedSvcs = effectiveScenario?.affectedServices?.length
      ? ` on ${effectiveScenario.affectedServices.slice(0, 2).join(' and ')}`
      : '';
    const dynamicGreeting = `Hey ${responderName}, AURA's online and on the bridge. We've got a ${greetingSeverity} — ${greetingTitle}${affectedSvcs}. I'm monitoring all telemetry. What's the latest from your end?`;

    // ── Gemini Live config (replaces Agora ConvAI payload) ───────────────────
    const agentId = `aura-${channelName.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now().toString(36)}`;

    const geminiConfig = {
      model: 'gemini-2.0-flash-live-001',
      systemInstruction: effectiveSystemPrompt,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Journey' },
          },
        },
        temperature: 0.12,
        maxOutputTokens: 512,
      },
    };

    const allMcpTools = [
      'log_fact', 'log_hypothesis', 'log_decision', 'log_action_item',
      'flag_conflict', 'create_jira_ticket', 'post_slack_update',
      'page_oncall_team', 'search_past_incidents', 'get_incident_history',
    ];

    // ── Store Gemini session config in Firebase RTDB ──────────────────────────
    // Replaces: Agora POST /join — stores config so client can establish Gemini Live WebSocket
    try {
      const { adminDb } = await import('@/lib/firebaseAdmin');
      const { ref, set, push } = await import('firebase-admin/database');

      await set(ref(adminDb, `sessions/${channelName}`), {
        agentId,
        channelName,
        status: 'starting',
        createdAt: Date.now(),
        geminiConfig,
        geminiApiKey: geminiKey, // Client reads this to open Live WebSocket
        greeting: dynamicGreeting,
        language: language || 'en-IN',
        mcpEndpoint: mcpEndpointWithChannel,
        mcpTools: mcpEndpointWithChannel ? allMcpTools : [],
        userUid: userUid || null,
        userName: userName || null,
        userRole: userRole || null,
        scenario: effectiveScenario || null,
      });

      await push(ref(adminDb, `channels/${channelName}/events`), {
        id: `evt-agent-started-${Date.now()}`,
        seq: Date.now(),
        timestamp: Date.now(),
        type: 'dashboard_event',
        eventType: 'agent_joined',
        customType: 'dashboard_event',
        payload: { agentId, channelName, greeting: dynamicGreeting },
      });
    } catch (firebaseErr) {
      console.error('[AgentStart] Firebase session write error:', firebaseErr);
      return NextResponse.json(
        { error: 'Failed to initialize Firebase session', details: firebaseErr instanceof Error ? firebaseErr.message : String(firebaseErr) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      agentId,
      agent_id: agentId,
      channelName,
      status: 'started',
      greeting: dynamicGreeting,
      stack: {
        llm: 'gemini-live',
        tts: 'gemini-live-journey',
        asr: 'gemini-live-builtin',
        vad: 'gemini-live-builtin',
        transport: 'firebase-rtdb',
        mcp: mcpEndpointWithChannel ? 'enabled' : 'disabled',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start AURA agent',
      },
      { status: 500 }
    );
  }
}
