import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineFeed } from '@/components/TimelineFeed';
import { EvidenceItem } from '@/lib/types';

describe('TimelineFeed & TimelineCard Components (components/TimelineFeed.tsx)', () => {
  it('renders empty state when evidenceItems is empty', () => {
    render(<TimelineFeed evidenceItems={[]} incidentOpenedAt={Date.now()} />);
    expect(screen.getByText('Awaiting incident telemetry')).toBeInTheDocument();
    expect(screen.getByText('Launch Demo Simulation')).toBeInTheDocument();
  });

  it('renders chronological cards with speaker names, categories, and disproven styling', () => {
    const mockEvidence: EvidenceItem[] = [
      {
        id: 'evt-001',
        category: 'fact',
        content: 'Checkout error rate spiked to 42%',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus Vance',
        confidence: 85,
        timestamp: Date.now() - 60_000,
        status: 'confirmed',
        relatedTo: [],
      },
      {
        id: 'evt-002',
        category: 'hypothesis',
        content: 'Database connection pool exhaustion',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus Vance',
        confidence: 75,
        timestamp: Date.now() - 45_000,
        status: 'disproven',
        relatedTo: ['evt-001'],
      },
      {
        id: 'evt-003',
        category: 'decision',
        content: 'Rollback canary deployment v2.14',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        confidence: 85,
        timestamp: Date.now() - 30_000,
        status: 'confirmed',
        relatedTo: ['evt-001'],
      },
    ];

    render(
      <TimelineFeed
        evidenceItems={mockEvidence}
        incidentOpenedAt={Date.now() - 120_000}
      />
    );

    // Verify content text
    expect(
      screen.getByText('Checkout error rate spiked to 42%')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Database connection pool exhaustion')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Rollback canary deployment v2.14')
    ).toBeInTheDocument();

    // Verify speaker names
    expect(screen.getAllByText('Marcus Vance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();

    // Verify disproven item indicator
    expect(screen.getByTitle('Disproven Hypothesis')).toBeInTheDocument();
    expect(screen.getByTitle('Confidence: 0% (Disproven)')).toBeInTheDocument();
  });

  it('filters timeline cards by category when filter pills are clicked', () => {
    const mockEvidence: EvidenceItem[] = [
      {
        id: 'evt-001',
        category: 'fact',
        content: 'Database connection maxed out',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus Vance',
        confidence: 85,
        timestamp: Date.now() - 30_000,
        status: 'confirmed',
        relatedTo: [],
      },
      {
        id: 'evt-002',
        category: 'hypothesis',
        content: 'Redis memory leak suspected',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        confidence: 70,
        timestamp: Date.now() - 20_000,
        status: 'active',
        relatedTo: [],
      },
    ];

    const { getByRole, getByText, queryByText } = render(
      <TimelineFeed
        evidenceItems={mockEvidence}
        incidentOpenedAt={Date.now() - 60_000}
      />
    );

    // Filter pills rendered with correct counts
    expect(getByText('All')).toBeInTheDocument();
    expect(getByText('Facts')).toBeInTheDocument();
    expect(getByText('Hypotheses')).toBeInTheDocument();

    // Click 'Hypotheses' filter
    const hypoButton = getByRole('tab', { name: /Hypotheses/i });
    fireEvent.click(hypoButton);

    // Only hypothesis is visible, fact is filtered out
    expect(getByText('Redis memory leak suspected')).toBeInTheDocument();
    expect(queryByText('Database connection maxed out')).toBeNull();

    // Click 'All' filter
    const allButton = getByRole('tab', { name: /All/i });
    fireEvent.click(allButton);

    // Both are visible again
    expect(getByText('Database connection maxed out')).toBeInTheDocument();
    expect(getByText('Redis memory leak suspected')).toBeInTheDocument();
  });
});
