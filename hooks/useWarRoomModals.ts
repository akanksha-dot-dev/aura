'use client';

import { useState, useCallback } from 'react';

export type WarRoomModalKey =
  | 'invite'
  | 'resolve'
  | 'postmortem'
  | 'quickCapture'
  | 'shortcuts'
  | 'analytics'
  | 'transcript';

export interface UseWarRoomModalsReturn {
  // State flags
  isInviteOpen: boolean;
  isResolveOpen: boolean;
  isPostmortemOpen: boolean;
  isQuickCaptureOpen: boolean;
  isShortcutsOpen: boolean;
  isAnalyticsOpen: boolean;
  isAnalyticsCollapsed: boolean;
  isTranscriptOpen: boolean;
  isTranscriptDrawerOpen: boolean;

  // Direct state setters
  setIsInviteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsResolveOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsPostmortemOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsQuickCaptureOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsShortcutsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsAnalyticsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsAnalyticsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  setIsTranscriptOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsTranscriptDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  // Canonical memoized action dispatchers
  openModal: (modal: WarRoomModalKey) => void;
  closeModal: (modal: WarRoomModalKey) => void;
  toggleModal: (modal: WarRoomModalKey) => void;
  closeAllModals: () => void;
}

/**
 * Custom hook encapsulating modal and drawer display state for the AURA War Room Flight Deck.
 */
export function useWarRoomModals(): UseWarRoomModalsReturn {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isPostmortemOpen, setIsPostmortemOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const openModal = useCallback((modal: WarRoomModalKey) => {
    switch (modal) {
      case 'invite':
        setIsInviteOpen(true);
        break;
      case 'resolve':
        setIsResolveOpen(true);
        break;
      case 'postmortem':
        setIsPostmortemOpen(true);
        break;
      case 'quickCapture':
        setIsQuickCaptureOpen(true);
        break;
      case 'shortcuts':
        setIsShortcutsOpen(true);
        break;
      case 'analytics':
        setIsAnalyticsOpen(true);
        break;
      case 'transcript':
        setIsTranscriptOpen(true);
        break;
    }
  }, []);

  const closeModal = useCallback((modal: WarRoomModalKey) => {
    switch (modal) {
      case 'invite':
        setIsInviteOpen(false);
        break;
      case 'resolve':
        setIsResolveOpen(false);
        break;
      case 'postmortem':
        setIsPostmortemOpen(false);
        break;
      case 'quickCapture':
        setIsQuickCaptureOpen(false);
        break;
      case 'shortcuts':
        setIsShortcutsOpen(false);
        break;
      case 'analytics':
        setIsAnalyticsOpen(false);
        break;
      case 'transcript':
        setIsTranscriptOpen(false);
        break;
    }
  }, []);

  const toggleModal = useCallback((modal: WarRoomModalKey) => {
    switch (modal) {
      case 'invite':
        setIsInviteOpen((prev) => !prev);
        break;
      case 'resolve':
        setIsResolveOpen((prev) => !prev);
        break;
      case 'postmortem':
        setIsPostmortemOpen((prev) => !prev);
        break;
      case 'quickCapture':
        setIsQuickCaptureOpen((prev) => !prev);
        break;
      case 'shortcuts':
        setIsShortcutsOpen((prev) => !prev);
        break;
      case 'analytics':
        setIsAnalyticsOpen((prev) => !prev);
        break;
      case 'transcript':
        setIsTranscriptOpen((prev) => !prev);
        break;
    }
  }, []);

  const closeAllModals = useCallback(() => {
    setIsInviteOpen(false);
    setIsResolveOpen(false);
    setIsPostmortemOpen(false);
    setIsQuickCaptureOpen(false);
    setIsShortcutsOpen(false);
    setIsAnalyticsOpen(false);
    setIsTranscriptOpen(false);
  }, []);

  const isAnalyticsCollapsed = !isAnalyticsOpen;
  const setIsAnalyticsCollapsed = useCallback(
    (collapsed: boolean | ((prev: boolean) => boolean)) => {
      setIsAnalyticsOpen((prev) => {
        const nextCollapsed = typeof collapsed === 'function' ? collapsed(!prev) : collapsed;
        return !nextCollapsed;
      });
    },
    []
  );

  return {
    isInviteOpen,
    isResolveOpen,
    isPostmortemOpen,
    isQuickCaptureOpen,
    isShortcutsOpen,
    isAnalyticsOpen,
    isAnalyticsCollapsed,
    isTranscriptOpen,
    isTranscriptDrawerOpen: isTranscriptOpen,

    setIsInviteOpen,
    setIsResolveOpen,
    setIsPostmortemOpen,
    setIsQuickCaptureOpen,
    setIsShortcutsOpen,
    setIsAnalyticsOpen,
    setIsAnalyticsCollapsed,
    setIsTranscriptOpen,
    setIsTranscriptDrawerOpen: setIsTranscriptOpen,

    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
  };
}
