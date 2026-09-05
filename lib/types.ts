import { z } from 'zod';

export const ClassificationType = z.enum([
  'fact', 'hypothesis', 'decision', 'action', 'conflict'
]);
export type ClassificationType = z.infer<typeof ClassificationType>;

export const HypothesisStatus = z.enum([
  'active', 'confirmed', 'disproven', 'resolved', 'stale'
]);
export type HypothesisStatus = z.infer<typeof HypothesisStatus>;

export const IncidentStatus = z.enum([
  'investigating', 'identified', 'monitoring', 'resolved'
]);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const OODAPhase = z.enum([
  'OBSERVE', 'ORIENT', 'DECIDE', 'ACT', 'RESOLVED'
]);
export type OODAPhase = z.infer<typeof OODAPhase>;

export const ActionStatus = z.enum([
  'pending', 'in_progress', 'done', 'blocked'
]);
export type ActionStatus = z.infer<typeof ActionStatus>;

export const Severity = z.enum(['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3']);
export type Severity = z.infer<typeof Severity>;

export const Participant = z.object({
  uid: z.string(),
  displayName: z.string(),
  role: z.string(),
  isIncidentCommander: z.boolean(),
  joinedAt: z.number(),
  totalSpeakingMs: z.number(),
  lastSpokeAt: z.number(),
});
export type Participant = z.infer<typeof Participant>;

export const EvidenceItem = z.object({
  id: z.string(),
  category: ClassificationType,
  content: z.string(),
  speakerUid: z.string(),
  speakerName: z.string(),
  confidence: z.number().max(85),
  timestamp: z.number(),
  serviceAffected: z.string().optional(),
  relatedTo: z.array(z.string()).default([]),
  status: HypothesisStatus.default('active'),
  assignedTo: z.string().optional(),
  eta: z.number().optional(),
  actionStatus: ActionStatus.optional(),
  decidingMetric: z.string().optional(),
  hypothesisA: z.string().optional(),
  hypothesisB: z.string().optional(),
  speakerAUid: z.string().optional(),
  speakerBUid: z.string().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const IncidentState = z.object({
  incidentId: z.string(),
  title: z.string(),
  severity: Severity,
  status: IncidentStatus,
  openedAt: z.number(),
  resolvedAt: z.number().optional(),
  affectedServices: z.array(z.string()),
  participants: z.record(z.string(), Participant),
  incidentCommanderUid: z.string().nullable(),
  evidenceItems: z.array(EvidenceItem),
  eventSeq: z.number().default(0),
  currentOODAPhase: OODAPhase.default('OBSERVE'),
  costAccrued: z.number().default(0),
  cognitiveLoadScore: z.number().default(0),
  lastReadbackAt: z.number().default(0),
});
export type IncidentState = z.infer<typeof IncidentState>;

// Sweller Cognitive Load Score (0-100)
export function calculateCognitiveLoad(state: IncidentState): number {
  const activeHypotheses = state.evidenceItems.filter(
    e => e.category === 'hypothesis' && e.status === 'active'
  ).length;
  const pendingActions = state.evidenceItems.filter(
    e => e.category === 'action' && (e.actionStatus === 'pending' || e.actionStatus === 'in_progress')
  ).length;
  const activeConflicts = state.evidenceItems.filter(
    e => e.category === 'conflict' && e.status === 'active'
  ).length;

  const raw = (activeHypotheses * 15) + (pendingActions * 10) + (activeConflicts * 25);
  return Math.min(100, raw);
}

// Temporal Confidence Decay (D-026)
export function getDisplayConfidence(item: EvidenceItem): number {
  if (item.category !== 'hypothesis' || item.status !== 'active') {
    return item.confidence;
  }
  const ageMinutes = (Date.now() - item.timestamp) / 60_000;
  // Linear decay over 10 minutes (D-026)
  const decayFactor = Math.max(0, 1 - (ageMinutes / 10));
  return Math.round(item.confidence * decayFactor);
}

// OODA Loop Phase Auto-Classification (D-024)
export function classifyOODAPhase(state: IncidentState): OODAPhase {
  if (state.status === 'resolved') return 'RESOLVED';
  if (state.evidenceItems.length === 0) return 'OBSERVE';

  const lastItem = state.evidenceItems[state.evidenceItems.length - 1];

  // Immediate operational transitions based on most recent event
  if (lastItem?.category === 'decision') return 'DECIDE';
  if (lastItem?.category === 'action') return 'ACT';

  const now = Date.now();
  const windowMs = 120_000; // 2-minute sliding window
  const timeFiltered = state.evidenceItems.filter((e) => e.timestamp > now - windowMs);
  const recent = timeFiltered.length >= 2 ? timeFiltered : state.evidenceItems.slice(-4);

  const counts = {
    fact: recent.filter((e) => e.category === 'fact').length,
    hypothesis: recent.filter((e) => e.category === 'hypothesis' && e.status === 'active').length,
    decision: recent.filter((e) => e.category === 'decision').length,
    action: recent.filter((e) => e.category === 'action' && e.actionStatus !== 'done').length,
    conflict: recent.filter((e) => e.category === 'conflict' && e.status === 'active').length,
  };
  const total = recent.length;

  if (counts.action > 0 && counts.action / total >= 0.25) return 'ACT';
  if (counts.decision / total > 0.2) return 'DECIDE';
  if (counts.hypothesis + counts.conflict > 0) return 'ORIENT';
  return 'OBSERVE';
}

// ─── Force-Directed Topology Graph Types & Physics (D-025) ───
export interface TopologyNode {
  id: string;                    // Event ID (e.g., "evt-001")
  category: ClassificationType;  // 'fact' | 'hypothesis' | 'decision' | 'action' | 'conflict'
  content: string;               // Display text (truncated to 60 chars)
  fullContent: string;           // Full text for tooltip
  speakerUid: string;            // Who generated this event
  speakerName: string;           // Display name
  confidence: number;            // 0-85 (capped)
  timestamp: number;             // Unix ms
  status: 'active' | 'confirmed' | 'disproven' | 'resolved' | 'stale';
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface TopologyEdge {
  source: string | TopologyNode;  // Node ID or node reference
  target: string | TopologyNode;  // Node ID or node reference
  type: 'causal' | 'conflict' | 'supports' | 'contradicts';
}

export const forceConfig = {
  chargeStrength: -120,          // Repulsion between all nodes
  linkDistance: 80,              // Edge spring length
  linkStrength: 0.3,
  collisionRadius: 30,           // Prevent overlap
  factClusterStrength: 0.05,     // Facts gravitational cluster
};

// ─── Agora RTM Event Structure (D-013) ───
export interface RTMDashboardEvent {
  type: 'dashboard_event';
  id: string;
  seq: number;
  timestamp: number;
  eventType: 'evidence_added' | 'evidence_updated' | 'status_changed' |
             'ic_claimed' | 'ic_released' | 'action_status_changed' |
             'participant_joined' | 'participant_left';
  payload: Record<string, unknown>;
}
