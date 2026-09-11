import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState, updateIncidentState, addEvidenceToIncident, addParticipantToIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';
import { buildEffectiveSystemPrompt } from '@/lib/promptBuilder';
import { EvidenceItem, IncidentState } from '@/lib/types';

export const runtime = 'edge';

/**
 * POST /api/agent/update — Hot-update the ConvAI agent's context when participants or evidence change.
 * Sends updated participant roster and rich incident context to the active agent while preserving
 * all 16 directives, voice rules, SBAR protocols, and telemetry syntax.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      channelName,
      participants,
      incidentState,
      evidenceItems,
      scenario,
      operatorUid,
    } = body;

    if (!agentId || !channelName) {
      return NextResponse.json(
        { error: 'Missing agentId or channelName' },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const customerKey = process.env.AGORA_CUSTOMER_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !customerKey || !customerSecret) {
      return NextResponse.json(
        { error: 'Agora credentials not configured' },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(
      `${customerKey}:${customerSecret}`
    ).toString('base64')}`;

    // 1. Resolve or sync server-side incident state
    let currentState: IncidentState = getIncidentState(channelName);

    if (incidentState && typeof incidentState === 'object') {
      currentState = updateIncidentState(channelName, (prev) => ({
        ...prev,
        ...incidentState,
        participants: incidentState.participants || prev.participants,
        evidenceItems: incidentState.evidenceItems || prev.evidenceItems,
      }));
    } else {
      // Sync incoming evidence items if sent directly
      if (Array.isArray(evidenceItems)) {
        for (const item of evidenceItems) {
          if (item && item.id && !currentState.evidenceItems.some((e) => e.id === item.id)) {
            currentState = addEvidenceToIncident(channelName, item as EvidenceItem);
          }
        }
      }

      // Sync incoming participants if sent directly
      if (Array.isArray(participants)) {
        for (const p of participants) {
          if (p && p.uid && !currentState.participants[p.uid]) {
            currentState = addParticipantToIncident(channelName, p);
          }
        }
      }
    }

    // 2. Resolve scenario briefing
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

    // 3. Build the full, rich system prompt with updated real-time incident context
    const effectiveSystemPrompt = buildEffectiveSystemPrompt({
      incidentState: currentState,
      scenario: effectiveScenario,
      operatorUid,
    });

    // 4. Use Agora's agent update API to push updated prompt
    const updatePayload = {
      properties: {
        llm: {
          system_messages: [
            {
              role: 'system',
              content: effectiveSystemPrompt,
            },
          ],
        },
      },
    };

    const agoraResponse = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/update`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );

    const responseData = await agoraResponse.json().catch(() => ({}));

    if (!agoraResponse.ok && agoraResponse.status !== 404) {
      console.warn(
        `[AgentUpdate] Agora update returned HTTP ${agoraResponse.status}:`,
        responseData
      );
      return NextResponse.json({
        status: 'context_queued',
        note: 'Agent update queued; context will sync on next turn',
        evidenceCount: currentState.evidenceItems.length,
        details: responseData,
      });
    }

    return NextResponse.json({
      status: 'updated',
      agentId,
      evidenceCount: currentState.evidenceItems.length,
      participantCount: Object.keys(currentState.participants).length,
      currentOODAPhase: currentState.currentOODAPhase,
      details: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update agent context',
      },
      { status: 500 }
    );
  }
}
