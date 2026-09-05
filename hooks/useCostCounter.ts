'use client';

import React, { useState } from 'react';
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
  resolvedAt?: number,
  baseRate: number = 150,
  isPaused: boolean = false
): number {
  const [activeCost, setActiveCost] = useState<number>(0);
  const rateRef = React.useRef(baseRate);
  const baseCostAccumulatedRef = React.useRef(0);
  const lastRateChangeTimeRef = React.useRef(openedAt);
  const isPausedRef = React.useRef(isPaused);

  // Sync if openedAt changes (e.g. replay restart)
  React.useEffect(() => {
    lastRateChangeTimeRef.current = openedAt;
    baseCostAccumulatedRef.current = 0;
  }, [openedAt]);

  // Handle pause / resume transitions
  React.useEffect(() => {
    const now = Date.now();
    if (isPaused && !isPausedRef.current) {
      // Transition from running to paused: lock in elapsed
      const multiplier: Record<string, number> = {
        investigating: 1,
        identified: 0.5,
        monitoring: 0.2,
      };
      const mult = multiplier[status] ?? 1;
      const elapsed = Math.max(0, (now - lastRateChangeTimeRef.current) / 1000);
      baseCostAccumulatedRef.current += elapsed * (rateRef.current * mult);
      lastRateChangeTimeRef.current = now;
      setActiveCost(Math.round(baseCostAccumulatedRef.current));
    } else if (!isPaused && isPausedRef.current) {
      // Transition from paused to running: reset timer origin
      lastRateChangeTimeRef.current = now;
    }
    isPausedRef.current = isPaused;
  }, [isPaused, status]);

  // When baseRate changes dynamically, accumulate previous segment
  React.useEffect(() => {
    if (baseRate !== rateRef.current) {
      const now = Date.now();
      if (!isPaused) {
        const elapsed = Math.max(0, (now - lastRateChangeTimeRef.current) / 1000);
        baseCostAccumulatedRef.current += elapsed * rateRef.current;
        lastRateChangeTimeRef.current = now;
      }
      rateRef.current = baseRate;
    }
  }, [baseRate, isPaused]);

  React.useEffect(() => {
    if (status === 'resolved' || isPaused) {
      return;
    }

    const multiplier: Record<string, number> = {
      investigating: 1,
      identified: 0.5,
      monitoring: 0.2,
    };
    const mult = multiplier[status] ?? 1;

    const tick = () => {
      const now = Date.now();
      const elapsedSinceChange = Math.max(0, (now - lastRateChangeTimeRef.current) / 1000);
      const currentSegment = elapsedSinceChange * (baseRate * mult);
      setActiveCost(Math.round(baseCostAccumulatedRef.current + currentSegment));
    };

    tick();
    const interval = setInterval(tick, 100);

    return () => clearInterval(interval);
  }, [status, openedAt, baseRate, isPaused]);

  if (status === 'resolved' && resolvedAt !== undefined) {
    // Use the last accumulated cost from the tick loop, which properly
    // accounts for rate changes and pause/resume during the incident.
    // Only fall back to naive calculation if activeCost was never set.
    if (activeCost > 0) return activeCost;
    const elapsed = Math.max(0, (resolvedAt - openedAt) / 1000);
    return Math.round(elapsed * (baseRate * 0.5));
  }

  return activeCost;
}
