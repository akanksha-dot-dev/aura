'use client';

import React from 'react';
import { IncidentStatus } from '@/lib/types';
import { useCostCounter } from '@/hooks/useCostCounter';

export interface CostCounterProps {
  incidentStatus: IncidentStatus;
  openedAt: number;
  resolvedAt?: number;
  baseRate?: number;
  onRateChange?: (newRate: number) => void;
}

export function CostCounter({
  incidentStatus,
  openedAt,
  resolvedAt,
  baseRate = 150,
  onRateChange,
}: CostCounterProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [customRateInput, setCustomRateInput] = React.useState(baseRate.toString());
  const cost = useCostCounter(incidentStatus, openedAt, resolvedAt, baseRate);
  const isResolved = incidentStatus === 'resolved';

  const formattedCost = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cost);

  const estimatedSavings = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cost * 0.52));

  const hourlyRateFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(baseRate * 3600);

  const PRESETS = [
    { label: 'SaaS ($25/s)', rate: 25 },
    { label: 'Mid ($75/s)', rate: 75 },
    { label: 'E-Comm ($150/s)', rate: 150 },
    { label: 'Fintech ($500/s)', rate: 500 },
    { label: 'Cloud ($1k/s)', rate: 1000 },
  ];

  const handleSelectRate = (rate: number) => {
    onRateChange?.(rate);
    setCustomRateInput(rate.toString());
    setIsPopoverOpen(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(1, Math.min(100000, Number(customRateInput) || baseRate));
    onRateChange?.(parsed);
    setIsPopoverOpen(false);
  };

  return (
    <>
      <style>{`
        .cost-counter-container {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          line-height: var(--leading-tight);
          cursor: pointer;
        }
        .cost-counter-interactive-wrapper {
          display: inline-flex;
          align-items: baseline;
          gap: var(--space-1);
        }
        .cost-counter-edit-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-tertiary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xs);
          padding: 1px 3px;
          opacity: 0.6;
          transition: opacity var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard);
        }
        .cost-counter-container:hover .cost-counter-edit-badge {
          opacity: 1;
          color: var(--color-aura);
          border-color: var(--color-aura-dim);
        }
        .cost-counter-value {
          font-family: var(--font-mono);
          font-size: var(--text-lg);
          font-weight: var(--weight-bold);
          font-variant-numeric: tabular-nums;
          color: var(--color-conflict);
          text-shadow: 0 0 8px var(--color-conflict-dim);
          transition: color var(--duration-normal) var(--ease-standard);
        }
        .cost-counter-value--resolved {
          color: var(--color-fact);
          text-shadow: none;
        }
        .cost-counter-savings {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--color-fact);
          font-variant-numeric: tabular-nums;
        }
        .cost-rate-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
        }
        .cost-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: var(--space-3);
          width: 260px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          text-align: left;
        }
        .cost-popover__title {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wider);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cost-popover__hourly {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-aura);
          margin-bottom: var(--space-1);
        }
        .cost-popover__presets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-1);
        }
        .cost-popover__preset-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--bg-base);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-align: center;
          transition: all var(--duration-fast) var(--ease-standard);
        }
        .cost-popover__preset-btn:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-color: var(--color-aura);
        }
        .cost-popover__preset-btn--active {
          border-color: var(--color-aura);
          color: var(--color-aura);
          background: var(--color-aura-dim);
        }
        .cost-popover__form {
          display: flex;
          gap: var(--space-1);
          margin-top: var(--space-1);
        }
        .cost-popover__input {
          flex: 1;
          background: var(--bg-base);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
        }
        .cost-popover__apply-btn {
          background: var(--color-aura);
          color: var(--text-inverse);
          border: none;
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-weight: var(--weight-bold);
        }
      `}</style>
      <div
        className="cost-counter-container"
        role="status"
        aria-label={`Accrued incident cost: ${formattedCost} at ${baseRate} dollars per second`}
        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        title="Click to adjust incident financial burn rate"
      >
        <div className="cost-counter-interactive-wrapper">
          <span className="cost-counter-edit-badge" aria-hidden="true">${baseRate}/s</span>
          <span
            className={`cost-counter-value ${isResolved ? 'cost-counter-value--resolved cost-counter--resolved' : ''}`}
          >
            {formattedCost}
          </span>
        </div>
        {isResolved ? (
          <span className="cost-counter-savings">
            Saved: ~{estimatedSavings}
          </span>
        ) : (
          <span className="cost-rate-badge">
            {hourlyRateFormatted}/hr
          </span>
        )}

        {isPopoverOpen && !isResolved && (
          <div
            className="cost-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cost-popover__title">
              <span>Financial Loss Rate</span>
              <button
                type="button"
                onClick={() => setIsPopoverOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
                aria-label="Close cost rate adjustment popover"
              >
                ✕
              </button>
            </div>
            <div className="cost-popover__hourly">
              Current: ${baseRate}/s ({hourlyRateFormatted}/hr)
            </div>
            <div className="cost-popover__presets">
              {PRESETS.map((p) => (
                <button
                  key={p.rate}
                  type="button"
                  className={`cost-popover__preset-btn ${p.rate === baseRate ? 'cost-popover__preset-btn--active' : ''}`}
                  onClick={() => handleSelectRate(p.rate)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleApplyCustom} className="cost-popover__form">
              <input
                type="number"
                min="1"
                max="100000"
                value={customRateInput}
                onChange={(e) => setCustomRateInput(e.target.value)}
                className="cost-popover__input"
                placeholder="Custom $/sec"
                aria-label="Custom financial burn rate in dollars per second"
              />
              <button type="submit" className="cost-popover__apply-btn">
                Set
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
