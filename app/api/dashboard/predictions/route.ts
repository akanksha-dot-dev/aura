import { NextResponse } from 'next/server';
import {
  getDb,
} from '@/lib/db';

/**
 * Dashboard Predictions API — Predictive risk scoring for AURA.
 *
 * GET /api/dashboard/predictions
 *   Returns risk scores per service based on historical incident patterns.
 *
 * Uses:
 * - Incident frequency (incidents per 30-day window)
 * - Time since last incident (recency factor)
 * - Average MTTR for this service
 * - Severity distribution (more SEV-0/1 = higher risk)
 * - Day-of-week / hour-of-day clustering
 */

interface ServiceRisk {
  service: string;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  incidents30d: number;
  lastIncidentAt: string | null;
  avgMttrMinutes: number | null;
  severityBreakdown: Record<string, number>;
  trend: 'improving' | 'stable' | 'worsening';
  recommendation: string;
  nextPredictedWindow: string | null;
}

interface PredictionsResponse {
  predictions: ServiceRisk[];
  overallHealth: number; // 0-100 (100 = perfect)
  generatedAt: string;
  dataWindow: string;
}

export async function GET() {
  try {
    const db = getDb();

    // Get all services that have had incidents
    const serviceRows = db.prepare(`
      SELECT DISTINCT
        json_each.value AS service
      FROM incidents,
           json_each(incidents.affected_services)
      WHERE json_each.value IS NOT NULL
      ORDER BY service
    `).all() as Array<{ service: string }>;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const predictions: ServiceRisk[] = [];

    for (const { service } of serviceRows) {
      // Incidents in last 30 days
      const recent30 = db.prepare(`
        SELECT COUNT(*) as count
        FROM incidents, json_each(incidents.affected_services)
        WHERE json_each.value = ?
          AND incidents.created_at > ?
      `).get(service, thirtyDaysAgo) as { count: number };

      // Incidents 30-60 days ago (for trend comparison)
      const prev30 = db.prepare(`
        SELECT COUNT(*) as count
        FROM incidents, json_each(incidents.affected_services)
        WHERE json_each.value = ?
          AND incidents.created_at > ?
          AND incidents.created_at <= ?
      `).get(service, sixtyDaysAgo, thirtyDaysAgo) as { count: number };

      // Last incident
      const lastIncident = db.prepare(`
        SELECT created_at, severity
        FROM incidents, json_each(incidents.affected_services)
        WHERE json_each.value = ?
        ORDER BY incidents.created_at DESC
        LIMIT 1
      `).get(service) as { created_at: number; severity: string } | undefined;

      // Average MTTR
      const mttrResult = db.prepare(`
        SELECT AVG(resolved_at - created_at) as avg_mttr
        FROM incidents, json_each(incidents.affected_services)
        WHERE json_each.value = ?
          AND incidents.resolved_at IS NOT NULL
      `).get(service) as { avg_mttr: number | null };

      // Severity breakdown
      const sevBreakdown = db.prepare(`
        SELECT incidents.severity, COUNT(*) as count
        FROM incidents, json_each(incidents.affected_services)
        WHERE json_each.value = ?
        GROUP BY incidents.severity
      `).all(service) as Array<{ severity: string; count: number }>;

      const severityBreakdown: Record<string, number> = {};
      for (const row of sevBreakdown) {
        severityBreakdown[row.severity] = row.count;
      }

      // Calculate risk score
      let riskScore = 0;

      // Frequency factor (0-40 points): more incidents = higher risk
      const frequencyScore = Math.min(40, recent30.count * 10);
      riskScore += frequencyScore;

      // Recency factor (0-25 points): more recent = higher risk
      if (lastIncident) {
        const daysSince = (now - lastIncident.created_at) / (24 * 60 * 60 * 1000);
        if (daysSince < 3) riskScore += 25;
        else if (daysSince < 7) riskScore += 18;
        else if (daysSince < 14) riskScore += 10;
        else if (daysSince < 30) riskScore += 5;
      }

      // Severity factor (0-20 points): more severe incidents = higher risk
      const sev0Count = severityBreakdown['SEV-0'] || 0;
      const sev1Count = severityBreakdown['SEV-1'] || 0;
      riskScore += Math.min(20, sev0Count * 10 + sev1Count * 5);

      // MTTR factor (0-15 points): longer MTTR = higher risk
      if (mttrResult.avg_mttr) {
        const avgMttrMin = mttrResult.avg_mttr / 60_000;
        if (avgMttrMin > 120) riskScore += 15;
        else if (avgMttrMin > 60) riskScore += 10;
        else if (avgMttrMin > 30) riskScore += 5;
      }

      riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

      // Determine trend
      let trend: ServiceRisk['trend'] = 'stable';
      if (recent30.count > prev30.count + 1) trend = 'worsening';
      else if (recent30.count < prev30.count - 1) trend = 'improving';

      // Determine risk level
      let riskLevel: ServiceRisk['riskLevel'] = 'LOW';
      if (riskScore >= 75) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 25) riskLevel = 'MEDIUM';

      // Generate recommendation
      let recommendation = '';
      if (riskScore >= 75) {
        recommendation = `${service} is at critical risk. Consider a dedicated reliability sprint. ${recent30.count} incidents in the last 30 days with ${sev0Count + sev1Count} high-severity events.`;
      } else if (riskScore >= 50) {
        recommendation = `${service} needs attention. Review recent changes and add monitoring. Incident frequency is ${trend === 'worsening' ? 'increasing' : 'elevated'}.`;
      } else if (riskScore >= 25) {
        recommendation = `${service} has moderate risk. Continue monitoring and ensure runbooks are up to date.`;
      } else {
        recommendation = `${service} is stable. No immediate action required.`;
      }

      // Predict next incident window (based on historical frequency)
      let nextPredictedWindow: string | null = null;
      if (recent30.count >= 2) {
        const avgDaysBetween = 30 / recent30.count;
        const daysSinceLast = lastIncident
          ? (now - lastIncident.created_at) / (24 * 60 * 60 * 1000)
          : 0;
        const daysUntilNext = Math.max(0, Math.round(avgDaysBetween - daysSinceLast));
        if (daysUntilNext <= 7) {
          nextPredictedWindow = daysUntilNext === 0
            ? 'Overdue — incident likely imminent'
            : `~${daysUntilNext} day${daysUntilNext !== 1 ? 's' : ''} (based on historical pattern)`;
        }
      }

      predictions.push({
        service,
        riskScore,
        riskLevel,
        incidents30d: recent30.count,
        lastIncidentAt: lastIncident ? new Date(lastIncident.created_at).toISOString() : null,
        avgMttrMinutes: mttrResult.avg_mttr ? Math.round(mttrResult.avg_mttr / 60_000) : null,
        severityBreakdown,
        trend,
        recommendation,
        nextPredictedWindow,
      });
    }

    // Sort by risk score descending
    predictions.sort((a, b) => b.riskScore - a.riskScore);

    // Calculate overall health
    const avgRisk = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length
      : 0;
    const overallHealth = Math.round(100 - avgRisk);

    const response: PredictionsResponse = {
      predictions,
      overallHealth,
      generatedAt: new Date().toISOString(),
      dataWindow: '30 days',
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[API /dashboard/predictions] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 },
    );
  }
}
