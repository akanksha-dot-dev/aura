import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  listIncidents,
  getIncidentStats,
  searchIncidents,
  seedHistoricalIncidents,
  type DbIncident,
} from '@/lib/db';
import { findSimilarIncidentsAdvanced, analyzePatterns } from '@/lib/similarityEngine';

export const runtime = 'nodejs';

/**
 * GET /api/dashboard
 *
 * Executive Intelligence Dashboard API.
 *
 * Query params:
 *   ?view=overview      — Aggregate stats (default)
 *   ?view=incidents     — Paginated incident list
 *   ?view=teams         — Team performance rankings
 *   ?view=patterns      — Recurring incident patterns
 *   ?view=similar       — Similar incident lookup (requires &services=... or &symptoms=...)
 *   ?view=heatmap       — Incident frequency heatmap data
 *   ?seed=true          — Force seed demo incidents
 *
 * Common filters:
 *   &severity=SEV-1     — Filter by severity
 *   &status=resolved    — Filter by status
 *   &days=90            — Lookback window in days (default: 90)
 *   &limit=20           — Pagination limit
 *   &offset=0           — Pagination offset
 *   &q=search           — Full-text search query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'overview';
    const days = parseInt(searchParams.get('days') || '90', 10);
    const severity = searchParams.get('severity') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const query = searchParams.get('q') || '';
    const shouldSeed = searchParams.get('seed') === 'true';

    if (shouldSeed) {
      seedHistoricalIncidents(true);
    }

    switch (view) {
      // ── Overview: Aggregate statistics ───────────────────────────────
      case 'overview': {
        let rawStats = getIncidentStats();
        // Auto-seed if database is fresh / has sparse test data
        if (rawStats.totalIncidents < 4) {
          seedHistoricalIncidents(false);
          rawStats = getIncidentStats();
        }

        const stats = {
          total: rawStats.totalIncidents,
          open: Math.max(0, rawStats.totalIncidents - rawStats.resolvedIncidents),
          resolved: rawStats.resolvedIncidents,
          avgMttrMs: Math.round(rawStats.avgResolutionTimeMs || 0),
          totalIncidents: rawStats.totalIncidents,
          resolvedIncidents: rawStats.resolvedIncidents,
          avgResolutionTimeMs: rawStats.avgResolutionTimeMs,
          incidentsBySeverity: rawStats.incidentsBySeverity,
        };
        const database = getDb();

        // MTTR by severity
        const mttrBySeverity = database.prepare(`
          SELECT severity,
            COUNT(*) as count,
            AVG(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - opened_at ELSE NULL END) as avg_mttr,
            MIN(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - opened_at ELSE NULL END) as min_mttr,
            MAX(CASE WHEN resolved_at IS NOT NULL THEN resolved_at - opened_at ELSE NULL END) as max_mttr
          FROM incidents
          GROUP BY severity
          ORDER BY severity
        `).all() as Array<{
          severity: string;
          count: number;
          avg_mttr: number | null;
          min_mttr: number | null;
          max_mttr: number | null;
        }>;

        // Recent trend (incidents per week for last 12 weeks)
        const twelveWeeksAgo = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000;
        const weeklyTrend = database.prepare(`
          SELECT
            CAST((opened_at - ?) / (7 * 24 * 60 * 60 * 1000) AS INTEGER) as week_index,
            COUNT(*) as count,
            severity
          FROM incidents
          WHERE opened_at > ?
          GROUP BY week_index, severity
          ORDER BY week_index
        `).all(twelveWeeksAgo, twelveWeeksAgo) as Array<{
          week_index: number;
          count: number;
          severity: string;
        }>;

        // Top affected services (last N days)
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const allIncidents = database.prepare(
          'SELECT affected_services FROM incidents WHERE opened_at > ?'
        ).all(cutoff) as Array<{ affected_services: string }>;

        const serviceFreq: Record<string, number> = {};
        for (const inc of allIncidents) {
          try {
            const services = JSON.parse(inc.affected_services) as string[];
            for (const svc of services) {
              serviceFreq[svc] = (serviceFreq[svc] || 0) + 1;
            }
          } catch { /* skip malformed */ }
        }

        const topServices = Object.entries(serviceFreq)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([service, count]) => ({ service, count }));

        // Cost summary
        const costResult = database.prepare(`
          SELECT
            SUM(cost_accrued) as total_cost,
            AVG(cost_accrued) as avg_cost
          FROM incidents
          WHERE opened_at > ?
        `).get(cutoff) as { total_cost: number | null; avg_cost: number | null };

        return NextResponse.json({
          stats,
          mttrBySeverity,
          weeklyTrend,
          topServices,
          cost: {
            totalAccrued: costResult.total_cost ?? 0,
            averagePerIncident: Math.round(costResult.avg_cost ?? 0),
          },
          meta: { daysBack: days, generatedAt: new Date().toISOString() },
        });
      }

      // ── Incidents: Paginated list with search ───────────────────────
      case 'incidents': {
        if (query) {
          const results = searchIncidents(query, limit);
          return NextResponse.json({
            incidents: results.map(normalizeIncident),
            total: results.length,
            query,
          });
        }

        const { incidents, total } = listIncidents({ severity, status, limit, offset });
        return NextResponse.json({
          incidents: incidents.map(normalizeIncident),
          total,
          limit,
          offset,
        });
      }

      // ── Teams: Performance rankings ─────────────────────────────────
      case 'teams': {
        const database = getDb();

        let teamStats: Array<{
          team_name: string;
          incident_count: number;
          avg_mttr: number | null;
          resolved_count: number;
        }> = [];

        try {
          teamStats = database.prepare(`
            SELECT
              it.team_name,
              COUNT(DISTINCT i.id) as incident_count,
              AVG(CASE WHEN i.resolved_at IS NOT NULL THEN i.resolved_at - i.opened_at ELSE NULL END) as avg_mttr,
              SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
            FROM incident_teams it
            JOIN incidents i ON i.id = it.incident_id
            WHERE it.is_primary_owner = 1
            GROUP BY it.team_name
            ORDER BY incident_count DESC
          `).all() as typeof teamStats;
        } catch {
          // incident_teams table may not exist yet
        }

        // Compute "repeat offender" — services with >3 incidents in window
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const allIncidents = database.prepare(
          'SELECT affected_services, severity FROM incidents WHERE opened_at > ?'
        ).all(cutoff) as Array<{ affected_services: string; severity: string }>;

        const serviceIncidentMap: Record<string, { count: number; severities: string[] }> = {};
        for (const inc of allIncidents) {
          try {
            const services = JSON.parse(inc.affected_services) as string[];
            for (const svc of services) {
              if (!serviceIncidentMap[svc]) {
                serviceIncidentMap[svc] = { count: 0, severities: [] };
              }
              serviceIncidentMap[svc].count++;
              serviceIncidentMap[svc].severities.push(inc.severity);
            }
          } catch { /* skip */ }
        }

        const repeatOffenders = Object.entries(serviceIncidentMap)
          .filter(([, v]) => v.count >= 3)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([service, data]) => ({
            service,
            incidentCount: data.count,
            severityBreakdown: data.severities.reduce((acc: Record<string, number>, s) => {
              acc[s] = (acc[s] || 0) + 1;
              return acc;
            }, {}),
            needsAttention: data.count >= 5 || data.severities.filter(s => s === 'SEV-0' || s === 'SEV-1').length >= 2,
          }));

        return NextResponse.json({
          teams: teamStats,
          repeatOffenders,
          meta: { daysBack: days },
        });
      }

      // ── Patterns: Recurring incident patterns ──────────────────────
      case 'patterns': {
        const patterns = analyzePatterns({ daysBack: days });
        return NextResponse.json(patterns);
      }

      // ── Similar: Find similar incidents ─────────────────────────────
      case 'similar': {
        const services = searchParams.get('services')?.split(',').filter(Boolean) || [];
        const symptoms = searchParams.get('symptoms') || '';
        const currentSeverity = searchParams.get('currentSeverity') || 'SEV-1';
        const excludeId = searchParams.get('excludeId') || undefined;

        if (services.length === 0 && !symptoms) {
          return NextResponse.json(
            { error: 'Provide at least one of: services (comma-separated) or symptoms' },
            { status: 400 }
          );
        }

        const results = findSimilarIncidentsAdvanced({
          services,
          evidenceTexts: symptoms ? [symptoms] : [],
          severity: currentSeverity,
          timestamp: Date.now(),
          excludeId,
          limit,
        });

        return NextResponse.json({
          similar: results,
          total: results.length,
          query: { services, symptoms, currentSeverity },
        });
      }

      // ── Heatmap: Incident frequency by day/hour ─────────────────────
      case 'heatmap': {
        const patterns = analyzePatterns({ daysBack: days });
        return NextResponse.json({
          heatmap: patterns.timeHeatmap,
          meta: { daysBack: days },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown view: ${view}. Valid: overview, incidents, teams, patterns, similar, heatmap` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard
 *
 * Write operations:
 *   action=tag_incident    — Add tags to an incident
 *   action=set_root_cause  — Set root cause category
 *   action=set_team        — Assign team to incident
 *   action=save_resolution — Save effective resolution steps
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const database = getDb();

    switch (action) {
      case 'seed': {
        const result = seedHistoricalIncidents(body.force === true);
        return NextResponse.json(result);
      }

      case 'tag_incident': {
        const { incidentId, tags } = body;
        if (!incidentId || !Array.isArray(tags)) {
          return NextResponse.json({ error: 'Missing incidentId or tags' }, { status: 400 });
        }
        const stmt = database.prepare(
          'INSERT OR IGNORE INTO incident_tags (incident_id, tag) VALUES (?, ?)'
        );
        for (const tag of tags) {
          stmt.run(incidentId, tag);
        }
        return NextResponse.json({ ok: true, tagged: tags.length });
      }

      case 'set_root_cause': {
        const { incidentId, category, subcategory, description } = body;
        if (!incidentId || !category) {
          return NextResponse.json({ error: 'Missing incidentId or category' }, { status: 400 });
        }
        database.prepare(`
          INSERT INTO root_causes (incident_id, category, subcategory, description)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(incident_id) DO UPDATE SET
            category = excluded.category,
            subcategory = excluded.subcategory,
            description = excluded.description
        `).run(incidentId, category, subcategory || null, description || null);
        return NextResponse.json({ ok: true });
      }

      case 'set_team': {
        const { incidentId, teamName, isPrimary } = body;
        if (!incidentId || !teamName) {
          return NextResponse.json({ error: 'Missing incidentId or teamName' }, { status: 400 });
        }
        database.prepare(`
          INSERT INTO incident_teams (incident_id, team_name, is_primary_owner)
          VALUES (?, ?, ?)
        `).run(incidentId, teamName, isPrimary ? 1 : 0);
        return NextResponse.json({ ok: true });
      }

      case 'save_resolution': {
        const { incidentId, steps } = body;
        if (!incidentId || !Array.isArray(steps)) {
          return NextResponse.json({ error: 'Missing incidentId or steps' }, { status: 400 });
        }
        const stmt = database.prepare(`
          INSERT INTO resolution_playbook (incident_id, step_order, action_text, was_effective, duration_ms)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          stmt.run(
            incidentId,
            i + 1,
            step.text || step,
            step.effective !== false ? 1 : 0,
            step.durationMs || null
          );
        }
        return NextResponse.json({ ok: true, saved: steps.length });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeIncident(inc: DbIncident) {
  let services: string[] = [];
  try {
    services = JSON.parse(inc.affected_services);
  } catch { /* skip */ }

  return {
    id: inc.id,
    title: inc.title,
    severity: inc.severity,
    status: inc.status,
    channelName: inc.channel_name,
    openedAt: inc.opened_at,
    resolvedAt: inc.resolved_at,
    affectedServices: services,
    costAccrued: inc.cost_accrued,
    cognitiveLoadScore: inc.cognitive_load_score,
    oodaPhase: inc.ooda_phase,
    durationMs: inc.resolved_at ? inc.resolved_at - inc.opened_at : Date.now() - inc.opened_at,
  };
}
