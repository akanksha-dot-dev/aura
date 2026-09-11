'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────────

export type ToastType =
  | 'escalation'
  | 'sla_warning'
  | 'sla_breach'
  | 'similar_found'
  | 'resolution'
  | 'info';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  persistent?: boolean; // Won't auto-dismiss
  timestamp: number;
}

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

// ── Color & Icon Map ─────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: string; accentColor: string; bgGlow: string; label: string }
> = {
  escalation: {
    icon: '🚨',
    accentColor: '#F59E0B',
    bgGlow: 'rgba(245, 158, 11, 0.06)',
    label: 'ESCALATION',
  },
  sla_warning: {
    icon: '⏱️',
    accentColor: '#F59E0B',
    bgGlow: 'rgba(245, 158, 11, 0.06)',
    label: 'SLA WARNING',
  },
  sla_breach: {
    icon: '🔴',
    accentColor: '#F43F5E',
    bgGlow: 'rgba(244, 63, 94, 0.08)',
    label: 'SLA BREACHED',
  },
  similar_found: {
    icon: '🧠',
    accentColor: '#6366F1',
    bgGlow: 'rgba(99, 102, 241, 0.06)',
    label: 'AI INSIGHT',
  },
  resolution: {
    icon: '✅',
    accentColor: '#10B981',
    bgGlow: 'rgba(16, 185, 129, 0.06)',
    label: 'RESOLVED',
  },
  info: {
    icon: 'ℹ️',
    accentColor: '#71717A',
    bgGlow: 'rgba(113, 113, 122, 0.04)',
    label: 'INFO',
  },
};

// ── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = TOAST_CONFIG[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast.persistent) return;
    const timer = setTimeout(() => onDismiss(toast.id), 8000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.persistent, onDismiss]);

  // Animate progress bar for auto-dismiss
  useEffect(() => {
    if (toast.persistent || !progressRef.current) return;
    const el = progressRef.current;
    el.style.transition = 'none';
    el.style.width = '100%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'width 8s linear';
        el.style.width = '0%';
      });
    });
  }, [toast.persistent]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: 360,
        background: 'var(--bg-surface-raised, #13151A)',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        borderLeft: `3px solid ${config.accentColor}`,
        borderRadius: 'var(--radius-lg, 8px)',
        boxShadow: `0 12px 40px -8px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06), 0 0 20px ${config.bgGlow}`,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        cursor: 'default',
      }}
    >
      {/* Content */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px 10px' }}>
        {/* Icon */}
        <div
          style={{
            fontSize: 20,
            lineHeight: 1,
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: config.bgGlow,
            borderRadius: 'var(--radius-sm, 4px)',
          }}
        >
          {config.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs, 11px)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: config.accentColor,
                textTransform: 'uppercase',
              }}
            >
              {config.label}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs, 11px)',
                color: 'var(--text-muted, #71717A)',
              }}
            >
              {new Date(toast.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div
            style={{
              fontSize: 'var(--text-base, 13px)',
              fontWeight: 500,
              color: 'var(--text-primary, #F4F4F6)',
              lineHeight: 1.4,
              marginBottom: 2,
            }}
          >
            {toast.title}
          </div>
          <div
            style={{
              fontSize: 'var(--text-sm, 12px)',
              color: 'var(--text-secondary, #A1A1AA)',
              lineHeight: 1.45,
            }}
          >
            {toast.description}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #71717A)',
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary, #F4F4F6)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted, #71717A)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ✕
        </button>
      </div>

      {/* Action Button */}
      {toast.actionLabel && toast.onAction && (
        <div style={{ padding: '0 14px 10px', display: 'flex' }}>
          <button
            onClick={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
            style={{
              fontSize: 'var(--text-sm, 12px)',
              fontWeight: 500,
              color: config.accentColor,
              background: config.bgGlow,
              border: `1px solid ${config.accentColor}33`,
              borderRadius: 'var(--radius-sm, 4px)',
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${config.accentColor}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = config.bgGlow;
            }}
          >
            {toast.actionLabel}
          </button>
        </div>
      )}

      {/* Auto-dismiss progress bar */}
      {!toast.persistent && (
        <div
          ref={progressRef}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 2,
            background: config.accentColor,
            opacity: 0.4,
            width: '100%',
          }}
        />
      )}
    </motion.div>
  );
}

// ── Toast Container & Hook ───────────────────────────────────────────────────

// Module-level toast state for cross-component access
type ToastListener = (toasts: ToastNotification[]) => void;
let currentToasts: ToastNotification[] = [];
const listeners = new Set<ToastListener>();
const MAX_VISIBLE = 4;
let toastIdCounter = 0;

function notify() {
  listeners.forEach((l) => l([...currentToasts]));
}

/**
 * Emit a toast notification from anywhere in the app.
 * Returns the toast ID for programmatic dismissal.
 */
export function emitToast(
  toast: Omit<ToastNotification, 'id' | 'timestamp'>,
): string {
  const id = `toast-${++toastIdCounter}-${Date.now()}`;
  const newToast: ToastNotification = {
    ...toast,
    id,
    timestamp: Date.now(),
  };

  currentToasts = [newToast, ...currentToasts].slice(0, MAX_VISIBLE);
  notify();
  return id;
}

export function dismissToast(id: string): void {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notify();
}

/**
 * Toast notification container — renders stacking toast cards.
 * Place once at the app layout level.
 */
export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  useEffect(() => {
    const handler: ToastListener = (t) => setToasts(t);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onDismiss={handleDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
