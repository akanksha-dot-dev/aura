import { NextRequest, NextResponse } from 'next/server';
import { listIncidents, getIncidentStats, upsertIncident, upsertPostmortem } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/incidents — Persist or update an incident or postmortem report in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incident_id, id, title, severity, status, channel_name, postmortem, root_cause, markdown, action_items, lessons_learned } = body;
    const targetId = incident_id || id;

    if (!targetId) {
      return NextResponse.json({ error: 'incident_id is required' }, { status: 400 });
    }

    // Upsert incident record
    upsertIncident({
      id: targetId,
      title: title || `Incident ${targetId}`,
      severity: severity || 'SEV-1',
      status: status || 'resolved',
      channelName: channel_name || 'incident-war-room',
      openedAt: body.opened_at || Date.now(),
      resolvedAt: body.resolved_at || Date.now(),
      affectedServices: body.affected_services || ['core-service'],
      costAccrued: body.cost_accrued || 0,
      cognitiveLoadScore: body.cognitive_load_score || 0,
      oodaPhase: body.ooda_phase || 'ACT',
    });

    // If postmortem data is provided, upsert postmortem
    if (markdown || postmortem || root_cause) {
      upsertPostmortem({
        incidentId: targetId,
        title: title || `Postmortem ${targetId}`,
        summary: markdown || postmortem || 'Postmortem report',
        rootCause: root_cause,
        actionItems: action_items || [],
        lessonsLearned: lessons_learned,
      });
    }

    return NextResponse.json({ success: true, incidentId: targetId });
  } catch (error) {
    console.error('[/api/incidents] POST Error:', error);
    return NextResponse.json({ error: 'Failed to persist incident' }, { status: 500 });
  }
}

/**
 * GET /api/incidents — List all past incidents with pagination and filtering.
 *
 * Query params:
 *   severity — Filter by severity (SEV-0, SEV-1, SEV-2, SEV-3)
 *   status   — Filter by status (investigating, identified, monitoring, resolved)
 *   limit    — Max results (default 50)
 *   offset   — Pagination offset (default 0)
 *   stats    — If 'true', include aggregate statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const severity = searchParams.get('severity') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
    const includeStats = searchParams.get('stats') === 'true';

    const { incidents, total } = listIncidents({ severity, status, limit, offset });

    const response: Record<string, unknown> = {
      incidents: incidents.map((inc) => ({
        ...inc,
        affected_services: JSON.parse(inc.affected_services || '[]'),
      })),
      total,
      limit,
      offset,
      hasMore: offset + incidents.length < total,
    };

    if (includeStats) {
      response.stats = getIncidentStats();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[/api/incidents] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve incidents' },
      { status: 500 }
    );
  }
}
