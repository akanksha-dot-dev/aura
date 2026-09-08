import { NextRequest, NextResponse } from 'next/server';
import { addEvidenceToIncident, updateIncidentState, getIncidentState } from '@/lib/incidentStore';
import { publishDashboardEvent, createDashboardEvent } from '@/lib/rtmPublisher';
import { buildDynamicContext } from '@/lib/incidentStore';

export const runtime = 'nodejs';

/**
 * POST /api/meet/audio
 *
 * Receives audio chunks from the AURA Chrome Extension (Google Meet integration).
 * Processes transcript text, runs it through the AURA incident commander LLM proxy,
 * logs evidence, and returns AURA's spoken response.
 *
 * Body: multipart/form-data OR JSON
 *   {
 *     transcript?: string        — pre-transcribed text (if client handles STT)
 *     speakerName?: string       — speaker display name from Meet participants list
 *     speakerUid?: string        — speaker uid
 *     channelName?: string       — war room channel (default: 'meet-war-room')
 *     incidentId?: string        — active incident ID
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      transcript?: string;
      speakerName?: string;
      speakerUid?: string;
      channelName?: string;
      incidentId?: string;
      isFiller?: boolean;
    };

    const {
      transcript,
      speakerName = 'Meet Participant',
      speakerUid = 'meet_participant',
      channelName = 'meet-war-room',
      incidentId,
      isFiller = false,
    } = body;

    if (!transcript || transcript.trim().length < 2) {
      return NextResponse.json({ silence: true, response: null });
    }

    // ── Filler word detection ──────────────────────────────────────────────
    const FILLER_RE = /^(hmm+|uh+|um+|ahh*|oh+|wait|hold on|let me see|one sec|give me a moment|yeah|yep|ok|okay|right|so+|erm|err)[\s,\.!?]*$/i;
    const isFillerOnly = FILLER_RE.test(transcript.trim());

    if (isFillerOnly || isFiller) {
      return NextResponse.json({
        silence: true,
        response: null,
        hint: 'filler_detected',
      });
    }

    // ── Log to incident store ──────────────────────────────────────────────
    const effectiveIncidentId = incidentId || `inc-${channelName}`;
    const incidentState = getIncidentState(channelName);

    // Add transcript as evidence if it sounds like an incident report
    const INCIDENT_SIGNAL_RE = /error|down|spike|fail|crash|latency|timeout|alert|pager|sev|outage|service|api|database|k8s|pod|deploy|rollback/i;
    if (INCIDENT_SIGNAL_RE.test(transcript)) {
      const evId = `meet-${Date.now()}`;
      addEvidenceToIncident(channelName, {
        id: evId,
        category: 'fact',
        content: `[Google Meet] ${speakerName}: "${transcript}"`,
        speakerUid,
        speakerName,
        confidence: 75,
        timestamp: Date.now(),
        status: 'active',
        relatedTo: [],
      });

      // Broadcast to AURA war room dashboard via RTM
      await publishDashboardEvent(
        channelName,
        createDashboardEvent('evidence_added', {
          id: evId,
          category: 'fact',
          content: `[Google Meet] ${speakerName}: "${transcript}"`,
          speakerName,
          confidence: 75,
          source: 'google_meet',
        })
      ).catch(() => { /* RTM optional */ });
    }

    // ── Call AURA LLM proxy ────────────────────────────────────────────────
    const proxySecret = process.env.INTERNAL_PROXY_SECRET || '';
    const openAiKey = process.env.OPENAI_API_KEY || '';
    const hasValidKey = openAiKey.startsWith('sk-') && !openAiKey.includes('your_openai');

    if (!hasValidKey || !proxySecret) {
      // Return a deterministic contextual response for demo mode
      const demoResponses = [
        `Copy that, ${speakerName}. I've logged that to the incident timeline.`,
        `Understood, ${speakerName}. That's been classified as a new data point. What's the error rate currently?`,
        `Got it. I'm cross-referencing that with the current topology. Any correlation with recent deployments?`,
        `Noted. I'll flag that as a hypothesis. Can anyone confirm the database connection pool status?`,
      ];
      const response = demoResponses[Math.floor(Math.random() * demoResponses.length)];
      return NextResponse.json({ response, source: 'demo_mode' });
    }

    const dynamicContext = incidentState ? buildDynamicContext(incidentState) : 'No active incident context.';

    const llmMessages = [
      {
        role: 'system' as const,
        content: `You are AURA, an AI incident commander in a Google Meet war room. Keep responses extremely brief (1-2 sentences max). You are voice-active in this meeting. Current context: ${dynamicContext}`,
      },
      {
        role: 'user' as const,
        content: `${speakerName} says: "${transcript}"`,
      },
    ];

    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: llmMessages,
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    if (!llmRes.ok) {
      return NextResponse.json({ response: null, error: 'LLM error' }, { status: 502 });
    }

    const llmData = await llmRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const response = llmData.choices?.[0]?.message?.content?.trim() || null;

    return NextResponse.json({ response, incidentLogged: INCIDENT_SIGNAL_RE.test(transcript) });
  } catch (err) {
    console.error('[/api/meet/audio] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
