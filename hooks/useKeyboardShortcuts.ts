'use client';

import { useEffect, useRef } from 'react';

export interface KeyboardShortcutsHandlers {
  /** ? key: Toggle Keyboard Shortcuts Modal */
  onToggleShortcuts: () => void;
  /** Cmd+K / Ctrl+K / '/' key: Toggle QuickCapture Command Bar */
  onToggleQuickCapture: () => void;
  /** Spacebar: Push-to-talk / Toggle Microphone Mute */
  onToggleMute?: () => void;
  /** Esc: Close all active dialogs, overlays & drawers */
  onCloseAllOverlays: () => void;
  /** T key: Toggle MainView between Timeline & Topology */
  onToggleTab?: () => void;
  /** J key: Toggle Transcript Drawer */
  onToggleTranscript?: () => void;
  /** P key: Toggle Postmortem Modal */
  onTogglePostmortem?: () => void;
  /** K key: Pause / Resume cost counter */
  onToggleCostPause?: () => void;
  /** [ key: Toggle Speaker Panel collapse */
  onToggleSpeakerCollapse?: () => void;
  /** ] key: Toggle Action Tracker collapse */
  onToggleActionsCollapse?: () => void;
  /** \ key: Toggle Full Focus mode (collapse/expand both sidebars) */
  onToggleFullFocus?: () => void;
  /** R key: Toggle Resolve Incident Modal */
  onToggleResolve?: () => void;
  /** A key: Toggle Analytics Dashboard Tab */
  onToggleAnalyticsTab?: () => void;
  /** G key: Open Postmortem Report if incident is resolved */
  onOpenPostmortemIfResolved?: () => void;
}

/**
 * Global war room keyboard shortcuts hook for NASA mission-control ergonomics.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutsHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Cmd+K / Ctrl+K -> QuickCapture
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handlersRef.current.onToggleQuickCapture();
        return;
      }

      // Space -> Toggle Microphone Mute
      if (e.code === 'Space' || (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        if (handlersRef.current.onToggleMute) {
          e.preventDefault();
          handlersRef.current.onToggleMute();
          return;
        }
      }

      // ? / Shift+/ -> Shortcuts cheatsheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        handlersRef.current.onToggleShortcuts();
      } else if (e.key === '/' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        // '/' without modifier -> QuickCapture
        e.preventDefault();
        handlersRef.current.onToggleQuickCapture();
      } else if (e.key === 'Escape') {
        handlersRef.current.onCloseAllOverlays();
      } else if (e.key === 't' || e.key === 'T') {
        handlersRef.current.onToggleTab?.();
      } else if (e.key === 'j' || e.key === 'J') {
        handlersRef.current.onToggleTranscript?.();
      } else if (e.key === 'p' || e.key === 'P') {
        handlersRef.current.onTogglePostmortem?.();
      } else if (e.key === 'k' || e.key === 'K') {
        handlersRef.current.onToggleCostPause?.();
      } else if (e.key === '[') {
        handlersRef.current.onToggleSpeakerCollapse?.();
      } else if (e.key === ']') {
        handlersRef.current.onToggleActionsCollapse?.();
      } else if (e.key === '\\') {
        handlersRef.current.onToggleFullFocus?.();
      } else if (e.key === 'r' || e.key === 'R') {
        handlersRef.current.onToggleResolve?.();
      } else if (e.key === 'a' || e.key === 'A') {
        handlersRef.current.onToggleAnalyticsTab?.();
      } else if (e.key === 'g' || e.key === 'G') {
        handlersRef.current.onOpenPostmortemIfResolved?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
