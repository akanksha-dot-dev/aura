/**
 * incidentAnalytics.ts â€” Executive intelligence analytics for AURA dashboard.
 *
 * Pure computation layer for management-grade incident metrics:
 * 1. MTTR trend computation (per week/month window)
 * 2. Team risk scoring (0-100) based on MTTR, repeat rate, response speed
 * 3. Recurring pattern detection (service + root cause clustering)
 * 4. Next-incident probability prediction per service
 * 5. Resolution playbook generation from historical data
 * 6. Heatmap data for time-of-day analysis
 * 7. Repeat offender detection with actionable recommendations
 */

// â”€â”€ Minimal incident shape accepted by this module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Intentionally looser than IncidentRecord so callers can pass raw SQLite rows.
export interface IncidentRecord {
  id: string;
  title: string;
  severity: string;
  status: string;
  channel_name?: string;
  opened_at: number;
  resolved_at?: number | null;
  affected_services?: string | null;
  cost_accrued?: number | null;
  [key: string]: unknown;
}

// Re-export as DbIncident alias for backward compatibility
export type DbIncident = IncidentRecord;

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TrendPoint {
  /** ISO date label (e.g., "2026-09-01" for daily or "2026-W36" for weekly) */
  label: string;
  /** Average MTTR in minutes */
  avgMttrMin: number;
  /** Number of incidents in this window */
  count: number;
  /** Total cost accrued */
  totalCost: number;
}

export interface TeamRiskScore {
  teamName: string;
  /** 0-100. Higher = higher risk of poor incident handling */
  riskScore: number;
  /** Contributing factors */
  factors: Array<{ factor: string; weight: number; value: string }>;
  /** Human-readable risk label */
  riskLabel: 'Low' | 'Moderate' | 'High' | 'Critical';
  /** Recommended action */
  recommendation: string;
  /** Recent incident count */
  recentIncidentCount: number;
  /** Average MTTR in minutes */
  avgMttrMin: number;
}

export interface RecurringPattern {
  /** Primary services involved */
  services: string[];
  /** Inferred root cause keyword */
  rootCause: string;
  /** Number of occurrences in the analysis window */
  occurrences: number;
  /** Timestamp of last occurrence */
  lastOccurred: number;
  /** Confidence score of this pattern (0-100) */
  confidence: number;
  /** Actionable recommendation */
  recommendation: string;
  /** Severity distribution */
  severityBreakdown: Record<string, number>;
}

export interface ServiceRiskPrediction {
  service: string;
  /** 0-100 probability of an incident this week */
  incidentProbability: number;
  /** Expected severity if incident occurs */
  predictedSeverity: string;
  /** Days since last incident */
  daysSinceLastIncident: number | null;
  /** Historical average incident interval in days */
  avgIntervalDays: number | null;
  /** Trend: 'improving' | 'stable' | 'degrading' */
  trend: 'improving' | 'stable' | 'degrading';
}

export interface PlaybookStep {
  stepNumber: number;
  action: string;
  owner: string;
  estimatedMinutes: number;
  preconditions: string[];
}

export interface GeneratedPlaybook {
  title: string;
  applicableServices: string[];
  derivedFrom: string[]; // incident IDs
  confidence: number;
  steps: PlaybookStep[];
  estimatedMttrMin: number;
}

export interface AiInsight {
  type: 'warning' | 'pattern' | 'recommendation' | 'achievement';
  title: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  service?: string;
  team?: string;
  incidentIds?: string[];
  actionable: boolean;
  action?: string;
}

// â”€â”€ MTTR Trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Compute MTTR trend points over a sliding window.
 */
