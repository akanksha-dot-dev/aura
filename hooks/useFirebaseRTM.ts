'use client';
/**
 * useFirebaseRTM.ts — Firebase Realtime Database Messaging Hook
 * Replaces: useAgoraRTM.ts (agora-rtm-sdk)
 * Google: Firebase Realtime Database onChildAdded() — sub-100ms guaranteed
 * Same exported interface as useAgoraRTM.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebaseClient';
import { ref, onChildAdded, off, DataSnapshot } from 'firebase/database';
import type { RTMDashboardEvent, EvidenceItem, IncidentState } from '@/lib/types';
import { PERSONAS } from '@/lib/constants';

export interface RTMTranscriptEntry {
  id: string;
  speakerName: string;
  timestamp: number;
  text: string;
  isFinal?: boolean;
}

export interface UseAgoraRTMOptions {
  uid: string;
  userName?: string;
  channelName: string;
  onEvent: (event: RTMDashboardEvent) => void;
  onTranscript?: (entry: RTMTranscriptEntry) => void;
  enabled?: boolean;
}

export interface UseAgoraRTMReturn {
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// Module-level state
const MAX_DEDUP_SET_SIZE = 1000;
let monotonicClientSeq = 800;
const processedEpistemicKeys = new Set<string>();
const seenEventIds = new Set<string>();
const eventBuffer: RTMDashboardEvent[] = [];
const activeSubscribers = new Set<(event: RTMDashboardEvent) => void>();
const activeTranscriptSubscribers = new Set<(entry: RTMTranscriptEntry) => void>();
const connectionStateListeners = new Set<(connected: boolean) => void>();
const errorListeners = new Set<(err: string | null) => void>();

let _rtmIncidentState: IncidentState | null = null;
export function setRtmIncidentState(state: IncidentState): void { _rtmIncidentState = state; }
export function getRtmIncidentState(): IncidentState | null { return _rtmIncidentState; }

function dispatchToSubscribers(event: RTMDashboardEvent) {
  if (seenEventIds.has(event.id)) return;
  seenEventIds.add(event.id);
  if (seenEventIds.size > MAX_DEDUP_SET_SIZE) { const f = seenEventIds.values().next().value; if (f) seenEventIds.delete(f); }
  eventBuffer.push(event);
  eventBuffer.sort((a, b) => a.seq - b.seq);
  while (eventBuffer.length > 0) {
    const e = eventBuffer.shift();
    if (e) activeSubscribers.forEach((h) => { try { h(e); } catch { /* ignore */ } });
  }
}

function dispatchTranscript(entry: RTMTranscriptEntry) {
  activeTranscriptSubscribers.forEach((h) => { try { h(entry); } catch { /* ignore */ } });
}

function broadcastConnectionState(c: boolean) { connectionStateListeners.forEach((f) => { try { f(c); } catch { /* ignore */ } }); }
function broadcastError(e: string | null) { errorListeners.forEach((f) => { try { f(e); } catch { /* ignore */ } }); }

