import { NextRequest, NextResponse } from 'next/server';
import {
  getIncidentById,
  getEvidenceByIncident,
  getParticipantsByIncident,
  getTranscriptsByIncident,
  getPostmortemByIncident,
} from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/incidents/[id] — Full incident detail including evidence, participants, transcript.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing incident ID' }, { status: 400 });
    }

    const incident = getIncidentById(id);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const evidence = getEvidenceByIncident(id);
    const participants = getParticipantsByIncident(id);
    const transcripts = getTranscriptsByIncident(id);
    const postmortem = getPostmortemByIncident(id);

    return NextResponse.json({
      incident: {
        ...incident,
        affected_services: JSON.parse(incident.affected_services || '[]'),
      },
      evidence: evidence.map((e) => ({
        ...e,
        related_to: JSON.parse(e.related_to || '[]'),
      })),
      participants,
      transcripts,
      postmortem: postmortem
        ? {
            ...postmortem,
            timeline: JSON.parse(postmortem.timeline_json || '[]'),
            actionItems: JSON.parse(postmortem.action_items_json || '[]'),
          }
        : null,
      stats: {
        evidenceCount: evidence.length,
        factCount: evidence.filter((e) => e.category === 'fact').length,
        hypothesisCount: evidence.filter((e) => e.category === 'hypothesis').length,
        decisionCount: evidence.filter((e) => e.category === 'decision').length,
        actionCount: evidence.filter((e) => e.category === 'action').length,
        conflictCount: evidence.filter((e) => e.category === 'conflict').length,
        participantCount: participants.length,
        transcriptEntries: transcripts.length,
        durationMs: incident.resolved_at
          ? incident.resolved_at - incident.opened_at
          : Date.now() - incident.opened_at,
      },
    });
  } catch (error) {
    console.error('[/api/incidents/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve incident detail' },
      { status: 500 }
    );
  }
}
