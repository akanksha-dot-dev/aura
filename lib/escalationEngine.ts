/**
 * escalationEngine.ts — Rules-based escalation & notification engine for AURA.
 *
 * Handles:
 * 1. Escalation Policies — Severity-based rules for when/how to escalate
 * 2. Slack Notifications — Formatted incident cards via webhook
 * 3. Auto-Severity Bump — Upgrades severity when MTTR exceeds SLA
 * 4. Escalation State Tracking — Prevents duplicate pages, tracks ack
 * 5. Notification Formatting — Rich Slack blocks for incidents
 */

import type { IncidentState } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EscalationPolicy {
  severity: string;
  /** Minutes before first auto-escalation page */
  pageAfterMinutes: number;
  /** Minutes before auto-severity bump (0 = disabled) */
  severityBumpAfterMinutes: number;
  /** Target severity after bump */
  bumpToSeverity: string | null;
  /** Maximum number of escalation attempts */
  maxEscalations: number;
  /** Minutes between re-escalation attempts */
  reEscalateIntervalMinutes: number;
}

export interface EscalationRecord {
  incidentId: string;
  severity: string;
  escalationCount: number;
  firstEscalatedAt: number;
  lastEscalatedAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  severityBumped: boolean;
  notificationsSent: number;
}

export interface SlackNotification {
  channel?: string;
  text: string;
  blocks: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
  accessory?: { type: string; text: { type: string; text: string; emoji?: boolean }; url?: string };
}

export type EscalationResult = {
  action: 'escalated' | 'bumped' | 'notified' | 'cooldown' | 'skipped';
  message: string;
  notification?: SlackNotification;
  newSeverity?: string;
};

// ── Default Policies ─────────────────────────────────────────────────────────

const DEFAULT_POLICIES: EscalationPolicy[] = [
  {
    severity: 'SEV-0',
    pageAfterMinutes: 5,
    severityBumpAfterMinutes: 0, // Already highest
    bumpToSeverity: null,
    maxEscalations: 5,
    reEscalateIntervalMinutes: 10,
  },
  {
    severity: 'SEV-1',
    pageAfterMinutes: 15,
    severityBumpAfterMinutes: 60,
    bumpToSeverity: 'SEV-0',
    maxEscalations: 4,
    reEscalateIntervalMinutes: 15,
  },
  {
    severity: 'SEV-2',
    pageAfterMinutes: 30,
    severityBumpAfterMinutes: 120,
    bumpToSeverity: 'SEV-1',
    maxEscalations: 3,
    reEscalateIntervalMinutes: 30,
  },
  {
    severity: 'SEV-3',
    pageAfterMinutes: 120,
    severityBumpAfterMinutes: 480,
    bumpToSeverity: 'SEV-2',
    maxEscalations: 2,
    reEscalateIntervalMinutes: 60,
  },
];

// ── Escalation State ─────────────────────────────────────────────────────────

const escalationRecords = new Map<string, EscalationRecord>();

export function getEscalationRecord(incidentId: string): EscalationRecord | undefined {
  return escalationRecords.get(incidentId);
}

export function acknowledgeEscalation(incidentId: string, acknowledgedBy: string): boolean {
  const record = escalationRecords.get(incidentId);
  if (!record) return false;
  record.acknowledgedAt = Date.now();
  record.acknowledgedBy = acknowledgedBy;
  return true;
}

export function clearEscalationRecord(incidentId: string): void {
  escalationRecords.delete(incidentId);
}

// ── Policy Lookup ────────────────────────────────────────────────────────────

function getPolicy(severity: string): EscalationPolicy {
  return DEFAULT_POLICIES.find((p) => p.severity === severity) ?? DEFAULT_POLICIES[1]; // Default to SEV-1
}

// ── Slack Notification Formatting ────────────────────────────────────────────

