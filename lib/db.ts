/**
 * db.ts — Persistent SQLite incident database for AURA.
 *
 * Stores incident metadata, evidence items, participant records, transcripts,
 * and postmortem reports. Enables "similar incident" lookups and full-text search
 * for future decision-making intelligence.
 *
 * Uses better-sqlite3 for synchronous, zero-config, file-based persistence.
 */

import Database from 'better-sqlite3';
import path from 'path';

// ─── Database Singleton ───

let db: Database.Database | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'aura.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();

  // Ensure directory exists
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for concurrent reads
  db.pragma('foreign_keys = ON');

  initializeSchema(db);
  return db;
}

// ─── Schema Definition & Migration ───

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'SEV-1',
      status TEXT NOT NULL DEFAULT 'investigating',
      channel_name TEXT NOT NULL,
      opened_at INTEGER NOT NULL,
      resolved_at INTEGER,
      affected_services TEXT NOT NULL DEFAULT '[]',
      incident_commander_uid TEXT,
      cost_accrued REAL DEFAULT 0,
      cognitive_load_score INTEGER DEFAULT 0,
      ooda_phase TEXT DEFAULT 'OBSERVE',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      speaker_uid TEXT,
      speaker_name TEXT,
      confidence INTEGER DEFAULT 80,
      timestamp INTEGER NOT NULL,
      service_affected TEXT,
      related_to TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      assigned_to TEXT,
      eta INTEGER,
      action_status TEXT,
      deciding_metric TEXT,
      hypothesis_a TEXT,
      hypothesis_b TEXT,
      speaker_a_uid TEXT,
      speaker_b_uid TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      is_incident_commander INTEGER DEFAULT 0,
      joined_at INTEGER NOT NULL,
      left_at INTEGER,
      total_speaking_ms INTEGER DEFAULT 0,
      turn_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      UNIQUE(incident_id, uid)
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      speaker_name TEXT NOT NULL,
      speaker_uid TEXT,
      text TEXT NOT NULL,
      is_agent INTEGER DEFAULT 0,
      is_filler INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL,
      turn_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS postmortems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      root_cause TEXT,
      timeline_json TEXT DEFAULT '[]',
      action_items_json TEXT DEFAULT '[]',
      lessons_learned TEXT,
      generated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    -- Indexes for fast lookups
    CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence_items(incident_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_category ON evidence_items(category);
    CREATE INDEX IF NOT EXISTS idx_transcripts_incident ON transcripts(incident_id);
    CREATE INDEX IF NOT EXISTS idx_participants_incident ON participants(incident_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_opened ON incidents(opened_at);
  `);

  // Full-text search virtual table for evidence content
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts USING fts5(
        content,
        content_rowid='rowid',
        tokenize='porter unicode61'
      );
    `);
  } catch {
    // FTS5 may not be available in all SQLite builds
    console.warn('[DB] FTS5 not available, full-text search will use LIKE fallback');
  }
}

// ─── Incident CRUD ───

export interface DbIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  channel_name: string;
  opened_at: number;
  resolved_at: number | null;
  affected_services: string;
  incident_commander_uid: string | null;
  cost_accrued: number;
  cognitive_load_score: number;
  ooda_phase: string;
  created_at: string;
  updated_at: string;
}

export interface DbEvidenceItem {
  id: string;
  incident_id: string;
  category: string;
  content: string;
  speaker_uid: string | null;
  speaker_name: string | null;
  confidence: number;
  timestamp: number;
  service_affected: string | null;
  related_to: string;
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
  id: number;
  incident_id: string;
  uid: string;
  display_name: string;
  role: string;
  is_incident_commander: number;
  joined_at: number;
  left_at: number | null;
  total_speaking_ms: number;
  turn_count: number;
}

export interface DbTranscript {
  id: number;
  incident_id: string;
  speaker_name: string;
  speaker_uid: string | null;
  text: string;
  is_agent: number;
  is_filler: number;
  timestamp: number;
  turn_id: string | null;
}

export interface DbPostmortem {
  id: number;
  incident_id: string;
  title: string;
  summary: string;
  root_cause: string | null;
  timeline_json: string;
  action_items_json: string;
  lessons_learned: string | null;
  generated_at: string;
}

// ─── Incident Operations ───

