import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptDrawer, TranscriptEntry } from '@/components/TranscriptDrawer';

describe('TranscriptDrawer Component (components/TranscriptDrawer.tsx)', () => {
  const mockEntries: TranscriptEntry[] = [
    {
      id: 't-1',
      speakerName: 'Sarah',
      timestamp: Date.now() - 60_000,
      text: 'Error rate just spiked to 42% on payment services.',
    },
    {
      id: 't-2',
      speakerName: 'Marcus',
      timestamp: Date.now() - 45_000,
      text: 'Checking the Postgres connection pool metrics now.',
    },
    {
      id: 't-3',
      speakerName: 'AURA',
      timestamp: Date.now() - 30_000,
      text: 'Logged confirmed fact. Two competing theories active.',
    },
  ];

  it('renders conversational transcript entries when open', () => {
    const onClose = vi.fn();
    render(
      <TranscriptDrawer
        isOpen={true}
        onClose={onClose}
        entries={mockEntries}
      />
    );

    expect(screen.getByText('Voice Transcript Log')).toBeInTheDocument();
    expect(screen.getByText('Error rate just spiked to 42% on payment services.')).toBeInTheDocument();
    expect(screen.getByText('Checking the Postgres connection pool metrics now.')).toBeInTheDocument();
    expect(screen.getByText('Logged confirmed fact. Two competing theories active.')).toBeInTheDocument();
  });

  it('filters transcript entries by search query', () => {
    const onClose = vi.fn();
    render(
      <TranscriptDrawer
        isOpen={true}
        onClose={onClose}
        entries={mockEntries}
      />
    );

    const searchInput = screen.getByPlaceholderText('Filter by speaker or text...');
    expect(searchInput).toBeInTheDocument();

    // Type search query "Postgres"
    fireEvent.change(searchInput, { target: { value: 'Postgres' } });

    expect(screen.getByText('Checking the Postgres connection pool metrics now.')).toBeInTheDocument();
    expect(screen.queryByText('Error rate just spiked to 42% on payment services.')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <TranscriptDrawer
        isOpen={true}
        onClose={onClose}
        entries={mockEntries}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close transcript drawer/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
