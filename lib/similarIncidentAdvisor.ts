/**
 * similarIncidentAdvisor.ts — Proactive similar incident advisory engine for AURA.
 *
 * Monitors live incident evidence and proactively identifies similar past incidents,
 * suggesting resolution steps based on historical data.
 *
 * Features:
 * 1. Evidence-Triggered Analysis — Runs when enough signal is gathered (3+ evidence items)
 * 2. Debounced Evaluation — Re-evaluates every 60s or on hypothesis creation
 * 3. Confidence Filtering — Only surfaces matches above 60% similarity
 * 4. Resolution Playbook Extraction — Pulls resolution steps from matched incidents
 * 5. Knowledge Base Lookup — Supplements with curated knowledge items
 */

import type { IncidentState } from './types';
import {
  findSimilarIncidents,
  getEvidenceByIncident,
  getDb,
  type DbIncident,
} from './db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SimilarIncidentSuggestion {
  incidentId: string;
  title: string;
  severity: string;
  similarityScore: number;
  rootCause: string | null;
  resolutionSteps: string[];
  keyEvidence: Array<{ category: string; content: string }>;
  resolvedAt: number | null;
  mttrMinutes: number | null;
}

export interface AdvisorResult {
  hasSuggestion: boolean;
  suggestions: SimilarIncidentSuggestion[];
  spokenMessage: string | null;
  /** Timestamp when this analysis was run */
  analyzedAt: number;
  /** Number of evidence items used for analysis */
  evidenceCount: number;
}

export interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  category: string;
  qualityScore: number;
  timesReferenced: number;
  incidentId: string | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  /** Minimum evidence items before analysis runs */
  minEvidenceForAnalysis: 3,
  /** Minimum similarity score to surface a suggestion (0-100) */
  minSimilarityScore: 40,
  /** Maximum suggestions to return */
  maxSuggestions: 3,
  /** Minimum seconds between re-evaluations */
  debounceIntervalSec: 60,
  /** Maximum past incidents to compare against */
  searchLimit: 10,
};

// ── State ────────────────────────────────────────────────────────────────────

const lastAnalysisTime = new Map<string, number>();
const lastSuggestionCache = new Map<string, AdvisorResult>();

/**
 * Checks if enough time has passed since the last analysis for this incident.
 */
function shouldReanalyze(incidentId: string): boolean {
  const lastTime = lastAnalysisTime.get(incidentId) ?? 0;
  return (Date.now() - lastTime) / 1000 >= CONFIG.debounceIntervalSec;
}

// ── Core Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze a live incident state and find similar past incidents.
 * Returns suggestions with resolution playbook steps.
 */