export function upsertIncident(incident: {
  id: string;
  title: string;
  severity: string;
  status: string;
  channelName: string;
  openedAt: number;
  resolvedAt?: number | null;
  affectedServices: string[];
  incidentCommanderUid?: string | null;
  costAccrued?: number;
  cognitiveLoadScore?: number;
  oodaPhase?: string;
}): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO incidents (id, title, severity, status, channel_name, opened_at, resolved_at, affected_services, incident_commander_uid, cost_accrued, cognitive_load_score, ooda_phase, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      severity = excluded.severity,
      status = excluded.status,
      resolved_at = excluded.resolved_at,
      affected_services = excluded.affected_services,
      incident_commander_uid = excluded.incident_commander_uid,
      cost_accrued = excluded.cost_accrued,
      cognitive_load_score = excluded.cognitive_load_score,
      ooda_phase = excluded.ooda_phase,
      updated_at = datetime('now')
  `);

  stmt.run(
    incident.id,
    incident.title,
    incident.severity,
    incident.status,
    incident.channelName,
    incident.openedAt,
    incident.resolvedAt ?? null,
    JSON.stringify(incident.affectedServices),
    incident.incidentCommanderUid ?? null,
    incident.costAccrued ?? 0,
    incident.cognitiveLoadScore ?? 0,
    incident.oodaPhase ?? 'OBSERVE'
  );
}

export function getIncidentById(id: string): DbIncident | undefined {
  const database = getDb();
  return database.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as DbIncident | undefined;
}

export function listIncidents(options?: {
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): { incidents: DbIncident[]; total: number } {
  const database = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.severity) {
    conditions.push('severity = ?');
    params.push(options.severity);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const total = (database.prepare(`SELECT COUNT(*) as count FROM incidents ${where}`).get(...params) as { count: number }).count;
  const incidents = database.prepare(`SELECT * FROM incidents ${where} ORDER BY opened_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as DbIncident[];

  return { incidents, total };
}

// ─── Evidence Operations ───

export function insertEvidence(evidence: {
  id: string;
  incidentId: string;
  category: string;
  content: string;
  speakerUid?: string;
  speakerName?: string;
  confidence?: number;
  timestamp: number;
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
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO evidence_items (
      id, incident_id, category, content, speaker_uid, speaker_name, confidence,
      timestamp, service_affected, related_to, status, assigned_to, eta,
      action_status, deciding_metric, hypothesis_a, hypothesis_b, speaker_a_uid, speaker_b_uid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    evidence.id,
    evidence.incidentId,
    evidence.category,
    evidence.content,
    evidence.speakerUid ?? null,
    evidence.speakerName ?? null,
    evidence.confidence ?? 80,
    evidence.timestamp,
    evidence.serviceAffected ?? null,
    JSON.stringify(evidence.relatedTo ?? []),
    evidence.status ?? 'active',
    evidence.assignedTo ?? null,
    evidence.eta ?? null,
    evidence.actionStatus ?? null,
    evidence.decidingMetric ?? null,
    evidence.hypothesisA ?? null,
    evidence.hypothesisB ?? null,
    evidence.speakerAUid ?? null,
    evidence.speakerBUid ?? null
  );

  // Update FTS index
  try {
    database.prepare(`INSERT OR REPLACE INTO evidence_fts(rowid, content) VALUES ((SELECT rowid FROM evidence_items WHERE id = ?), ?)`).run(evidence.id, evidence.content);
  } catch {
    // FTS not available, silently skip
  }
}

export function getEvidenceByIncident(incidentId: string): DbEvidenceItem[] {
  const database = getDb();
  return database.prepare('SELECT * FROM evidence_items WHERE incident_id = ? ORDER BY timestamp ASC').all(incidentId) as DbEvidenceItem[];
}

// ─── Participant Operations ───

export function upsertParticipant(participant: {
  incidentId: string;
  uid: string;
  displayName: string;
  role: string;
  isIncidentCommander?: boolean;
  joinedAt: number;
  totalSpeakingMs?: number;
  turnCount?: number;
}): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO participants (incident_id, uid, display_name, role, is_incident_commander, joined_at, total_speaking_ms, turn_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(incident_id, uid) DO UPDATE SET
      display_name = excluded.display_name,
      role = excluded.role,
      is_incident_commander = excluded.is_incident_commander,
      total_speaking_ms = excluded.total_speaking_ms,
      turn_count = excluded.turn_count
  `);

  stmt.run(
    participant.incidentId,
    participant.uid,
    participant.displayName,
    participant.role,
    participant.isIncidentCommander ? 1 : 0,
    participant.joinedAt,
    participant.totalSpeakingMs ?? 0,
    participant.turnCount ?? 0
  );
}

export function getParticipantsByIncident(incidentId: string): DbParticipant[] {
  const database = getDb();
  return database.prepare('SELECT * FROM participants WHERE incident_id = ? ORDER BY joined_at ASC').all(incidentId) as DbParticipant[];
}

// ─── Transcript Operations ───

export function insertTranscript(entry: {
  incidentId: string;
  speakerName: string;
  speakerUid?: string;
  text: string;
  isAgent?: boolean;
  isFiller?: boolean;
  timestamp: number;
  turnId?: string;
}): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO transcripts (incident_id, speaker_name, speaker_uid, text, is_agent, is_filler, timestamp, turn_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entry.incidentId,
    entry.speakerName,
    entry.speakerUid ?? null,
    entry.text,
    entry.isAgent ? 1 : 0,
    entry.isFiller ? 1 : 0,
    entry.timestamp,
    entry.turnId ?? null
  );
}

export function getTranscriptsByIncident(incidentId: string): DbTranscript[] {
  const database = getDb();
  return database.prepare('SELECT * FROM transcripts WHERE incident_id = ? ORDER BY timestamp ASC').all(incidentId) as DbTranscript[];
}

// ─── Postmortem Operations ───

export function upsertPostmortem(postmortem: {
  incidentId: string;
  title: string;
  summary: string;
  rootCause?: string;
  timeline?: unknown[];
  actionItems?: unknown[];
  lessonsLearned?: string;
}): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO postmortems (incident_id, title, summary, root_cause, timeline_json, action_items_json, lessons_learned)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(incident_id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      root_cause = excluded.root_cause,
      timeline_json = excluded.timeline_json,
      action_items_json = excluded.action_items_json,
      lessons_learned = excluded.lessons_learned,
      generated_at = datetime('now')
  `);

  stmt.run(
    postmortem.incidentId,
    postmortem.title,
    postmortem.summary,
    postmortem.rootCause ?? null,
    JSON.stringify(postmortem.timeline ?? []),
    JSON.stringify(postmortem.actionItems ?? []),
    postmortem.lessonsLearned ?? null
  );
}

