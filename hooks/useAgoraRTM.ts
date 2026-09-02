'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RTMDashboardEvent } from '@/lib/types';

export interface UseAgoraRTMOptions {
  uid: string;
  channelName: string; // e.g., "incident-sev1-4821"
  onEvent: (event: RTMDashboardEvent) => void;
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

export function useAgoraRTM({
  uid,
  channelName,
  onEvent,
  enabled = true,
}: UseAgoraRTMOptions): UseAgoraRTMReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<RtmClientInstance | null>(null);
  const isConnectingRef = useRef(false);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventBufferRef = useRef<RTMDashboardEvent[]>([]);

  const processAndDispatchEvent = useCallback((event: RTMDashboardEvent) => {
    // 1. Deduplication check
    if (seenEventIdsRef.current.has(event.id)) {
      return;
    }
    seenEventIdsRef.current.add(event.id);

    // Limit deduplication cache size to prevent memory leak
    if (seenEventIdsRef.current.size > MAX_DEDUP_SET_SIZE) {
      const firstVal = seenEventIdsRef.current.values().next().value;
      if (firstVal) {
        seenEventIdsRef.current.delete(firstVal);
      }
    }

    // 2. Buffer and sort by monotonic seq
    eventBufferRef.current.push(event);
    eventBufferRef.current.sort((a, b) => a.seq - b.seq);

    // 3. Dispatch ordered events
    while (eventBufferRef.current.length > 0) {
      const nextEvt = eventBufferRef.current.shift();
      if (nextEvt) {
        onEventRef.current(nextEvt);
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (clientRef.current) {
        const client = clientRef.current;
        clientRef.current = null;

        try {
          if (channelName) {
            await client.unsubscribe(channelName);
          }
        } catch {
          // Ignore unsubscribe error on teardown
        }

        try {
          await client.logout();
        } catch {
          // Ignore logout error on teardown
        }
      }
      setIsConnected(false);
    } catch (err) {
      console.warn('[useAgoraRTM] Disconnect error:', err);
    }
  }, [channelName]);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!channelName || !uid) {
      setError('channelName and uid are required for RTM');
      return;
    }

    if (clientRef.current || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    try {
      // 1. Fetch token from /api/token
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        if (tokenRes.status === 500 && String(errData.error).includes('credentials not configured')) {
          console.info('[useAgoraRTM] Telemetry standby: Agora credentials not configured in .env.local');
          setError('Agora telemetry standby (credentials not configured)');
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

      // 2. Dynamic import to avoid SSR errors
      const AgoraRTM = (await import('agora-rtm-sdk')).default;

      // 3. Initialize RTM Client
      const client = new AgoraRTM.RTM(appId, uid) as unknown as RtmClientInstance;
      clientRef.current = client;

      // 4. Attach event listeners
      client.addEventListener('message', (eventData: Record<string, unknown>) => {
        try {
          let rawData = eventData?.message;
          if (rawData instanceof Uint8Array) {
            rawData = new TextDecoder().decode(rawData);
          }

          if (typeof rawData !== 'string') return;

          const parsed = JSON.parse(rawData);

          // Check if message is a dashboard event
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
            processAndDispatchEvent(parsed as RTMDashboardEvent);
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
        if (stateStr === 'CONNECTED') {
          setIsConnected(true);
        } else if (
          stateStr === 'DISCONNECTED' ||
          stateStr === 'FAILED' ||
          stateStr === 'SUSPENDED'
        ) {
          setIsConnected(false);
        }
      });

      // 5. Login to Agora RTM
      await client.login({ token: rtmToken || undefined });

      // 6. Subscribe to channel
      await client.subscribe(channelName);

      setIsConnected(true);
      setError(null);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to connect to Agora RTM';
      setError(errMsg);
      console.error('[useAgoraRTM] Connection error:', err);
    } finally {
      isConnectingRef.current = false;
    }
  }, [channelName, uid, processAndDispatchEvent]);

  // Lifecycle management
  useEffect(() => {
    let mounted = true;

    if (enabled && channelName && uid) {
      const init = async () => {
        if (!mounted) return;
        await connect();
      };
      void init();
    }

    return () => {
      mounted = false;
      void disconnect();
    };
  }, [enabled, channelName, uid, connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
  };
}
