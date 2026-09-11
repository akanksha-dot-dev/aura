/**
 * db.ts — Zero-dependency, Edge-compatible In-Memory Incident Store for AURA.
 *
 * Stores incident metadata, evidence items, participant records, transcripts,
 * and postmortem reports in memory. Pre-seeded with realistic production outage
 * scenarios from PRESET_SCENARIOS for historical intelligence and similarity lookups.
 *
 * Fully compatible with Cloudflare Pages (no native C++ addons, no better-sqlite3).
 */

import { PRESET_SCENARIOS } from './scenarios';

// ─── Interfaces ───

export interface DbIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  channel_name: string;
  opened_at: number;
  resolved_at: number | null;
  affected_services: string; // JSON string array
  incident_commander_uid: string | null;
  cost_accrued: number;
  cognitive_load_score: number;
  ooda_phase: string;
  created_at: number;
  updated_at: number;
  similarity_score?: number;
}

export interface DbEvidenceItem {
  id: string;
  incident_id: string;
  category: string;
  content: string;
  speaker_uid: string;
  speaker_name: string;
  confidence: number;
  timestamp: number;
  service_affected: string | null;
  related_to: string; // JSON string array
  status: string;
  assigned_to: string | null;
  eta: number | null;
  action_status: string | null;
  deciding_metric: string | null;
  hypothesis_a: string | null;
  hypothesis_b: string | null;
  speaker_a_uid: string | null;
  speaker_b_uid: string | null;
}

export interface DbParticipant {
  incident_id: string;
  uid: string;
  display_name: string;
  role: string;
  is_incident_commander: number;
  joined_at: number;
  total_speaking_ms: number;
  last_spoke_at: number | null;
}

export interface DbTranscript {
  id: number;
  incident_id: string;
  speaker_uid: string | null;
  speaker_name: string;
  text: string;
  is_filler: number;
  filler_type: string | null;
  confidence: number | null;
  timestamp: number;
}

export interface DbPostmortem {
  incident_id: string;
  title?: string;
  summary: string;
  root_cause: string;
  detection: string | null;
  timeline: string; // JSON
  action_items: string; // JSON
  five_whys: string; // JSON
  timeline_json?: string;
  action_items_json?: string;
  five_whys_json?: string;
  generated_at: number;
  published: number;
}

export interface DbKnowledgeItem {
  id: number;
  incident_id: string | null;
  title: string;
  content: string;
  category: string;
  tags: string; // JSON
  quality_score: number;
  times_referenced: number;
  created_at: number;
}

export interface DbIncidentScore {
  incident_id: string;
  time_to_first_hypothesis_ms: number | null;
  time_to_root_cause_ms: number | null;
  mttr_ms: number;
  sla_met: number;
  participant_count: number;
  evidence_count: number;
  action_items_completed: number;
  action_items_total: number;
  overall_score: number;
  created_at: number;
}

// ─── In-Memory Stores ───

const incidentsStore = new Map<string, DbIncident>();
const evidenceStore = new Map<string, DbEvidenceItem[]>();
const participantsStore = new Map<string, Map<string, DbParticipant>>();
const transcriptsStore = new Map<string, DbTranscript[]>();
const postmortemsStore = new Map<string, DbPostmortem>();
const incidentScoresStore = new Map<string, DbIncidentScore>();
const knowledgeBaseStore: DbKnowledgeItem[] = [];

let transcriptSeq = 1;
let knowledgeSeq = 1;
let isSeeded = false;

// ─── Pre-seed Initial Scenarios ───