export function getPostmortemByIncident(incidentId: string): DbPostmortem | undefined {
  const database = getDb();
  return database.prepare('SELECT * FROM postmortems WHERE incident_id = ?').get(incidentId) as DbPostmortem | undefined;
}

// ─── Search & Similarity ───

export function searchIncidents(query: string, limit = 20): DbIncident[] {
  const database = getDb();

  // Try FTS5 first
  try {
    const ftsResults = database.prepare(`
      SELECT DISTINCT i.* FROM incidents i
      JOIN evidence_items e ON e.incident_id = i.id
      JOIN evidence_fts f ON f.rowid = e.rowid
      WHERE evidence_fts MATCH ?
      ORDER BY i.opened_at DESC
      LIMIT ?
    `).all(query, limit) as DbIncident[];
    if (ftsResults.length > 0) return ftsResults;
  } catch {
    // FTS not available
  }

  // Fallback to LIKE search
  const likeQuery = `%${query}%`;
  return database.prepare(`
    SELECT DISTINCT i.* FROM incidents i
    LEFT JOIN evidence_items e ON e.incident_id = i.id
    WHERE i.title LIKE ? OR e.content LIKE ? OR i.affected_services LIKE ?
    ORDER BY i.opened_at DESC
    LIMIT ?
  `).all(likeQuery, likeQuery, likeQuery, limit) as DbIncident[];
}

