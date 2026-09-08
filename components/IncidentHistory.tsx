'use client';

import React, { useState, useEffect } from 'react';

/**
 * IncidentHistory — Searchable, filterable list of past incidents.
 * Shows timeline, severity, duration, and evidence counts for each incident.
 * Supports click-through to full detail view.
 */

interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  channel_name: string;
  opened_at: number;
  resolved_at: number | null;
  affected_services: string[];
  cost_accrued: number;
}

interface IncidentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  currentServices?: string[];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const severityColors: Record<string, string> = {
  'SEV-0': '#FF4444',
  'SEV-1': '#F87171',
  'SEV-2': '#FFA726',
  'SEV-3': '#66BB6A',
};

export function IncidentHistory({ isOpen, onClose, currentServices }: IncidentHistoryProps) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalIncidents: number;
    resolvedIncidents: number;
    avgResolutionTimeMs: number;
  } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<Record<string, unknown> | null>(null);

  // Fetch incidents
  useEffect(() => {
    if (!isOpen) return;

    const fetchIncidents = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterSeverity) params.set('severity', filterSeverity);
        if (filterStatus) params.set('status', filterStatus);
        params.set('stats', 'true');

        const res = await fetch(`/api/incidents?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents || []);
          if (data.stats) setStats(data.stats);
        }
      } catch (err) {
        console.warn('[IncidentHistory] Failed to fetch:', err);
      }
      setIsLoading(false);
    };

    fetchIncidents();
  }, [isOpen, filterSeverity, filterStatus]);

  // Search handler
  useEffect(() => {
    if (!isOpen || !searchQuery.trim()) return;

    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/incidents/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.results || []);
        }
      } catch {
        // Use existing results
      }
    }, 400);

    return () => clearTimeout(debounce);
  }, [isOpen, searchQuery]);

  // Fetch detail for selected incident
  useEffect(() => {
    if (!selectedIncident) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/incidents/${encodeURIComponent(selectedIncident)}`);
        if (res.ok) {
          const data = await res.json();
          setIncidentDetail(data);
        }
      } catch {
        setIncidentDetail(null);
      }
    };

    fetchDetail();
  }, [selectedIncident]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface-card, #1a1d23)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          width: '90vw',
          maxWidth: '1000px',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>📊</span>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'white', margin: 0 }}>
              Incident History
            </h2>
            {stats && (
              <span
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                }}
              >
                {stats.totalIncidents} total · {stats.resolvedIncidents} resolved
                {stats.avgResolutionTimeMs > 0 &&
                  ` · avg ${formatDuration(stats.avgResolutionTimeMs)}`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Search & Filters */}
        <div
          style={{
            padding: '12px 24px',
            display: 'flex',
            gap: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'white',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'white',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="">All Severities</option>
            <option value="SEV-0">SEV-0 Critical</option>
            <option value="SEV-1">SEV-1 High</option>
            <option value="SEV-2">SEV-2 Medium</option>
            <option value="SEV-3">SEV-3 Low</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'white',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            <option value="resolved">Resolved</option>
            <option value="investigating">Investigating</option>
            <option value="identified">Identified</option>
            <option value="monitoring">Monitoring</option>
          </select>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              Loading incidents...
            </div>
          ) : incidents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📁</div>
              <div style={{ fontSize: '15px', fontWeight: 500 }}>No past incidents found</div>
              <div style={{ fontSize: '13px', marginTop: '6px', opacity: 0.7 }}>
                Resolved incidents will appear here for future reference
              </div>
            </div>
          ) : selectedIncident && incidentDetail ? (
            /* Detail View */
            <div>
              <button
                onClick={() => {
                  setSelectedIncident(null);
                  setIncidentDetail(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                ← Back to list
              </button>
              <div style={{ color: 'white' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                  {(incidentDetail.incident as Record<string, unknown>)?.title as string}
                </h3>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '16px',
                  }}
                >
                  {(incidentDetail.stats as Record<string, unknown>)?.evidenceCount as number}{' '}
                  evidence items ·{' '}
                  {(incidentDetail.stats as Record<string, unknown>)?.participantCount as number}{' '}
                  participants
                  {Boolean((incidentDetail.stats as Record<string, unknown>)?.durationMs) && (
                    <>
                      {' '}
                      · Duration:{' '}
                      {formatDuration(
                        (incidentDetail.stats as Record<string, unknown>)?.durationMs as number
                      )}
                    </>
                  )}
                </div>
                {/* Evidence Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(
                    (incidentDetail.evidence as Array<Record<string, unknown>>) || []
                  ).map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        borderLeft: `3px solid ${
                          ev.category === 'fact'
                            ? '#4ECDC4'
                            : ev.category === 'hypothesis'
                            ? '#FFD93D'
                            : ev.category === 'decision'
                            ? '#6C5CE7'
                            : ev.category === 'action'
                            ? '#A8E6CF'
                            : '#FF6B6B'
                        }`,
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                        {(ev.category as string).toUpperCase()} · {ev.speaker_name as string} ·{' '}
                        confidence {ev.confidence as number}%
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                        {ev.content as string}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* List View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {incidents.map((inc) => {
                const hasSimilarServices =
                  currentServices &&
                  inc.affected_services?.some((s) => currentServices.includes(s));

                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      background: hasSimilarServices
                        ? 'rgba(78, 205, 196, 0.06)'
                        : 'rgba(255,255,255,0.02)',
                      border: hasSimilarServices
                        ? '1px solid rgba(78, 205, 196, 0.2)'
                        : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      color: 'white',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Severity badge */}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: severityColors[inc.severity] || '#999',
                        background: `${severityColors[inc.severity] || '#999'}18`,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        minWidth: '52px',
                        textAlign: 'center',
                      }}
                    >
                      {inc.severity}
                    </span>

                    {/* Title & metadata */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {inc.title}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: '3px',
                        }}
                      >
                        {formatDate(inc.opened_at)}
                        {inc.resolved_at && ` · ${formatDuration(inc.resolved_at - inc.opened_at)}`}
                        {inc.affected_services?.length > 0 &&
                          ` · ${inc.affected_services.join(', ')}`}
                      </div>
                    </div>

                    {/* Status & similarity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {hasSimilarServices && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#4ECDC4',
                            background: 'rgba(78,205,196,0.12)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 600,
                          }}
                        >
                          SIMILAR
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '10px',
                          color:
                            inc.status === 'resolved'
                              ? '#66BB6A'
                              : inc.status === 'investigating'
                              ? '#FFA726'
                              : '#999',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {inc.status === 'resolved' ? '✓' : '⚠'} {inc.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