export function seedHistoricalIncidents(force = false): { seeded: number; message: string } {
  if (isSeeded && !force) {
    return { seeded: incidentsStore.size, message: `Already seeded (${incidentsStore.size} incidents)` };
  }

  const now = Date.now();

  // Seed knowledge items from preset scenarios
  for (const scenario of PRESET_SCENARIOS) {
    const incId = `inc-${scenario.id}`;
    const openedAt = now - 86400000 * 2; // 2 days ago
    const resolvedAt = openedAt + 45 * 60 * 1000; // 45m MTTR

    const inc: DbIncident = {
      id: incId,
      title: scenario.title,
      severity: scenario.severity,
      status: 'resolved',
      channel_name: scenario.channelName,
      opened_at: openedAt,
      resolved_at: resolvedAt,
      affected_services: JSON.stringify(scenario.affectedServices),
      incident_commander_uid: scenario.personas[0]?.uid || 'sarah_ic',
      cost_accrued: Math.round(scenario.costRate * 45),
      cognitive_load_score: 35,
      ooda_phase: 'ACT',
      created_at: openedAt,
      updated_at: resolvedAt,
    };
    incidentsStore.set(incId, inc);

    // Add playbook resolution steps to knowledge base
    if (scenario.playbook) {
      for (const step of scenario.playbook) {
        knowledgeBaseStore.push({
          id: knowledgeSeq++,
          incident_id: incId,
          title: `Playbook: ${step.title}`,
          content: `${step.detail}${step.command ? ` | Command: ${step.command}` : ''}`,
          category: 'resolution',
          tags: JSON.stringify(scenario.affectedServices),
          quality_score: step.priority === 'critical' ? 95 : step.priority === 'high' ? 85 : 75,
          times_referenced: 1,
          created_at: now - 86400000,
        });
      }
    }
  }

  isSeeded = true;
  return { seeded: incidentsStore.size, message: `Successfully seeded ${incidentsStore.size} historical incidents` };
}

// Auto-seed on load
seedHistoricalIncidents();

// ─── Exported Functions ───