export function findSimilarIncidents(options: {
  services?: string[];
  symptoms?: string;
  excludeId?: string;
  limit?: number;
}): Array<DbIncident & { similarity_score: number }> {
  const database = getDb();
  const limit = options.limit ?? 5;
  const results: Array<DbIncident & { similarity_score: number }> = [];

  // Service-based similarity
  if (options.services && options.services.length > 0) {
    const serviceMatches = database.prepare(`
      SELECT i.*, COUNT(*) as match_count
      FROM incidents i, json_each(i.affected_services) AS s
      WHERE s.value IN (${options.services.map(() => '?').join(',')})
      ${options.excludeId ? 'AND i.id != ?' : ''}
      GROUP BY i.id
      ORDER BY match_count DESC, i.opened_at DESC
      LIMIT ?
    `).all(
      ...options.services,
      ...(options.excludeId ? [options.excludeId] : []),
      limit
    ) as Array<DbIncident & { match_count: number }>;

    for (const m of serviceMatches) {
      results.push({
        ...m,
        similarity_score: Math.min(100, Math.round((m.match_count / options.services.length) * 80)),
      });
    }
  }

  // Symptom-based similarity (text search in evidence)
  if (options.symptoms) {
    const likeQuery = `%${options.symptoms}%`;
    const symptomMatches = database.prepare(`
      SELECT DISTINCT i.*
      FROM incidents i
      JOIN evidence_items e ON e.incident_id = i.id
      WHERE (e.content LIKE ? OR i.title LIKE ?)
      ${options.excludeId ? 'AND i.id != ?' : ''}
      ORDER BY i.opened_at DESC
      LIMIT ?
    `).all(
      likeQuery, likeQuery,
      ...(options.excludeId ? [options.excludeId] : []),
      limit
    ) as DbIncident[];

    for (const m of symptomMatches) {
      if (!results.find((r) => r.id === m.id)) {
        results.push({ ...m, similarity_score: 60 });
      }
    }
  }

  return results.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, limit);
}

// ─── Bulk Persistence (called on incident resolution) ───

export function persistFullIncidentSnapshot(incidentState: {
  incidentId: string;
  title: string;
  severity: string;
  status: string;
  channelName: string;
  openedAt: number;
  resolvedAt?: number;
  affectedServices: string[];
  incidentCommanderUid?: string | null;
  costAccrued?: number;
  cognitiveLoadScore?: number;
  currentOODAPhase?: string;
  participants: Record<string, {
    uid: string;
    displayName: string;
    role: string;
    isIncidentCommander: boolean;
    joinedAt: number;
    totalSpeakingMs: number;
  }>;
  evidenceItems: Array<{
    id: string;
    category: string;
    content: string;
    speakerUid: string;
    speakerName: string;
    confidence: number;
    timestamp: number;
    serviceAffected?: string;
    relatedTo?: string[];
    status: string;
    assignedTo?: string;
    eta?: number;
    actionStatus?: string;
    decidingMetric?: string;
    hypothesisA?: string;
    hypothesisB?: string;
    speakerAUid?: string;
    speakerBUid?: string;
  }>;
}): void {
  const database = getDb();

  const transaction = database.transaction(() => {
    // 1. Upsert incident
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

    // 2. Upsert participants
    for (const p of Object.values(incidentState.participants)) {
      upsertParticipant({
        incidentId: incidentState.incidentId,
        uid: p.uid,
        displayName: p.displayName,
        role: p.role,
        isIncidentCommander: p.isIncidentCommander,
        joinedAt: p.joinedAt,
        totalSpeakingMs: p.totalSpeakingMs,
      });
    }

    // 3. Insert evidence items
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
        speakerAUid: e.speakerAUid,
        speakerBUid: e.speakerBUid,
      });
    }
  });

  transaction();
}

// ─── Statistics ───

export function getIncidentStats(): {
  totalIncidents: number;
  resolvedIncidents: number;
  avgResolutionTimeMs: number;
  incidentsBySeverity: Record<string, number>;
} {
  const database = getDb();

  const total = (database.prepare('SELECT COUNT(*) as count FROM incidents').get() as { count: number }).count;
  const resolved = (database.prepare('SELECT COUNT(*) as count FROM incidents WHERE status = ?').get('resolved') as { count: number }).count;

  const avgResult = database.prepare(
    'SELECT AVG(resolved_at - opened_at) as avg_time FROM incidents WHERE resolved_at IS NOT NULL'
  ).get() as { avg_time: number | null };

  const severityCounts = database.prepare(
    'SELECT severity, COUNT(*) as count FROM incidents GROUP BY severity'
  ).all() as Array<{ severity: string; count: number }>;

  const bySeverity: Record<string, number> = {};
  for (const row of severityCounts) {
    bySeverity[row.severity] = row.count;
  }

  return {
    totalIncidents: total,
    resolvedIncidents: resolved,
    avgResolutionTimeMs: avgResult.avg_time ?? 0,
    incidentsBySeverity: bySeverity,
  };
}