export function computeMttrTrend(
  incidents: IncidentRecord[],
  windowDays = 30,
  granularity: 'daily' | 'weekly' = 'weekly',
): TrendPoint[] {
  const resolved = incidents.filter(i => i.resolved_at != null);
  if (resolved.length === 0) return [];

  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const start = now - windowMs;

  const buckets = new Map<string, { mttrSum: number; count: number; cost: number }>();

  for (const incident of resolved) {
    const openedAt = incident.opened_at;
    if (openedAt < start) continue;

    const mttrMs = (incident.resolved_at! - incident.opened_at);
    const mttrMin = mttrMs / 60_000;
    const cost = incident.cost_accrued ?? 0;

    const date = new Date(openedAt);
    let label: string;

    if (granularity === 'daily') {
      label = date.toISOString().slice(0, 10);
    } else {
      // ISO week
      const dayOfWeek = date.getDay() || 7; // Mon=1, Sun=7
      const mondayDate = new Date(date);
      mondayDate.setDate(date.getDate() - dayOfWeek + 1);
      label = mondayDate.toISOString().slice(0, 10);
    }

    const bucket = buckets.get(label) ?? { mttrSum: 0, count: 0, cost: 0 };
    bucket.mttrSum += mttrMin;
    bucket.count += 1;
    bucket.cost += cost;
    buckets.set(label, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { mttrSum, count, cost }]) => ({
      label,
      avgMttrMin: Math.round(mttrSum / count),
      count,
      totalCost: Math.round(cost),
    }));
}

// â”€â”€ Team Risk Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Compute a 0-100 risk score for a team based on their recent incident record.
 */
export function computeTeamRiskScore(
  teamName: string,
  incidents: IncidentRecord[],
  windowDays = 30,
): TeamRiskScore {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const recent = incidents.filter(i => i.opened_at > cutoff);

  // MTTR component (0-40 points: >120min = 40, <20min = 0)
  const resolved = recent.filter(i => i.resolved_at != null);
  const avgMttrMin = resolved.length > 0
    ? resolved.reduce((sum, i) => sum + (i.resolved_at! - i.opened_at) / 60_000, 0) / resolved.length
    : 0;
  const mttrScore = Math.min(40, Math.max(0, (avgMttrMin - 20) / 2.5));

  // Frequency component (0-30 points: >10 per month = 30, 0 = 0)
  const frequencyScore = Math.min(30, recent.length * 3);

  // Severity component (0-20 points)
  const sev0Count = recent.filter(i => i.severity === 'SEV-0').length;
  const sev1Count = recent.filter(i => i.severity === 'SEV-1').length;
  const severityScore = Math.min(20, sev0Count * 10 + sev1Count * 4);

  // Repeat offender component (0-10 points)
  const servicesMap = new Map<string, number>();
  for (const i of recent) {
    try {
      const services: string[] = JSON.parse(i.affected_services ?? '[]');
      for (const svc of services) {
        servicesMap.set(svc, (servicesMap.get(svc) ?? 0) + 1);
      }
    } catch { /* ignore */ }
  }
  const maxServiceHits = Math.max(0, ...servicesMap.values());
  const repeatScore = Math.min(10, maxServiceHits * 2);

  const totalScore = Math.min(100, Math.round(mttrScore + frequencyScore + severityScore + repeatScore));

  const riskLabel: TeamRiskScore['riskLabel'] =
    totalScore >= 70 ? 'Critical' :
    totalScore >= 50 ? 'High' :
    totalScore >= 25 ? 'Moderate' : 'Low';

  const recommendations: Record<TeamRiskScore['riskLabel'], string> = {
    Critical: 'Immediate review required. Schedule incident blameless post-mortem series and code quality audit.',
    High: 'Increase monitoring coverage. Review runbooks for top-hit services. Consider on-call rotation adjustment.',
    Moderate: 'Review top affected services. Ensure all past incidents have completed postmortems.',
    Low: 'Continue current practices. Consider sharing learnings with other teams.',
  };

  return {
    teamName,
    riskScore: totalScore,
    riskLabel,
    recommendation: recommendations[riskLabel],
    recentIncidentCount: recent.length,
    avgMttrMin: Math.round(avgMttrMin),
    factors: [
      { factor: 'Avg MTTR', weight: 40, value: avgMttrMin > 0 ? `${Math.round(avgMttrMin)}m` : 'N/A' },
      { factor: 'Incident frequency', weight: 30, value: `${recent.length} / ${windowDays}d` },
      { factor: 'SEV-0/1 ratio', weight: 20, value: `${sev0Count + sev1Count} critical` },
      { factor: 'Repeat services', weight: 10, value: maxServiceHits > 1 ? `${maxServiceHits}Ã— repeat` : 'None' },
    ],
  };
}

// â”€â”€ Recurring Pattern Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detect recurring incident patterns by clustering on service + root-cause keywords.
 */
