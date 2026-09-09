import { NextRequest, NextResponse } from 'next/server';
import {
  getIncidentState,
  updateIncidentState,
} from '@/lib/incidentStore';
import {
  getDb,
  getEvidenceByIncident,
} from '@/lib/db';
import {
  formatResolutionNotification,
  sendSlackNotification,
  clearEscalationRecord,
} from '@/lib/escalationEngine';
import { clearAdvisorCache } from '@/lib/similarIncidentAdvisor';

export const runtime = 'nodejs';

// ── Types ────────────────────────────────────────────────────────────────────

interface ResolveRequest {
  channelName: string;
  rootCause?: {
    category: string;
    subcategory?: string;
    description: string;
  };
  resolvedBy?: string;
  lessonsLearned?: string;
  actionEffectiveness?: Record<string, 'effective' | 'partial' | 'ineffective'>;
}

interface IncidentScore {
  timeToFirstHypothesisMs: number | null;
  timeToRootCauseMs: number | null;
  mttrMs: number;
  slaMet: boolean;
  participantCount: number;
  evidenceCount: number;
  actionItemsCompleted: number;
  actionItemsTotal: number;
  overallScore: number;
}

// ── SLA Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_SLA_RESOLVE_MINUTES: Record<string, number> = {
  'SEV-0': 60,
  'SEV-1': 240,
  'SEV-2': 1440,
  'SEV-3': 4320,
};

// ── Score Computation ────────────────────────────────────────────────────────

function computeIncidentScore(
  state: typeof import('@/lib/types').IncidentState._type,
  resolvedAt: number,
): IncidentScore {
  const mttrMs = resolvedAt - state.openedAt;

  // Time to first hypothesis
  const firstHypothesis = state.evidenceItems
    .filter((e: { category: string }) => e.category === 'hypothesis')
    .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp)[0];
  const timeToFirstHypothesisMs = firstHypothesis
    ? firstHypothesis.timestamp - state.openedAt
    : null;

  // Time to confirmed root cause
  const confirmedHypothesis = state.evidenceItems.find(
    (e: { category: string; status: string }) => e.category === 'hypothesis' && e.status === 'confirmed',
  );
  const timeToRootCauseMs = confirmedHypothesis
    ? confirmedHypothesis.timestamp - state.openedAt
    : null;

  // SLA compliance
  const slaMinutes = DEFAULT_SLA_RESOLVE_MINUTES[state.severity] ?? 240;
  const mttrMinutes = mttrMs / 60_000;
  const slaMet = mttrMinutes <= slaMinutes;

  // Participant count (exclude AURA)
  const participantCount = Object.keys(state.participants).filter(
    (k: string) => k !== 'aura_agent',
  ).length;

  // Action items
  const actions = state.evidenceItems.filter((e: { category: string }) => e.category === 'action');
  const actionItemsTotal = actions.length;
  const actionItemsCompleted = actions.filter(
    (e: { actionStatus?: string }) => e.actionStatus === 'done',
  ).length;

  // Compute overall score (0-100)
  let overallScore = 50; // Baseline

  // Speed bonuses/penalties
  if (slaMet) overallScore += 15;
  else overallScore -= 15;

  // Hypothesis speed bonus
  if (timeToFirstHypothesisMs !== null) {
    const hypMinutes = timeToFirstHypothesisMs / 60_000;
    if (hypMinutes <= 5) overallScore += 15; // Very fast hypothesis
    else if (hypMinutes <= 10) overallScore += 10;
    else if (hypMinutes <= 20) overallScore += 5;
  } else {
    overallScore -= 10; // No hypothesis logged
  }

  // Root cause confirmation bonus
  if (timeToRootCauseMs !== null) overallScore += 10;

  // Evidence quality bonus
  const factCount = state.evidenceItems.filter((e: { category: string }) => e.category === 'fact').length;
  if (factCount >= 5) overallScore += 5;
  if (factCount >= 10) overallScore += 5;

  // Action completion rate
  if (actionItemsTotal > 0) {
    const completionRate = actionItemsCompleted / actionItemsTotal;
    overallScore += Math.round(completionRate * 10);
  }

  // Participation bonus
  if (participantCount >= 3) overallScore += 5;

  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    timeToFirstHypothesisMs,
    timeToRootCauseMs,
    mttrMs,
    slaMet,
    participantCount,
    evidenceCount: state.evidenceItems.length,
    actionItemsCompleted,
    actionItemsTotal,
    overallScore,
  };
}

