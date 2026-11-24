import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PitchTourModal } from '@/components/modals/PitchTourModal';

describe('PitchTourModal Component (components/modals/PitchTourModal.tsx)', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PitchTourModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all 5 pitch steps, title, and interactive buttons when isOpen is true', () => {
    render(<PitchTourModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText(/AURA 2.0 • 60-Second Buildathon Pitch Tour/i)).toBeInTheDocument();
    expect(screen.getByText('STAGE 1: THE CRISIS')).toBeInTheDocument();
    expect(screen.getByText('Outage Influx & Financial Burn Rate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🚨 Ingest Crisis Telemetry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🔊 Listen to AURA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Auto-Play Pitch/i })).toBeInTheDocument();
  });

  it('navigates to next and back steps when navigation buttons are clicked', () => {
    render(<PitchTourModal isOpen={true} onClose={() => {}} />);

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /Next →/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('STAGE 2: COGNITIVE CLARITY')).toBeInTheDocument();
    expect(screen.getByText('Epistemic Causal Knowledge Graph')).toBeInTheDocument();

    // Click Back
    const backBtn = screen.getByRole('button', { name: /← Back/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('STAGE 1: THE CRISIS')).toBeInTheDocument();
  });

  it('invokes trigger callback when stage action button is clicked', () => {
    const onSimulateOutage = vi.fn();
    render(
      <PitchTourModal
        isOpen={true}
        onClose={() => {}}
        onSimulateOutage={onSimulateOutage}
      />
    );

    const actionBtn = screen.getByRole('button', { name: /🚨 Ingest Crisis Telemetry/i });
    fireEvent.click(actionBtn);
    expect(onSimulateOutage).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<PitchTourModal isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close walkthrough/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
