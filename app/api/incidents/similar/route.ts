import { NextRequest, NextResponse } from 'next/server';
import { findSimilarIncidents } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/incidents/similar?services=...&symptoms=...&excludeId=...
 *
 * Find past incidents with similar affected services or symptom patterns.
 * Powers AURA's "I've seen a similar incident before" intelligence.
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

    const results = findSimilarIncidents({ services, symptoms, excludeId, limit });

    return NextResponse.json({
      results: results.map((inc) => ({
        ...inc,
        affected_services: JSON.parse(inc.affected_services || '[]'),
      })),
      count: results.length,
    });
  } catch (error) {
    console.error('[/api/incidents/similar] Error:', error);
    return NextResponse.json(
      { error: 'Similar incident lookup failed' },
      { status: 500 }
    );
  }
}
