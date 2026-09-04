import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostmortemModal } from '@/components/PostmortemModal';
import { IncidentState } from '@/lib/types';

describe('PostmortemModal Component (components/PostmortemModal.tsx)', () => {
  const mockResolvedIncident: IncidentState = {
    incidentId: 'INC-4821',
    title: 'Payment Gateway Outage — Checkout Failures',
    severity: 'SEV-1',
    status: 'resolved',
    openedAt: Date.now() - 300_000,
    resolvedAt: Date.now(),
    affectedServices: ['payment-gateway', 'checkout-service'],
    participants: {
      sarah_oncall: {
        uid: 'sarah_oncall',
        displayName: 'Sarah Chen',
        role: 'Incident Commander',
        isIncidentCommander: true,
        joinedAt: Date.now() - 300_000,
        totalSpeakingMs: 45_000,
        lastSpokeAt: Date.now() - 25_000,
      },
      marcus_devops: {
        uid: 'marcus_devops',
        displayName: 'Marcus Vance',
        role: 'Senior SRE',
        isIncidentCommander: false,
        joinedAt: Date.now() - 280_000,
        totalSpeakingMs: 65_000,
        lastSpokeAt: Date.now() - 10_000,
      },
    },
    incidentCommanderUid: 'sarah_oncall',
    evidenceItems: [
      {
        id: 'evt-001',
        category: 'fact',
        content: 'Error rate spiked to 42% on payment services',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus Vance',
        confidence: 85,
        timestamp: Date.now() - 240_000,
        status: 'confirmed',
        relatedTo: [],
      },
      {
        id: 'evt-002',
        category: 'hypothesis',
        content: 'Database connection pool starvation',
        speakerUid: 'marcus_devops',
        speakerName: 'Marcus Vance',
        confidence: 85,
        timestamp: Date.now() - 180_000,
        status: 'confirmed',
        relatedTo: ['evt-001'],
      },
      {
        id: 'evt-003',
        category: 'hypothesis',
        content: 'Payment gateway API rate limiting',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        confidence: 70,
        timestamp: Date.now() - 150_000,
        status: 'disproven',
        relatedTo: ['evt-001'],
      },
      {
        id: 'evt-004',
        category: 'action',
        content: 'Restart connection pooler on primary db cluster',
        speakerUid: 'sarah_oncall',
        speakerName: 'Sarah Chen',
        assignedTo: 'Marcus Vance',
        actionStatus: 'done',
        confidence: 85,
        timestamp: Date.now() - 60_000,
        relatedTo: ['evt-002'],
        status: 'active',
      },
    ],
    eventSeq: 4,
    currentOODAPhase: 'RESOLVED',
    costAccrued: 45000,
    cognitiveLoadScore: 0,
    lastReadbackAt: Date.now() - 60_000,
  };

  it('renders all SRE postmortem debrief sections', () => {
    const onClose = vi.fn();
    render(
      <PostmortemModal
        isOpen={true}
        onClose={onClose}
        incident={mockResolvedIncident}
        costRate={150}
      />
    );

    // Header & Spec Label & Incident ID
    expect(screen.getByText(/Google SRE Specification/i)).toBeInTheDocument();
    expect(screen.getByText('INC-4821')).toBeInTheDocument();
    expect(screen.getByText('Payment Gateway Outage — Checkout Failures')).toBeInTheDocument();

    // Section 1: Executive Summary
    expect(screen.getByText(/1\. Executive Summary/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Database connection pool starvation/i).length).toBeGreaterThanOrEqual(1);

    // Section 2: Causal Evidence Chain
    expect(screen.getByText(/2\. Causal Evidence Chain/i)).toBeInTheDocument();

    // Section 3: Epistemic Incident Timeline Log
    expect(screen.getByText(/3\. Epistemic Incident Timeline Log/i)).toBeInTheDocument();

    // Section 4: Refuted Theories
    expect(screen.getByText(/4\. Refuted Theories/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Payment gateway API rate limiting/i).length).toBeGreaterThanOrEqual(1);

    // Section 5: Remediation Action Items
    expect(screen.getByText(/5\. Remediation Action Items/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Restart connection pooler on primary db cluster/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers export and copy buttons in the action toolbar', async () => {
    const onClose = vi.fn();
    // Polyfill navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <PostmortemModal
        isOpen={true}
        onClose={onClose}
        incident={mockResolvedIncident}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy MD/i });
    expect(copyBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

    const exportBtn = screen.getByRole('button', { name: /Export MD/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('invokes onClose when clicking close button or pressing Escape', () => {
    const onClose = vi.fn();
    render(
      <PostmortemModal
        isOpen={true}
        onClose={onClose}
        incident={mockResolvedIncident}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close postmortem/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
