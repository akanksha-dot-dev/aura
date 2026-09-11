import { NextRequest, NextResponse } from 'next/server';
import { searchIncidents } from '@/lib/db';

export const runtime = 'edge';

/**
 * GET /api/incidents/search?q=... — Full-text search across past incidents.
 * Returns ranked results by relevance.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20));

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Missing search query (q)' }, { status: 400 });
    }

    const results = searchIncidents(query.trim(), limit);

    return NextResponse.json({
      query: query.trim(),
      results: results.map((inc) => ({
        ...inc,
        affected_services: JSON.parse(inc.affected_services || '[]'),
      })),
      count: results.length,
    });
  } catch (error) {
    console.error('[/api/incidents/search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
