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

    -- Team/owner attribution for incidents (Pillar 2: Executive Dashboard)
    CREATE TABLE IF NOT EXISTS incident_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      team_name TEXT NOT NULL,
      is_primary_owner INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    -- Root cause categories for pattern analysis (Pillar 2)
    CREATE TABLE IF NOT EXISTS root_causes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      subcategory TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    -- Resolution steps that worked — for future suggestion (Pillar 2)
    CREATE TABLE IF NOT EXISTS resolution_playbook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      action_text TEXT NOT NULL,
      was_effective INTEGER DEFAULT 1,
      duration_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    -- Tags for flexible categorization (Pillar 2)
    CREATE TABLE IF NOT EXISTS incident_tags (
      incident_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (incident_id, tag),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    -- Speaker voice profiles for cross-session recognition (Pillar 1: War Room)
    CREATE TABLE IF NOT EXISTS speaker_profiles (
      uid TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT DEFAULT 'participant',
      embedding_json TEXT NOT NULL,
      embedding_dim INTEGER NOT NULL DEFAULT 66,
      frame_count INTEGER NOT NULL DEFAULT 0,
      identity_confidence INTEGER NOT NULL DEFAULT 0,
      is_enrolled INTEGER NOT NULL DEFAULT 0,
      last_active_at INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Knowledge base — extracted learnings from resolved incidents (Pillar 5)
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags TEXT DEFAULT '[]',
      quality_score INTEGER DEFAULT 50,
      times_referenced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL
    );

    -- SLA targets per severity (Pillar 2: Dashboard)
    CREATE TABLE IF NOT EXISTS sla_targets (
      severity TEXT PRIMARY KEY,
      acknowledge_minutes INTEGER NOT NULL,
      resolve_minutes INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Incident response quality scores (Pillar 5: Post-Incident)
    CREATE TABLE IF NOT EXISTS incident_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id TEXT NOT NULL UNIQUE,
      time_to_first_hypothesis_ms INTEGER,
      time_to_root_cause_ms INTEGER,
      mttr_ms INTEGER,
      sla_met INTEGER DEFAULT 0,
      participant_count INTEGER DEFAULT 0,
      evidence_count INTEGER DEFAULT 0,
      action_items_completed INTEGER DEFAULT 0,
      action_items_total INTEGER DEFAULT 0,
      overall_score INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
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
    CREATE INDEX IF NOT EXISTS idx_speaker_profiles_name ON speaker_profiles(display_name);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_incident ON knowledge_base(incident_id);
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

  // Seed default SLA targets if table is empty
  try {
    const slaCount = database.prepare('SELECT COUNT(*) as count FROM sla_targets').get() as { count: number };
    if (slaCount.count === 0) {
      const slaStmt = database.prepare(
        'INSERT OR IGNORE INTO sla_targets (severity, acknowledge_minutes, resolve_minutes) VALUES (?, ?, ?)',
      );
      slaStmt.run('SEV-0', 15, 60);
      slaStmt.run('SEV-1', 30, 240);
      slaStmt.run('SEV-2', 120, 1440);
      slaStmt.run('SEV-3', 240, 4320);
      console.log('[DB] Seeded default SLA targets');
    }
  } catch {
    console.warn('[DB] Failed to seed SLA targets');
  }
}

// ─── Database Robustness Helpers ───

let writeCount = 0;
const WAL_CHECKPOINT_INTERVAL = 100;

/**
 * Wraps a multi-statement operation in a transaction for atomicity.
 * Automatically retries on SQLITE_BUSY up to 3 times with backoff.
 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDb();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = database.transaction(() => fn(database))();
      writeCount++;
      // Periodic WAL checkpoint
      if (writeCount % WAL_CHECKPOINT_INTERVAL === 0) {
        try {
          database.pragma('wal_checkpoint(PASSIVE)');
        } catch {
          // Non-critical
        }
      }
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('SQLITE_BUSY') && attempt < maxRetries) {
        const backoffMs = attempt * 100;
        console.warn(`[DB] SQLITE_BUSY, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`);
        // Synchronous sleep for SQLite retry
        const end = Date.now() + backoffMs;
        while (Date.now() < end) { /* busy-wait */ }
        continue;
      }
      throw err;
    }
  }
  // Should never reach here due to throw in catch
  throw new Error('Transaction failed after max retries');
}