export function detectRecurringPatterns(
  incidents: IncidentRecord[],
  minOccurrences = 2,
): RecurringPattern[] {
  // Build a serviceâ†’incidents map
  const serviceIncidents = new Map<string, IncidentRecord[]>();

  for (const incident of incidents) {
    try {
      const services: string[] = JSON.parse(incident.affected_services ?? '[]');
      for (const svc of services) {
        const list = serviceIncidents.get(svc) ?? [];
        list.push(incident);
        serviceIncidents.set(svc, list);
      }
    } catch { /* ignore */ }
  }

  const patterns: RecurringPattern[] = [];

  for (const [service, svcIncidents] of serviceIncidents.entries()) {
    if (svcIncidents.length < minOccurrences) continue;

    // Group by inferred root cause keyword
    const causeGroups = new Map<string, IncidentRecord[]>();

    for (const incident of svcIncidents) {
      const cause = inferRootCauseKeyword(incident.title);
      const group = causeGroups.get(cause) ?? [];
      group.push(incident);
      causeGroups.set(cause, group);
    }

    for (const [cause, group] of causeGroups.entries()) {
      if (group.length < minOccurrences) continue;

      const lastOccurred = Math.max(...group.map(i => i.opened_at));
      const severityBreakdown: Record<string, number> = {};
      for (const i of group) {
        severityBreakdown[i.severity] = (severityBreakdown[i.severity] ?? 0) + 1;
      }

      patterns.push({
        services: [service],
        rootCause: cause,
        occurrences: group.length,
        lastOccurred,
        confidence: Math.min(95, 50 + group.length * 10),
        recommendation: generatePatternRecommendation(service, cause, group.length),
        severityBreakdown,
      });
    }
  }

  return patterns
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
}

function inferRootCauseKeyword(title: string): string {
  const lower = title.toLowerCase();
  if (/database|db|sql|postgres|mysql|redis|connection pool/.test(lower)) return 'database';
  if (/deploy|deployment|release|rollout|canary/.test(lower)) return 'deployment';
  if (/memory|oom|heap|leak/.test(lower)) return 'memory';
  if (/cpu|load|performance|latency|slow/.test(lower)) return 'performance';
  if (/network|dns|timeout|connectivity|ssl/.test(lower)) return 'network';
  if (/auth|authentication|token|cert|certificate/.test(lower)) return 'auth';
  if (/disk|storage|space|volume/.test(lower)) return 'storage';
  if (/kubernetes|k8s|pod|node|cluster/.test(lower)) return 'kubernetes';
  return 'configuration';
}

function generatePatternRecommendation(
  service: string,
  cause: string,
  occurrences: number,
): string {
  const recs: Record<string, string> = {
    database: `Add connection pool monitoring and auto-scaling for ${service}. Consider read replicas.`,
    deployment: `Add automated canary analysis and rollback for ${service} deployments.`,
    memory: `Profile ${service} for memory leaks. Set OOMKiller and JVM heap limits explicitly.`,
    performance: `Add load testing to ${service} CI pipeline. Set SLO alerts at 80% threshold.`,
    network: `Implement retry + circuit breaker for ${service}. Check DNS TTL settings.`,
    auth: `Automate certificate renewal for ${service}. Add token expiry monitoring.`,
    storage: `Set disk usage alerts at 70% for ${service}. Add automated cleanup jobs.`,
    kubernetes: `Review ${service} resource limits and liveness probes. Add PodDisruptionBudgets.`,
    configuration: `Add configuration drift detection for ${service}. Implement GitOps practices.`,
  };

  const base = recs[cause] ?? `Review ${service} incident history for ${cause} pattern.`;
  return occurrences >= 5 ? `URGENT: ${base}` : base;
}

// â”€â”€ Next-Incident Probability Prediction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Predict probability of an incident for a service within the next 7 days.
 * Uses historical incident frequency and recency weighting.
 */
