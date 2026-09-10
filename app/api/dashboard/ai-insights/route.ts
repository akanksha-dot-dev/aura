/**
 * GET /api/dashboard/ai-insights
 *
 * Returns AI-generated intelligence insights from the incident history database.
 * Uses the incidentAnalytics computation layer for rule-based insights when
 * no LLM API key is configured, or calls Gemini if GEMINI_API_KEY is set.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  generateComputedInsights,
  computeTeamRiskScore,
  detectRecurringPatterns,
  predictServiceRisk,
  computeMttrTrend,
  type IncidentRecord,
  type AiInsight,
  type TeamRiskScore,
  type RecurringPattern,
  type ServiceRiskPrediction,
  type TrendPoint,
} from '@/lib/incidentAnalytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DbIncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  channel_name: string;
  opened_at: number;
  resolved_at: number | null;
  affected_services: string;
  incident_commander_uid: string | null;
  cost_accrued: number | null;
  cognitive_load_score: number | null;
  ooda_phase: string | null;
  created_at: number;
  updated_at: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDays = parseInt(searchParams.get('windowDays') ?? '90', 10);
    const teamName = searchParams.get('team') ?? 'Engineering';

    const db = getDb();

    // Fetch incidents from the window
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const incidents = db.prepare(`
      SELECT id, title, severity, status, channel_name, opened_at, resolved_at,
             affected_services, incident_commander_uid, cost_accrued, cognitive_load_score, ooda_phase,
             created_at, updated_at
      FROM incidents
      WHERE opened_at > ?
      ORDER BY opened_at DESC
      LIMIT 500
    `).all(cutoff) as IncidentRecord[];

    // All-time for pattern detection
    const allIncidents = db.prepare(`
      SELECT id, title, severity, status, channel_name, opened_at, resolved_at,
             affected_services, incident_commander_uid, cost_accrued, cognitive_load_score, ooda_phase,
             created_at, updated_at
      FROM incidents
      ORDER BY opened_at DESC
      LIMIT 1000
    `).all() as IncidentRecord[];

    // Run all analytics in parallel
    const [insights, teamRisk, patterns, mttrTrend] = await Promise.all([
      Promise.resolve(generateComputedInsights(incidents, windowDays)),
      Promise.resolve(computeTeamRiskScore(teamName, incidents, windowDays)),
      Promise.resolve(detectRecurringPatterns(allIncidents, 2)),
      Promise.resolve(computeMttrTrend(incidents, windowDays, 'weekly')),
    ]);

    // Extract unique services for risk prediction
    const allServices = new Set<string>();
    for (const i of allIncidents) {
      try {
        (JSON.parse(i.affected_services ?? '[]') as string[]).forEach(s => allServices.add(s));
      } catch { /* ignore */ }
    }

    const serviceRisks: ServiceRiskPrediction[] = Array.from(allServices)
      .slice(0, 10) // top 10 services
      .map(svc => predictServiceRisk(svc, allIncidents));

    serviceRisks.sort((a, b) => b.incidentProbability - a.incidentProbability);

    // Summary stats
    const resolved = incidents.filter(i => i.resolved_at != null);
    const avgMttrMs = resolved.length > 0
      ? resolved.reduce((s, i) => s + (i.resolved_at! - i.opened_at), 0) / resolved.length
      : 0;
    const totalCost = incidents.reduce((s, i) => s + (i.cost_accrued ?? 0), 0);
    const sev0Count = incidents.filter(i => i.severity === 'SEV-0').length;
    const sev1Count = incidents.filter(i => i.severity === 'SEV-1').length;

    // Try Gemini LLM enhancement if API key is configured
    let llmInsights: AiInsight[] = [];
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && incidents.length >= 3) {
      try {
        llmInsights = await generateGeminiInsights(incidents, teamName, windowDays, geminiKey);
      } catch (llmErr) {
        console.warn('[ai-insights] Gemini call failed, using computed insights:', llmErr);
      }
    }

    const finalInsights = llmInsights.length > 0 ? llmInsights : insights;

    return NextResponse.json({
      success: true,
      windowDays,
      generatedAt: Date.now(),
      usedLlm: llmInsights.length > 0,
      summary: {
        totalIncidents: incidents.length,
        resolvedIncidents: resolved.length,
        openIncidents: incidents.filter(i => i.status !== 'resolved').length,
        sev0Count,
        sev1Count,
        avgMttrMinutes: Math.round(avgMttrMs / 60_000),
        totalCostUsd: Math.round(totalCost),
      },
      insights: finalInsights,
      teamRisk,
      patterns,
      serviceRisks,
      mttrTrend,
    });
  } catch (err) {
    console.error('[api/dashboard/ai-insights] Error:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

// ── Gemini LLM Enhancement ────────────────────────────────────────────────────

async function generateGeminiInsights(
  incidents: IncidentRecord[],
  teamName: string,
  windowDays: number,
  apiKey: string,
): Promise<AiInsight[]> {
  // Build a compact summary for the LLM
  const summary = {
    total: incidents.length,
    resolved: incidents.filter(i => i.resolved_at).length,
    sev0: incidents.filter(i => i.severity === 'SEV-0').length,
    sev1: incidents.filter(i => i.severity === 'SEV-1').length,
    avgMttrMin: Math.round(
      incidents
        .filter(i => i.resolved_at)
        .reduce((s, i) => s + (i.resolved_at! - i.opened_at) / 60000, 0) /
      Math.max(1, incidents.filter(i => i.resolved_at).length)
    ),
    topServices: (() => {
      const map = new Map<string, number>();
      for (const i of incidents) {
        try {
          (JSON.parse(i.affected_services ?? '[]') as string[]).forEach(s => map.set(s, (map.get(s) ?? 0) + 1));
        } catch { /* ignore */ }
      }
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => `${s}(${c}x)`).join(', ');
    })(),
    recentTitles: incidents.slice(0, 8).map(i => i.title).join(' | '),
  };

  const prompt = `You are an expert SRE analyst. Analyze this incident data for team "${teamName}" over ${windowDays} days:

Total incidents: ${summary.total} (${summary.resolved} resolved)
SEV-0: ${summary.sev0}, SEV-1: ${summary.sev1}
Avg MTTR: ${summary.avgMttrMin} minutes
Most affected services: ${summary.topServices}
Recent incidents: ${summary.recentTitles}

Generate 3-5 specific, actionable insights as a JSON array. Each insight must have:
- type: "warning"|"pattern"|"recommendation"|"achievement"
- title: (short, <60 chars)
- detail: (specific, data-backed, <150 chars)
- severity: "critical"|"high"|"medium"|"low"|"positive"
- actionable: true|false
- action: (specific action if actionable)

Respond ONLY with valid JSON array, no explanation.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API ${response.status}`);

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Extract JSON array from response
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in Gemini response');

  const parsed = JSON.parse(jsonMatch[0]) as AiInsight[];
  return parsed.map(i => ({ ...i, actionable: Boolean(i.actionable) }));
}
