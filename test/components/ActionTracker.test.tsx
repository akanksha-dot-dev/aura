import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionTracker } from '@/components/ActionTracker';
import { EvidenceItem } from '@/lib/types';

describe('ActionTracker Component (components/ActionTracker.tsx)', () => {
  it('renders empty listening state when no actions exist', () => {
    const onStatusChange = vi.fn();
    render(<ActionTracker actions={[]} onStatusChange={onStatusChange} />);
    expect(screen.getByText('Mitigation Actions')).toBeInTheDocument();
    expect(
      screen.getByText(/AURA AI synthesizes verbal tasks into Jira & Slack action items/i)
    ).toBeInTheDocument();
  });

  it('renders action items and cycles status when clicked', () => {
    const onStatusChange = vi.fn();
    const mockActions: EvidenceItem[] = [
      {
        id: 'act-1',
        category: 'action',
        content: 'Scale read replicas to 10 instances',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        assignedTo: 'Marcus Vance',
        actionStatus: 'pending',
        confidence: 85,
        timestamp: Date.now(),
        relatedTo: [],
        status: 'active',
      },
      {
        id: 'act-2',
        category: 'action',
        content: 'Notify customer support leadership',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        assignedTo: 'Priya Patel',
        actionStatus: 'in_progress',
        confidence: 85,
        timestamp: Date.now(),
        relatedTo: [],
        status: 'active',
      },
    ];

    render(
      <ActionTracker actions={mockActions} onStatusChange={onStatusChange} />
    );

    expect(
      screen.getByText('Scale read replicas to 10 instances')
    ).toBeInTheDocument();
    expect(screen.getByText('@Marcus Vance')).toBeInTheDocument();
    expect(
      screen.getByText('Notify customer support leadership')
    ).toBeInTheDocument();
    expect(screen.getByText('@Priya Patel')).toBeInTheDocument();

    // Click on pending action item -> cycles to in_progress
    const pendingItem = screen.getByText('Scale read replicas to 10 instances').closest('.action-item');
    expect(pendingItem).not.toBeNull();
    if (pendingItem) {
      fireEvent.click(pendingItem);
    }
    expect(onStatusChange).toHaveBeenCalledWith('act-1', 'in_progress');
  });
});