export function predictServiceRisk(
  service: string,
  incidents: IncidentRecord[],
): ServiceRiskPrediction {
  const serviceIncidents = incidents
    .filter(i => {
      try {
        return (JSON.parse(i.affected_services ?? '[]') as string[]).includes(service);
      } catch { return false; }
    })
    .sort((a, b) => b.opened_at - a.opened_at);

  if (serviceIncidents.length === 0) {
    return {
      service,
      incidentProbability: 5,
      predictedSeverity: 'SEV-2',
      daysSinceLastIncident: null,
      avgIntervalDays: null,
      trend: 'stable',
    };
  }

  const now = Date.now();
  const lastIncident = serviceIncidents[0];
  const daysSinceLast = (now - lastIncident.opened_at) / (24 * 60 * 60 * 1000);

  // Compute average interval between incidents
  let avgIntervalDays: number | null = null;
  if (serviceIncidents.length >= 2) {
    const intervals: number[] = [];
    for (let i = 0; i < serviceIncidents.length - 1; i++) {
      intervals.push(
        (serviceIncidents[i].opened_at - serviceIncidents[i + 1].opened_at) / (24 * 60 * 60 * 1000),
      );
    }
    avgIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  // Probability: 0% at avg interval, 100% well past it
  let prob = 10; // baseline
  if (avgIntervalDays !== null) {
    const ratio = daysSinceLast / avgIntervalDays;
    // Logistic-inspired: approaches 90% as ratio â†’ 1.5
    prob = Math.min(90, Math.round(90 * (1 - Math.exp(-2 * ratio))));
  } else {
    // Single data point: base on recency
    prob = daysSinceLast < 7 ? 60 : daysSinceLast < 14 ? 40 : 20;
  }

  // Trend: compare last 30d vs previous 30d
  const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
  const cutoff60 = now - 60 * 24 * 60 * 60 * 1000;
  const last30 = serviceIncidents.filter(i => i.opened_at > cutoff30).length;
  const prev30 = serviceIncidents.filter(i => i.opened_at > cutoff60 && i.opened_at <= cutoff30).length;
  const trend: ServiceRiskPrediction['trend'] =
    last30 > prev30 + 1 ? 'degrading' :
    last30 < prev30 - 1 ? 'improving' : 'stable';

  // Most common severity
  const sevCounts: Record<string, number> = {};
  for (const i of serviceIncidents.slice(0, 5)) {
    sevCounts[i.severity] = (sevCounts[i.severity] ?? 0) + 1;
  }
  const predictedSeverity = Object.entries(sevCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'SEV-2';

  return {
    service,
    incidentProbability: prob,
    predictedSeverity,
    daysSinceLastIncident: Math.round(daysSinceLast),
    avgIntervalDays: avgIntervalDays !== null ? Math.round(avgIntervalDays) : null,
    trend,
  };
}

// â”€â”€ AI Insight Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate actionable AI insights from incident history.
 * Used when LLM is not available (pure rule-based computation).
 */
export function generateComputedInsights(
  incidents: IncidentRecord[],
  windowDays = 90,
): AiInsight[] {
  const insights: AiInsight[] = [];
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const recent = incidents.filter(i => i.opened_at > cutoff);

  if (recent.length === 0) return [];

  // 1. Repeat offender detection
  const serviceCounts = new Map<string, number>();
  for (const i of recent) {
    try {
      const services: string[] = JSON.parse(i.affected_services ?? '[]');
      for (const svc of services) {
        serviceCounts.set(svc, (serviceCounts.get(svc) ?? 0) + 1);
      }
    } catch { /* ignore */ }
  }

  for (const [service, count] of serviceCounts.entries()) {
    if (count >= 4) {
      insights.push({
        type: 'warning',
        title: `"${service}" is a repeat offender`,
        detail: `${count} incidents in the last ${windowDays} days. This service needs a dedicated reliability improvement sprint.`,
        severity: count >= 7 ? 'critical' : 'high',
        service,
        actionable: true,
        action: `Schedule a reliability review for ${service}`,
        incidentIds: recent
          .filter(i => {
            try { return (JSON.parse(i.affected_services) as string[]).includes(service); } catch { return false; }
          })
          .slice(0, 5)
          .map(i => i.id),
      });
    }
  }

  // 2. MTTR degradation detection
  const resolved = recent.filter(i => i.resolved_at != null);
  if (resolved.length >= 4) {
    const sorted = resolved.sort((a, b) => a.opened_at - b.opened_at);
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const avgFirst = firstHalf.reduce((s, i) => s + (i.resolved_at! - i.opened_at), 0) / firstHalf.length / 60000;
    const avgSecond = secondHalf.reduce((s, i) => s + (i.resolved_at! - i.opened_at), 0) / secondHalf.length / 60000;
    const degradation = ((avgSecond - avgFirst) / avgFirst) * 100;

    if (degradation > 25) {
      insights.push({
        type: 'pattern',
        title: 'MTTR is trending up',
        detail: `Average resolution time has increased by ${Math.round(degradation)}% over the last ${windowDays} days. From ${Math.round(avgFirst)}m to ${Math.round(avgSecond)}m.`,
        severity: degradation > 50 ? 'high' : 'medium',
        actionable: true,
        action: 'Review incident resolution playbooks and on-call runbooks',
      });
    } else if (degradation < -20) {
      insights.push({
        type: 'achievement',
        title: 'MTTR is improving',
        detail: `Average resolution time decreased by ${Math.round(Math.abs(degradation))}% â€” from ${Math.round(avgFirst)}m to ${Math.round(avgSecond)}m. Keep it up!`,
        severity: 'positive',
        actionable: false,
      });
    }
  }

  // 3. Time-of-day pattern
  const hourCounts: number[] = Array(24).fill(0);
  for (const i of recent) {
    hourCounts[new Date(i.opened_at).getHours()]++;
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakCount = hourCounts[peakHour];
  if (peakCount >= 3) {
    const timeLabel = peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`;
    insights.push({
      type: 'pattern',
      title: `Incidents peak at ${timeLabel}`,
      detail: `${peakCount} of ${recent.length} incidents occurred around ${timeLabel}. Consider adjusting deployment windows or increasing monitoring during this period.`,
      severity: 'medium',
      actionable: true,
      action: `Avoid deploys in the ${timeLabel} window. Increase alert sensitivity 30min prior.`,
    });
  }

  // 4. High cost incidents
  const highCost = recent.filter(i => (i.cost_accrued ?? 0) > 10000);
  if (highCost.length > 0) {
    const totalCost = highCost.reduce((s, i) => s + (i.cost_accrued ?? 0), 0);
    insights.push({
      type: 'warning',
      title: `$${Math.round(totalCost / 1000)}K accrued in high-cost incidents`,
      detail: `${highCost.length} incidents exceeded $10K in downtime cost. These represent ${Math.round((totalCost / 1000))}K in SLA/revenue impact.`,
      severity: totalCost > 100000 ? 'critical' : 'high',
      actionable: true,
      action: 'Review SLOs and implement automated circuit breakers for top-cost services',
    });
  }

  // 5. Severity-0 frequency
  const sev0 = recent.filter(i => i.severity === 'SEV-0');
  if (sev0.length >= 2) {
    insights.push({
      type: 'warning',
      title: `${sev0.length} SEV-0 incidents in ${windowDays} days`,
      detail: `Critical outages are occurring too frequently. Each SEV-0 represents a full-service failure.`,
      severity: 'critical',
      actionable: true,
      action: 'Implement chaos engineering program to harden against SEV-0 scenarios',
    });
  }

  return insights.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, positive: 4 };
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
  });
}

// â”€â”€ Resolution Playbook Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate a step-by-step resolution playbook from similar past incidents.
 */
export function generateResolutionPlaybook(
  similarIncidents: IncidentRecord[],
  currentTitle: string,
): GeneratedPlaybook {
  const rootCause = inferRootCauseKeyword(currentTitle);
  const services = new Set<string>();

  for (const i of similarIncidents) {
    try {
      const svcs: string[] = JSON.parse(i.affected_services ?? '[]');
      svcs.forEach(s => services.add(s));
    } catch { /* ignore */ }
  }

  // Pre-built playbook templates per root cause
  const templates: Record<string, PlaybookStep[]> = {
    database: [
      { stepNumber: 1, action: 'Check current connection pool utilization', owner: 'On-Call SRE', estimatedMinutes: 2, preconditions: [] },
      { stepNumber: 2, action: 'Review slow query log for blocking queries', owner: 'DBA', estimatedMinutes: 5, preconditions: ['Step 1 complete'] },
      { stepNumber: 3, action: 'Kill long-running queries (>30s)', owner: 'DBA', estimatedMinutes: 3, preconditions: ['Step 2 identifies blockers'] },
      { stepNumber: 4, action: 'Temporarily increase connection pool size', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 5, action: 'Verify service recovery and monitor for 10min', owner: 'IC', estimatedMinutes: 10, preconditions: ['All prior steps complete'] },
    ],
    deployment: [
      { stepNumber: 1, action: 'Identify the offending deployment via git log/Argo', owner: 'On-Call SRE', estimatedMinutes: 3, preconditions: [] },
      { stepNumber: 2, action: 'Check error rate delta vs pre-deploy baseline', owner: 'On-Call SRE', estimatedMinutes: 2, preconditions: ['Step 1 complete'] },
      { stepNumber: 3, action: 'Initiate rollback via ArgoCD / kubectl rollout undo', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: ['Step 2 confirms regression'] },
      { stepNumber: 4, action: 'Verify error rate returns to baseline', owner: 'IC', estimatedMinutes: 5, preconditions: ['Step 3 complete'] },
      { stepNumber: 5, action: 'Notify stakeholders of rollback and ETA for fix', owner: 'IC', estimatedMinutes: 2, preconditions: ['Step 4 confirms recovery'] },
    ],
    memory: [
      { stepNumber: 1, action: 'Check pod/service memory usage via kubectl top / Datadog', owner: 'On-Call SRE', estimatedMinutes: 2, preconditions: [] },
      { stepNumber: 2, action: 'Capture heap dump if JVM-based (jmap -heap)', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: ['Memory > 90%'] },
      { stepNumber: 3, action: 'Rolling restart affected pods', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 4, action: 'Monitor memory trend post-restart', owner: 'IC', estimatedMinutes: 10, preconditions: ['Step 3 complete'] },
      { stepNumber: 5, action: 'File ticket to increase memory limits or fix leak', owner: 'Dev Lead', estimatedMinutes: 3, preconditions: ['Incident stabilized'] },
    ],
    network: [
      { stepNumber: 1, action: 'Check DNS resolution for affected services', owner: 'On-Call SRE', estimatedMinutes: 2, preconditions: [] },
      { stepNumber: 2, action: 'Test connectivity between service mesh nodes', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 3, action: 'Check load balancer health checks and backend pool', owner: 'Network SRE', estimatedMinutes: 5, preconditions: ['Steps 1-2 inconclusive'] },
      { stepNumber: 4, action: 'Review cloud provider status page (AWS/GCP/Azure)', owner: 'IC', estimatedMinutes: 2, preconditions: [] },
      { stepNumber: 5, action: 'Implement failover to secondary region if available', owner: 'On-Call SRE', estimatedMinutes: 10, preconditions: ['Provider issue confirmed'] },
    ],
    performance: [
      { stepNumber: 1, action: 'Identify top consumers of CPU/memory (profiling)', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 2, action: 'Scale out service horizontally (add replicas)', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 3, action: 'Check for N+1 query patterns or hot cache keys', owner: 'Dev Lead', estimatedMinutes: 10, preconditions: ['Step 1 points to DB'] },
      { stepNumber: 4, action: 'Enable CDN/caching layer bypass to reduce backend load', owner: 'On-Call SRE', estimatedMinutes: 5, preconditions: [] },
      { stepNumber: 5, action: 'Monitor p99 latency return to SLO', owner: 'IC', estimatedMinutes: 10, preconditions: ['Mitigation applied'] },
    ],
  };

  const steps = templates[rootCause] ?? templates.performance;
  const avgMttr = similarIncidents.length > 0
    ? Math.round(
        similarIncidents
          .filter(i => i.resolved_at)
          .reduce((s, i) => s + (i.resolved_at! - i.opened_at) / 60000, 0) /
        Math.max(1, similarIncidents.filter(i => i.resolved_at).length)
      )
    : 30;

  return {
    title: `${rootCause.charAt(0).toUpperCase() + rootCause.slice(1)} Incident Playbook`,
    applicableServices: Array.from(services).slice(0, 5),
    derivedFrom: similarIncidents.slice(0, 3).map(i => i.id),
    confidence: Math.min(90, 50 + similarIncidents.length * 8),
    steps,
    estimatedMttrMin: avgMttr,
  };
}

