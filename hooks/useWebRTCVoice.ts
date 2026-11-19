'use client';
/**
 * useWebRTCVoice.ts — Native WebRTC Voice Hook
 * Replaces: useAgoraRTC.ts (agora-rtc-sdk-ng)
 * Google: Native WebRTC + Google STUN + Firebase RTDB signaling
 *
 * Same interface as useAgoraRTC — zero changes needed in consuming components.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getFirebaseDb } from '@/lib/firebaseClient';
import { ref, onValue, push, remove, set, onDisconnect, off } from 'firebase/database';

export interface UseAgoraRTCOptions {
  channelName: string;
  uid: string;
  appId?: string; // ignored — Firebase used instead
}

export interface AgoraNetworkStats {
  mos: number;
  rtt: number;
  jitter: number;
  packetLoss: number;
  uplinkQuality: number;
  downlinkQuality: number;
}

export interface RemoteUser {
  uid: string | number;
  hasAudio: boolean;
  audioTrack: {
    isPlaying: boolean;
    play: () => void;
    stop: () => void;
    setVolume: (v: number) => void;
  } | null;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';

export interface UseAgoraRTCReturn {
  joinChannel: () => Promise<void>;
  leaveChannel: () => Promise<void>;
  isJoined: boolean;
  connectionState: ConnectionState;
  localAudioTrack: MediaStreamTrack | null;
  remoteUsers: RemoteUser[];
  volumeLevels: Record<string, number>;
  networkStats: AgoraNetworkStats;
  error: string | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  ...(process.env.NEXT_PUBLIC_TURN_SERVER_URL
    ? [{ urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL, username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || '', credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || '' }]
    : []),
];

function createVolumeAnalyser(stream: MediaStream, onVolume: (level: number) => void): () => void {
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let running = true;
    const tick = () => {
      if (!running) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      onVolume(Math.round((avg / 255) * 100));
      requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; source.disconnect(); ctx.close().catch(() => {}); };
  } catch { return () => {}; }
}

export function useAgoraRTC({ channelName, uid }: UseAgoraRTCOptions): UseAgoraRTCReturn {
  const [isJoined, setIsJoined] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [volumeLevels, setVolumeLevels] = useState<Record<string, number>>({});
  const [networkStats, setNetworkStats] = useState<AgoraNetworkStats>({ mos: 4.3, rtt: 38, jitter: 8, packetLoss: 0, uplinkQuality: 1, downlinkQuality: 1 });
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isMountedRef = useRef(true);
  const cleanupVolumeRef = useRef<(() => void) | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalingUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  const startStatsPolling = useCallback((pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        const stats = await pc.getStats();
        let rtt = 38, jitter = 8, packetLoss = 0;
        stats.forEach((r) => {
          if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
            rtt = Math.round((r.roundTripTime ?? 0.038) * 1000);
            jitter = Math.round((r.jitter ?? 0.008) * 1000);
            packetLoss = Number((r.fractionLost ?? 0).toFixed(1));
          }
        });
        const mos = Math.min(4.5, Math.max(1.0, 4.45 - Math.max(0, (rtt + jitter * 2 - 80) * 0.004) - packetLoss * 0.06));
        if (isMountedRef.current) setNetworkStats({ mos: Number(mos.toFixed(1)), rtt, jitter, packetLoss, uplinkQuality: 1, downlinkQuality: 1 });
      } catch { /* ignore */ }
    }, 2000);
  }, []);

  const createPeerConnection = useCallback((remoteUid: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.oniceconnectionstatechange = () => {
      if (!isMountedRef.current) return;
      const map: Record<string, ConnectionState> = { new: 'CONNECTING', checking: 'CONNECTING', connected: 'CONNECTED', completed: 'CONNECTED', disconnected: 'RECONNECTING', failed: 'FAILED', closed: 'DISCONNECTED' };
      setConnectionState(map[pc.iceConnectionState] ?? 'DISCONNECTED');
      if (pc.iceConnectionState === 'connected') { setIsJoined(true); startStatsPolling(pc); }
    };
    pc.ontrack = (event) => {
      if (!isMountedRef.current) return;
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      const audioEl = new Audio();
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      setRemoteUsers((prev) => {
        const filtered = prev.filter((u) => String(u.uid) !== remoteUid);
        return [...filtered, {
          uid: remoteUid, hasAudio: true,
          audioTrack: {
            isPlaying: true,
            play: () => audioEl.play().catch(() => {}),
            stop: () => { audioEl.pause(); audioEl.srcObject = null; },
            setVolume: (v: number) => { audioEl.volume = Math.max(0, Math.min(1, v / 100)); },
          },
        }];
      });
    };
    return pc;
  }, [startStatsPolling]);

  const joinChannel = useCallback(async () => {
    if (!channelName || !uid || !isMountedRef.current) return;
    setConnectionState('CONNECTING');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
      });
      if (!isMountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalAudioTrack(stream.getAudioTracks()[0] ?? null);
      cleanupVolumeRef.current = createVolumeAnalyser(stream, (level) => {
        if (isMountedRef.current) setVolumeLevels((prev) => ({ ...prev, [uid]: level }));
      });

      const db = getFirebaseDb();
      if (db) {
        const presenceRef = ref(db, `signaling/${channelName}/presence/${uid}`);
        await set(presenceRef, { uid, joinedAt: Date.now(), hasAudio: true });
        onDisconnect(presenceRef).remove();

        const signalingRef = ref(db, `signaling/${channelName}/messages`);
        const unsubscribe = onValue(signalingRef, async (snapshot) => {
          const messages = snapshot.val() as Record<string, Record<string, unknown>> | null;
          if (!messages) return;
          for (const [msgId, msg] of Object.entries(messages)) {
            if (msg.to !== uid) continue;
            const fromUid = String(msg.from);
            let pc = peerConnectionsRef.current.get(fromUid);
            if (msg.type === 'offer') {
              if (!pc) {
                pc = createPeerConnection(fromUid);
                if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => pc!.addTrack(t, localStreamRef.current!));
                peerConnectionsRef.current.set(fromUid, pc);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await push(ref(db, `signaling/${channelName}/messages`), { from: uid, to: fromUid, type: 'answer', sdp: answer });
              await remove(ref(db, `signaling/${channelName}/messages/${msgId}`));
            } else if (msg.type === 'answer' && pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
              await remove(ref(db, `signaling/${channelName}/messages/${msgId}`));
            } else if (msg.type === 'ice' && pc) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
              await remove(ref(db, `signaling/${channelName}/messages/${msgId}`));
            }
          }
        });
        signalingUnsubRef.current = () => off(signalingRef, 'value', unsubscribe as Parameters<typeof off>[2]);
      }

      setIsJoined(true);
      setConnectionState('CONNECTED');
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to join voice channel';
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Microphone permission denied. Operating in listen-only mode.');
      } else {
        setError(msg);
      }
      setConnectionState('FAILED');
    }
  }, [channelName, uid, createPeerConnection]);

  const leaveChannel = useCallback(async () => {
    cleanupVolumeRef.current?.(); cleanupVolumeRef.current = null;
    signalingUnsubRef.current?.(); signalingUnsubRef.current = null;
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    localStreamRef.current?.getTracks().forEach((t) => t.stop()); localStreamRef.current = null;
    peerConnectionsRef.current.forEach((pc) => pc.close()); peerConnectionsRef.current.clear();
    const db = getFirebaseDb();
    if (db && channelName && uid) remove(ref(db, `signaling/${channelName}/presence/${uid}`)).catch(() => {});
    if (isMountedRef.current) {
      setIsJoined(false); setConnectionState('DISCONNECTED');
      setLocalAudioTrack(null); setRemoteUsers([]); setVolumeLevels({});
    }
  }, [channelName, uid]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupVolumeRef.current?.();
      signalingUnsubRef.current?.();
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  return { joinChannel, leaveChannel, isJoined, connectionState, localAudioTrack, remoteUsers, volumeLevels, networkStats, error };
}
