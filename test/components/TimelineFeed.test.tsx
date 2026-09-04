import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
