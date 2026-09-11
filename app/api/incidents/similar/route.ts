import { NextRequest, NextResponse } from 'next/server';
import { findSimilarIncidents, getDb } from '@/lib/db';

export const runtime = 'nodejs';

interface FormattedIncidentMatch {
  id: string;
  title: string;
  severity: string;
  status: string;
  score: number;
  root_cause: string;
  resolution_steps: string[];
  mttr_minutes: number;
  affected_services: string[];
}

function formatMatches(
  incidents: ReturnType<typeof findSimilarIncidents>
): FormattedIncidentMatch[] {
  const db = getDb();
  return incidents.map((inc, index) => {
    let affectedServices: string[] = [];
    try {
      affectedServices = JSON.parse(inc.affected_services || '[]');
    } catch {
      affectedServices = [];
    }

    let rootCause = 'Unknown';
    try {
      const rc = db
        .prepare('SELECT description FROM root_causes WHERE incident_id = ?')
        .get(inc.id) as { description: string } | undefined;
      if (rc?.description) rootCause = rc.description;
    } catch {
      // Fallback
    }

    let resolutionSteps: string[] = [];
    try {
      const steps = db
        .prepare(
          'SELECT action_text FROM resolution_playbook WHERE incident_id = ? ORDER BY step_order'
        )
        .all(inc.id) as Array<{ action_text: string }>;
      resolutionSteps = steps.map((s) => s.action_text);
    } catch {
      // Fallback
    }

    const mttrMinutes =
      inc.resolved_at && inc.opened_at
        ? Math.round((inc.resolved_at - inc.opened_at) / 60000)
        : 22;

    const score = Math.max(50, 92 - index * 14);

    return {
      id: inc.id,
      title: inc.title,
      severity: inc.severity,
      status: inc.status,
      score,
      root_cause: rootCause,
      resolution_steps: resolutionSteps,
      mttr_minutes: mttrMinutes,
      affected_services: affectedServices,
    };
  });
}

/**
 * GET /api/incidents/similar?services=...&symptoms=...&excludeId=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const servicesRaw = searchParams.get('services');
    const symptoms = searchParams.get('symptoms') || undefined;
    const excludeId = searchParams.get('excludeId') || undefined;
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 5));

    const services = servicesRaw
      ? servicesRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    if (!services?.length && !symptoms) {
      return NextResponse.json(
        { error: 'At least one of services or symptoms is required' },
        { status: 400 }
      );
    }

    const rawResults = findSimilarIncidents({ services, symptoms, excludeId, limit });
    const formatted = formatMatches(rawResults);

    return NextResponse.json({
      results: formatted,
      matches: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('[/api/incidents/similar] GET Error:', error);
    return NextResponse.json(
      { error: 'Similar incident lookup failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidents/similar
 * Body: { services?: string[], symptoms?: string, excludeId?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    let body: {
      services?: string[];
      symptoms?: string;
      excludeId?: string;
      channelName?: string;
      limit?: number;
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { services, symptoms, excludeId, limit = 5 } = body;
    const boundedLimit = Math.min(20, Math.max(1, Number(limit) || 5));

    const rawResults = findSimilarIncidents({
      services: Array.isArray(services) ? services : undefined,
      symptoms: typeof symptoms === 'string' ? symptoms : undefined,
      excludeId: typeof excludeId === 'string' ? excludeId : undefined,
      limit: boundedLimit,
    });

    const formatted = formatMatches(rawResults);

    return NextResponse.json({
      results: formatted,
      matches: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('[/api/incidents/similar] POST Error:', error);
    return NextResponse.json(
      { error: 'Similar incident lookup failed' },
      { status: 500 }
    );
  }
}

