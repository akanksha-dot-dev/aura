'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { IncidentState } from '@/lib/types';

export interface SimilarIncidentSuggestion {
  incidentId: string;
  title: string;
  severity: string;
  similarityScore: number;
  rootCause: string;
  resolutionSteps: string[];
  mttrMinutes: number;
}

export interface SimilarIncidentBannerProps {
  incident: IncidentState;
  channelName: string;
}

export function SimilarIncidentBanner({ incident, channelName }: SimilarIncidentBannerProps) {
  const [suggestions, setSuggestions] = useState<SimilarIncidentSuggestion[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Only check when we have 3+ evidence items
  const checkSimilar = useCallback(async () => {
    if (incident.evidenceItems.length < 3 || incident.status === 'resolved') return;

    try {
      const services = incident.affectedServices;
      if (services.length === 0) return;

      const res = await fetch('/api/incidents/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services,
          symptoms: incident.evidenceItems
            .filter((e) => e.category === 'fact')
            .map((e) => e.content)
            .slice(0, 5)
            .join('; '),
          channelName,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.matches && data.matches.length > 0) {
        setSuggestions(
          data.matches.slice(0, 3).map((m: Record<string, unknown>) => ({
            incidentId: String(m.id || ''),
            title: String(m.title || ''),
            severity: String(m.severity || ''),
            similarityScore: Number(m.score || 0),
            rootCause: String(m.root_cause || 'Unknown'),
            resolutionSteps: Array.isArray(m.resolution_steps) ? m.resolution_steps as string[] : [],
            mttrMinutes: Number(m.mttr_minutes || 0),
          })),
        );
      }
    } catch {
      // Non-critical — fail silently
    } finally {
      setHasChecked(true);
    }
  }, [incident.evidenceItems, incident.affectedServices, incident.status, channelName]);

  // Check when evidence count crosses threshold
  useEffect(() => {
    if (hasChecked || incident.evidenceItems.length < 3) return;
    const timer = setTimeout(checkSimilar, 2000); // Debounce
    return () => clearTimeout(timer);
  }, [incident.evidenceItems.length, hasChecked, checkSimilar]);

  // Re-check when evidence doubles
  useEffect(() => {
    if (incident.evidenceItems.length >= 6 && suggestions.length === 0 && hasChecked) {
      setHasChecked(false); // Allow re-check
    }
  }, [incident.evidenceItems.length, suggestions.length, hasChecked]);

  if (isDismissed || suggestions.length === 0) return null;

  const topMatch = suggestions[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          margin: '0 12px',
          marginBottom: 8,
          background: 'var(--bg-surface-raised, #13151A)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderLeft: '3px solid #6366F1',
          borderRadius: 'var(--radius-md, 6px)',
          overflow: 'hidden',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.04)',
        }}
      >
        {/* Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 10px',
            cursor: 'pointer',
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(99, 102, 241, 0.12)',
                borderRadius: 'var(--radius-sm, 4px)',
              }}
            >
              🧠
            </span>
            <div>
              <span
                style={{
                  fontSize: 'var(--text-sm, 12px)',
                  fontWeight: 600,
                  color: '#6366F1',
                }}
              >
                AURA found {suggestions.length} similar past incident{suggestions.length > 1 ? 's' : ''}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs, 11px)',
                  color: 'var(--text-muted)',
                  marginLeft: 8,
                }}
              >
                Top match: &quot;{topMatch.title}&quot; ({topMatch.similarityScore}% similar)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 'var(--text-xs, 11px)',
                color: 'var(--text-muted)',
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDismissed(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 2px',
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Expanded Cards */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((s) => (
                  <div
                    key={s.incidentId}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-surface, #0D0E11)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md, 6px)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 'var(--text-xs, 11px)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm, 4px)',
                            fontWeight: 600,
                            background: s.severity === 'SEV-0' || s.severity === 'SEV-1'
                              ? 'rgba(244,63,94,0.1)'
                              : 'rgba(245,158,11,0.1)',
                            color: s.severity === 'SEV-0' || s.severity === 'SEV-1'
                              ? '#F43F5E'
                              : '#F59E0B',
                          }}
                        >
                          {s.severity}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--text-base, 13px)',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {s.title}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--text-xs, 11px)',
                          fontWeight: 600,
                          color: '#6366F1',
                          padding: '2px 6px',
                          background: 'rgba(99,102,241,0.1)',
                          borderRadius: 'var(--radius-sm, 4px)',
                        }}
                      >
                        {s.similarityScore}% match
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 'var(--text-sm, 12px)',
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>Root cause:</strong> {s.rootCause}
                    </div>

                    {s.resolutionSteps.length > 0 && (
                      <div style={{ fontSize: 'var(--text-xs, 11px)', color: 'var(--text-muted)' }}>
                        <strong>Resolution:</strong>{' '}
                        {s.resolutionSteps.slice(0, 2).join(' → ')}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: 'var(--text-xs, 11px)',
                        color: 'var(--text-muted)',
                        marginTop: 4,
                      }}
                    >
                      Resolved in {s.mttrMinutes}m
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
