import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/dashboard/live — Returns currently active (non-resolved) incidents
 * with real-time metrics for the executive dashboard.
 *
 * Returns:
 * - Active incident cards with severity, elapsed time, OODA phase, participant count
 * - SLA countdown per incident
 * - Latest 3 evidence items per incident for quick context
 * - Overall active incident count and aggregate stats
 */

// ── SLA Defaults ─────────────────────────────────────────────────────────────

const SLA_RESOLVE_MINUTES: Record<string, number> = {
  'SEV-0': 60,
  'SEV-1': 240,
  'SEV-2': 1440,
  'SEV-3': 4320,
};

export async function GET() {
  try {
    const db = getDb();

    // Get all non-resolved incidents
    const activeIncidents = db
      .prepare(
        `SELECT id, title, severity, status, channel_name, opened_at, affected_services,
                incident_commander_uid, cost_accrued, cognitive_load_score, ooda_phase,
                created_at, updated_at
         FROM incidents
         WHERE status != 'resolved'
         ORDER BY
           CASE severity
             WHEN 'SEV-0' THEN 0
             WHEN 'SEV-1' THEN 1
             WHEN 'SEV-2' THEN 2
             WHEN 'SEV-3' THEN 3
             ELSE 4
           END,
           opened_at ASC`,
      )
      .all() as Array<{
        id: string;
        title: string;
        severity: string;
        status: string;
        channel_name: string;
        opened_at: number;
        affected_services: string;
        incident_commander_uid: string | null;
        cost_accrued: number;
        cognitive_load_score: number;
        ooda_phase: string;
        created_at: string;
        updated_at: string;
      }>;

    const now = Date.now();

    const enrichedIncidents = activeIncidents.map((inc) => {
      // Compute elapsed time
      const elapsedMs = now - inc.opened_at;
      const elapsedMinutes = Math.round(elapsedMs / 60_000);

      // SLA countdown
      const slaMinutes = SLA_RESOLVE_MINUTES[inc.severity] ?? 240;
      const slaRemainingMinutes = Math.max(0, slaMinutes - elapsedMinutes);
      const slaPercentUsed = Math.min(100, Math.round((elapsedMinutes / slaMinutes) * 100));
      const slaStatus: 'ok' | 'warning' | 'breached' =
        slaPercentUsed >= 100 ? 'breached' : slaPercentUsed >= 75 ? 'warning' : 'ok';

      // Get participant count
      const participantCount = (
        db
          .prepare(
            'SELECT COUNT(*) as count FROM participants WHERE incident_id = ? AND left_at IS NULL',
          )
          .get(inc.id) as { count: number }
      )?.count ?? 0;

      // Get latest 3 evidence items
      const latestEvidence = db
        .prepare(
          `SELECT id, category, content, speaker_name, confidence, timestamp
           FROM evidence_items
           WHERE incident_id = ?
           ORDER BY timestamp DESC
           LIMIT 3`,
        )
        .all(inc.id) as Array<{
          id: string;
          category: string;
          content: string;
          speaker_name: string;
          confidence: number;
          timestamp: number;
        }>;

      // Count evidence by category
      const evidenceCounts = db
        .prepare(
          `SELECT category, COUNT(*) as count
           FROM evidence_items
           WHERE incident_id = ?
           GROUP BY category`,
        )
        .all(inc.id) as Array<{ category: string; count: number }>;

      const evidenceByCategory: Record<string, number> = {};
      for (const ec of evidenceCounts) {
        evidenceByCategory[ec.category] = ec.count;
      }

      return {
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        channelName: inc.channel_name,
        affectedServices: JSON.parse(inc.affected_services || '[]'),
        incidentCommanderUid: inc.incident_commander_uid,
        costAccrued: inc.cost_accrued,
        cognitiveLoadScore: inc.cognitive_load_score,
        oodaPhase: inc.ooda_phase,
        elapsedMinutes,
        participantCount,
        sla: {
          targetMinutes: slaMinutes,
          remainingMinutes: slaRemainingMinutes,
          percentUsed: slaPercentUsed,
          status: slaStatus,
        },
        latestEvidence: latestEvidence.map((e) => ({
          id: e.id,
          category: e.category,
          content: e.content,
          speakerName: e.speaker_name,
          confidence: e.confidence,
          timestamp: e.timestamp,
          timeAgo: `${Math.round((now - e.timestamp) / 60_000)}m ago`,
        })),
        evidenceByCategory,
      };
    });

    // Aggregate stats
    const totalActive = enrichedIncidents.length;
    const slaBreached = enrichedIncidents.filter((i) => i.sla.status === 'breached').length;
    const slaWarning = enrichedIncidents.filter((i) => i.sla.status === 'warning').length;
    const bySeverity: Record<string, number> = {};
    for (const inc of enrichedIncidents) {
      bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1;
    }

    return NextResponse.json({
      incidents: enrichedIncidents,
      aggregate: {
        totalActive,
        slaBreached,
        slaWarning,
        bySeverity,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/dashboard/live] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live incidents', code: 'LIVE_FEED_ERROR' },
      { status: 500 },
    );
  }
}
