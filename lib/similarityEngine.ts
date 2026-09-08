/**
 * similarityEngine.ts — AI-powered incident similarity engine for AURA.
 *
 * Multi-dimensional similarity scoring using:
 * 1. Service Overlap — Jaccard coefficient on affected services
 * 2. Evidence TF-IDF — Term frequency-inverse document frequency on evidence text
 * 3. Root Cause Match — Exact/partial match on categorized root causes
 * 4. Time-of-Day Correlation — Incidents at similar times of day
 * 5. Severity Match — Same or adjacent severity levels
 *
 * Returns ranked similar incidents with confidence scores and resolution suggestions.
 */

import {
  getDb,
  type DbIncident,
  type DbEvidenceItem,
  getEvidenceByIncident,
} from './db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SimilarIncidentResult {
  incident: DbIncident;
  /** Overall similarity score (0-100) */
  similarityScore: number;
  /** Breakdown of similarity dimensions */
  dimensions: {
    serviceOverlap: number;     // 0-100 — Jaccard coefficient
    evidenceSimilarity: number; // 0-100 — TF-IDF cosine similarity
    rootCauseMatch: number;     // 0-100 — Root cause category match
    timeCorrelation: number;    // 0-100 — Time-of-day proximity
    severityMatch: number;      // 0-100 — Severity level proximity
  };
  /** What resolved this past incident (if resolved) */
  resolutionSteps: string[];
  /** Key evidence items from the past incident */
  keyEvidence: Array<{ category: string; content: string }>;
  /** How many times this service combination has had incidents */
  recurrenceCount: number;
}

export interface PatternAnalysis {
  /** Service → incident count */
  serviceFrequency: Record<string, number>;
  /** Team → { count, avgMttr, trend } */
  teamPerformance: Record<string, { count: number; avgMttrMs: number; trend: 'improving' | 'stable' | 'declining' }>;
  /** Recurring service + root cause patterns */
  recurringPatterns: Array<{
    services: string[];
    rootCause: string;
    occurrences: number;
    lastOccurred: number;
    recommendation: string;
  }>;
  /** Day-of-week × hour heatmap data */
  timeHeatmap: Array<{ day: number; hour: number; count: number }>;
}

// ── TF-IDF Engine ────────────────────────────────────────────────────────────

interface TfIdfDocument {
  incidentId: string;
  terms: Map<string, number>; // term → TF
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'and', 'but', 'or', 'not',
  'so', 'if', 'then', 'that', 'this', 'it', 'its', 'we', 'our', 'they',
  'them', 'their', 'he', 'she', 'him', 'her', 'i', 'my', 'me', 'you',
  'your', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'than', 'too',
  'very', 'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why',
  'how', 'what', 'which', 'who', 'whom', 'about', 'up', 'out', 'off',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function computeTf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [term, count] of counts) {
    tf.set(term, count / len);
  }
  return tf;
}

