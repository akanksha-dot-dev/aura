import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCostCounter } from '@/hooks/useCostCounter';

describe('useCostCounter Hook (hooks/useCostCounter.ts)', () => {
  let startTime: number;

  beforeEach(() => {
    startTime = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates cost at $150/sec during investigating phase', () => {
    const { result } = renderHook(() =>
      useCostCounter('investigating', startTime, undefined, 150, false)
    );

    expect(result.current).toBe(0);

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // 5s * 150 = $750
    expect(result.current).toBe(750);

    // Advance another 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // 10s * 150 = $1500
    expect(result.current).toBe(1500);
  });

  it('accumulates cost at 50% rate ($75/sec) during identified phase', () => {
    const { result } = renderHook(() =>
      useCostCounter('identified', startTime, undefined, 150, false)
    );

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // 10s * (150 * 0.5) = $750
    expect(result.current).toBe(750);
  });

  it('accumulates cost at 20% rate during monitoring phase', () => {
    const { result } = renderHook(() =>
      useCostCounter('monitoring', startTime, undefined, 150, false)
    );

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // 10s * (150 * 0.2) = $300
    expect(result.current).toBe(300);
  });

  it('freezes cost calculation when status is resolved with resolvedAt stamp', () => {
    const resolvedTime = startTime + 120_000; // 120s duration
    const { result } = renderHook(() =>
      useCostCounter('resolved', startTime, resolvedTime, 150, false)
    );

    // 120s * (150 * 0.5) = $9,000
    expect(result.current).toBe(9000);

    // Advancing time should not change resolved cost
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current).toBe(9000);
  });

  it('pauses and resumes cost accumulation accurately when isPaused toggles', () => {
    let isPaused = false;
    const { result, rerender } = renderHook(
      ({ paused }) => useCostCounter('investigating', startTime, undefined, 150, paused),
      { initialProps: { paused: isPaused } }
    );

    // Run for 4 seconds -> $600
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBe(600);

    // Pause the counter
    isPaused = true;
    rerender({ paused: isPaused });

    // Advance 10 seconds while paused
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(600); // Stays at $600

    // Resume the counter
    isPaused = false;
    rerender({ paused: isPaused });

    // Advance 2 seconds -> $600 + (2 * 150) = $900
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(900);
  });
});
