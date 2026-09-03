'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  IAgoraRTCClient,
  ILocalAudioTrack,
  IAgoraRTCRemoteUser,
  ConnectionState,
} from 'agora-rtc-sdk-ng';

export interface UseAgoraRTCOptions {
  channelName: string;
  uid: string;
  appId?: string;
}

export interface UseAgoraRTCReturn {
  joinChannel: () => Promise<void>;
  leaveChannel: () => Promise<void>;
  isJoined: boolean;
  connectionState: ConnectionState | 'DISCONNECTED';
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  volumeLevels: Record<string, number>; // uid -> 0-100
  error: string | null;
}

export function useAgoraRTC({ channelName, uid, appId: propAppId }: UseAgoraRTCOptions): UseAgoraRTCReturn {
  const [isJoined, setIsJoined] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState | 'DISCONNECTED'>('DISCONNECTED');
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [volumeLevels, setVolumeLevels] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<ILocalAudioTrack | null>(null);
  const isJoiningRef = useRef<boolean>(false);

  // Initialize client instance
  useEffect(() => {
    let mounted = true;

    async function initClient() {
      if (typeof window === 'undefined') return;

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      AgoraRTC.setLogLevel(1); // Warnings and errors only

      if (!clientRef.current && mounted) {
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('connection-state-change', (curState) => {
          setConnectionState(curState);
          if (curState === 'CONNECTED') {
            setIsJoined(true);
          } else if (curState === 'DISCONNECTED') {
            setIsJoined(false);
          }
        });

        client.on('user-published', async (user, mediaType) => {
          if (mediaType === 'audio') {
            await client.subscribe(user, 'audio');
            user.audioTrack?.play();
            setRemoteUsers((prev) => {
              if (prev.some((u) => u.uid === user.uid)) return prev;
              return [...prev, user];
            });
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'audio') {
            user.audioTrack?.stop();
          }
        });

        client.on('user-left', (user) => {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          setVolumeLevels((prev) => {
            const next = { ...prev };
            delete next[String(user.uid)];
            return next;
          });
        });

        client.enableAudioVolumeIndicator();
        client.on('volume-indicator', (volumes) => {
          const levels: Record<string, number> = {};
          volumes.forEach((vol) => {
            // vol.uid is 0 for local user or string/number for remote user
            const targetUid = vol.uid === 0 ? uid : String(vol.uid);
            levels[targetUid] = Math.round(vol.level);
          });
          setVolumeLevels((prev) => ({ ...prev, ...levels }));
        });
      }
    }

    initClient();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const joinChannel = useCallback(async () => {
    if (!channelName || !uid) {
      setError('channelName and uid are required to join');
      return;
    }

    // Prevent concurrent join executions
    if (isJoiningRef.current) {
      return;
    }

    // Bail out early if client is already connecting or connected
    if (
      clientRef.current &&
      (clientRef.current.connectionState === 'CONNECTING' ||
        clientRef.current.connectionState === 'CONNECTED')
    ) {
      setIsJoined(true);
      return;
    }

    isJoiningRef.current = true;

    try {
      setError(null);
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // 1. Fetch token from server
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid }),
      });

      if (!tokenRes.ok) {
        const errJson = await tokenRes.json().catch(() => ({}));
        if (tokenRes.status === 500 && String(errJson.error).includes('credentials not configured')) {
          console.info('[useAgoraRTC] Voice standby: Agora credentials not configured in .env.local');
          setError('Agora voice standby (credentials not configured)');
          return;
        }
        throw new Error(errJson.error || `Failed to get Agora token (HTTP ${tokenRes.status})`);
      }

      const tokenData = await tokenRes.json();
      const targetAppId = propAppId || tokenData.appId;
      const rtcToken = tokenData.rtcToken;

      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      }

      const client = clientRef.current;

      // Re-check connection state before calling client.join
      if (
        client.connectionState === 'CONNECTING' ||
        client.connectionState === 'CONNECTED'
      ) {
        setIsJoined(true);
        return;
      }

      // 2. Join RTC channel with string UID
      await client.join(targetAppId, channelName, rtcToken || null, uid);
      setIsJoined(true);

      // 3. Create and publish local microphone audio track if not already active
      if (!localTrackRef.current) {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true, // Acoustic Echo Cancellation
          ANS: true, // Noise Suppression
          AGC: true, // Auto Gain Control
        });

        localTrackRef.current = audioTrack;
        setLocalAudioTrack(audioTrack);
        await client.publish([audioTrack]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join voice channel';
      // Suppress benign "already in connecting/connected state" error if caught
      if (message.includes('already in connecting/connected state')) {
        setIsJoined(true);
        return;
      }
      setError(message);
      if (message.includes('credentials not configured')) {
        console.info('[useAgoraRTC] Voice channel on standby (Agora credentials not configured in .env.local).');
      } else {
        console.error('[useAgoraRTC] Join error:', err);
      }
    } finally {
      isJoiningRef.current = false;
    }
  }, [channelName, uid, propAppId]);

  const leaveChannel = useCallback(async () => {
    isJoiningRef.current = false;
    try {
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
        setLocalAudioTrack(null);
      }

      if (clientRef.current) {
        if (
          clientRef.current.connectionState === 'CONNECTED' ||
          clientRef.current.connectionState === 'CONNECTING'
        ) {
          await clientRef.current.leave();
        }
      }

      setIsJoined(false);
      setConnectionState('DISCONNECTED');
      setRemoteUsers([]);
      setVolumeLevels({});
    } catch (err) {
      console.error('[useAgoraRTC] Leave error:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isJoiningRef.current = false;
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        if (
          clientRef.current.connectionState === 'CONNECTED' ||
          clientRef.current.connectionState === 'CONNECTING'
        ) {
          clientRef.current.leave().catch(() => {});
        }
      }
    };
  }, []);

  return {
    joinChannel,
    leaveChannel,
    isJoined,
    connectionState,
    localAudioTrack,
    remoteUsers,
    volumeLevels,
    error,
  };
}
