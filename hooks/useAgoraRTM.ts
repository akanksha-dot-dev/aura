/**
 * useAgoraRTM.ts — BACKWARD-COMPAT RE-EXPORT ALIAS
 * All logic lives in useFirebaseRTM.ts (Firebase RTDB onChildAdded — sub-100ms)
 * This file exists only so existing imports from '@/hooks/useAgoraRTM' keep working unchanged.
 *
 * Google Ecosystem Edition — zero Agora dependencies.
 */
'use client';

export type {
  RTMTranscriptEntry,
  UseAgoraRTMOptions,
  UseAgoraRTMReturn,
} from './useFirebaseRTM';

export {
  useAgoraRTM,
  setRtmIncidentState,
  getRtmIncidentState,
} from './useFirebaseRTM';
