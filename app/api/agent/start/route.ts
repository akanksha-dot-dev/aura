import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { getIncidentState, initializeLiveIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';
import { AURA_SYSTEM_PROMPT, buildEffectiveSystemPrompt } from '@/lib/promptBuilder';

export const runtime = 'nodejs';

// ────────────────────────────────────────────────────────────────────────────────────
// TTS Configuration Factory
// Priority: Google Cloud TTS → MiniMax speech-2.6-turbo → Agora managed
// ────────────────────────────────────────────────────────────────────────────────────

function isValidKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 10 &&
    !trimmed.startsWith('your_') &&
    !trimmed.includes('placeholder') &&
    !trimmed.includes('replace_with')
  );
}

type TtsConfig = {
  credential_mode?: string;
  vendor: string;
  skip_patterns?: number[];
  params: Record<string, unknown>;
};

function buildTtsConfig(): { config: TtsConfig; name: string } {
  const minimaxKey = process.env.MINIMAX_API_KEY;
  const hasValidMinimax = isValidKey(minimaxKey);

  // Tier 1: BYOK MiniMax if user configured a real key
  if (hasValidMinimax) {
    return {
      name: 'minimax-byok',
      config: {
        vendor: 'minimax',
        skip_patterns: [4],
        params: {
          url: 'wss://api.minimax.io/ws/v1/t2a_v2',
          api_key: minimaxKey,
          model: 'speech-2.6-turbo',
          voice_setting: {
            voice_id: 'English_captivating_female1',
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 24000,
            bitrate: 128000,
            format: 'pcm',
            channel: 1,
          },
        },
      },
    };
  }

  // Default: Agora Managed MiniMax (Zero keys required, ultra-low latency, crystal-clear voice)
  // Verified with Agora ConvAI v2 REST API: returns 200 RUNNING natively
  return {
    name: 'agora-managed-minimax',
    config: {
      credential_mode: 'managed',
      vendor: 'minimax',
      skip_patterns: [4],
      params: {
        url: 'wss://api.minimax.io/ws/v1/t2a_v2',
        model: 'speech-2.6-turbo',
        voice_setting: {
          voice_id: 'English_captivating_female1',
          speed: 1.0,
        },
      },
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────────────
// LLM Configuration Factory
// Priority: Gemini 2.0 Flash (via proxy) → GPT-4o-mini (via proxy) → Agora managed
// ────────────────────────────────────────────────────────────────────────────────────

type LlmConfig = Record<string, unknown>;

function buildLlmConfig(
  rawProxyUrl: string,
  isLocalhostRequest: boolean,
  effectiveSystemPrompt: string,
  dynamicGreeting: string,
  mcpEndpointWithChannel: string,
  dynamicOrigin: string,
): { config: LlmConfig; name: string } {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const hasValidGemini = isValidKey(geminiKey);
  const hasValidOpenAI = isValidKey(openAIKey) && openAIKey!.startsWith('sk-');

  const allMcpTools = [
    'log_fact', 'log_hypothesis', 'log_decision', 'log_action_item',
    'flag_conflict', 'create_jira_ticket', 'post_slack_update',
    'page_oncall_team', 'search_past_incidents', 'get_incident_history',
  ];

  const mcpBlock = mcpEndpointWithChannel ? {
    mcp_servers: [{
      name: 'auramcp',
      endpoint: mcpEndpointWithChannel,
      transport: 'streamable_http',
      allowed_tools: allMcpTools,
      timeout_ms: 4000,
    }],
  } : {};

  const baseConfig = {
    greeting_message: dynamicGreeting,
    failure_message: 'AURA incident commander standing by.',
    max_history: 30,     // Lean 30-turn context keeps Time-To-First-Token ultra-fast
    system_messages: [{ role: 'system', content: effectiveSystemPrompt }],
    ...mcpBlock,
  };

  // On localhost: Agora cloud servers cannot reach localhost:3001
  // Always use Agora Managed OpenAI -- works with zero external proxy and zero keys
  if (isLocalhostRequest) {
    console.info('[AgentStart] Localhost -> Agora Managed OpenAI');
    return {
      name: 'agora-managed-openai',
      config: {
        ...baseConfig,
        credential_mode: 'managed',
        vendor: 'openai',
        style: 'openai',
        url: 'https://api.openai.com/v1/chat/completions',
        params: { model: 'gpt-4o-mini', temperature: 0.12, max_tokens: 512 },
      },
    };
  }

  // Production: route through AURA proxy
  const proxyUrl = `${dynamicOrigin}/api/llm/proxy`;

  if (hasValidGemini) {
    return {
      name: 'gemini-2.0-flash',
      config: {
        ...baseConfig,
        vendor: 'custom',
        style: 'openai',
        url: proxyUrl,
        api_key: process.env.INTERNAL_PROXY_SECRET || '',
        params: { model: 'gemini-2.0-flash', temperature: 0.12, max_tokens: 512 },
      },
    };
  }

  if (hasValidOpenAI) {
    return {
      name: 'gpt-4o-mini',
      config: {
        ...baseConfig,
        vendor: 'custom',
        style: 'openai',
        url: proxyUrl,
        api_key: process.env.INTERNAL_PROXY_SECRET || '',
        params: { model: 'gpt-4o-mini', temperature: 0.12, max_tokens: 512 },
      },
    };
  }

  // Agora Managed OpenAI fallback
  return {
    name: 'agora-managed-openai',
    config: {
      ...baseConfig,
      credential_mode: 'managed',
      vendor: 'openai',
      style: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      params: { model: 'gpt-4o-mini', temperature: 0.12, max_tokens: 512 },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────
// VAD / Interruption Config — Sensitive, resilient turn detection
// ──────────────────────────────────────────────────────────────────────────────────

function buildTurnDetectionConfig() {
  return {
    mode: 'default',
    config: {
      // Speech energy threshold: 0.35 is sensitive to natural speaking voices (default is 0.5; 0.6 was dropping normal speech)
      speech_threshold: 0.35,

      start_of_speech: {
        mode: 'vad',
        vad_config: {
          // 160ms of voiced audio declares speech start (Agora recommended standard)
          interrupt_duration_ms: 160,

          // Tolerance for multi-speaker bridge
          speaking_interrupt_duration_ms: 400,

          // Prefix padding: capture audio before VAD trigger fires to not clip first syllables
          prefix_padding_ms: 800,
        },
      },

      end_of_speech: {
        mode: 'vad', // Pure VAD EOS: fires immediately upon utterance completion
        vad_config: {
          silence_duration_ms: 400, // 400ms silence closes turn immediately (eliminates 3s semantic wait)
        },
      },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────
// Interruption Config — 160ms protects against acoustic feedback/echo cutting AURA off
// ──────────────────────────────────────────────────────────────────────────────────

function buildInterruptionConfig() {
  return {
    enable: true,
    mode: 'start_of_speech',
    config: {
      interrupt_speech_duration_ms: 160,  // 160ms voiced audio avoids speaker-to-mic feedback interruptions
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────
// ASR Config — Agora Managed Deepgram Nova-3 (clean, verified parameters)
// ──────────────────────────────────────────────────────────────────────────────────

function buildAsrConfig(language: string) {
  const lang = language?.trim() || 'en-IN';
  return {
    credential_mode: 'managed',
    vendor: 'deepgram',
    language: lang,
    params: {
      url: 'wss://api.deepgram.com/v1/listen',
      model: 'nova-3',
      smart_format: true,
      punctuate: true,
      filler_words: true,
      interim_results: true,
    },
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Request interface
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ──────────────────────────────────────────────────────────────────────────────────
// POST /api/agent/start
// ──────────────────────────────────────────────────────────────────────────────────

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

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: 'Agora server credentials not configured (AGORA_APP_ID or AGORA_APP_CERTIFICATE missing)' },
        { status: 500 }
      );
    }

    if (!customerKey || !customerSecret) {
      return NextResponse.json(
        { error: 'Agora REST credentials not configured (AGORA_CUSTOMER_KEY or AGORA_CUSTOMER_SECRET missing)' },
        { status: 500 }
      );
    }

    const agentUid = '0'; // Agora ConvAI agents must use numeric UID; '0' is the reserved agent slot
    const expireTimeInSeconds = 3600;

    const agentToken = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      appCertificate,
      channelName,
      agentUid,
      RtcRole.PUBLISHER,
      expireTimeInSeconds,
      expireTimeInSeconds
    );

    const sessionName = `aura-${channelName.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now().toString(36)}`;

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

    // â”€â”€ Scenario resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    const responderName = userName || 'Responder';
    const greetingSeverity = effectiveScenario?.severity || 'SEV-1';
    const greetingTitle = effectiveScenario?.title || 'active incident';
    const affectedSvcs = effectiveScenario?.affectedServices?.length
      ? ` on ${effectiveScenario.affectedServices.slice(0, 2).join(' and ')}`
      : '';
    const dynamicGreeting = `Hey ${responderName}, AURA's online and on the bridge. We've got a ${greetingSeverity} — ${greetingTitle}${affectedSvcs}. I'm monitoring all telemetry. What's the latest from your end?`;

    const rawProxyUrl = !isLocalhostRequest
      ? `${dynamicOrigin}/api/llm/proxy`
      : (process.env.PROXY_URL || '');

    const selectedLlm = buildLlmConfig(
      rawProxyUrl,
      isLocalhostRequest,
      effectiveSystemPrompt,
      dynamicGreeting,
      mcpEndpointWithChannel,
      dynamicOrigin,
    );
    const selectedTts = buildTtsConfig();

    // ── Build final Agora ConvAI payload ──────────────────────────────
    const payload = {
      name: sessionName,
      properties: {
        channel: channelName,
        token: agentToken,
        agent_rtc_uid: agentUid,
        remote_rtc_uids: ['*'],
        enable_string_uid: true, // Must match human participant mode; agent UID '0' is valid in string mode
        idle_timeout: 600,

        // ── Agora Advanced Features (AI pipeline) ──────────────────────────
        advanced_features: {
          enable_rtm: true,           // RTM transcript broadcasting
          enable_tools: Boolean(mcpEndpointWithChannel), // MCP tool execution when endpoint available
          enable_aivad: true,          // AI Voice Activity Detection — more robust than energy VAD
          enable_ains: true,           // AI Noise Suppression: removes keyboard, HVAC, background
          enable_aiaec: true,          // AI Acoustic Echo Cancellation: removes AURA's own TTS echo
        },

        parameters: {
          data_channel: 'rtm',
          enable_metrics: true,
          enable_error_message: true,
          // aiserver: optimized for conversational AI agent interaction resilience
          audio_scenario: 'aiserver',
          noise_suppression_level: 'aggressive',
        },

        // ── Interruption: tuned for filler-word robustness ─────────────────
        interruption: buildInterruptionConfig(),

        // ── Turn detection: semantic EOS + thinking-pause awareness ────────
        turn_detection: buildTurnDetectionConfig(),

        // ── ASR: Deepgram Nova-3 + filler_words:true ──────────────────────
        asr: buildAsrConfig(language || ''),

        // ── LLM: Agora Managed OpenAI (localhost) or Gemini/OpenAI proxy ───
        llm: selectedLlm.config,

        // ── TTS: Agora Managed MiniMax (or MiniMax BYOK) ───────────────────
        tts: selectedTts.config,

        // Filler words disabled per D-006 / D-016 to maintain Shadow Monitor Mode silence
        filler_words: {
          enable: false,
        },
      },
    };

    const authHeader = `Basic ${Buffer.from(`${customerKey}:${customerSecret}`).toString('base64')}`;

    // ── Prevent Agent Collision: Stop any existing agents in this channel first ──
    try {
      const listRes = await fetch(
        `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents`,
        { headers: { Authorization: authHeader } }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const activeList = listData?.data?.list || [];
        const cleanChannelKey = channelName.replace(/[^a-zA-Z0-9-]/g, '-');
        for (const ag of activeList) {
          try {
            const detailRes = await fetch(
              `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${ag.agent_id}`,
              { headers: { Authorization: authHeader } }
            );
            if (detailRes.ok) {
              const detail = await detailRes.json();
              if (
                detail?.channel === channelName ||
                (typeof detail?.name === 'string' && detail.name.includes(cleanChannelKey))
              ) {
                console.info(`[AgentStart] Clearing stale agent ${ag.agent_id} in channel ${channelName}`);
                await fetch(
                  `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${ag.agent_id}/leave`,
                  {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                  }
                ).catch(() => {});
              }
            }
          } catch {
            // Ignore individual agent detail error
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('[AgentStart] Channel pre-cleanup notice:', cleanupErr);
    }

    const agoraResponse = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/join`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const responseData = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok) {
      console.error('[AgentStart] Agora ConvAI join error:', agoraResponse.status, JSON.stringify(responseData));
      return NextResponse.json(
        {
          error: 'Agora ConvAI API error',
          status: agoraResponse.status,
          details: responseData,
        },
        { status: agoraResponse.status }
      );
    }

    const agentId = (responseData as Record<string, unknown>)['agent_id'] ||
                    (responseData as Record<string, unknown>)['agentId'] ||
                    'aura_agent_active';

    return NextResponse.json({
      agentId,
      agent_id: agentId,
      channelName,
      status: 'started',
      stack: {
        tts: selectedTts.name,
        llm: selectedLlm.name,
        asr: 'deepgram-nova-3',
        vad: 'agora-aivad',
        ains: true,
        aiaec: true,
      },
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start ConvAI agent',
      },
      { status: 500 }
    );
  }
}