function extractAndDispatchEpistemicEvents(rawText: string, channelName: string, uid: string, userName?: string) {
  if (!rawText) return;
  const dispatch = (category: 'fact' | 'hypothesis' | 'decision' | 'action' | 'conflict', content: string, extra: { confidence?: number; service?: string; decidingMetric?: string; rationale?: string; assignedTo?: string; eta?: number; hypothesisA?: string; hypothesisB?: string } = {}) => {
    const clean = content.trim().replace(/^["']|["']$/g, '');
    if (!clean || clean.length < 3) return;
    const key = `${category}:${clean.toLowerCase().slice(0, 45)}`;
    if (processedEpistemicKeys.has(key)) return;
    processedEpistemicKeys.add(key);
    const now = Date.now();
    const id = `ev-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const isH = category === 'hypothesis', isA = category === 'action', isC = category === 'conflict';
    const evidenceItem: EvidenceItem = {
      id, category, content: clean, speakerUid: 'aura_agent', speakerName: 'AURA',
      confidence: Math.min(85, extra.confidence || (category === 'fact' ? 85 : 80)),
      timestamp: now, serviceAffected: extra.service || 'core', relatedTo: [],
      decidingMetric: extra.decidingMetric, hypothesisA: extra.hypothesisA, hypothesisB: extra.hypothesisB,
      status: (isH || isC) ? 'active' : 'confirmed',
      assignedTo: extra.assignedTo || (isA ? (userName || 'Responder') : undefined),
      actionStatus: isA ? 'pending' : undefined,
    };
    dispatchToSubscribers({ id, seq: ++monotonicClientSeq, timestamp: now, type: 'dashboard_event', eventType: 'evidence_added', payload: evidenceItem as unknown as Record<string, unknown> });
    if (typeof window !== 'undefined') {
      fetch('/api/incident/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelName, item: evidenceItem }) }).catch(() => {});
    }
  };

  const factTag = rawText.match(/\[LOG_FACT:\s*([^|\]]+?)(?:\s*\|\s*(\d+))?(?:\s*\|\s*([^\]]+?))?\]/i);
  if (factTag) dispatch('fact', factTag[1], { confidence: factTag[2] ? Math.min(85, Number(factTag[2])) : 85, service: factTag[3]?.trim() });

  const hypoTag = rawText.match(/\[LOG_HYPOTHESIS:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*(\d+))?\]/i);
  if (hypoTag) dispatch('hypothesis', hypoTag[1], { decidingMetric: hypoTag[2]?.trim(), confidence: hypoTag[3] ? Math.min(85, Number(hypoTag[3])) : 80 });

  const conflictTag = rawText.match(/\[LOG_CONFLICT:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i);
  if (conflictTag) { const a = conflictTag[1].trim(), b = conflictTag[2].trim(); dispatch('conflict', `${a} vs ${b}`, { hypothesisA: a, hypothesisB: b, decidingMetric: conflictTag[3]?.trim(), confidence: 85 }); }

  const decTag = rawText.match(/\[LOG_DECISION:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i);
  if (decTag) dispatch('decision', decTag[1], { rationale: decTag[2]?.trim() });

  const actTag = rawText.match(/\[LOG_ACTION:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*([^\]]+?))?\]/i);
  if (actTag) dispatch('action', actTag[1], { assignedTo: actTag[2]?.trim(), eta: actTag[3] ? Number(actTag[3]) : undefined });

  const resolveTag = rawText.match(/\[RESOLVE_CONFLICT:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i);
  if (resolveTag && resolveTag[1].trim().length >= 3) {
    dispatchToSubscribers({ id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, seq: ++monotonicClientSeq, timestamp: Date.now(), type: 'dashboard_event', eventType: 'evidence_updated', payload: { id: resolveTag[1].trim(), status: 'resolved', rationale: resolveTag[2]?.trim() || 'Resolved' } });
  }

  const completeTag = rawText.match(/\[COMPLETE_ACTION:\s*([^|\]]+?)\]/i);
  if (completeTag) dispatchToSubscribers({ id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, seq: ++monotonicClientSeq, timestamp: Date.now(), type: 'dashboard_event', eventType: 'action_status_changed', payload: { actionId: completeTag[1].trim(), status: 'completed' } });

  const spokenHypo = rawText.match(/(?:logging\s+hypothesis|the\s+hypothesis\s+has\s+been\s+recorded):\s*["']?([^"'\n]+?)["']?(?:\.|with|the\s+deciding|\s*$)/i);
  if (spokenHypo) { const m = rawText.match(/deciding\s+metric\s+will\s+be\s+(?:the\s+)?([^.]+)/i); dispatch('hypothesis', spokenHypo[1], { decidingMetric: m ? m[1].trim() : 'Telemetry verification', confidence: 80 }); }

  const spokenFact = rawText.match(/(?:logging\s+fact|recorded\s+as\s+fact):\s*["']?([^"'\n]+?)["']?(?:\.|with|logging|\s*$)/i);
  if (spokenFact) dispatch('fact', spokenFact[1], { confidence: 85 });
}

let activeUnsubscribe: (() => void) | null = null;

export function useAgoraRTM({ uid, userName, channelName, onEvent, onTranscript, enabled = true }: UseAgoraRTMOptions): UseAgoraRTMReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const onEventRef = useRef(onEvent);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    isMountedRef.current = true;
    const handleConn = (c: boolean) => { if (isMountedRef.current) setIsConnected(c); };
    const handleErr = (e: string | null) => { if (isMountedRef.current) setError(e); };
    connectionStateListeners.add(handleConn);
    errorListeners.add(handleErr);
    const handleEvt = (e: RTMDashboardEvent) => { if (isMountedRef.current) onEventRef.current(e); };
    const handleTr = (e: RTMTranscriptEntry) => { if (isMountedRef.current) onTranscriptRef.current?.(e); };
    activeSubscribers.add(handleEvt);
    activeTranscriptSubscribers.add(handleTr);
    return () => {
      isMountedRef.current = false;
      connectionStateListeners.delete(handleConn);
      errorListeners.delete(handleErr);
      activeSubscribers.delete(handleEvt);
      activeTranscriptSubscribers.delete(handleTr);
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !channelName || !uid) return;
    if (!isFirebaseConfigured()) { broadcastError('Firebase not configured — local mode'); broadcastConnectionState(true); return; }
    const db = getFirebaseDb();
    if (!db) { broadcastError('Firebase DB unavailable'); return; }
    try {
      const eventsRef = ref(db, `channels/${channelName}/events`);
      if (activeUnsubscribe) { activeUnsubscribe(); activeUnsubscribe = null; }
      const handler = (snapshot: DataSnapshot) => {
        try {
          const data = snapshot.val();
          if (!data) return;
          if (data.customType === 'dashboard_event' || data.type === 'dashboard_event') {
            if (data.id && typeof data.seq === 'number' && data.eventType) dispatchToSubscribers(data as RTMDashboardEvent);
            return;
          }
          const text = data.text || data.transcript || data.content;
          if (typeof text === 'string' && text.trim() && text.trim() !== '[SILENT]') {
            const isAgent = data.speakerUid === 'aura_agent' || data.role === 'assistant';
            if (isAgent) extractAndDispatchEpistemicEvents(text, channelName, uid, userName);
            const cleanText = text.replace(/\[(?:LOG_[A-Z]+|SILENT)[^\]]*\]/gi, '').trim();
            if (cleanText) {
              const isFinal = data.isFinal ?? data.is_final ?? false;
              const speakerName = isAgent ? 'AURA' : (data.speakerName || userName || 'Responder');
              const turnKey = data.turnId || (isAgent ? `agent-${Date.now()}` : `user-${Date.now()}`);
              dispatchTranscript({ id: `tr-${turnKey}`, speakerName, timestamp: data.timestamp || Date.now(), text: cleanText, isFinal });
            }
          }
        } catch (e) { console.warn('[useFirebaseRTM] Parse error:', e); }
      };
      onChildAdded(eventsRef, handler);
      activeUnsubscribe = () => off(eventsRef, 'child_added', handler);
      broadcastConnectionState(true);
      broadcastError(null);
    } catch (e) {
      broadcastError(e instanceof Error ? e.message : 'Firebase RTM failed');
      broadcastConnectionState(false);
    }
  }, [channelName, uid, userName]);

  const disconnect = useCallback(async () => {
    if (activeUnsubscribe) { activeUnsubscribe(); activeUnsubscribe = null; }
    broadcastConnectionState(false);
  }, []);

  useEffect(() => {
    if (enabled) connect().catch(() => {});
    return () => { disconnect().catch(() => {}); };
  }, [enabled, connect, disconnect]);

  return { isConnected, error, connect, disconnect };
}
