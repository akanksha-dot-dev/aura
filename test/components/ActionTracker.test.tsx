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

  it('renders collapsed rail view with progress ratio and interactive rail items', () => {
    const onStatusChange = vi.fn();
    const onToggleCollapse = vi.fn();
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
        actionStatus: 'done',
        confidence: 85,
        timestamp: Date.now(),
        relatedTo: [],
        status: 'active',
      },
    ];

    render(
      <ActionTracker
        actions={mockActions}
        onStatusChange={onStatusChange}
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />
    );

    // Collapsed header shows expand button
    const expandBtn = screen.getByRole('button', { name: /Expand Action Items/i });
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    // Shows compact progress ratio
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Clicking an in-rail action button cycles status directly from rail
    const pendingRailBtn = screen.getByLabelText(/ACT-1.*PENDING/i);
    expect(pendingRailBtn).toBeInTheDocument();
    fireEvent.click(pendingRailBtn);
    expect(onStatusChange).toHaveBeenCalledWith('act-1', 'in_progress');
  });
});
