'use client';

import React from 'react';
import { IncidentStatus } from '@/lib/types';
import { useCostCounter } from '@/hooks/useCostCounter';

export interface CostCounterProps {
  incidentStatus: IncidentStatus;
  openedAt: number;
  resolvedAt?: number;
}

export function CostCounter({
  incidentStatus,
  openedAt,
  resolvedAt,
}: CostCounterProps) {
  const cost = useCostCounter(incidentStatus, openedAt, resolvedAt);
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

  return (
    <>
      <style>{`
        .cost-counter-container {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          line-height: var(--leading-tight);
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
      `}</style>
      <div className="cost-counter-container" role="status" aria-label="Accrued incident cost">
        <span
          className={`cost-counter-value ${isResolved ? 'cost-counter-value--resolved cost-counter--resolved' : ''}`}
        >
          {formattedCost}
        </span>
        {isResolved && (
          <span className="cost-counter-savings">
            Saved: ~{estimatedSavings}
          </span>
        )}
      </div>
    </>
  );
}