// ── Knowledge Extraction ─────────────────────────────────────────────────────

function extractKnowledgeItems(
  state: typeof import('@/lib/types').IncidentState._type,
  rootCause?: ResolveRequest['rootCause'],
  lessonsLearned?: string,
): Array<{
  title: string;
  content: string;
  category: string;
  tags: string[];
  qualityScore: number;
}> {
  const items: Array<{
    title: string;
    content: string;
    category: string;
    tags: string[];
    qualityScore: number;
  }> = [];

  // Extract from confirmed hypothesis
  const confirmedHyp = state.evidenceItems.find(
    (e: { category: string; status: string }) => e.category === 'hypothesis' && e.status === 'confirmed',
  );
  if (confirmedHyp) {
    items.push({
      title: `Root Cause: ${state.title}`,
      content: confirmedHyp.content,
      category: 'root-cause',
      tags: [...state.affectedServices],
      qualityScore: 80,
    });
  }

  // Extract from root cause description
  if (rootCause?.description) {
    items.push({
      title: `${rootCause.category}: ${state.title}`,
      content: rootCause.description,
      category: rootCause.category,
      tags: [...state.affectedServices, rootCause.category],
      qualityScore: 85,
    });
  }

  // Extract from effective actions
  const effectiveActions = state.evidenceItems.filter(
    (e: { category: string; actionStatus?: string }) => e.category === 'action' && e.actionStatus === 'done',
  );
  if (effectiveActions.length > 0) {
    const actionSummary = effectiveActions
      .map((a: { content: string }) => `• ${a.content}`)
      .join('\n');
    items.push({
      title: `Resolution Steps: ${state.title}`,
      content: actionSummary,
      category: 'resolution',
      tags: [...state.affectedServices],
      qualityScore: 70,
    });
  }

  // Extract from lessons learned
  if (lessonsLearned) {
    items.push({
      title: `Lessons Learned: ${state.title}`,
      content: lessonsLearned,
      category: 'lessons-learned',
      tags: [...state.affectedServices],
      qualityScore: 60,
    });
  }

  return items;
}

