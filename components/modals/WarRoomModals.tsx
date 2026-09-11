'use client';

import React from 'react';
import type { IncidentState, TopologyEdge } from '@/lib/types';
import type { UseWarRoomModalsReturn } from '@/hooks/useWarRoomModals';
import { PostmortemModal } from './PostmortemModal';
import { ResolveIncidentModal } from './ResolveIncidentModal';
import { WarRoomInvite } from './WarRoomInvite';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { QuickCapture, QuickCapturePayload } from './QuickCapture';
import { TranscriptDrawer, TranscriptEntry } from './TranscriptDrawer';
import { NotificationToastContainer } from '@/components/indicators/NotificationToast';
import { playResolutionEarcon } from '@/lib/audioCues';

export interface WarRoomModalsProps {
  modals: UseWarRoomModalsReturn;
  incident: IncidentState;
  topologyEdges: TopologyEdge[];
  costRate: number;
  channelName: string;
  effectiveTranscripts: TranscriptEntry[];
  speakerName: string;
  onQuickCaptureSubmit: (payload: QuickCapturePayload) => void;
}

export function WarRoomModals({
  modals,
  incident,
  topologyEdges,
  costRate,
  channelName,
  effectiveTranscripts,
  speakerName,
  onQuickCaptureSubmit,
}: WarRoomModalsProps) {
  return (
    <>
      <PostmortemModal
        isOpen={modals.isPostmortemOpen}
        onClose={() => modals.closeModal('postmortem')}
        incident={incident}
        evidenceChainEdges={topologyEdges}
        costRate={costRate}
      />
      <ResolveIncidentModal
        isOpen={modals.isResolveOpen}
        onClose={() => modals.closeModal('resolve')}
        incident={incident}
        channelName={channelName}
        onResolved={() => playResolutionEarcon()}
      />
      <NotificationToastContainer />
      <TranscriptDrawer
        isOpen={modals.isTranscriptOpen}
        onClose={() => modals.closeModal('transcript')}
        entries={effectiveTranscripts}
      />
      <KeyboardShortcutsModal
        isOpen={modals.isShortcutsOpen}
        onClose={() => modals.closeModal('shortcuts')}
      />
      <WarRoomInvite
        isOpen={modals.isInviteOpen}
        onClose={() => modals.closeModal('invite')}
      />
      <QuickCapture
        isOpen={modals.isQuickCaptureOpen}
        onClose={() => modals.closeModal('quickCapture')}
        speakerName={speakerName}
        onSubmit={onQuickCaptureSubmit}
      />
    </>
  );
}