export function formatSlackIncidentCard(
  state: IncidentState,
  reason: string,
  joinUrl?: string,
): SlackNotification {
  const elapsed = Math.round((Date.now() - state.openedAt) / 60_000);
  const participantCount = Object.keys(state.participants).filter((k) => k !== 'aura_agent').length;
  const factCount = state.evidenceItems.filter((e) => e.category === 'fact').length;
  const hypothesisCount = state.evidenceItems.filter(
    (e) => e.category === 'hypothesis' && e.status === 'active',
  ).length;
  const actionCount = state.evidenceItems.filter(
    (e) => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress'),
  ).length;

  const sevEmoji: Record<string, string> = {
    'SEV-0': '🔴',
    'SEV-1': '🟠',
    'SEV-2': '🟡',
    'SEV-3': '⚪',
  };

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${sevEmoji[state.severity] ?? '🔵'} ${state.severity} — ${state.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reason:* ${reason}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Status:* ${state.status}` },
        { type: 'mrkdwn', text: `*OODA Phase:* ${state.currentOODAPhase}` },
        { type: 'mrkdwn', text: `*Elapsed:* ${elapsed}m` },
        { type: 'mrkdwn', text: `*Responders:* ${participantCount}` },
        { type: 'mrkdwn', text: `*Facts:* ${factCount} | *Hypotheses:* ${hypothesisCount}` },
        { type: 'mrkdwn', text: `*Pending Actions:* ${actionCount}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Affected Services:* ${state.affectedServices.join(', ')}`,
      },
    },
  ];

  if (joinUrl) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🛡️ *Join the AURA War Room:*',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Join War Room',
          emoji: true,
        },
        url: joinUrl,
      },
    });
  }

  // Recent evidence summary
  const recentEvidence = state.evidenceItems
    .slice(-3)
    .map((e) => `• [${e.category.toUpperCase()}] ${e.content} _(${e.speakerName})_`)
    .join('\n');

  if (recentEvidence) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Latest Evidence:*\n${recentEvidence}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🤖 Sent by *AURA* AI Incident Commander at ${new Date().toISOString()}`,
      },
    ],
  });

  return {
    text: `${sevEmoji[state.severity] ?? '🔵'} ${state.severity} ${state.title} — ${reason}`,
    blocks,
  };
}

export function formatResolutionNotification(
  state: IncidentState,
  mttrMinutes: number,
  rootCause?: string,
): SlackNotification {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `✅ RESOLVED — ${state.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Severity:* ${state.severity}` },
        { type: 'mrkdwn', text: `*MTTR:* ${mttrMinutes}m` },
        { type: 'mrkdwn', text: `*Root Cause:* ${rootCause ?? 'Not categorized'}` },
        {
          type: 'mrkdwn',
          text: `*Evidence Items:* ${state.evidenceItems.length}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🤖 Resolved at ${new Date().toISOString()} — Postmortem auto-generated by *AURA*`,
        },
      ],
    },
  ];

  return {
    text: `✅ RESOLVED — ${state.title} (MTTR: ${mttrMinutes}m)`,
    blocks,
  };
}

// ── Slack Webhook Sender ─────────────────────────────────────────────────────

export async function sendSlackNotification(notification: SlackNotification): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[EscalationEngine] SLACK_WEBHOOK_URL not configured. Logging notification:', notification.text);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      console.error(`[EscalationEngine] Slack webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log('[EscalationEngine] Slack notification sent successfully');
    return true;
  } catch (error) {
    console.error('[EscalationEngine] Slack webhook error:', error);
    return false;
  }
}

// ── Core Escalation Logic ────────────────────────────────────────────────────

/**
 * Evaluates whether an incident should be escalated based on policies.
 * Called by the proactive engine or manually via API.
 */
