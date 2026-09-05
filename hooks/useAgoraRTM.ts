'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RTMDashboardEvent } from '@/lib/types';
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

            // 2. Agora ConvAI Transcript Handling
            const publisher = String(eventData?.publisher || '').trim();
            const resolveSpeakerInfo = (
              item: Record<string, unknown>,
              fallbackUid?: string
            ): { speakerUid: string; speakerName: string } => {
              const role = String(
                item?.role ||
                item?.user_type ||
                item?.speaker_type ||
                item?.type ||
                ''
              ).toLowerCase();

              const rawUid = String(
                item?.uid ??
                item?.user_id ??
                item?.userId ??
                item?.agent_user_id ??
                item?.agent_id ??
                item?.speaker_uid ??
                item?.speaker ??
                fallbackUid ??
                ''
              ).trim();

              const isAgent =
                role === 'assistant' ||
                role === 'agent' ||
                rawUid === 'aura_agent' ||
                rawUid === '0' ||
                rawUid.toLowerCase().includes('agent') ||
                rawUid.toLowerCase().includes('aura') ||
                publisher === 'aura_agent' ||
                item?.stream_id === 0;

              if (isAgent) {
                return { speakerUid: 'aura_agent', speakerName: 'AURA' };
              }

              const localUid = activeSession?.uid || uid;
              const localName = activeSession?.userName || userName;
              if (rawUid && (rawUid === localUid || rawUid === uid)) {
                return { speakerUid: localUid, speakerName: localName || localUid };
              }

              if (rawUid) {
                const persona = PERSONAS.find((p) => p.uid === rawUid);
                if (persona) {
                  return { speakerUid: rawUid, speakerName: persona.displayName };
                }
                if (
                  rawUid !== 'undefined' &&
                  rawUid !== 'null' &&
                  rawUid !== 'Responder' &&
                  rawUid !== 'user'
                ) {
                  return { speakerUid: rawUid, speakerName: rawUid };
                }
              }

              if (publisher && (publisher === localUid || publisher === uid)) {
                return { speakerUid: localUid, speakerName: localName || localUid };
              }

              return {
                speakerUid: localUid || 'operator',
                speakerName: localName || 'Incident Responder',
              };
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
                  const speaker = resolveSpeakerInfo(item as Record<string, unknown>, publisher);
                  const turnId = item?.turn_id ?? item?.turnID ?? item?.message_id ?? item?.msg_id ?? Date.now();
                  dispatchTranscriptToSubscribers({
                    id: `tr-${turnId}-${speaker.speakerUid}`,
                    speakerName: speaker.speakerName,
                    timestamp: Number(item?._time || item?.timestamp || item?.ts || Date.now()),
                    text: text.trim(),
                    isFinal: item?.status === 1 || item?.status === 'end' || item?.is_final === true,
                  });
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
              const speaker = resolveSpeakerInfo(parsed as Record<string, unknown>, publisher);
              const turnId = parsed?.turn_id ?? parsed?.turnID ?? parsed?.message_id ?? parsed?.msg_id ?? Date.now();
              dispatchTranscriptToSubscribers({
                id: `tr-${turnId}-${speaker.speakerUid}`,
                speakerName: speaker.speakerName,
                timestamp: Number(parsed?._time || parsed?.timestamp || parsed?.ts || Date.now()),
                text: singleText.trim(),
                isFinal: parsed?.status === 1 || parsed?.is_final === true || parsed?.status === 'end',
              });
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

