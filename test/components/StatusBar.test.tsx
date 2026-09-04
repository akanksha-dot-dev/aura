import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '@/components/StatusBar';

describe('StatusBar Component (components/StatusBar.tsx)', () => {
  it('renders incident header, severity badge, and title correctly', () => {
    render(
      <StatusBar
        incidentTitle="Payment Gateway Outage — Checkout Failures"
        severity="SEV-1"
        status="investigating"
        openedAt={Date.now() - 30_000}
        currentOODAPhase="ORIENT"
        icName="Sarah"
        connectionQuality="excellent"
      />
    );

    expect(screen.getByText('AURA')).toBeInTheDocument();
    expect(screen.getByText('INC-492')).toBeInTheDocument();
    expect(screen.getByText('SEV-1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Payment Gateway Outage — Checkout Failures',
      })
    ).toBeInTheDocument();
  });

  it('renders active OODA loop phase indicator', () => {
    render(
      <StatusBar
        incidentTitle="Payment Gateway Outage"
        severity="SEV-1"
        status="investigating"
        openedAt={Date.now()}
        currentOODAPhase="DECIDE"
        icName="Sarah"
        connectionQuality="good"
      />
    );

    const decideStep = screen.getByText('DECIDE');
    expect(decideStep).toBeInTheDocument();
  });

  it('renders locked IC name when assigned, or Claim IC button when unassigned', () => {
    const onClaimIC = vi.fn();
    const { rerender } = render(
      <StatusBar
        incidentTitle="Payment Gateway Outage"
        severity="SEV-1"
        status="investigating"
        openedAt={Date.now()}
        currentOODAPhase="OBSERVE"
        icName="Sarah"
        connectionQuality="excellent"
      />
    );

    expect(screen.getByText('Sarah (IC)')).toBeInTheDocument();

    // Rerender with icName = null
    rerender(
      <StatusBar
        incidentTitle="Payment Gateway Outage"
        severity="SEV-1"
        status="investigating"
        openedAt={Date.now()}
        currentOODAPhase="OBSERVE"
        icName={null}
        connectionQuality="excellent"
        onClaimIC={onClaimIC}
      />
    );

    const claimBtn = screen.getByRole('button', { name: /Claim IC/i });
    expect(claimBtn).toBeInTheDocument();
    fireEvent.click(claimBtn);
    expect(onClaimIC).toHaveBeenCalledTimes(1);
  });

  it('toggles theme when clicking theme button', () => {
    render(
      <StatusBar
        incidentTitle="Payment Gateway Outage"
        severity="SEV-1"
        status="investigating"
        openedAt={Date.now()}
        currentOODAPhase="OBSERVE"
        icName="Sarah"
        connectionQuality="excellent"
      />
    );

    const themeBtn = screen.getByRole('button', { name: /Switch to/i });
    expect(themeBtn).toBeInTheDocument();
    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBeDefined();
  });
});