export function evaluateEscalation(state: IncidentState): EscalationResult {
  if (state.status === 'resolved') {
    return { action: 'skipped', message: 'Incident is resolved' };
  }

  const policy = getPolicy(state.severity);
  const elapsedMin = (Date.now() - state.openedAt) / 60_000;
  const record = escalationRecords.get(state.incidentId);

  // Check for severity bump
  if (
    policy.severityBumpAfterMinutes > 0 &&
    policy.bumpToSeverity &&
    elapsedMin >= policy.severityBumpAfterMinutes &&
    (!record || !record.severityBumped)
  ) {
    // Record the bump
    const updatedRecord: EscalationRecord = record ?? {
      incidentId: state.incidentId,
      severity: state.severity,
      escalationCount: 0,
      firstEscalatedAt: Date.now(),
      lastEscalatedAt: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      severityBumped: false,
      notificationsSent: 0,
    };
    updatedRecord.severityBumped = true;
    updatedRecord.lastEscalatedAt = Date.now();
    escalationRecords.set(state.incidentId, updatedRecord);

    const notification = formatSlackIncidentCard(
      state,
      `⬆️ Auto-escalated: ${state.severity} → ${policy.bumpToSeverity} (SLA threshold exceeded after ${Math.round(elapsedMin)}m)`,
    );

    return {
      action: 'bumped',
      message: `Severity bumped from ${state.severity} to ${policy.bumpToSeverity} after ${Math.round(elapsedMin)}m`,
      notification,
      newSeverity: policy.bumpToSeverity,
    };
  }

  // Check if escalation is due
  if (elapsedMin < policy.pageAfterMinutes) {
    return { action: 'skipped', message: `Escalation not due yet (${Math.round(elapsedMin)}m < ${policy.pageAfterMinutes}m threshold)` };
  }

  // Already acknowledged — skip
  if (record?.acknowledgedAt) {
    return { action: 'skipped', message: 'Escalation already acknowledged' };
  }

  // Check max escalations
  if (record && record.escalationCount >= policy.maxEscalations) {
    return { action: 'skipped', message: `Max escalations reached (${policy.maxEscalations})` };
  }

  // Check re-escalation interval
  if (record) {
    const sinceLast = (Date.now() - record.lastEscalatedAt) / 60_000;
    if (sinceLast < policy.reEscalateIntervalMinutes) {
      return {
        action: 'cooldown',
        message: `Re-escalation cooldown (${Math.round(sinceLast)}m < ${policy.reEscalateIntervalMinutes}m)`,
      };
    }
  }

  // Check if there's been recent progress (evidence in last 5 min)
  const recentEvidence = state.evidenceItems.filter(
    (e) => (Date.now() - e.timestamp) < 5 * 60_000,
  );
  if (recentEvidence.length > 0 && record && record.escalationCount > 0) {
    return { action: 'skipped', message: 'Recent progress detected, deferring re-escalation' };
  }

  // Escalate!
  const updatedRecord: EscalationRecord = record ?? {
    incidentId: state.incidentId,
    severity: state.severity,
    escalationCount: 0,
    firstEscalatedAt: Date.now(),
    lastEscalatedAt: Date.now(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    severityBumped: false,
    notificationsSent: 0,
  };
  updatedRecord.escalationCount += 1;
  updatedRecord.lastEscalatedAt = Date.now();
  updatedRecord.notificationsSent += 1;
  escalationRecords.set(state.incidentId, updatedRecord);

  const isFirstPage = updatedRecord.escalationCount === 1;
  const reason = isFirstPage
    ? `🚨 Incident has been active for ${Math.round(elapsedMin)}m without resolution — initiating escalation`
    : `🔁 Re-escalation #${updatedRecord.escalationCount}: still unresolved after ${Math.round(elapsedMin)}m`;

  const notification = formatSlackIncidentCard(state, reason);

  return {
    action: 'escalated',
    message: reason,
    notification,
  };
}

/**
 * Checks if a severity bump should happen based on SLA targets.
 * Returns the new severity string if a bump is needed, null otherwise.
 */
export function checkSeverityBump(
  currentSeverity: string,
  elapsedMinutes: number,
  slaTargets?: Record<string, number>,
): string | null {
  const defaults: Record<string, number> = {
    'SEV-3': 480,
    'SEV-2': 120,
    'SEV-1': 60,
    'SEV-0': 0, // Can't bump higher
  };

  const targets = slaTargets ?? defaults;
  const threshold = targets[currentSeverity];

  if (threshold === undefined || threshold === 0) return null;
  if (elapsedMinutes < threshold) return null;

  const bumpMap: Record<string, string> = {
    'SEV-3': 'SEV-2',
    'SEV-2': 'SEV-1',
    'SEV-1': 'SEV-0',
  };

  return bumpMap[currentSeverity] ?? null;
}

/**
 * Generates a concise escalation summary for AURA to speak.
 */
export function generateEscalationSpeech(result: EscalationResult, state: IncidentState): string {
  if (result.action === 'bumped') {
    return `Attention team: I've auto-escalated this incident from ${state.severity} to ${result.newSeverity} because our mean time to resolve has exceeded the SLA threshold. Additional resources may be needed.`;
  }

  if (result.action === 'escalated') {
    const participantCount = Object.keys(state.participants).filter((k) => k !== 'aura_agent').length;
    return `I've sent an escalation notification. We currently have ${participantCount} responders and we've been working on this for ${Math.round((Date.now() - state.openedAt) / 60_000)} minutes. The notification includes our current evidence and a join link for additional responders.`;
  }

  return '';
}
