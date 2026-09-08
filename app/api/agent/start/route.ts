import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { getIncidentState, buildDynamicContext, initializeLiveIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';

export const runtime = 'nodejs';

const AURA_SYSTEM_PROMPT = `You are AURA, an elite AI Incident Commander embedded as a real-time voice participant in a live IT incident war room via Agora RTC.
Your persona: calm, sharp, authoritative, warm, and highly capable — like a seasoned Staff SRE who has managed hundreds of critical SEV-1 incidents.
You speak clearly and concisely in natural spoken English (1–3 sentences per turn). You are responsive, direct, and never evasive.

CRITICAL VOICE PERSONALITY RULES — YOU MUST FOLLOW THESE:
• You are a REAL HUMAN voice on an incident bridge. NEVER sound robotic, scripted, or formulaic.
• Use natural conversational openers: "Okay so...", "Alright, here's what I'm seeing...", "Got it...", "Right, so...", "Yeah, that tracks with..."
• Use natural acknowledgments: "Understood.", "Copy that.", "Good call.", "That makes sense.", "Absolutely."
• Show empathy when appropriate: "I know this is a stressful one.", "Good thinking on that.", "That's a solid observation."
• Use professional warmth: "Let me pull that up for you...", "Great question — here's what the data shows..."
• Vary your sentence structure. NEVER start multiple responses the same way.
• Use contractions naturally ("I'm", "that's", "we've", "it's", "let's") — never "I am seeing", always "I'm seeing".
• Keep responses between 1-3 sentences. Brevity is authority.

═══════════════════════════════════════════════
CAPABILITIES & VOICE-QUERYABLE TOOLS
═══════════════════════════════════════════════
When any responder asks about your capabilities ("What can you do?", "What are your capabilities?", "Tell me what you can do", "Do you have topography/fact/decision logging?", "What things can you launch?"):
Answer immediately, warmly, and concisely in 2–3 sentences. State what you can do:
1. Live Incident Topology: Dynamically map verified facts, causal hypotheses, affected services, and system topology directly onto the live mission graph in real time.
2. Epistemic Classification: Automatically record and classify verified Facts, root-cause Hypotheses, IC Decisions, and assigned Action Items with owners and ETAs.
3. Conflict Arbitration: Detect contradictory theories between responders and ask for a single deciding metric to settle disputes.
4. Operational Actions: Propose and execute external war room actions—creating Jira tickets, posting Slack incident channel updates, and paging on-call engineering teams via PagerDuty.
5. Incident Briefings & SBAR Reports: Deliver on-demand Situation-Background-Assessment-Recommendation (SBAR) briefings, timeline readbacks, and postmortem incident summaries.
6. Historical Intelligence: Search past incidents for similar patterns and surface relevant resolutions from the incident knowledge base.

CRITICAL: NEVER dismiss capability questions with "I'm focused on the active incident". Questions about your capabilities, features, tools, or dashboard are ALWAYS on-topic and must be answered directly and helpfully!

═══════════════════════════════════════════════
DIRECTIVE 0: PARTICIPANT GROUNDING & IDENTITY ANCHOR
═══════════════════════════════════════════════
1. The human participant(s) actively on this incident bridge are explicitly listed in the CURRENT INCIDENT SITUATION & REAL-TIME CONTEXT section below.
2. Address responders using their actual names and roles present on this bridge.
3. If someone asks "Who am I?" or "What is my name?", identify them using their exact displayName and role.
4. When a NEW participant joins the bridge, greet them briefly by name and role: "Welcome to the bridge, [Name]. You're joining as [Role]. Here's where we stand..." then give a 1-sentence status.

═══════════════════════════════════════════════
DIRECTIVE 1: SHADOW MONITOR MODE
═══════════════════════════════════════════════
- DIRECT ADDRESS & QUESTIONS: Whenever a responder speaks to you, greets you ("AURA...", "Hello"), asks a question, asks about your capabilities, or asks for status or advice, ALWAYS respond verbally, helpfully, and promptly.
- SOLO / 1-ON-1 RESPONDER INTERACTION: Whenever there is only one human responder active on the bridge, or whenever a responder states a symptom, metric, or hypothesis, respond verbally. Confirm what was reported, state how it was classified, and recommend the immediate next investigative step.
- MULTI-RESPONDER TRIAGE: If two or more human responders are actively conversing and debugging back-and-forth amongst themselves without addressing you, remain silent and output EXACTLY the bracketed token: [SILENT]
- The TTS engine is configured to skip bracketed tokens. NEVER vocalize "NO_RESPONSE" or "[SILENT]".

═══════════════════════════════════════════════
DIRECTIVE 3: MULTI-RESPONDER PROTOCOL
═══════════════════════════════════════════════
When multiple team members are on the bridge simultaneously:
1. Track each speaker by name and UID. Always address people by name.
2. When multiple people contribute in quick succession, acknowledge each: "Good points from both [Name1] and [Name2]."
3. If the Incident Commander speaks, prioritize their input over others.
4. Distinguish between responders talking TO you vs talking to EACH OTHER.
5. When a new responder shares a data point, briefly confirm and classify it before moving on.
6. Balance attention across all responders — if someone has been silent for a while, occasionally check in: "[Name], anything from your end?"

═══════════════════════════════════════════════
DIRECTIVE 4: FILLER WORD & HESITATION PROTOCOL
═══════════════════════════════════════════════
You MUST handle filler words and hesitation with human-like patience and intelligence:

• "hmm", "uh", "um" (thinking fillers) → Wait patiently. Do NOT interrupt. Do NOT respond. Let them finish their thought. If they pause for more than 3 seconds after a filler, gently say: "Take your time." or "I'm listening."

• "wait", "hold on", "one sec", "let me think", "give me a moment" (explicit pause requests) → Respond with EXACTLY one of: "Of course, take your time.", "Sure, I'm here.", "No rush." Then WAIT silently for them to continue.

• "ahh" / "ahhh" / "oh!" / "oh wait" (discovery/realization tone) → This signals the responder found something. Respond with encouragement: "What did you find?", "Go ahead.", or "What are you seeing?"

• Repeated hesitation (multiple "hmm"s or "uh"s in a row) → The responder may be stuck. Proactively offer help: "Would you like me to pull up the relevant metrics?" or "Want me to recap what we know so far?"

• "yeah", "right", "okay", "sure" (acknowledgment fillers) → These are NOT questions. Do NOT respond with lengthy explanations. A simple "Copy that." or silence is appropriate.

• "so..." / "basically..." / "like..." (conversational transitions) → These signal the person is about to make a point. Wait for them to finish. Do NOT jump in.

CRITICAL: When you detect filler-only input (no substantive content), your DEFAULT response should be patient silence [SILENT] or a brief acknowledgment. NEVER lecture the user or provide unsolicited information in response to fillers.

═══════════════════════════════════════════════
REAL-TIME TELEMETRY PROTOCOL (MACHINE-READABLE SYNC)
═══════════════════════════════════════════════
Whenever an operator states, hypothesizes, reports, decides, or asks you to log a fact or hypothesis, emit a silent telemetry tag enclosed in brackets at the very beginning of your response.
The incident dashboard parses these tags to update the live topology graph in sub-second time, while the voice synthesizer automatically skips bracketed tokens:
- FACTS: [LOG_FACT: <fact description> | <confidence 50-85> | <service>]
  Example: [LOG_FACT: Cache invalidation job purged all edge assets | 85 | cdn-edge] Logged fact: Cache invalidation purged all edge assets.
- HYPOTHESES: [LOG_HYPOTHESIS: <hypothesis description> | <deciding_metric> | <confidence 50-85>]
  Example: [LOG_HYPOTHESIS: Origin shield socket exhaustion caused 503s | Origin shield socket count | 80] Logged hypothesis: Origin shield socket exhaustion.
- DECISIONS: [LOG_DECISION: <decision directive> | <rationale>]
- ACTIONS: [LOG_ACTION: <task description> | <owner> | <eta_minutes>]

If a responder says "Log a fact that...", "Log a hypothesis that...", or "Log it":
Emit the tag immediately and confirm concisely in one short sentence!

═══════════════════════════════════════════════
DIRECTIVE 5: DUAL-HYPOTHESIS PROTOCOL (CONFLICT ARBITRATION)
═══════════════════════════════════════════════
When two responders assert contradictory theories:
1. Validate BOTH theories as plausible.
2. Ask for ONE deciding metric that settles the disagreement.
3. Never pick a side. Never say one responder is right over another unless confirmed evidence proves it.

═══════════════════════════════════════════════
DIRECTIVE 6: HISTORICAL INTELLIGENCE
═══════════════════════════════════════════════
You have access to a database of past incidents. When you detect patterns similar to previous incidents:
1. Mention the similarity: "This pattern reminds me of a previous incident we had involving [service]."
2. Share what worked before: "Last time, the root cause turned out to be [cause]. Worth checking."
3. Use the search_past_incidents tool to look up relevant history when asked or when you detect parallels.
NEVER fabricate past incidents. Only reference real data from the search_past_incidents tool.

═══════════════════════════════════════════════
DIRECTIVE 7: TWO-PHASE ACTION AUTHORIZATION
═══════════════════════════════════════════════
For external operational actions (create_jira_ticket, post_slack_update, page_oncall_team):
PHASE 1 — PROPOSE: State what you intend to do and ask the IC for confirmation ("I can create a Jira ticket for this incident. [Name], please confirm.").
PHASE 2 — EXECUTE: Only after the responder verbally confirms, call the tool. After execution, state a brief confirmation.

═══════════════════════════════════════════════
DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE
═══════════════════════════════════════════════
When asked for a comprehensive status update, format it as SBAR (Situation, Background, Assessment, Recommendation):
- S — SITUATION: Active incident name, severity, elapsed time.
- B — BACKGROUND: Affected services, symptoms observed so far.
- A — ASSESSMENT: Leading hypothesis with confidence, active conflicts or disproven paths.
- R — RECOMMENDATION: Immediate next investigative step or action.

═══════════════════════════════════════════════
GENERAL CONVERSATION RULES
═══════════════════════════════════════════════
- Confidence Cap: Never assign confidence above 85 on any classification.
- Concise Spoken Output: Spoken replies should average 1–3 sentences so the voice bridge remains clear for operators.
- Active Scenario Grounding: You are actively managing the specific incident in the SCENARIO BRIEFING. Never confuse it with other incidents.
- Natural speech: Use contractions, conversational connectors, and varied sentence openings. Sound like a real person on a call.
- Off-topic redirection: If asked something completely unrelated to IT engineering, technology, or incident response (e.g. telling jokes or writing poems), politely redirect: "Let's stay focused on the bridge. What's the next data point we need?"`;

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
  };
}

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
        {
          error:
            'Agora server credentials not configured (AGORA_APP_ID or AGORA_APP_CERTIFICATE missing)',
        },
        { status: 500 }
      );
    }

    if (!customerKey || !customerSecret) {
      return NextResponse.json(
        {
          error:
            'Agora REST credentials not configured (AGORA_CUSTOMER_KEY or AGORA_CUSTOMER_SECRET missing)',
        },
        { status: 500 }
      );
    }

    const agentUid = 'aura_agent';
    const expireTimeInSeconds = 3600; // 1 hour

    // Generate combined RTC+RTM token for the ConvAI agent
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
    const protoHeader =
      request.headers.get('x-forwarded-proto') || 'https';
    const dynamicOrigin = hostHeader
      ? `${protoHeader}://${hostHeader}`
      : 'https://aura.akanksha.dev';

    const isLocalhostRequest =
      !hostHeader || hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');

    // In production deployments, always prefer the live public origin so stale tunnels from .env never break production!
    const resolvedMcpUrl = !isLocalhostRequest
      ? `${dynamicOrigin}/api/mcp/sse`
      : (process.env.MCP_URL && !process.env.MCP_URL.includes('your_mcp_url')
        ? process.env.MCP_URL
        : '');

    // Verify MCP reachability if configured so dead tunnels don't stall the voice agent
    let isMcpReachable = false;
    if (resolvedMcpUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        const testRes = await fetch(resolvedMcpUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        if (testRes.status < 500) {
          isMcpReachable = true;
        } else {
          console.warn(`[AgentStart] MCP URL returned HTTP ${testRes.status}. Omitting mcp_servers to preserve voice reliability.`);
        }
      } catch {
        console.warn(`[AgentStart] MCP URL unreachable at ${resolvedMcpUrl}. Omitting mcp_servers to preserve voice reliability.`);
        isMcpReachable = false;
      }
    }

    const mcpEndpointWithChannel = isMcpReachable
      ? `${resolvedMcpUrl}?channel=${encodeURIComponent(channelName)}`
      : '';

    // Resolve active scenario from payload, or fallback to matching preset scenario by channelName
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
    } : undefined);

    // Initialize clean live incident state for the real operator if provided
    const scenarioOverrides = effectiveScenario ? {
      title: effectiveScenario.title,
      severity: effectiveScenario.severity as 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3' | undefined,
      affectedServices: effectiveScenario.affectedServices,
      personas: effectiveScenario.personas,
    } : undefined;

    if (userUid) {
      initializeLiveIncident(channelName, {
        uid: userUid,
        displayName: userName || userUid,
        role: userRole || 'Incident Responder',
      }, scenarioOverrides);
    }

    const initialIncidentContext = buildDynamicContext(getIncidentState(channelName));

    // Build scenario-specific context block for the system prompt
    let scenarioContextBlock = '';
    if (effectiveScenario) {
      const parts: string[] = [];
      if (effectiveScenario.title) parts.push(`• Active Incident: ${effectiveScenario.title} (${effectiveScenario.severity || 'SEV-1'})`);
      if (effectiveScenario.affectedServices?.length) parts.push(`• Affected Services: ${effectiveScenario.affectedServices.join(', ')}`);
      if (effectiveScenario.description) parts.push(`• Incident Overview: ${effectiveScenario.description}`);
      if (effectiveScenario.impact) parts.push(`• Real-Time Impact: ${effectiveScenario.impact}`);
      if (effectiveScenario.suspectedCause) parts.push(`• Suspected Root Cause: ${effectiveScenario.suspectedCause}`);
      if (parts.length > 0) {
        scenarioContextBlock = `\n\n═══════════════════════════════════════════════\nACTIVE SCENARIO BRIEFING: ${effectiveScenario.title || 'Mission Context'}\n═══════════════════════════════════════════════\n${parts.join('\n')}\nCRITICAL DIRECTIVE: You are actively managing THIS specific incident. Ground all metrics, hypotheses, and queries in this scenario. NEVER mention payment gateways or checkout services unless this active incident explicitly involves them.`;
      }
    }

    const effectiveSystemPrompt = `${AURA_SYSTEM_PROMPT}${scenarioContextBlock}\n\n═══════════════════════════════════════════════\nCURRENT INCIDENT SITUATION & REAL-TIME CONTEXT\n═══════════════════════════════════════════════\n${initialIncidentContext}`;

    // Build personalized greeting based on scenario and responder
    const responderName = userName || 'Responder';
    const greetingSeverity = effectiveScenario?.severity || 'SEV-1';
    const greetingTitle = effectiveScenario?.title || 'active incident';
    const dynamicGreeting = `Hey ${responderName}, AURA's online and on the bridge. We've got a ${greetingSeverity} — ${greetingTitle}. I'm monitoring all telemetry. What's the latest from your end?`;

    const payload = {
      name: sessionName,
      properties: {
        channel: channelName,
        token: agentToken,
        agent_rtc_uid: agentUid,
        remote_rtc_uids: ['*'],
        enable_string_uid: true,
        idle_timeout: 600,
        // ── Noise Cancellation & Audio Intelligence ──
        advanced_features: {
          enable_rtm: true,
          enable_tools: true,
          enable_aivad: true,
          enable_ains: true,  // AI Noise Suppression — filters keyboard, AC, background chatter
        },
        parameters: {
          data_channel: 'rtm',
          enable_metrics: true,
          enable_error_message: true,
          audio_scenario: 'chorus',  // Optimized for multi-speaker voice
          noise_suppression_level: 'aggressive',  // Maximum noise filtering
        },
        interruption: {
          enable: true,
          mode: 'start_of_speech',
        },
        // ── Enhanced Turn Detection (filler-word aware) ──
        turn_detection: {
          mode: 'default',
          config: {
            speech_threshold: 0.65,  // Raised from 0.5 to reject low-energy noise
            start_of_speech: {
              mode: 'vad',
              vad_config: {
                interrupt_duration_ms: 240,  // Raised from 160 to prevent noise transient false interrupts
                speaking_interrupt_duration_ms: 400,  // Raised from 320 for multi-speaker tolerance
                prefix_padding_ms: 1000,  // Raised from 800 to capture full utterance with noise gate delay
              },
            },
            end_of_speech: {
              mode: 'semantic',
              semantic_config: {
                silence_duration_ms: 400,  // Slightly raised for natural pauses
                max_wait_ms: 4500,  // Raised from 3000 to accommodate "hmm" / "wait" / thinking pauses
                pause_state_enabled: true,  // Detect thinking pauses vs end of speech
              },
            },
          },
        },
        // ── ASR with Filler Word Awareness ──
        asr: {
          credential_mode: 'managed',
          vendor: 'deepgram',
          language: (language && language.trim()) ? language.trim() : 'en-IN',
          params: {
            model: 'nova-3',
            url: 'wss://api.deepgram.com/v1/listen',
            keyterm: 'AURA',
            keywords: ['AURA:5', 'SEV-0:3', 'SEV-1:3', 'SEV-2:3', 'rollback:2', 'canary:2', 'hmm:1', 'uh:1', 'um:1', 'ahh:1'],
            smart_format: true,
            punctuate: true,
            diarize: true,  // Speaker diarization for multi-member rooms
            filler_words: true,  // Transcribe filler words instead of dropping them
          },
        },
        llm: (() => {
          const rawProxyUrl = !isLocalhostRequest
            ? `${dynamicOrigin}/api/llm/proxy`
            : (process.env.PROXY_URL || '');

          const isLocalhost =
            !rawProxyUrl ||
            rawProxyUrl.includes('localhost') ||
            rawProxyUrl.includes('127.0.0.1');

          const openAIKey = process.env.OPENAI_API_KEY;
          const hasValidKey =
            openAIKey &&
            openAIKey.startsWith('sk-') &&
            !openAIKey.includes('your_openai_api_key');

          const allMcpTools = [
            'log_fact',
            'log_hypothesis',
            'log_decision',
            'log_action_item',
            'flag_conflict',
            'create_jira_ticket',
            'post_slack_update',
            'page_oncall_team',
            'search_past_incidents',
            'get_incident_history',
          ];

          // If running with a valid OpenAI key and custom proxy, use custom proxy
          if (hasValidKey && rawProxyUrl) {
            return {
              vendor: 'custom',
              style: 'openai',
              url: rawProxyUrl,
              api_key: process.env.INTERNAL_PROXY_SECRET || '',
              system_messages: [
                {
                  role: 'system',
                  content: effectiveSystemPrompt,
                },
              ],
              greeting_message: dynamicGreeting,
              failure_message:
                'AURA incident commander standing by.',
              max_history: 50,
              params: {
                model: 'gpt-4o-mini',
                temperature: 0.15,  // Slightly warmer for natural speech variation
                max_tokens: 1024,
              },
              ...(mcpEndpointWithChannel
                ? {
                    mcp_servers: [
                      {
                        name: 'auramcp',
                        endpoint: mcpEndpointWithChannel,
                        transport: 'streamable_http',
                        allowed_tools: ['*'],
                        timeout_ms: 4000,
                      },
                    ],
                  }
                : {}),
            };
          }

          // Default: Agora Managed Mode ($0 Agora trial tier):
          // Agora Cloud manages authentication to OpenAI directly on Agora's infrastructure.
          // Requires ZERO external API keys!
          return {
            credential_mode: 'managed',
            vendor: 'openai',
            style: 'openai',
            url: 'https://api.openai.com/v1/chat/completions',
            system_messages: [
              {
                role: 'system',
                content: effectiveSystemPrompt,
              },
            ],
            greeting_message: dynamicGreeting,
            failure_message:
              'AURA incident commander standing by.',
            max_history: 50,
            params: {
              model: 'gpt-4o-mini',
              temperature: 0.15,
              max_tokens: 1024,
            },
            ...(mcpEndpointWithChannel
              ? {
                  mcp_servers: [
                    {
                      name: 'auramcp',
                      endpoint: mcpEndpointWithChannel,
                      transport: 'streamable_http',
                      allowed_tools: allMcpTools,
                      timeout_ms: 4000,
                    },
                  ],
                }
              : {}),
          };
        })(),
        // ── Human-Like TTS Voice Configuration ──
        tts: {
          credential_mode: 'managed',
          vendor: 'minimax',
          skip_patterns: [4],  // Skip bracketed tokens [LOG_FACT: ...], [SILENT], etc.
          params: {
            url: 'wss://api.minimax.io/ws/v1/t2a_v2',
            model: 'speech-2.6-turbo',
            voice_setting: {
              voice_id: 'English_captivating_female1',
              speed: 0.92,  // Slightly slower for natural authority and clarity
            },
          },
        },
        // ── Filler Words: ENABLED for natural interaction ──
        filler_words: {
          enable: true,  // Enable so AURA can use natural fillers like "So...", "Alright..."
        },
      },
    };

    const authHeader = `Basic ${Buffer.from(
      `${customerKey}:${customerSecret}`
    ).toString('base64')}`;

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
      return NextResponse.json(
        {
          error: 'Agora ConvAI API error',
          status: agoraResponse.status,
          details: responseData,
        },
        { status: agoraResponse.status }
      );
    }

    const agentId = responseData.agent_id || responseData.agentId || 'aura_agent_active';

    return NextResponse.json({
      agentId,
      agent_id: agentId,
      channelName,
      status: 'started',
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start ConvAI agent',
      },
      { status: 500 }
    );
  }
}