function computeIdf(documents: TfIdfDocument[]): Map<string, number> {
  const docCount = documents.length;
  const termDocFreq = new Map<string, number>();

  for (const doc of documents) {
    for (const term of doc.terms.keys()) {
      termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of termDocFreq) {
    idf.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
  }

  return idf;
}

function cosineSimilarity(
  tfidfA: Map<string, number>,
  tfidfB: Map<string, number>,
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Compute over union of terms
  const allTerms = new Set([...tfidfA.keys(), ...tfidfB.keys()]);

  for (const term of allTerms) {
    const a = tfidfA.get(term) || 0;
    const b = tfidfB.get(term) || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

// ── Similarity Scoring ───────────────────────────────────────────────────────

function jaccardCoefficient(setA: string[], setB: string[]): number {
  const a = new Set(setA.map(s => s.toLowerCase()));
  const b = new Set(setB.map(s => s.toLowerCase()));

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function timeOfDayProximity(timestampA: number, timestampB: number): number {
  const hourA = new Date(timestampA).getHours();
  const hourB = new Date(timestampB).getHours();
  const diff = Math.abs(hourA - hourB);
  const circularDiff = Math.min(diff, 24 - diff);
  // 0 hours apart → 100%, 12 hours apart → 0%
  return Math.max(0, 1 - circularDiff / 12);
}

function severityProximity(sevA: string, sevB: string): number {
  const levels: Record<string, number> = { 'SEV-0': 0, 'SEV-1': 1, 'SEV-2': 2, 'SEV-3': 3 };
  const a = levels[sevA] ?? 2;
  const b = levels[sevB] ?? 2;
  const diff = Math.abs(a - b);
  return diff === 0 ? 1 : diff === 1 ? 0.6 : diff === 2 ? 0.2 : 0;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Finds incidents similar to the given parameters using multi-dimensional scoring.
 *
 * @param currentServices Services affected by the current incident
 * @param currentEvidence Evidence items from the current incident
 * @param currentSeverity Severity of the current incident
 * @param currentTimestamp When the current incident started
 * @param excludeId Incident ID to exclude (the current one)
 * @param limit Max results to return
 */
export function findSimilarIncidentsAdvanced(options: {
  services: string[];
  evidenceTexts: string[];
  severity: string;
  timestamp: number;
  excludeId?: string;
  limit?: number;
}): SimilarIncidentResult[] {
  const database = getDb();
  const limit = options.limit ?? 10;

  // 1. Fetch all past incidents (resolved or not)
  const allIncidents = database.prepare(`
    SELECT * FROM incidents
    WHERE id != ?
    ORDER BY opened_at DESC
    LIMIT 100
  `).all(options.excludeId || '') as DbIncident[];

  if (allIncidents.length === 0) return [];

  // 2. Build TF-IDF corpus from all evidence
  const currentTokens = tokenize(options.evidenceTexts.join(' '));
  const currentTf = computeTf(currentTokens);

  const documents: TfIdfDocument[] = [
    { incidentId: '__current__', terms: currentTf },
  ];

  const incidentEvidenceMap = new Map<string, DbEvidenceItem[]>();
  for (const inc of allIncidents) {
    const evidence = getEvidenceByIncident(inc.id);
    incidentEvidenceMap.set(inc.id, evidence);

    const allText = [inc.title, ...evidence.map(e => e.content)].join(' ');
    const tokens = tokenize(allText);
    documents.push({ incidentId: inc.id, terms: computeTf(tokens) });
  }

  const idf = computeIdf(documents);

  // Compute TF-IDF vectors
  const currentTfIdf = new Map<string, number>();
  for (const [term, tf] of currentTf) {
    currentTfIdf.set(term, tf * (idf.get(term) || 1));
  }

  // 3. Score each incident
  const results: SimilarIncidentResult[] = [];

  for (const inc of allIncidents) {
    const services: string[] = (() => {
      try {
        return JSON.parse(inc.affected_services);
      } catch {
        return [];
      }
    })();
    const evidence = incidentEvidenceMap.get(inc.id) || [];

    // ─── Dimension 1: Service Overlap (Jaccard) ──────────────────────
    const serviceOverlap = jaccardCoefficient(options.services, services) * 100;

    // ─── Dimension 2: Evidence TF-IDF Similarity ─────────────────────
    const doc = documents.find(d => d.incidentId === inc.id);
    let evidenceSimilarity = 0;
    if (doc) {
      const docTfIdf = new Map<string, number>();
      for (const [term, tf] of doc.terms) {
        docTfIdf.set(term, tf * (idf.get(term) || 1));
      }
      evidenceSimilarity = cosineSimilarity(currentTfIdf, docTfIdf) * 100;
    }

    // ─── Dimension 3: Root Cause Match ───────────────────────────────
    let rootCauseMatch = 0;
    try {
      const rootCause = database.prepare(
        'SELECT category FROM root_causes WHERE incident_id = ?'
      ).get(inc.id) as { category: string } | undefined;
      if (rootCause) {
        // Check if current evidence mentions similar root cause terms
        const rcTerms = tokenize(rootCause.category);
        const overlap = rcTerms.filter(t => currentTokens.includes(t)).length;
        rootCauseMatch = rcTerms.length > 0 ? (overlap / rcTerms.length) * 100 : 0;
      }
    } catch {
      // root_causes table may not exist yet
    }

    // ─── Dimension 4: Time Correlation ───────────────────────────────
    const timeCorrelation = timeOfDayProximity(options.timestamp, inc.opened_at) * 100;

    // ─── Dimension 5: Severity Match ─────────────────────────────────
    const severityMatch = severityProximity(options.severity, inc.severity) * 100;

    // ─── Weighted Overall Score ──────────────────────────────────────
    const weights = {
      serviceOverlap: 0.30,
      evidenceSimilarity: 0.35,
      rootCauseMatch: 0.15,
      timeCorrelation: 0.05,
      severityMatch: 0.15,
    };

    const similarityScore = Math.round(
      serviceOverlap * weights.serviceOverlap +
      evidenceSimilarity * weights.evidenceSimilarity +
      rootCauseMatch * weights.rootCauseMatch +
      timeCorrelation * weights.timeCorrelation +
      severityMatch * weights.severityMatch
    );

    // Skip low-similarity results
    if (similarityScore < 15) continue;

    // ─── Extract Resolution Steps ────────────────────────────────────
    const resolutionSteps: string[] = [];
    try {
      const steps = database.prepare(
        'SELECT action_text FROM resolution_playbook WHERE incident_id = ? AND was_effective = 1 ORDER BY step_order'
      ).all(inc.id) as Array<{ action_text: string }>;
      resolutionSteps.push(...steps.map(s => s.action_text));
    } catch {
      // Table may not exist; fallback to evidence actions
    }

    if (resolutionSteps.length === 0) {
      // Fallback: use completed action items from evidence
      const completedActions = evidence
        .filter(e => e.category === 'action' && e.action_status === 'done')
        .map(e => e.content);
      resolutionSteps.push(...completedActions);
    }

    // ─── Service Recurrence Count ────────────────────────────────────
    let recurrenceCount = 0;
    if (services.length > 0) {
      try {
        const svcConditions = services.map(() => "i.affected_services LIKE ?").join(' OR ');
        const result = database.prepare(`
          SELECT COUNT(DISTINCT i.id) as count FROM incidents i
          WHERE (${svcConditions}) AND i.id != ?
        `).get(...services.map(s => `%${s}%`), inc.id) as { count: number };
        recurrenceCount = result.count;
      } catch {
        // Fallback
      }
    }

    results.push({
      incident: inc,
      similarityScore,
      dimensions: {
        serviceOverlap: Math.round(serviceOverlap),
        evidenceSimilarity: Math.round(evidenceSimilarity),
        rootCauseMatch: Math.round(rootCauseMatch),
        timeCorrelation: Math.round(timeCorrelation),
        severityMatch: Math.round(severityMatch),
      },
      resolutionSteps,
      keyEvidence: evidence
        .filter(e => e.category === 'fact' || e.category === 'hypothesis')
        .slice(0, 5)
        .map(e => ({ category: e.category, content: e.content })),
      recurrenceCount,
    });
  }

  return results
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

// ── Pattern Analysis ─────────────────────────────────────────────────────────

/**
 * Analyzes historical incident patterns for the executive dashboard.
 */
export function analyzePatterns(options?: {
  /** Only include incidents from this many days ago */
  daysBack?: number;
}): PatternAnalysis {
  const database = getDb();
  const daysBack = options?.daysBack ?? 90;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  // Service frequency
  const serviceFrequency: Record<string, number> = {};
  const incidents = database.prepare(
    'SELECT * FROM incidents WHERE opened_at > ? ORDER BY opened_at DESC'
  ).all(cutoff) as DbIncident[];

  for (const inc of incidents) {
    try {
      const services = JSON.parse(inc.affected_services) as string[];
      for (const svc of services) {
        serviceFrequency[svc] = (serviceFrequency[svc] || 0) + 1;
      }
    } catch {
      // Skip malformed JSON
    }
  }

  // Team performance
  const teamPerformance: Record<string, { count: number; avgMttrMs: number; trend: 'improving' | 'stable' | 'declining' }> = {};
  try {
    const teams = database.prepare(`
      SELECT it.team_name, COUNT(*) as count,
        AVG(CASE WHEN i.resolved_at IS NOT NULL THEN i.resolved_at - i.opened_at ELSE NULL END) as avg_mttr
      FROM incident_teams it
      JOIN incidents i ON i.id = it.incident_id
      WHERE i.opened_at > ? AND it.is_primary_owner = 1
      GROUP BY it.team_name
      ORDER BY count DESC
    `).all(cutoff) as Array<{ team_name: string; count: number; avg_mttr: number | null }>;

    for (const team of teams) {
      teamPerformance[team.team_name] = {
        count: team.count,
        avgMttrMs: team.avg_mttr ?? 0,
        trend: 'stable', // TODO: compute trend from time series
      };
    }
  } catch {
    // incident_teams table may not exist yet
  }

  // Recurring patterns
  const recurringPatterns: PatternAnalysis['recurringPatterns'] = [];
  try {
    const patterns = database.prepare(`
      SELECT i.affected_services, rc.category, COUNT(*) as occurrences,
        MAX(i.opened_at) as last_occurred
      FROM incidents i
      JOIN root_causes rc ON rc.incident_id = i.id
      WHERE i.opened_at > ?
      GROUP BY i.affected_services, rc.category
      HAVING occurrences >= 2
      ORDER BY occurrences DESC
      LIMIT 10
    `).all(cutoff) as Array<{ affected_services: string; category: string; occurrences: number; last_occurred: number }>;

    for (const p of patterns) {
      let services: string[];
      try {
        services = JSON.parse(p.affected_services);
      } catch {
        services = [p.affected_services];
      }
      recurringPatterns.push({
        services,
        rootCause: p.category,
        occurrences: p.occurrences,
        lastOccurred: p.last_occurred,
        recommendation: generateRecommendation(services, p.category, p.occurrences),
      });
    }
  } catch {
    // Tables may not exist yet
  }

  // Time heatmap
  const timeHeatmap: PatternAnalysis['timeHeatmap'] = [];
  for (const inc of incidents) {
    const d = new Date(inc.opened_at);
    timeHeatmap.push({
      day: d.getDay(),
      hour: d.getHours(),
      count: 1,
    });
  }

  // Aggregate heatmap
  const heatmapAgg = new Map<string, number>();
  for (const item of timeHeatmap) {
    const key = `${item.day}-${item.hour}`;
    heatmapAgg.set(key, (heatmapAgg.get(key) || 0) + item.count);
  }
  const aggregatedHeatmap = Array.from(heatmapAgg.entries()).map(([key, count]) => {
    const [day, hour] = key.split('-').map(Number);
    return { day, hour, count };
  });

  return {
    serviceFrequency,
    teamPerformance,
    recurringPatterns,
    timeHeatmap: aggregatedHeatmap,
  };
}

function generateRecommendation(services: string[], rootCause: string, occurrences: number): string {
  const svcStr = services.join(', ');
  const rcMap: Record<string, string> = {
    deployment: `${occurrences} incidents on ${svcStr} caused by deployments. Recommendation: Add pre-deployment health checks and canary analysis to CI/CD pipeline.`,
    infrastructure: `${occurrences} infrastructure incidents on ${svcStr}. Recommendation: Review capacity planning and add auto-scaling policies.`,
    dependency: `${occurrences} dependency-related incidents on ${svcStr}. Recommendation: Implement circuit breakers and fallback paths for external dependencies.`,
    configuration: `${occurrences} configuration issues on ${svcStr}. Recommendation: Enforce configuration validation in deployment pipeline and add config drift detection.`,
    capacity: `${occurrences} capacity issues on ${svcStr}. Recommendation: Set up proactive capacity alerting at 70% utilization threshold.`,
    security: `${occurrences} security incidents on ${svcStr}. Recommendation: Schedule security audit and review access controls.`,
  };

  return rcMap[rootCause.toLowerCase()] ||
    `${occurrences} recurring incidents on ${svcStr} with root cause: ${rootCause}. Recommendation: Conduct a focused retrospective on this pattern.`;
}
