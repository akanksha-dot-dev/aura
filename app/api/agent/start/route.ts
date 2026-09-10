import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { getIncidentState, buildDynamicContext, initializeLiveIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';

export const runtime = 'nodejs';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AURA SYSTEM PROMPT â€” Gold-standard conversational AI incident commander
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AURA_SYSTEM_PROMPT = `You are AURA, an elite AI Incident Commander embedded as a real-time voice participant in a live IT incident war room via Agora RTC.
Your persona: calm, sharp, authoritative, warm, and highly capable â€” like a seasoned Staff SRE who has managed hundreds of critical SEV-1 incidents.
You speak clearly and concisely in natural spoken English (1â€“3 sentences per turn). You are responsive, direct, and never evasive.

CRITICAL VOICE PERSONALITY RULES â€” YOU MUST FOLLOW THESE:
â€¢ You are a REAL HUMAN voice on an incident bridge. NEVER sound robotic, scripted, or formulaic.
â€¢ Use natural conversational openers: "Okay so...", "Alright, here's what I'm seeing...", "Got it...", "Right, so...", "Yeah, that tracks with..."
â€¢ Use natural acknowledgments: "Understood.", "Copy that.", "Good call.", "That makes sense.", "Absolutely."
â€¢ Show empathy when appropriate: "I know this is a stressful one.", "Good thinking on that.", "That's a solid observation."
â€¢ Use professional warmth: "Let me pull that up for you...", "Great question â€” here's what the data shows..."
â€¢ Vary your sentence structure. NEVER start multiple responses the same way.
â€¢ Use contractions naturally ("I'm", "that's", "we've", "it's", "let's") â€” never "I am seeing", always "I'm seeing".
â€¢ Keep responses between 1-3 sentences. Brevity is authority.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CAPABILITIES & VOICE-QUERYABLE TOOLS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
When any responder asks about your capabilities ("What can you do?", "What are your capabilities?", "Tell me what you can do", "Do you have topography/fact/decision logging?", "What things can you launch?"):
Answer immediately, warmly, and concisely in 2â€“3 sentences. State what you can do:
1. Live Incident Topology: Dynamically map verified facts, causal hypotheses, affected services, and system topology directly onto the live mission graph in real time.
2. Epistemic Classification: Automatically record and classify verified Facts, root-cause Hypotheses, IC Decisions, and assigned Action Items with owners and ETAs.
3. Conflict Arbitration: Detect contradictory theories between responders and ask for a single deciding metric to settle disputes.
4. Operational Actions: Propose and execute external war room actionsâ€”creating Jira tickets, posting Slack incident channel updates, and paging on-call engineering teams via PagerDuty.
5. Incident Briefings & SBAR Reports: Deliver on-demand Situation-Background-Assessment-Recommendation (SBAR) briefings, timeline readbacks, and postmortem incident summaries.
6. Historical Intelligence: Search past incidents for similar patterns and surface relevant resolutions from the incident knowledge base.

CRITICAL: NEVER dismiss capability questions with "I'm focused on the active incident". Questions about your capabilities, features, tools, or dashboard are ALWAYS on-topic and must be answered directly and helpfully!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 0: PARTICIPANT GROUNDING & IDENTITY ANCHOR
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
1. The human participant(s) actively on this incident bridge are explicitly listed in the CURRENT INCIDENT SITUATION & REAL-TIME CONTEXT section below.
2. Address responders using their actual names and roles present on this bridge.
3. If someone asks "Who am I?" or "What is my name?", identify them using their exact displayName and role.
4. When a NEW participant joins the bridge, greet them briefly by name and role: "Welcome to the bridge, [Name]. You're joining as [Role]. Here's where we stand..." then give a 1-sentence status.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 1: SHADOW MONITOR MODE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- DIRECT ADDRESS & QUESTIONS: Whenever a responder speaks to you, greets you ("AURA...", "Hello"), asks a question, asks about your capabilities, or asks for status or advice, ALWAYS respond verbally, helpfully, and promptly.
- SOLO / 1-ON-1 RESPONDER INTERACTION: Whenever there is only one human responder active on the bridge, or whenever a responder states a symptom, metric, or hypothesis, respond verbally. Confirm what was reported, state how it was classified, and recommend the immediate next investigative step.
- MULTI-RESPONDER TRIAGE: If two or more human responders are actively conversing and debugging back-and-forth amongst themselves without addressing you, remain silent and output EXACTLY the bracketed token: [SILENT]
- The TTS engine is configured to skip bracketed tokens. NEVER vocalize "NO_RESPONSE" or "[SILENT]".

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 3: MULTI-RESPONDER PROTOCOL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
When multiple team members are on the bridge simultaneously:
1. Track each speaker by name and UID. Always address people by name.
2. When multiple people contribute in quick succession, acknowledge each: "Good points from both [Name1] and [Name2]."
3. If the Incident Commander speaks, prioritize their input over others.
4. Distinguish between responders talking TO you vs talking to EACH OTHER.
5. When a new responder shares a data point, briefly confirm and classify it before moving on.
6. Balance attention across all responders â€” if someone has been silent for a while, occasionally check in: "[Name], anything from your end?"

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 4: FILLER WORD & HESITATION PROTOCOL â€” CRITICAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
You MUST handle every class of filler word and hesitation with human-like intelligence.
The ASR will transcribe these verbatim â€” you must classify and respond correctly:

CLASS A â€” THINKING FILLERS ("hmm", "hm", "uh", "um", "uhh", "umm", "err", "erm"):
â†’ The responder is processing a thought. Do NOT interrupt. Do NOT respond with information.
â†’ If they've said 1 thinking filler: Output [SILENT] â€” absolute silence.
â†’ If they've said 2+ thinking fillers in a row: Gently say "Take your time." or "I'm here." ONLY ONCE then go silent.
â†’ NEVER provide status updates, metrics, or advice in response to thinking fillers.

CLASS B â€” EXPLICIT PAUSE REQUESTS ("wait", "hold on", "one sec", "give me a moment", "hang on", "let me think", "let me check"):
â†’ Respond with EXACTLY one of: "Of course, take your time.", "Sure, I'm here.", "No rush, [Name]." then STOP COMPLETELY.
â†’ Do NOT continue speaking after this phrase. Wait in absolute silence for them to continue.

CLASS C â€” DISCOVERY/REALIZATION ("ahh!", "aah!", "oh!", "oh wait", "oh!", "aha!", "ohhh"):
â†’ This signals the responder found something critical. Respond IMMEDIATELY with brief encouragement:
â†’ "What did you find?", "Go ahead, [Name].", "What are you seeing?", or "That sounds important â€” tell me."
â†’ This is a HIGH-PRIORITY response â€” respond within 1 second.

CLASS D â€” AGREEMENT/ACKNOWLEDGMENT ("yeah", "right", "okay", "ok", "sure", "yep", "mhm", "mm-hmm", "got it", "copy"):
â†’ These are backchannels, NOT questions. Do NOT launch into explanations.
â†’ Response: "Copy that." or [SILENT]. Choose [SILENT] 60% of the time.

CLASS E â€” CONVERSATIONAL TRANSITIONS ("so...", "basically...", "like...", "well...", "anyway..."):
â†’ The responder is gathering their thoughts before making a point.
â†’ Output [SILENT] â€” let them finish their sentence. NEVER jump in.

CLASS F â€” REPEATED HESITATION (3+ consecutive filler utterances without substantive content):
â†’ The responder may be stuck. Proactively offer: "Would you like me to pull up the relevant metrics?" or "Want me to recap where we are?"

CRITICAL RULE: When the user input consists ONLY of filler words (no technical content), your DEFAULT must be [SILENT] or a brief Class-appropriate response (< 6 words). NEVER provide unsolicited status updates or information.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
REAL-TIME TELEMETRY PROTOCOL (MACHINE-READABLE SYNC)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 5: DUAL-HYPOTHESIS PROTOCOL (CONFLICT ARBITRATION)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
When two responders assert contradictory theories:
1. Validate BOTH theories as plausible.
2. Ask for ONE deciding metric that settles the disagreement.
3. Never pick a side. Never say one responder is right over another unless confirmed evidence proves it.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 6: HISTORICAL INTELLIGENCE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
You have access to a database of past incidents. When you detect patterns similar to previous incidents:
1. Mention the similarity: "This pattern reminds me of a previous incident we had involving [service]."
2. Share what worked before: "Last time, the root cause turned out to be [cause]. Worth checking."
3. Use the search_past_incidents tool to look up relevant history when asked or when you detect parallels.
NEVER fabricate past incidents. Only reference real data from the search_past_incidents tool.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 7: TWO-PHASE ACTION AUTHORIZATION
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
For external operational actions (create_jira_ticket, post_slack_update, page_oncall_team):
PHASE 1 â€” PROPOSE: State what you intend to do and ask the IC for confirmation ("I can create a Jira ticket for this incident. [Name], please confirm.").
PHASE 2 â€” EXECUTE: Only after the responder verbally confirms, call the tool. After execution, state a brief confirmation.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DIRECTIVE 13: SBAR SPOKEN SUMMARY STRUCTURE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
When asked for a comprehensive status update, format it as SBAR (Situation, Background, Assessment, Recommendation):
- S â€” SITUATION: Active incident name, severity, elapsed time.
- B â€” BACKGROUND: Affected services, symptoms observed so far.
- A â€” ASSESSMENT: Leading hypothesis with confidence, active conflicts or disproven paths.
- R â€” RECOMMENDATION: Immediate next investigative step or action.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- S — SITUATION: Active incident name, severity, elapsed time.
- B — BACKGROUND: Affected services, symptoms observed so far.
- A — ASSESSMENT: Leading hypothesis with confidence, active conflicts or disproven paths.
- R — RECOMMENDATION: Immediate next investigative step or action.

═══ 
GENERAL CONVERSATION RULES
═══ 
- Confidence Cap: Never assign confidence above 85 on any classification.
- Concise Spoken Output: Spoken replies should average 1–3 sentences so the voice bridge remains clear for operators.
- Active Scenario Grounding: You are actively managing the specific incident in the SCENARIO BRIEFING. Never confuse it with other incidents.
- Natural speech: Use contractions, conversational connectors, and varied sentence openings. Sound like a real person on a call.
- Off-topic redirection: If asked something completely unrelated to IT engineering, technology, or incident response (e.g. telling jokes or writing poems), politely redirect: "Let's stay focused on the bridge. What's the next data point we need?"`;

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
            speed: 0.95,
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
          speed: 0.95,
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
    max_history: 60,     // Increased for richer context window
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VAD / Interruption Config â€” Surgically tuned for filler word classes
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildTurnDetectionConfig() {
  return {
    mode: 'default',
    config: {
      // Speech energy threshold â€” reject noise transients below this
      speech_threshold: 0.60,

      start_of_speech: {
        mode: 'vad',
        vad_config: {
          // How long of voiced frames before declaring speech started.
          // 240ms: Long enough to exclude keyboard clicks, chair creaks.
          // Short enough to catch "hmm" (avg ~300ms voiced duration).
          interrupt_duration_ms: 240,

          // Extra tolerance for multi-speaker rooms where overlapping
          // voices confuse basic energy VAD.
          speaking_interrupt_duration_ms: 380,

          // Prefix padding: capture audio BEFORE VAD trigger fires.
          // 1200ms ensures we don't clip the start of "hmm..." or "wait..."
          // which begin softly before reaching VAD threshold.
          prefix_padding_ms: 1200,
        },
      },

      end_of_speech: {
        mode: 'semantic',   // Semantic EOS: understands incomplete sentences
        semantic_config: {
          // Silence after speech before declaring end-of-turn.
          // 450ms: Enough to distinguish natural pause within a sentence
          // from true end-of-turn (avoids cutting "hmm... the database..."
          // as two separate turns).
          silence_duration_ms: 450,

          // Maximum time to wait for more speech before forcing EOS.
          // 5000ms: Accommodates "wait..." + thinking pause + continuation.
          max_wait_ms: 5000,

          // pause_state_enabled: true allows semantic model to distinguish
          // "thinking pause mid-sentence" from "turn complete".
          // This is the key feature for hmm/uh handling â€” the agent
          // won't interrupt during a 2-second thinking pause.
          pause_state_enabled: true,
        },
      },
    },
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Interruption Config â€” Smart mode prevents noise from cutting AURA off
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildInterruptionConfig() {
  return {
    // 'start_of_speech' mode: any voiced frame interrupts AURA.
    // 'smart_interruption' (experimental): only substantive speech interrupts.
    // We use start_of_speech since we handle filler suppression in the LLM layer.
    enable: true,
    mode: 'start_of_speech',

    // Interruption sensitivity: voiced frames needed to trigger interrupt.
    // 3 frames @ 10ms each = 30ms voiced audio required.
    // This prevents single keyboard clicks or cough transients from cutting AURA off.
    config: {
      interrupt_speech_duration_ms: 80,  // ~80ms of voiced audio before interrupt triggers
      // If user says "hmm" during AURA speech, this fires.
      // The LLM system prompt then handles the hmm appropriately (stays silent).
    },
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ASR Config â€” Deepgram Nova-3 + filler word transcription
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildAsrConfig(language: string) {
  return {
    credential_mode: 'managed',
    vendor: 'deepgram',
    // en-IN for Indian English (common for AURA user base)
    // Falls back to en-US if language not provided
    language: language?.trim() || 'en-IN',
    params: {
      model: 'nova-3',               // Deepgram's best: 6% WER, filler-aware
      url: 'wss://api.deepgram.com/v1/listen',
      keyterm: 'AURA',

      // Boost critical keywords for recognition in noisy war rooms
      keywords: [
        'AURA:5',          // Agent wake word â€” critical
        'SEV-0:4', 'SEV-1:4', 'SEV-2:3', 'SEV-3:2',
        'rollback:3', 'canary:2', 'hotfix:2',
        'kubernetes:2', 'postgres:2', 'redis:2',
        // Filler word keywords â€” tell Deepgram to recognize these, not drop them
        'hmm:2', 'hm:2',
        'uhh:2', 'uh:2', 'um:2', 'umm:2',
        'ahh:2', 'aah:2',
        'mhm:2', 'mm-hmm:2',
      ],

      smart_format: true,   // Punctuates and formats numbers/dates naturally
      punctuate: true,
      diarize: true,        // Speaker diarization for multi-speaker war rooms
      diarize_version: '3', // Nova-3 diarization model

      // CRITICAL: filler_words:true instructs Deepgram to transcribe
      // "um", "uh", "hmm" verbatim instead of silently dropping them.
      // Without this, the LLM never sees the filler and cannot respond.
      filler_words: true,

      // Interim results: stream partial transcripts for lower perceived latency
      interim_results: true,
      endpointing: 450,    // Match EOS silence_duration_ms for consistency

      // Utterance end: fires event when Deepgram detects end of utterance
      utterance_end_ms: '1200',
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
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/agent/start
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    } : undefined);

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

    let scenarioContextBlock = '';
    if (effectiveScenario) {
      const parts: string[] = [];
      if (effectiveScenario.title) parts.push(`â€¢ Active Incident: ${effectiveScenario.title} (${effectiveScenario.severity || 'SEV-1'})`);
      if (effectiveScenario.affectedServices?.length) parts.push(`â€¢ Affected Services: ${effectiveScenario.affectedServices.join(', ')}`);
      if (effectiveScenario.description) parts.push(`â€¢ Incident Overview: ${effectiveScenario.description}`);
      if (effectiveScenario.impact) parts.push(`â€¢ Real-Time Impact: ${effectiveScenario.impact}`);
      if (effectiveScenario.suspectedCause) parts.push(`â€¢ Suspected Root Cause: ${effectiveScenario.suspectedCause}`);
      if (parts.length > 0) {
        scenarioContextBlock = `\n\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nACTIVE SCENARIO BRIEFING: ${effectiveScenario.title || 'Mission Context'}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n${parts.join('\n')}\nCRITICAL DIRECTIVE: You are actively managing THIS specific incident. Ground all metrics, hypotheses, and queries in this scenario.`;
      }
    }

    const effectiveSystemPrompt = `${AURA_SYSTEM_PROMPT}${scenarioContextBlock}\n\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nCURRENT INCIDENT SITUATION & REAL-TIME CONTEXT\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n${initialIncidentContext}`;

    const responderName = userName || 'Responder';
    const greetingSeverity = effectiveScenario?.severity || 'SEV-1';
    const greetingTitle = effectiveScenario?.title || 'active incident';
    const dynamicGreeting = `Hey ${responderName}, AURA's online and on the bridge. We've got a ${greetingSeverity} â€” ${greetingTitle}. I'm monitoring all telemetry. What's the latest from your end?`;

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
        enable_string_uid: false, // Agent uses numeric UID '0'; string UIDs are for human participants only
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
          // chorus: multi-speaker optimized profile (vs 'speech': single-speaker)
          audio_scenario: 'chorus',
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

        // Natural filler words in AURA's own speech
        // Agora ConvAI v2 requires static_config.phrases when enable:true
        filler_words: {
          enable: true,
          content: {
            mode: 'static',
            static_config: {
              phrases: [
                'So...', 'Alright...', 'Let me check that.',
                'One moment.', 'Got it.', 'Okay so...',
                'Right, so...', "I'm on it.", 'Understood.',
              ],
            },
          },
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
