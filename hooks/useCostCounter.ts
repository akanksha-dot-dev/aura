'use client';

import { useState, useEffect } from 'react';
import { IncidentStatus } from '@/lib/types';

/**
 * useCostCounter — Ticks at 10Hz to compute incident cost.
 * Rates:
 *  - investigating: $150/sec ($9,000/min)
 *  - identified:    $75/sec  ($4,500/min)
 *  - monitoring:    $25/sec  ($1,500/min)
 * Freezes when status is 'resolved'.
 */
export function useCostCounter(
  status: IncidentStatus,
  openedAt: number,
  resolvedAt?: number
): number {
  const [activeCost, setActiveCost] = useState<number>(0);

  useEffect(() => {
    if (status === 'resolved') {
      return;
    }

    const ratePerSecond: Record<string, number> = {
      investigating: 150,
      identified: 75,
      monitoring: 25,
    };
    const rate = ratePerSecond[status] ?? 150;

    const tick = () => {
      const elapsed = Math.max(0, (Date.now() - openedAt) / 1000);
      setActiveCost(Math.round(elapsed * rate));
    };

    tick();
    const interval = setInterval(tick, 100);

    return () => clearInterval(interval);
  }, [status, openedAt]);

  if (status === 'resolved' && resolvedAt !== undefined) {
    const elapsed = Math.max(0, (resolvedAt - openedAt) / 1000);
    return Math.round(elapsed * 75);
  }

  return activeCost;
}