export function upsertIncident(incident: {
  id: string;
  title: string;
  severity?: string;
  status?: string;
  channelName?: string;
  openedAt?: number;
  resolvedAt?: number | null;
  affectedServices?: string[];
  incidentCommanderUid?: string | null;
  costAccrued?: number;
  cognitiveLoadScore?: number;
  oodaPhase?: string;
}): void {
  const now = Date.now();
  const existing = incidentsStore.get(incident.id);

  const updated: DbIncident = {
    id: incident.id,
    title: incident.title,
    severity: incident.severity ?? existing?.severity ?? 'SEV-1',
    status: incident.status ?? existing?.status ?? 'investigating',
    channel_name: incident.channelName ?? existing?.channel_name ?? 'incident-war-room',
    opened_at: incident.openedAt ?? existing?.opened_at ?? now,
    resolved_at: incident.resolvedAt !== undefined ? incident.resolvedAt : existing?.resolved_at ?? null,
    affected_services: JSON.stringify(incident.affectedServices ?? (existing ? JSON.parse(existing.affected_services) : [])),
    incident_commander_uid: incident.incidentCommanderUid !== undefined ? incident.incidentCommanderUid : existing?.incident_commander_uid ?? null,
    cost_accrued: incident.costAccrued ?? existing?.cost_accrued ?? 0,
    cognitive_load_score: incident.cognitiveLoadScore ?? existing?.cognitive_load_score ?? 0,
    ooda_phase: incident.oodaPhase ?? existing?.ooda_phase ?? 'OBSERVE',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  incidentsStore.set(incident.id, updated);
}

export function getIncidentById(id: string): DbIncident | undefined {
  return incidentsStore.get(id);
}

export function listIncidents(options?: {
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): { incidents: DbIncident[]; total: number } {
  let list = Array.from(incidentsStore.values());

  if (options?.status) {
    list = list.filter((i) => i.status === options.status);
  }
  if (options?.severity) {
    list = list.filter((i) => i.severity === options.severity);
  }

  list.sort((a, b) => b.opened_at - a.opened_at);

  const total = list.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;
  const paged = list.slice(offset, offset + limit);

  return { incidents: paged, total };
}

export function insertEvidence(evidence: {
  id: string;
  incidentId: string;
  category: string;
  content: string;
  speakerUid?: string;
  speakerName?: string;
  confidence?: number;
  timestamp?: number;
  serviceAffected?: string;
  relatedTo?: string[];
  status?: string;
  assignedTo?: string;
  eta?: number;
  actionStatus?: string;
  decidingMetric?: string;
  hypothesisA?: string;
  hypothesisB?: string;
  speakerAUid?: string;
  speakerBUid?: string;
}): void {
  const item: DbEvidenceItem = {
    id: evidence.id,
    incident_id: evidence.incidentId,
    category: evidence.category,
    content: evidence.content,
    speaker_uid: evidence.speakerUid ?? 'unknown',
    speaker_name: evidence.speakerName ?? 'Unknown',
    confidence: Math.min(85, evidence.confidence ?? (evidence.category === 'fact' ? 85 : 80)),
    timestamp: evidence.timestamp ?? Date.now(),
    service_affected: evidence.serviceAffected ?? null,
    related_to: JSON.stringify(evidence.relatedTo ?? []),
    status: evidence.status ?? 'active',
    assigned_to: evidence.assignedTo ?? null,
    eta: evidence.eta ?? null,
    action_status: evidence.actionStatus ?? null,
    deciding_metric: evidence.decidingMetric ?? null,
    hypothesis_a: evidence.hypothesisA ?? null,
    hypothesis_b: evidence.hypothesisB ?? null,
    speaker_a_uid: evidence.speakerAUid ?? null,
    speaker_b_uid: evidence.speakerBUid ?? null,
  };

  const list = evidenceStore.get(evidence.incidentId) ?? [];
  const idx = list.findIndex((e) => e.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.push(item);
  }
  evidenceStore.set(evidence.incidentId, list);
}

export function getEvidenceByIncident(incidentId: string): DbEvidenceItem[] {
  return evidenceStore.get(incidentId) ?? [];
}

export function upsertParticipant(participant: {
  incidentId: string;
  uid: string;
  displayName: string;
  role: string;
  isIncidentCommander?: boolean;
  joinedAt?: number;
}): void {
  let partMap = participantsStore.get(participant.incidentId);
  if (!partMap) {
    partMap = new Map();
    participantsStore.set(participant.incidentId, partMap);
  }

  const existing = partMap.get(participant.uid);
  const now = Date.now();

  const item: DbParticipant = {
    incident_id: participant.incidentId,
    uid: participant.uid,
    display_name: participant.displayName,
    role: participant.role,
    is_incident_commander: participant.isIncidentCommander ? 1 : 0,
    joined_at: participant.joinedAt ?? existing?.joined_at ?? now,
    total_speaking_ms: existing?.total_speaking_ms ?? 0,
    last_spoke_at: existing?.last_spoke_at ?? now,
  };

  partMap.set(participant.uid, item);
}

export function getParticipantsByIncident(incidentId: string): DbParticipant[] {
  const map = participantsStore.get(incidentId);
  return map ? Array.from(map.values()) : [];
}

export function insertTranscript(entry: {
  incidentId: string;
  speakerUid?: string;
  speakerName: string;
  text: string;
  isFiller?: boolean;
  fillerType?: string;
  confidence?: number;
  timestamp?: number;
}): void {
  const item: DbTranscript = {
    id: transcriptSeq++,
    incident_id: entry.incidentId,
    speaker_uid: entry.speakerUid ?? null,
    speaker_name: entry.speakerName,
    text: entry.text,
    is_filler: entry.isFiller ? 1 : 0,
    filler_type: entry.fillerType ?? null,
    confidence: entry.confidence ?? null,
    timestamp: entry.timestamp ?? Date.now(),
  };

  const list = transcriptsStore.get(entry.incidentId) ?? [];
  list.push(item);
  transcriptsStore.set(entry.incidentId, list);
}

export function getTranscriptsByIncident(incidentId: string): DbTranscript[] {
  return transcriptsStore.get(incidentId) ?? [];
}

export function upsertPostmortem(postmortem: {
  incidentId: string;
  title?: string;
  summary: string;
  rootCause: string;
  detection?: string;
  timeline?: unknown[];
  actionItems?: unknown[];
  fiveWhys?: unknown[];
  lessonsLearned?: string;
  published?: boolean;
}): void {
  const item: DbPostmortem = {
    incident_id: postmortem.incidentId,
    title: postmortem.title,
    summary: postmortem.summary,
    root_cause: postmortem.rootCause,
    detection: postmortem.detection ?? null,
    timeline: JSON.stringify(postmortem.timeline ?? []),
    action_items: JSON.stringify(postmortem.actionItems ?? []),
    five_whys: JSON.stringify(postmortem.fiveWhys ?? []),
    timeline_json: JSON.stringify(postmortem.timeline ?? []),
    action_items_json: JSON.stringify(postmortem.actionItems ?? []),
    five_whys_json: JSON.stringify(postmortem.fiveWhys ?? []),
    generated_at: Date.now(),
    published: postmortem.published ? 1 : 0,
  };
  postmortemsStore.set(postmortem.incidentId, item);
}

export function getPostmortemByIncident(incidentId: string): DbPostmortem | undefined {
  return postmortemsStore.get(incidentId);
}

export function searchIncidents(query: string, limit = 20): DbIncident[] {
  const q = query.trim().toLowerCase();
  if (!q) return listIncidents({ limit }).incidents;

  const matches: DbIncident[] = [];
  for (const inc of incidentsStore.values()) {
    const services = inc.affected_services.toLowerCase();
    const title = inc.title.toLowerCase();
    if (title.includes(q) || services.includes(q) || inc.id.toLowerCase().includes(q)) {
      matches.push(inc);
    }
  }

  return matches.slice(0, limit);
}

export function findSimilarIncidents(options: {
  services?: string[];
  symptoms?: string;
  excludeId?: string;
  limit?: number;
}): DbIncident[] {
  const { services = [], symptoms, excludeId, limit = 5 } = options;
  const targetServices = new Set(services.map((s) => s.toLowerCase()));
  const symptomTokens = symptoms ? symptoms.toLowerCase().split(/\s+/).filter((t) => t.length > 3) : [];

  interface ScoredIncident {
    incident: DbIncident;
    score: number;
  }

  const scored: ScoredIncident[] = [];

  for (const inc of incidentsStore.values()) {
    if (excludeId && inc.id === excludeId) continue;

    let score = 0;
    const incServices: string[] = JSON.parse(inc.affected_services || '[]');

    // Service overlap
    for (const s of incServices) {
      if (targetServices.has(s.toLowerCase())) {
        score += 30;
      }
    }

    // Symptom match in title
    for (const token of symptomTokens) {
      if (inc.title.toLowerCase().includes(token)) {
        score += 15;
      }
    }

    if (score > 0) {
      scored.push({ incident: inc, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.incident);
}

export function persistFullIncidentSnapshot(incidentState: {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  channelName: string;
  openedAt: number;
  resolvedAt?: number | null;
  affectedServices: string[];
  incidentCommanderUid?: string | null;
  costAccrued: number;
  cognitiveLoadScore: number;
  currentOODAPhase?: string;
  participants: Record<string, { uid: string; displayName: string; role: string; isIncidentCommander?: boolean }>;
  evidenceItems: Array<{
    id: string;
    category: string;
    content: string;
    speakerUid: string;
    speakerName: string;
    confidence: number;
    timestamp: number;
    serviceAffected?: string;
    relatedTo: string[];
    status: string;
    assignedTo?: string;
    eta?: number;
    actionStatus?: string;
    decidingMetric?: string;
    hypothesisA?: string;
    hypothesisB?: string;
  }>;
}): void {
  upsertIncident({
    id: incidentState.incidentId,
    title: incidentState.title,
    severity: incidentState.severity,
    status: incidentState.status,
    channelName: incidentState.channelName,
    openedAt: incidentState.openedAt,
    resolvedAt: incidentState.resolvedAt,
    affectedServices: incidentState.affectedServices,
    incidentCommanderUid: incidentState.incidentCommanderUid,
    costAccrued: incidentState.costAccrued,
    cognitiveLoadScore: incidentState.cognitiveLoadScore,
    oodaPhase: incidentState.currentOODAPhase,
  });

  for (const p of Object.values(incidentState.participants)) {
    upsertParticipant({
      incidentId: incidentState.incidentId,
      uid: p.uid,
      displayName: p.displayName,
      role: p.role,
      isIncidentCommander: p.isIncidentCommander,
    });
  }

  for (const e of incidentState.evidenceItems) {
    insertEvidence({
      id: e.id,
      incidentId: incidentState.incidentId,
      category: e.category,
      content: e.content,
      speakerUid: e.speakerUid,
      speakerName: e.speakerName,
      confidence: e.confidence,
      timestamp: e.timestamp,
      serviceAffected: e.serviceAffected,
      relatedTo: e.relatedTo,
      status: e.status,
      assignedTo: e.assignedTo,
      eta: e.eta,
      actionStatus: e.actionStatus,
      decidingMetric: e.decidingMetric,
      hypothesisA: e.hypothesisA,
      hypothesisB: e.hypothesisB,
    });
  }
}

export function getIncidentStats(): {
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  avgCognitiveLoad: number;
  avgMttrMinutes: number;
  bySeverity: Record<string, number>;
} {
  const all = Array.from(incidentsStore.values());
  const active = all.filter((i) => i.status !== 'resolved');
  const resolved = all.filter((i) => i.status === 'resolved' && i.resolved_at);

  const bySeverity: Record<string, number> = { 'SEV-0': 0, 'SEV-1': 0, 'SEV-2': 0, 'SEV-3': 0 };
  let totalCogLoad = 0;
  let totalMttrMs = 0;

  for (const inc of all) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    totalCogLoad += inc.cognitive_load_score;
  }

  for (const inc of resolved) {
    if (inc.resolved_at) {
      totalMttrMs += inc.resolved_at - inc.opened_at;
    }
  }

  return {
    totalIncidents: all.length,
    activeIncidents: active.length,
    resolvedIncidents: resolved.length,
    avgCognitiveLoad: all.length > 0 ? Math.round(totalCogLoad / all.length) : 0,
    avgMttrMinutes: resolved.length > 0 ? Math.round(totalMttrMs / resolved.length / 60000) : 0,
    bySeverity,
  };
}

export function getDatabaseHealth(): {
  status: 'healthy' | 'degraded' | 'error';
  tables: Record<string, number>;
  fileSizeBytes: number;
  walSizeBytes: number;
  uptimeSeconds: number;
} {
  return {
    status: 'healthy',
    tables: {
      incidents: incidentsStore.size,
      evidence: Array.from(evidenceStore.values()).reduce((sum, list) => sum + list.length, 0),
      transcripts: Array.from(transcriptsStore.values()).reduce((sum, list) => sum + list.length, 0),
      postmortems: postmortemsStore.size,
      knowledge_base: knowledgeBaseStore.length,
    },
    fileSizeBytes: 0,
    walSizeBytes: 0,
    uptimeSeconds: Math.round(process.uptime()),
  };
}

export function withTransaction<T>(fn: (db: unknown) => T): T {
  return fn(getDb());
}

/**
 * Mock database interface for legacy callers that execute .prepare().
 */
export function getDb(): {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
    run: (...args: unknown[]) => { changes: number };
  };
  exec: (sql: string) => void;
  pragma: (sql: string) => void;
} {
  return {
    prepare: (sql: string) => {
      const lowerSql = sql.toLowerCase();
      return {
        all: (...args: unknown[]) => {
          if (lowerSql.includes('from incidents')) {
            const excludeId = args[0] as string | undefined;
            return Array.from(incidentsStore.values()).filter((i) => i.id !== excludeId);
          }
          if (lowerSql.includes('from knowledge_base')) {
            return knowledgeBaseStore;
          }
          if (lowerSql.includes('from evidence_items')) {
            return Array.from(evidenceStore.values()).flat();
          }
          return [];
        },
        get: (...args: unknown[]) => {
          if (lowerSql.includes('from incidents')) {
            const id = args[0] as string;
            return incidentsStore.get(id);
          }
          if (lowerSql.includes('from postmortems')) {
            const id = args[0] as string;
            return postmortemsStore.get(id);
          }
          return undefined;
        },
        run: () => ({ changes: 1 }),
      };
    },
    exec: () => {},
    pragma: () => {},
  };
}