// ── API Handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/incidents/resolve — Complete incident lifecycle.
 *
 * Body: {
 *   channelName: string,
 *   rootCause?: { category, subcategory?, description },
 *   resolvedBy?: string,
 *   lessonsLearned?: string,
 *   actionEffectiveness?: Record<actionId, 'effective' | 'partial' | 'ineffective'>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: ResolveRequest = await request.json();
    const { channelName, rootCause, resolvedBy, lessonsLearned, actionEffectiveness } = body;

    if (!channelName) {
      return NextResponse.json(
        { error: 'channelName is required', code: 'MISSING_CHANNEL' },
        { status: 400 },
      );
    }

    const state = getIncidentState(channelName);

    if (state.status === 'resolved') {
      return NextResponse.json(
        { error: 'Incident is already resolved', code: 'ALREADY_RESOLVED' },
        { status: 409 },
      );
    }

    const resolvedAt = Date.now();

    // 1. Update incident state to resolved
    const resolvedState = updateIncidentState(channelName, (prev) => ({
      ...prev,
      status: 'resolved' as const,
      resolvedAt,
    }));

    const db = getDb();

    // 2. Compute and persist incident score
    const score = computeIncidentScore(resolvedState, resolvedAt);

    try {
      db.prepare(`
        INSERT INTO incident_scores (
          incident_id, time_to_first_hypothesis_ms, time_to_root_cause_ms,
          mttr_ms, sla_met, participant_count, evidence_count,
          action_items_completed, action_items_total, overall_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(incident_id) DO UPDATE SET
          time_to_first_hypothesis_ms = excluded.time_to_first_hypothesis_ms,
          time_to_root_cause_ms = excluded.time_to_root_cause_ms,
          mttr_ms = excluded.mttr_ms,
          sla_met = excluded.sla_met,
          participant_count = excluded.participant_count,
          evidence_count = excluded.evidence_count,
          action_items_completed = excluded.action_items_completed,
          action_items_total = excluded.action_items_total,
          overall_score = excluded.overall_score
      `).run(
        resolvedState.incidentId,
        score.timeToFirstHypothesisMs,
        score.timeToRootCauseMs,
        score.mttrMs,
        score.slaMet ? 1 : 0,
        score.participantCount,
        score.evidenceCount,
        score.actionItemsCompleted,
        score.actionItemsTotal,
        score.overallScore,
      );
    } catch (err) {
      console.warn('[Resolve] Failed to persist incident score:', err);
    }

    // 3. Persist root cause
    if (rootCause) {
      try {
        db.prepare(`
          INSERT INTO root_causes (incident_id, category, subcategory, description)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(incident_id) DO UPDATE SET
            category = excluded.category,
            subcategory = excluded.subcategory,
            description = excluded.description
        `).run(
          resolvedState.incidentId,
          rootCause.category,
          rootCause.subcategory ?? null,
          rootCause.description,
        );
      } catch (err) {
        console.warn('[Resolve] Failed to persist root cause:', err);
      }
    }

    // 4. Persist resolution playbook from effective actions
    const effectiveActions = resolvedState.evidenceItems.filter(
      (e) => e.category === 'action' && e.actionStatus === 'done',
    );
    if (effectiveActions.length > 0) {
      try {
        const pbStmt = db.prepare(`
          INSERT INTO resolution_playbook (incident_id, step_order, action_text, was_effective, duration_ms)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < effectiveActions.length; i++) {
          const action = effectiveActions[i];
          const effectiveness = actionEffectiveness?.[action.id];
          const wasEffective = effectiveness === 'ineffective' ? 0 : 1;
          pbStmt.run(resolvedState.incidentId, i + 1, action.content, wasEffective, null);
        }
      } catch (err) {
        console.warn('[Resolve] Failed to persist resolution playbook:', err);
      }
    }

    // 5. Extract and persist knowledge items
    const knowledgeItems = extractKnowledgeItems(resolvedState, rootCause, lessonsLearned);
    let knowledgeSaved = 0;
    try {
      const kbStmt = db.prepare(`
        INSERT INTO knowledge_base (incident_id, title, content, category, tags, quality_score)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of knowledgeItems) {
        kbStmt.run(
          resolvedState.incidentId,
          item.title,
          item.content,
          item.category,
          JSON.stringify(item.tags),
          item.qualityScore,
        );
        knowledgeSaved++;
      }
    } catch (err) {
      console.warn('[Resolve] Failed to persist knowledge items:', err);
    }

    // 6. Send resolution notification
    const mttrMinutes = Math.round(score.mttrMs / 60_000);
    let slackSent = false;
    try {
      const notification = formatResolutionNotification(
        resolvedState,
        mttrMinutes,
        rootCause?.description,
      );
      slackSent = await sendSlackNotification(notification);
    } catch (err) {
      console.warn('[Resolve] Failed to send resolution notification:', err);
    }

    // 7. Clean up escalation and advisor state
    clearEscalationRecord(resolvedState.incidentId);
    clearAdvisorCache(resolvedState.incidentId);

    return NextResponse.json({
      resolved: true,
      incidentId: resolvedState.incidentId,
      resolvedAt: new Date(resolvedAt).toISOString(),
      score,
      rootCause: rootCause ?? null,
      knowledgeItemsSaved: knowledgeSaved,
      resolutionStepsSaved: effectiveActions.length,
      slackNotificationSent: slackSent,
      summary: {
        title: resolvedState.title,
        severity: resolvedState.severity,
        mttrMinutes,
        slaMet: score.slaMet,
        overallScore: score.overallScore,
        participantCount: score.participantCount,
        evidenceCount: score.evidenceCount,
      },
    });
  } catch (error) {
    console.error('[/api/incidents/resolve] Error:', error);
    return NextResponse.json(
      { error: 'Resolution failed', code: 'RESOLVE_ERROR', details: String(error) },
      { status: 500 },
    );
  }
}