/**
 * Returns database size and health metrics.
 */
export function getDatabaseHealth(): {
  sizeBytes: number;
  incidentCount: number;
  evidenceCount: number;
  transcriptCount: number;
  knowledgeBaseCount: number;
  walMode: string;
} {
  const database = getDb();
  const fs = require('fs');
  const dbPath = getDbPath();
  let sizeBytes = 0;
  try {
    const stats = fs.statSync(dbPath);
    sizeBytes = stats.size;
  } catch { /* file may not exist yet */ }

  const counts = {
    incidentCount: (database.prepare('SELECT COUNT(*) as c FROM incidents').get() as { c: number }).c,
    evidenceCount: (database.prepare('SELECT COUNT(*) as c FROM evidence_items').get() as { c: number }).c,
    transcriptCount: (database.prepare('SELECT COUNT(*) as c FROM transcripts').get() as { c: number }).c,
    knowledgeBaseCount: (database.prepare('SELECT COUNT(*) as c FROM knowledge_base').get() as { c: number }).c,
  };

  const walMode = String(database.pragma('journal_mode', { simple: true }));

  return { sizeBytes, ...counts, walMode };
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

// ─── Historical Seed Data for Executive Intelligence Dashboard ───

export function seedHistoricalIncidents(force = false): { seeded: number; message: string } {
  const database = getDb();

  const count = (database.prepare('SELECT COUNT(*) as count FROM incidents').get() as { count: number }).count;
  if (count >= 6 && !force) {
    return { seeded: 0, message: `Database already has ${count} incidents. Pass force=true to re-seed.` };
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MIN_MS = 60 * 1000;

  const sampleIncidents = [
    {
      id: 'INC-4819',
      title: 'Token validation latency spike & 504 Gateway Timeouts',
      severity: 'SEV-1',
      status: 'resolved',
      channelName: 'war-room-4819',
      openedAt: now - 18 * DAY_MS,
      resolvedAt: now - 18 * DAY_MS + 26 * MIN_MS,
      affectedServices: ['auth-service', 'api-gateway', 'redis-session'],
      costAccrued: 18500,
      cognitiveLoadScore: 68,
      oodaPhase: 'ACT',
      team: 'Identity & Auth',
      rootCause: {
        category: 'Resource Exhaustion',
        subcategory: 'Redis connection pool saturation',
        description: 'Redis connection pool saturated due to burst of token refresh requests during mobile app update roll-out.',
      },
      tags: ['auth', 'redis', 'timeouts', 'api-gateway'],
      playbook: [
        { text: 'Scaled Redis read replicas from 2 to 6', durationMs: 420000, effective: 1 },
        { text: 'Increased client connection pool maxTotal from 50 to 200 in auth-service configuration', durationMs: 360000, effective: 1 },
        { text: 'Enabled circuit breaker on JWT verification fallback to local public-key cache', durationMs: 240000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4819 Token validation latency spike',
        summary: 'Mobile app v4.2 update rollout caused synchronized token refresh requests that exceeded auth-service Redis connection pool capacity, resulting in cascading 504 gateway timeouts for 26 minutes.',
        rootCause: 'Connection pool starvation in auth-service Redis client library under peak token refresh load.',
        lessonsLearned: 'Always implement jitter on client-side refresh timers. Auto-scale Redis replica read pools proactively before mobile app rollouts.',
      },
    },
    {
      id: 'INC-4822',
      title: 'Payment processing failures with Postgres connection pool exhaustion',
      severity: 'SEV-1',
      status: 'resolved',
      channelName: 'war-room-4822',
      openedAt: now - 14 * DAY_MS,
      resolvedAt: now - 14 * DAY_MS + 38 * MIN_MS,
      affectedServices: ['payment-service', 'postgres-primary', 'billing-gateway'],
      costAccrued: 42000,
      cognitiveLoadScore: 82,
      oodaPhase: 'ACT',
      team: 'Payments Team',
      rootCause: {
        category: 'Database Contention',
        subcategory: 'Connection pool exhaustion',
        description: 'Unindexed query on transactions table holding connection locks during bulk settlement batch run.',
      },
      tags: ['payments', 'postgres', 'locks', 'slow-query'],
      playbook: [
        { text: 'Ran pg_terminate_backend on idle-in-transaction queries older than 60 seconds', durationMs: 180000, effective: 1 },
        { text: 'Added concurrent composite index on transactions(user_id, status, created_at)', durationMs: 900000, effective: 1 },
        { text: 'Restarted payment-service deployment pods to refresh leaked pool connections', durationMs: 300000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4822 Payment processing failures',
        summary: 'Nightly settlement cron triggered unindexed table scan that held Postgres row locks, leading to connection exhaustion for live checkout requests.',
        rootCause: 'Missing composite index on transactions table allowing sequential table scans to monopolize connection pool.',
        lessonsLearned: 'Mandate EXPLAIN ANALYZE reviews in PRs for queries in batch jobs touching core tables.',
      },
    },
    {
      id: 'INC-4835',
      title: 'Stripe webhook deadlock causing payment double-charge timeouts',
      severity: 'SEV-1',
      status: 'resolved',
      channelName: 'war-room-4835',
      openedAt: now - 8 * DAY_MS,
      resolvedAt: now - 8 * DAY_MS + 45 * MIN_MS,
      affectedServices: ['payment-service', 'checkout-api', 'redis-cluster'],
      costAccrued: 55000,
      cognitiveLoadScore: 78,
      oodaPhase: 'ACT',
      team: 'Payments Team',
      rootCause: {
        category: 'Concurrency Bug',
        subcategory: 'Distributed lock timeout too short',
        description: 'Redlock TTL was set to 2000ms while payment gateway callback took up to 3500ms under load, triggering lock expirations and lock contention deadlocks.',
      },
      tags: ['payments', 'webhooks', 'deadlock', 'stripe'],
      playbook: [
        { text: 'Temporarily throttled incoming Stripe webhook worker concurrency to 10', durationMs: 240000, effective: 1 },
        { text: 'Increased Redis lock lease time from 2000ms to 12000ms in payment-service config', durationMs: 600000, effective: 1 },
        { text: 'Retried failed dead-letter-queue transactions with idempotency keys', durationMs: 480000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4835 Stripe webhook deadlock',
        summary: 'Latency increase on third-party payment partner triggered distributed lock lease expiration before transactions completed, creating duplicate processing races.',
        rootCause: 'Aggressive 2-second lock lease duration without renewal heartbeats.',
        lessonsLearned: 'Implement background heartbeat extension for distributed locks in payment pipeline.',
      },
    },
    {
      id: 'INC-4841',
      title: 'Cascading 500s across checkout pipeline due to unhandled NullPointer in v2.4.1',
      severity: 'SEV-0',
      status: 'resolved',
      channelName: 'war-room-4841',
      openedAt: now - 3 * DAY_MS,
      resolvedAt: now - 3 * DAY_MS + 52 * MIN_MS,
      affectedServices: ['payment-service', 'fraud-engine', 'checkout-api'],
      costAccrued: 85000,
      cognitiveLoadScore: 94,
      oodaPhase: 'ACT',
      team: 'Payments Team',
      rootCause: {
        category: 'Software Regression',
        subcategory: 'Missing null check on new currency field',
        description: 'Deployment of v2.4.1 introduced a new currency code field without null check for legacy carts, crashing payment worker threads.',
      },
      tags: ['payments', 'checkout', 'regression', 'sev-0'],
      playbook: [
        { text: 'Initiated immediate canary rollback of payment-service from v2.4.1 to v2.4.0', durationMs: 420000, effective: 1 },
        { text: 'Flushed poisoned cart sessions in Redis cache', durationMs: 180000, effective: 1 },
        { text: 'Verified end-to-end checkout synthetics return HTTP 200', durationMs: 120000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4841 Cascading 500s on Checkout',
        summary: 'Critical SEV-0 outage lasting 52 minutes halting all checkout flows worldwide due to backwards-incompatible currency field deserialization.',
        rootCause: 'Software defect introduced in commit 8f2a1b without backwards-compatibility test on legacy session data.',
        lessonsLearned: 'Payments Team requires automated canary analysis (ACA) and mandatory shadow-traffic validation before full production release.',
      },
    },
    {
      id: 'INC-4850',
      title: 'Elasticsearch cluster yellow status due to unassigned replica shards',
      severity: 'SEV-2',
      status: 'resolved',
      channelName: 'war-room-4850',
      openedAt: now - 10 * DAY_MS,
      resolvedAt: now - 10 * DAY_MS + 16 * MIN_MS,
      affectedServices: ['search-indexer', 'elasticsearch-cluster'],
      costAccrued: 4500,
      cognitiveLoadScore: 42,
      oodaPhase: 'ACT',
      team: 'Search & Data Platform',
      rootCause: {
        category: 'Disk Exhaustion',
        subcategory: 'ES high watermark hit',
        description: 'Disk space exceeded 85% high watermark on node 3, preventing new shard allocation.',
      },
      tags: ['search', 'elasticsearch', 'storage', 'disk'],
      playbook: [
        { text: 'Deleted expired log indices older than 30 days via curator', durationMs: 240000, effective: 1 },
        { text: 'Triggered cluster shard rebalance via POST /_cluster/reroute', durationMs: 360000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4850 Elasticsearch cluster degradation',
        summary: 'Log index lifecycle management failed to purge stale index data, causing node 3 disk utilization to hit flood stage.',
        rootCause: 'Disk capacity threshold breached on single Elasticsearch data node.',
        lessonsLearned: 'Set up disk growth rate alerting at 75% capacity instead of 85%.',
      },
    },
    {
      id: 'INC-4859',
      title: 'Kafka consumer lag exceeding 100k messages on email notifications',
      severity: 'SEV-2',
      status: 'resolved',
      channelName: 'war-room-4859',
      openedAt: now - 5 * DAY_MS,
      resolvedAt: now - 5 * DAY_MS + 22 * MIN_MS,
      affectedServices: ['notification-worker', 'kafka-broker', 'email-gateway'],
      costAccrued: 6200,
      cognitiveLoadScore: 50,
      oodaPhase: 'ACT',
      team: 'Core Infrastructure',
      rootCause: {
        category: 'Third-Party Rate Limit',
        subcategory: 'Email gateway 429 throttling',
        description: 'Marketing campaign blast exceeded transactional email API quota, causing Kafka consumers to back off and accumulate lag.',
      },
      tags: ['kafka', 'notifications', 'rate-limit'],
      playbook: [
        { text: 'Separated transactional notifications topic from marketing notifications topic', durationMs: 480000, effective: 1 },
        { text: 'Scaled notification-worker pods from 4 to 12 partitions', durationMs: 300000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4859 Notification consumer lag',
        summary: 'Bulk email campaign flooded single Kafka partition shared with OTP/password reset emails.',
        rootCause: 'Lack of multi-tenant rate limiting and shared topic usage for different priority queues.',
        lessonsLearned: 'Enforce topic separation between critical transactional emails and bulk marketing messages.',
      },
    },
    {
      id: 'INC-4863',
      title: 'BGP route flap causing intermittent DNS resolution failures',
      severity: 'SEV-1',
      status: 'resolved',
      channelName: 'war-room-4863',
      openedAt: now - 21 * DAY_MS,
      resolvedAt: now - 21 * DAY_MS + 31 * MIN_MS,
      affectedServices: ['dns-resolver', 'edge-router', 'core-api'],
      costAccrued: 31000,
      cognitiveLoadScore: 74,
      oodaPhase: 'ACT',
      team: 'Core Infrastructure',
      rootCause: {
        category: 'Network Infrastructure',
        subcategory: 'Upstream BGP flap',
        description: 'Upstream transit provider flapped routes 14 times in 10 minutes, triggering DNS lookup packet loss.',
      },
      tags: ['dns', 'bgp', 'network', 'edge'],
      playbook: [
        { text: 'Withdrew BGP announcement from problematic ISP transit peer', durationMs: 360000, effective: 1 },
        { text: 'Rerouted traffic through backup Tier-1 transit provider', durationMs: 240000, effective: 1 },
      ],
      postmortem: {
        title: 'Postmortem: INC-4863 Upstream BGP Flapping Outage',
        summary: 'Intermittent DNS packet loss for 12% of North America traffic due to external transit route flapping.',
        rootCause: 'BGP route instability on upstream provider peer connection.',
        lessonsLearned: 'Implement BGP route flap dampening and redundant multi-cloud DNS Anycast.',
      },
    },
    {
      id: 'INC-4870',
      title: 'Checkout cart sync failures due to Redis evictions under peak traffic',
      severity: 'SEV-1',
      status: 'investigating',
      channelName: 'war-room-live',
      openedAt: now - 45 * MIN_MS,
      resolvedAt: null,
      affectedServices: ['payment-service', 'checkout-api', 'cart-service'],
      costAccrued: 14500,
      cognitiveLoadScore: 76,
      oodaPhase: 'ORIENT',
      team: 'Payments Team',
      rootCause: {
        category: 'Resource Exhaustion',
        subcategory: 'Redis maxmemory eviction policy',
        description: 'Cart sessions getting evicted prematurely causing user sessions to drop at final checkout step.',
      },
      tags: ['payments', 'redis', 'checkout', 'active'],
      playbook: [
        { text: 'Increase Redis maxmemory from 16GB to 32GB on session cluster', durationMs: 180000, effective: 1 },
        { text: 'Switch eviction policy from volatile-lru to allkeys-lfu', durationMs: 120000, effective: 1 },
      ],
      postmortem: null,
    },
  ];

  const transaction = database.transaction(() => {
    for (const inc of sampleIncidents) {
      // 1. Upsert incident
      upsertIncident({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        channelName: inc.channelName,
        openedAt: inc.openedAt,
        resolvedAt: inc.resolvedAt,
        affectedServices: inc.affectedServices,
        costAccrued: inc.costAccrued,
        cognitiveLoadScore: inc.cognitiveLoadScore,
        oodaPhase: inc.oodaPhase,
      });

      // 2. Incident team attribution
      database.prepare(`
        INSERT INTO incident_teams (incident_id, team_name, is_primary_owner)
        VALUES (?, ?, 1)
        ON CONFLICT DO NOTHING
      `).run(inc.id, inc.team);

      // 3. Root causes
      if (inc.rootCause) {
        database.prepare(`
          INSERT INTO root_causes (incident_id, category, subcategory, description)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(incident_id) DO UPDATE SET
            category = excluded.category,
            subcategory = excluded.subcategory,
            description = excluded.description
        `).run(inc.id, inc.rootCause.category, inc.rootCause.subcategory, inc.rootCause.description);
      }

      // 4. Tags
      const tagStmt = database.prepare('INSERT OR IGNORE INTO incident_tags (incident_id, tag) VALUES (?, ?)');
      for (const t of inc.tags) {
        tagStmt.run(inc.id, t);
      }

      // 5. Playbook steps
      const pbStmt = database.prepare(`
        INSERT INTO resolution_playbook (incident_id, step_order, action_text, was_effective, duration_ms)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < inc.playbook.length; i++) {
        const step = inc.playbook[i];
        pbStmt.run(inc.id, i + 1, step.text, step.effective, step.durationMs);
      }

      // 6. Postmortem
      if (inc.postmortem) {
        upsertPostmortem({
          incidentId: inc.id,
          title: inc.postmortem.title,
          summary: inc.postmortem.summary,
          rootCause: inc.postmortem.rootCause,
          lessonsLearned: inc.postmortem.lessonsLearned,
        });
      }
    }
  });

  transaction();
  return { seeded: sampleIncidents.length, message: `Successfully seeded ${sampleIncidents.length} historical incidents with teams, root causes, and playbooks.` };
}