export function analyzeSimilarIncidents(state: IncidentState): AdvisorResult {
  const noResult: AdvisorResult = {
    hasSuggestion: false,
    suggestions: [],
    spokenMessage: null,
    analyzedAt: Date.now(),
    evidenceCount: state.evidenceItems.length,
  };

  // Not enough evidence yet
  if (state.evidenceItems.length < CONFIG.minEvidenceForAnalysis) {
    return noResult;
  }

  // Debounce check
  if (!shouldReanalyze(state.incidentId)) {
    const cached = lastSuggestionCache.get(state.incidentId);
    if (cached) return cached;
    return noResult;
  }

  lastAnalysisTime.set(state.incidentId, Date.now());

  try {
    // Build symptom string from evidence
    const symptoms = state.evidenceItems
      .filter((e) => e.category === 'fact' || e.category === 'hypothesis')
      .map((e) => e.content)
      .join('. ');

    // Find similar past incidents from DB
    const similarIncidents = findSimilarIncidents({
      services: state.affectedServices,
      symptoms,
      excludeId: state.incidentId,
      limit: CONFIG.searchLimit,
    });

    if (similarIncidents.length === 0) {
      lastSuggestionCache.set(state.incidentId, noResult);
      return noResult;
    }

    const db = getDb();

    // Enrich with resolution steps and root cause
    const suggestions: SimilarIncidentSuggestion[] = similarIncidents
      .map((inc: DbIncident) => {
        // Compute a similarity score based on service overlap + evidence overlap
        const incServices: string[] = JSON.parse(inc.affected_services || '[]');
        const serviceOverlap = state.affectedServices.filter((s) =>
          incServices.includes(s),
        ).length;
        const serviceScore = incServices.length > 0
          ? (serviceOverlap / Math.max(state.affectedServices.length, incServices.length)) * 100
          : 0;

        // Get evidence similarity
        const pastEvidence = getEvidenceByIncident(inc.id);
        const pastSymptoms = pastEvidence
          .filter((e) => e.category === 'fact' || e.category === 'hypothesis')
          .map((e) => e.content.toLowerCase());
        const currentSymptoms = state.evidenceItems
          .filter((e) => e.category === 'fact' || e.category === 'hypothesis')
          .map((e) => e.content.toLowerCase());

        // Simple keyword overlap score
        const currentKeywords = new Set(
          currentSymptoms.flatMap((s) => s.split(/\s+/).filter((w) => w.length > 3)),
        );
        const pastKeywords = new Set(
          pastSymptoms.flatMap((s) => s.split(/\s+/).filter((w) => w.length > 3)),
        );
        let keywordOverlap = 0;
        for (const kw of currentKeywords) {
          if (pastKeywords.has(kw)) keywordOverlap++;
        }
        const evidenceScore = currentKeywords.size > 0
          ? (keywordOverlap / currentKeywords.size) * 100
          : 0;

        // Severity proximity score
        const sevOrder = ['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3'];
        const sevDiff = Math.abs(
          sevOrder.indexOf(state.severity) - sevOrder.indexOf(inc.severity),
        );
        const severityScore = Math.max(0, 100 - sevDiff * 30);

        // Combined score (weighted average)
        const similarityScore = Math.round(
          serviceScore * 0.4 + evidenceScore * 0.35 + severityScore * 0.25,
        );

        // Get root cause
        let rootCause: string | null = null;
        try {
          const rc = db
            .prepare('SELECT description FROM root_causes WHERE incident_id = ?')
            .get(inc.id) as { description: string } | undefined;
          rootCause = rc?.description ?? null;
        } catch {
          // Root cause not available
        }

        // Get resolution steps
        let resolutionSteps: string[] = [];
        try {
          const steps = db
            .prepare(
              'SELECT action_text FROM resolution_playbook WHERE incident_id = ? AND was_effective = 1 ORDER BY step_order',
            )
            .all(inc.id) as Array<{ action_text: string }>;
          resolutionSteps = steps.map((s) => s.action_text);
        } catch {
          // Playbook not available
        }

        // Get key evidence items
        const keyEvidence = pastEvidence
          .filter((e) => e.category === 'fact' || (e.category === 'hypothesis' && e.status === 'confirmed'))
          .slice(0, 3)
          .map((e) => ({ category: e.category, content: e.content }));

        // Compute MTTR
        const mttrMinutes = inc.resolved_at && inc.opened_at
          ? Math.round((inc.resolved_at - inc.opened_at) / 60_000)
          : null;

        return {
          incidentId: inc.id,
          title: inc.title,
          severity: inc.severity,
          similarityScore,
          rootCause,
          resolutionSteps,
          keyEvidence,
          resolvedAt: inc.resolved_at,
          mttrMinutes,
        };
      })
      .filter((s) => s.similarityScore >= CONFIG.minSimilarityScore)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, CONFIG.maxSuggestions);

    if (suggestions.length === 0) {
      lastSuggestionCache.set(state.incidentId, noResult);
      return noResult;
    }

    // Generate spoken message for the top suggestion
    const top = suggestions[0];
    let spokenMessage = `I found a similar past incident: "${top.title}" with ${top.similarityScore}% similarity.`;

    if (top.rootCause) {
      spokenMessage += ` The root cause was ${top.rootCause}.`;
    }

    if (top.resolutionSteps.length > 0) {
      spokenMessage += ` It was resolved by: ${top.resolutionSteps.slice(0, 2).join(', and ')}.`;
      spokenMessage += ` Would you like me to pull up the full playbook?`;
    }

    if (top.mttrMinutes) {
      spokenMessage += ` That incident was resolved in ${top.mttrMinutes} minutes.`;
    }

    const result: AdvisorResult = {
      hasSuggestion: true,
      suggestions,
      spokenMessage,
      analyzedAt: Date.now(),
      evidenceCount: state.evidenceItems.length,
    };

    lastSuggestionCache.set(state.incidentId, result);
    return result;
  } catch (error) {
    console.error('[SimilarIncidentAdvisor] Analysis error:', error);
    return noResult;
  }
}

// ── Knowledge Base Search ────────────────────────────────────────────────────

/**
 * Search the knowledge base for relevant items matching affected services or symptoms.
 */
export function searchKnowledgeBase(
  services: string[],
  symptoms?: string,
  limit: number = 5,
): KnowledgeItem[] {
  try {
    const db = getDb();

    // Search by service tags and content keywords
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (services.length > 0) {
      // Simplify: match any service in tags
      for (const s of services) {
        conditions.push(`tags LIKE '%${s.replace(/'/g, "''")}%'`);
      }
    }

    if (symptoms) {
      // Extract keywords for LIKE matching
      const keywords = symptoms
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5);
      for (const kw of keywords) {
        conditions.push(`content LIKE ?`);
        params.push(`%${kw}%`);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    const whereClause = conditions.join(' OR ');
    const results = db
      .prepare(
        `SELECT id, title, content, category, quality_score, times_referenced, incident_id
         FROM knowledge_base
         WHERE ${whereClause}
         ORDER BY quality_score DESC, times_referenced DESC
         LIMIT ?`,
      )
      .all(...params, limit) as Array<{
        id: number;
        title: string;
        content: string;
        category: string;
        quality_score: number;
        times_referenced: number;
        incident_id: string | null;
      }>;

    // Increment reference count for returned items
    const updateStmt = db.prepare(
      'UPDATE knowledge_base SET times_referenced = times_referenced + 1 WHERE id = ?',
    );
    for (const item of results) {
      updateStmt.run(item.id);
    }

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      qualityScore: r.quality_score,
      timesReferenced: r.times_referenced + 1,
      incidentId: r.incident_id,
    }));
  } catch (error) {
    console.error('[SimilarIncidentAdvisor] Knowledge base search error:', error);
    return [];
  }
}

/**
 * Clear analysis cache for a specific incident (e.g., on resolution).
 */
export function clearAdvisorCache(incidentId: string): void {
  lastAnalysisTime.delete(incidentId);
  lastSuggestionCache.delete(incidentId);
}

/**
 * Update analysis configuration at runtime.
 */
export function updateAdvisorConfig(overrides: Partial<typeof CONFIG>): void {
  Object.assign(CONFIG, overrides);
}
