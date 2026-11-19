/**
 * useAgoraRTC.ts — BACKWARD-COMPAT RE-EXPORT ALIAS
 * All logic lives in useWebRTCVoice.ts (native WebRTC + Firebase RTDB signaling)
 * This file exists only so existing imports from '@/hooks/useAgoraRTC' keep working unchanged.
 *
 * Google Ecosystem Edition — zero Agora dependencies.
 */
'use client';

export type {
  UseAgoraRTCOptions,
  UseAgoraRTCReturn,
  AgoraNetworkStats,
  RemoteUser,
  ConnectionState,
} from './useWebRTCVoice';

export { useAgoraRTC } from './useWebRTCVoice';
