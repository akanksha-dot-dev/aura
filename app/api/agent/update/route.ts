import { NextRequest, NextResponse } from 'next/server';
import { getIncidentState, updateIncidentState, addEvidenceToIncident, addParticipantToIncident } from '@/lib/incidentStore';
import { PRESET_SCENARIOS } from '@/lib/scenarios';
import { buildEffectiveSystemPrompt } from '@/lib/promptBuilder';
import { EvidenceItem, IncidentState } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/agent/update — Hot-update the Gemini Live agent's context when participants
 * or evidence change. Replaces Agora ConvAI /update REST endpoint.
 *
 * Strategy: Writes updated systemInstruction to Firebase RTDB sessions/{channelName}.
 * The client-side Gemini Live WebSocket hook picks it up and can optionally close+reopen
 * the session with the new instruction, or the update is reflected on the next turn.
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

    // 4. Write updated config to Firebase RTDB sessions/{channelName}
    //    The client-side Gemini Live hook listens to this node and applies updated
    //    system instruction on next session reconnect or via setConfig() if supported.
    try {
      const { adminDb } = await import('@/lib/firebaseAdmin');
      const { ref, update, push } = await import('firebase-admin/database');

      // Update the session node with new system instruction
      await update(ref(adminDb, `sessions/${channelName}`), {
        systemInstruction: effectiveSystemPrompt,
        updatedAt: Date.now(),
        agentId,
        participantCount: Object.keys(currentState.participants).length,
        evidenceCount: currentState.evidenceItems.length,
        currentOODAPhase: currentState.currentOODAPhase,
      });

      // Also broadcast an update event to all dashboards
      await push(ref(adminDb, `channels/${channelName}/events`), {
        id: `ctx-update-${Date.now()}`,
        seq: Date.now(),
        timestamp: Date.now(),
        type: 'context_updated',
        eventType: 'context_updated',
        payload: {
          agentId,
          evidenceCount: currentState.evidenceItems.length,
          participantCount: Object.keys(currentState.participants).length,
          phase: currentState.currentOODAPhase,
        },
      });

      return NextResponse.json({
        status: 'updated',
        agentId,
        evidenceCount: currentState.evidenceItems.length,
        participantCount: Object.keys(currentState.participants).length,
        currentOODAPhase: currentState.currentOODAPhase,
        transport: 'firebase-rtdb',
      });
    } catch (fbErr) {
      console.warn('[AgentUpdate] Firebase RTDB update warning:', fbErr);
      // Graceful degradation — context was updated server-side even if RTDB write failed
      return NextResponse.json({
        status: 'context_queued',
        note: 'Agent context updated server-side; Firebase sync pending',
        evidenceCount: currentState.evidenceItems.length,
      });
    }
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
