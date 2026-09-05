'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RTMDashboardEvent, EvidenceItem } from '@/lib/types';
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
  channelName: string; // e.g., "incident-sev1-4821"
  onEvent: (event: RTMDashboardEvent) => void;
  onTranscript?: (entry: RTMTranscriptEntry) => void;
  enabled?: boolean; // default true, allows lazy connection
}

export interface UseAgoraRTMReturn {
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

interface RtmClientInstance {
  addEventListener: (
    event: string,
    handler: (data: Record<string, unknown>) => void
  ) => void;
  login: (options: { token?: string }) => Promise<void>;
  subscribe: (channelName: string) => Promise<void>;
  unsubscribe: (channelName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const MAX_DEDUP_SET_SIZE = 1000;

function isAbortOrCancelError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  return (
    code === 'OPERATION_ABORTED' ||
    msg.includes('OPERATION_ABORTED') ||
    msg.includes('cancel token canceled') ||
    msg.includes('AbortError') ||
    msg.includes('already in connecting/connected state') ||
    msg.includes('INVALID_OPERATION')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level Singleton RTM Session Manager
// Agora RTM 2.x mandates a single RTM instance globally per user session.
// In React 18/19 (Strict Mode, fast refreshes, hot reload), unmanaged
// instantiations create "Ins#2" which causes mutual client kickouts.
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalRtmSession {
  client: RtmClientInstance;
  appId: string;
  uid: string;
  userName?: string;
  subscribedChannel: string | null;
  isLoggedIn: boolean;
}

let activeSession: GlobalRtmSession | null = null;
let connectingPromise: Promise<void> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

// Registry of active subscribers across React hook instances
const activeSubscribers = new Set<(event: RTMDashboardEvent) => void>();
const activeTranscriptSubscribers = new Set<(entry: RTMTranscriptEntry) => void>();
const connectionStateListeners = new Set<(connected: boolean) => void>();
const errorListeners = new Set<(err: string | null) => void>();
let monotonicClientSeq = 800;
const processedEpistemicKeys = new Set<string>();
let activeAgentTurnId: string | null = null;
let activeUserTurnId: string | null = null;

function dispatchTranscriptToSubscribers(entry: RTMTranscriptEntry) {
  activeTranscriptSubscribers.forEach((handler) => {
    try {
      handler(entry);
    } catch (err) {
      console.warn('[useAgoraRTM] Transcript subscriber error:', err);
    }
  });
}

// Deduplication cache shared across session
const seenEventIds = new Set<string>();
const eventBuffer: RTMDashboardEvent[] = [];

function dispatchToSubscribers(event: RTMDashboardEvent) {
  if (seenEventIds.has(event.id)) return;
  seenEventIds.add(event.id);

  if (seenEventIds.size > MAX_DEDUP_SET_SIZE) {
    const firstVal = seenEventIds.values().next().value;
    if (firstVal) seenEventIds.delete(firstVal);
  }

  eventBuffer.push(event);
  eventBuffer.sort((a, b) => a.seq - b.seq);

  while (eventBuffer.length > 0) {
    const nextEvt = eventBuffer.shift();
    if (nextEvt) {
      activeSubscribers.forEach((handler) => {
        try {
          handler(nextEvt);
        } catch (handlerErr) {
          console.warn('[useAgoraRTM] Subscriber handler error:', handlerErr);
        }
      });
    }
  }
}

function updateAllConnectionStates(connected: boolean) {
  connectionStateListeners.forEach((fn) => {
    try {
      fn(connected);
    } catch {
      // ignore
    }
  });
}

function broadcastError(err: string | null) {
  errorListeners.forEach((fn) => {
    try {
      fn(err);
    } catch {
      // ignore
    }
  });
}

export function useAgoraRTM({
  uid,
  userName,
  channelName,
  onEvent,
  onTranscript,
  enabled = true,
}: UseAgoraRTMOptions): UseAgoraRTMReturn {
  const [isConnected, setIsConnected] = useState<boolean>(() => {
    return Boolean(
      activeSession?.isLoggedIn &&
      activeSession?.uid === uid &&
      activeSession?.subscribedChannel === channelName
    );
  });
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const onEventRef = useRef(onEvent);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    isMountedRef.current = true;
    const handleConnectionChange = (connected: boolean) => {
      if (isMountedRef.current) {
        setIsConnected(connected);
      }
    };
    const handleErrorChange = (err: string | null) => {
      if (isMountedRef.current) {
        setError(err);
      }
    };

    connectionStateListeners.add(handleConnectionChange);
    errorListeners.add(handleErrorChange);

    return () => {
      isMountedRef.current = false;
      connectionStateListeners.delete(handleConnectionChange);
      errorListeners.delete(handleErrorChange);
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!channelName || !uid) return;

    // Cancel any scheduled teardown from a previous unmount
    if (teardownTimer) {
      clearTimeout(teardownTimer);
      teardownTimer = null;
    }

    // 1. If an active session exists for this exact UID
    if (activeSession && activeSession.uid === uid) {
      if (userName) {
        activeSession.userName = userName;
      }
      if (activeSession.isLoggedIn) {
        updateAllConnectionStates(true);
        broadcastError(null);

        // Check if channel subscription matches
        if (activeSession.subscribedChannel !== channelName) {
          try {
            if (activeSession.subscribedChannel) {
              await activeSession.client.unsubscribe(activeSession.subscribedChannel);
            }
            await activeSession.client.subscribe(channelName);
            activeSession.subscribedChannel = channelName;
          } catch (subErr) {
            console.warn('[useAgoraRTM] Channel resubscribe warning:', subErr);
          }
        }
        return;
      }
    }

    // 2. If a connection is already in progress, await it
    if (connectingPromise) {
      try {
        await connectingPromise;
        if (activeSession?.isLoggedIn) {
          updateAllConnectionStates(true);
          broadcastError(null);
        }
        return;
      } catch {
        // Fall through to retry if in-progress attempt failed
      }
    }

    // 3. Initiate single connection pipeline
    connectingPromise = (async () => {
      try {
        // If an old session with a different UID exists, cleanly log it out first
        if (activeSession && activeSession.uid !== uid) {
          try {
            if (activeSession.subscribedChannel) {
              await activeSession.client.unsubscribe(activeSession.subscribedChannel);
            }
            await activeSession.client.logout();
          } catch {
            // Ignore previous logout errors
          } finally {
            activeSession = null;
          }
        }

        // Fetch token from /api/token
        const tokenRes = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid }),
        });

        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          if (tokenRes.status === 500 && String(errData.error).includes('credentials not configured')) {
            console.info('[useAgoraRTM] Telemetry standby: Agora credentials not configured in .env.local');
            broadcastError('Agora telemetry standby (credentials not configured)');
            return;
          }
          throw new Error(
            errData.error || `Failed to fetch RTM token (HTTP ${tokenRes.status})`
          );
        }

        const { rtmToken, appId } = await tokenRes.json();
        if (!appId) {
          throw new Error('Missing Agora App ID from token endpoint');
        }

        const AgoraRTM = (await import('agora-rtm-sdk')).default;

        // Initialize single RTM client with warning log level to suppress harmless noise
        const client = new AgoraRTM.RTM(appId, uid, {
          useStringUserId: true,
          logLevel: 'warn',
        }) as unknown as RtmClientInstance;

        // Attach listeners once on the client
        client.addEventListener('message', (eventData: Record<string, unknown>) => {
          try {
            let rawData = eventData?.message;
            if (rawData instanceof Uint8Array) {
              rawData = new TextDecoder().decode(rawData);
            }

            if (typeof rawData !== 'string') return;

            const parsed = JSON.parse(rawData);

            // 1. Dashboard Event Handling
            const isDashboardEvent =
              eventData?.customType === 'dashboard_event' ||
              parsed?.customType === 'dashboard_event' ||
              parsed?.type === 'dashboard_event';

            if (
              isDashboardEvent &&
              parsed?.id &&
              typeof parsed?.seq === 'number' &&
              parsed?.eventType
            ) {
              dispatchToSubscribers(parsed as RTMDashboardEvent);
              return;
            }

            // 2. Agora ConvAI Transcript & Telemetry Stream Handling
            const publisher = String(eventData?.publisher || '').trim();

            const resolveSpeakerInfo = (
              item: Record<string, unknown>,
              rawText?: string
            ): { speakerUid: string; speakerName: string; isAgent: boolean } => {
              const role = String(
                item?.role ||
                item?.user_type ||
                item?.speaker_type ||
                item?.type ||
                item?.speaker ||
                parsed?.type ||
                ''
              ).toLowerCase().trim();

              const rawUid = String(
                item?.uid ??
                item?.user_id ??
                item?.userId ??
                item?.agent_user_id ??
                item?.agent_id ??
                item?.speaker_uid ??
                parsed?.uid ??
                ''
              ).trim();

              const streamId = item?.stream_id ?? item?.streamId ?? parsed?.stream_id ?? parsed?.streamId;
              const localUid = activeSession?.uid || uid;
              const localName = activeSession?.userName || userName;

              // Text content signature check (phrases that are exclusively uttered by AURA)
              const textLower = (rawText || '').toLowerCase().trim();
              const isAgentByText =
                textLower.includes('aura online') ||
                textLower.includes('incident bridge monitoring active') ||
                textLower.includes("i'm focused on the active incident") ||
                textLower.includes('what is the next data point') ||
                textLower.includes("what's the next data point") ||
                textLower.includes('logging hypothesis') ||
                textLower.includes('logging fact') ||
                textLower.includes('logging decision') ||
                textLower.includes('the hypothesis has been recorded') ||
                textLower.includes('situation: sev-') ||
                textLower.includes('flagging contradiction') ||
                textLower.includes("here's what we know for certain") ||
                textLower.includes('ai incident commander') ||
                textLower.includes('standing by');

              // 1. Check if this is the ConvAI agent:
              // - In Agora ConvAI, stream_id: 0 is ALWAYS the agent bot
              // - uid: 'aura_agent', '0', 0, or includes 'agent' / 'aura'
              // - role: 'assistant', 'agent', 'bot', 'ai'
              const isAgentByStream = streamId === 0 || streamId === '0';
              const isAgentByRole =
                role === 'assistant' ||
                role === 'agent' ||
                role === 'bot' ||
                role === 'ai' ||
                role.includes('assistant') ||
                role.includes('agent');
              const isAgentByUid =
                rawUid === 'aura_agent' ||
                rawUid === '0' ||
                rawUid.toLowerCase().includes('agent') ||
                rawUid.toLowerCase().includes('aura');

              if (isAgentByStream || isAgentByRole || isAgentByUid || isAgentByText) {
                return {
                  speakerUid: 'aura_agent',
                  speakerName: 'AURA',
                  isAgent: true,
                };
              }

              // 2. Explicit User checks
              if (
                role === 'user' ||
                role === 'human' ||
                role === 'caller' ||
                role === 'client' ||
                role === 'operator' ||
                (typeof streamId === 'number' && streamId > 0) ||
                (typeof streamId === 'string' && streamId !== '0' && streamId !== '')
              ) {
                const finalUid = (rawUid && rawUid !== '0' && rawUid !== 'aura_agent') ? rawUid : (localUid || 'operator');
                if (finalUid === localUid || finalUid === uid) {
                  return {
                    speakerUid: localUid,
                    speakerName: localName || 'Responder',
                    isAgent: false,
                  };
                }
                const persona = PERSONAS.find((p) => p.uid === finalUid);
                if (persona) {
                  return { speakerUid: finalUid, speakerName: persona.displayName, isAgent: false };
                }
                return {
                  speakerUid: finalUid,
                  speakerName: localName || finalUid || 'Responder',
                  isAgent: false,
                };
              }

              // 3. User UID matching
              if (rawUid && (rawUid === localUid || rawUid === uid)) {
                return {
                  speakerUid: localUid,
                  speakerName: localName || localUid,
                  isAgent: false,
                };
              }

              if (rawUid && rawUid !== '0' && rawUid !== 'aura_agent' && rawUid !== 'undefined' && rawUid !== 'null') {
                const persona = PERSONAS.find((p) => p.uid === rawUid);
                if (persona) {
                  return { speakerUid: rawUid, speakerName: persona.displayName, isAgent: false };
                }
                return { speakerUid: rawUid, speakerName: rawUid, isAgent: false };
              }

              return {
                speakerUid: localUid || 'operator',
                speakerName: localName || 'Responder',
                isAgent: false,
              };
            };

            const extractAndDispatchEpistemicEvents = (rawText: string) => {
              if (!rawText || typeof rawText !== 'string') return;

              const dispatchEpistemicItem = (
                category: 'fact' | 'hypothesis' | 'decision' | 'action',
                content: string,
                extra: {
                  confidence?: number;
                  service?: string;
                  decidingMetric?: string;
                  rationale?: string;
                  assignedTo?: string;
                  eta?: number;
                } = {}
              ) => {
                const cleanContent = content.trim().replace(/^["']|["']$/g, '');
                if (!cleanContent || cleanContent.length < 3) return;

                const dedupKey = `${category}:${cleanContent.toLowerCase().slice(0, 45)}`;
                if (processedEpistemicKeys.has(dedupKey)) return;
                processedEpistemicKeys.add(dedupKey);

                const now = Date.now();
                const eventId = `ev-${now}-${Math.random().toString(36).substring(2, 6)}`;
                const isHypothesis = category === 'hypothesis';
                const isAction = category === 'action';
                const status = isHypothesis ? 'active' : 'confirmed';

                const evidenceItem: EvidenceItem = {
                  id: eventId,
                  category,
                  content: cleanContent,
                  speakerUid: 'aura_agent',
                  speakerName: 'AURA',
                  confidence: Math.min(85, extra.confidence || (category === 'fact' ? 85 : 80)),
                  timestamp: now,
                  serviceAffected: extra.service || 'core',
                  relatedTo: [],
                  decidingMetric: extra.decidingMetric,
                  status,
                  assignedTo: extra.assignedTo || (isAction ? (activeSession?.userName || userName || 'Responder') : undefined),
                  actionStatus: isAction ? 'pending' : undefined,
                };

                const dashboardEvt: RTMDashboardEvent = {
                  id: eventId,
                  seq: ++monotonicClientSeq,
                  timestamp: now,
                  type: 'dashboard_event',
                  eventType: 'evidence_added',
                  payload: evidenceItem as unknown as Record<string, unknown>,
                };

                // Instant UI dispatch (Topology Graph, Status counters, ActionTracker)
                dispatchToSubscribers(dashboardEvt);

                // Background sync to server incident store
                if (typeof window !== 'undefined') {
                  fetch('/api/incident/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      channelName: activeSession?.subscribedChannel || channelName || 'incident-war-room',
                      item: evidenceItem,
                    }),
                  }).catch((err) => {
                    console.warn('[useAgoraRTM] Epistemic sync note:', err);
                  });
                }
              };

              // A. Silent machine-readable bracket tags: [LOG_FACT: ...], [LOG_HYPOTHESIS: ...]
              const factTag = rawText.match(/\[LOG_FACT:\s*([^|\]]+?)(?:\s*\|\s*(\d+))?(?:\s*\|\s*([^\]]+?))?\]/i);
              if (factTag) {
                dispatchEpistemicItem('fact', factTag[1], {
                  confidence: factTag[2] ? Number(factTag[2]) : 95,
                  service: factTag[3]?.trim(),
                });
              }

              const hypoTag = rawText.match(/\[LOG_HYPOTHESIS:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*(\d+))?\]/i);
              if (hypoTag) {
                dispatchEpistemicItem('hypothesis', hypoTag[1], {
                  decidingMetric: hypoTag[2]?.trim(),
                  confidence: hypoTag[3] ? Number(hypoTag[3]) : 80,
                });
              }

              const decTag = rawText.match(/\[LOG_DECISION:\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\]/i);
              if (decTag) {
                dispatchEpistemicItem('decision', decTag[1], {
                  rationale: decTag[2]?.trim(),
                });
              }

              const actTag = rawText.match(/\[LOG_ACTION:\s*([^|\]]+?)(?:\s*\|\s*([^|\]]+?))?(?:\s*\|\s*([^\]]+?))?\]/i);
              if (actTag) {
                dispatchEpistemicItem('action', actTag[1], {
                  assignedTo: actTag[2]?.trim(),
                  eta: actTag[3] ? Number(actTag[3]) : undefined,
                });
              }

              // B. Natural spoken confirmations fallback
              const spokenHypo = rawText.match(/(?:logging\s+hypothesis|the\s+hypothesis\s+has\s+been\s+recorded):\s*["']?([^"'\n]+?)["']?(?:\.|\s+with|\s+the\s+deciding|\s+logging|\s*$)/i);
              if (spokenHypo) {
                const metricMatch = rawText.match(/deciding\s+metric\s+will\s+be\s+(?:the\s+)?([^.]+)/i);
                dispatchEpistemicItem('hypothesis', spokenHypo[1], {
                  decidingMetric: metricMatch ? metricMatch[1].trim() : 'Telemetry verification',
                  confidence: 80,
                });
              }

              const spokenFact = rawText.match(/(?:logging\s+fact|recorded\s+as\s+fact):\s*["']?([^"'\n]+?)["']?(?:\.|\s+with|\s+logging|\s*$)/i);
              if (spokenFact) {
                dispatchEpistemicItem('fact', spokenFact[1], {
                  confidence: 95,
                });
              }
            };

            // Case A: Array of transcription items
            const transcriptionList = Array.isArray(parsed?.transcription)
              ? parsed.transcription
              : Array.isArray(parsed?.data?.transcription)
              ? parsed.data.transcription
              : Array.isArray(parsed)
              ? parsed
              : null;

            if (transcriptionList) {
              for (const item of transcriptionList) {
                const text =
                  item?.text ||
                  item?.transcript ||
                  item?.content ||
                  item?.words?.map((w: { word?: string; text?: string }) => w?.word || w?.text || '').join(' ');
                if (typeof text === 'string' && text.trim() && text.trim() !== '[SILENT]') {
                  const speaker = resolveSpeakerInfo(item as Record<string, unknown>, text);
                  if (speaker.isAgent) {
                    extractAndDispatchEpistemicEvents(text);
                  }
                  const cleanText = text.replace(/\[(?:LOG_[A-Z]+|SILENT)[^\]]*\]/gi, '').trim();
                  if (cleanText) {
                    const isFinal = item?.status === 1 || item?.status === 'end' || item?.is_final === true;
                    const explicitTurn =
                      item?.turn_id ??
                      item?.turnID ??
                      item?.turn ??
                      item?.message_id ??
                      item?.msg_id ??
                      item?.id ??
                      parsed?.turn_id ??
                      parsed?.turnID ??
                      parsed?.message_id;

                    let turnKey: string;
                    if (explicitTurn !== undefined && explicitTurn !== null) {
                      turnKey = `tr-${explicitTurn}-${speaker.speakerUid}`;
                    } else if (speaker.isAgent) {
                      activeUserTurnId = null;
                      if (!activeAgentTurnId) activeAgentTurnId = `agent-${Date.now()}`;
                      turnKey = `tr-${activeAgentTurnId}`;
                      if (isFinal) activeAgentTurnId = null;
                    } else {
                      activeAgentTurnId = null;
                      if (!activeUserTurnId) activeUserTurnId = `user-${Date.now()}`;
                      turnKey = `tr-${activeUserTurnId}`;
                      if (isFinal) activeUserTurnId = null;
                    }

                    dispatchTranscriptToSubscribers({
                      id: turnKey,
                      speakerName: speaker.speakerName,
                      timestamp: Number(item?._time || item?.timestamp || item?.ts || Date.now()),
                      text: cleanText,
                      isFinal,
                    });
                  }
                }
              }
              return;
            }

            // Case B: Single transcript payload
            const singleText =
              parsed?.text ||
              parsed?.transcript ||
              parsed?.content ||
              parsed?.data?.text ||
              parsed?.data?.transcript;

            if (typeof singleText === 'string' && singleText.trim() && singleText.trim() !== '[SILENT]') {
              const speaker = resolveSpeakerInfo(parsed as Record<string, unknown>, singleText);
              if (speaker.isAgent) {
                extractAndDispatchEpistemicEvents(singleText);
              }
              const cleanText = singleText.replace(/\[(?:LOG_[A-Z]+|SILENT)[^\]]*\]/gi, '').trim();
              if (cleanText) {
                const isFinal = parsed?.status === 1 || parsed?.is_final === true || parsed?.status === 'end';
                const explicitTurn =
                  parsed?.turn_id ??
                  parsed?.turnID ??
                  parsed?.turn ??
                  parsed?.message_id ??
                  parsed?.msg_id ??
                  parsed?.id;

                let turnKey: string;
                if (explicitTurn !== undefined && explicitTurn !== null) {
                  turnKey = `tr-${explicitTurn}-${speaker.speakerUid}`;
                } else if (speaker.isAgent) {
                  activeUserTurnId = null;
                  if (!activeAgentTurnId) activeAgentTurnId = `agent-${Date.now()}`;
                  turnKey = `tr-${activeAgentTurnId}`;
                  if (isFinal) activeAgentTurnId = null;
                } else {
                  activeAgentTurnId = null;
                  if (!activeUserTurnId) activeUserTurnId = `user-${Date.now()}`;
                  turnKey = `tr-${activeUserTurnId}`;
                  if (isFinal) activeUserTurnId = null;
                }

                dispatchTranscriptToSubscribers({
                  id: turnKey,
                  speakerName: speaker.speakerName,
                  timestamp: Number(parsed?._time || parsed?.timestamp || parsed?.ts || Date.now()),
                  text: cleanText,
                  isFinal,
                });
              }
              return;
            }
          } catch (msgErr) {
            console.warn('[useAgoraRTM] Message parsing error:', msgErr);
          }
        });

        client.addEventListener('linkState', (eventData: Record<string, unknown>) => {
          const stateStr =
            typeof eventData?.currentState === 'string'
              ? eventData.currentState
              : '';
          const connected = stateStr === 'CONNECTED';
          if (activeSession) {
            activeSession.isLoggedIn = connected;
          }
          updateAllConnectionStates(connected);
        });

        // Login to Agora RTM
        await client.login({ token: rtmToken || undefined });

        // Subscribe to incident channel
        await client.subscribe(channelName);

        activeSession = {
          client,
          appId,
          uid,
          userName,
          subscribedChannel: channelName,
          isLoggedIn: true,
        };

        updateAllConnectionStates(true);
        broadcastError(null);
      } catch (err) {
        if (!isAbortOrCancelError(err)) {
          const errMsg = err instanceof Error ? err.message : 'Failed to connect to Agora RTM';
          broadcastError(errMsg);
          console.error('[useAgoraRTM] Connection error:', err);
        }
        throw err;
      } finally {
        connectingPromise = null;
      }
    })();

    await connectingPromise;
  }, [channelName, uid]);

  const disconnect = useCallback(async () => {
    // If no active subscribers remain after a grace period, teardown the session
    if (activeSubscribers.size === 0 && activeSession) {
      try {
        const session = activeSession;
        activeSession = null;
        if (session.subscribedChannel) {
          await session.client.unsubscribe(session.subscribedChannel);
        }
        await session.client.logout();
      } catch (err) {
        if (!isAbortOrCancelError(err)) {
          console.warn('[useAgoraRTM] Disconnect error:', err);
        }
      } finally {
        updateAllConnectionStates(false);
      }
    }
  }, []);

  // Lifecycle management
  useEffect(() => {
    if (!enabled || !channelName || !uid) return;

    // Register this instance's event handlers into subscriber sets
    const subscriberHandler = (event: RTMDashboardEvent) => {
      if (onEventRef.current) {
        onEventRef.current(event);
      }
    };
    activeSubscribers.add(subscriberHandler);

    const transcriptHandler = (entry: RTMTranscriptEntry) => {
      if (onTranscriptRef.current) {
        onTranscriptRef.current(entry);
      }
    };
    activeTranscriptSubscribers.add(transcriptHandler);

    // Cancel any pending teardown
    if (teardownTimer) {
      clearTimeout(teardownTimer);
      teardownTimer = null;
    }

    void connect();

    return () => {
      activeSubscribers.delete(subscriberHandler);
      activeTranscriptSubscribers.delete(transcriptHandler);

      // In React 18/19 (Strict Mode, fast refreshes), unmounts happen before immediate remounts.
      // We debounce teardown by 2500ms to allow remounts to reuse the active RTM connection
      // without instantiating duplicate client instances.
      if (activeSubscribers.size === 0) {
        teardownTimer = setTimeout(() => {
          if (activeSubscribers.size === 0) {
            void disconnect();
          }
        }, 2500);
      }
    };
  }, [enabled, channelName, uid, connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
  };
}

