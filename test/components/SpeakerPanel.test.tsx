import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeakerPanel } from '@/components/SpeakerPanel';
import { Participant } from '@/lib/types';

describe('SpeakerPanel Component & Telemetry Sub-meters (components/SpeakerPanel.tsx)', () => {
  const mockParticipants: Record<string, Participant> = {
    sarah_ic: {
      uid: 'sarah_ic',
      displayName: 'Sarah Chen',
      role: 'Incident Commander',
      isIncidentCommander: true,
      joinedAt: Date.now() - 360_000,
      totalSpeakingMs: 45_000,
      lastSpokeAt: Date.now() - 25_000,
    },
    marcus_sre: {
      uid: 'marcus_sre',
      displayName: 'Marcus Vance',
      role: 'Lead SRE',
      isIncidentCommander: false,
      joinedAt: Date.now() - 340_000,
      totalSpeakingMs: 65_000,
      lastSpokeAt: Date.now() - 10_000,
    },
    priya_pm: {
      uid: 'priya_pm',
      displayName: 'Priya Patel',
      role: 'Product Manager',
      isIncidentCommander: false,
      joinedAt: Date.now() - 300_000,
      totalSpeakingMs: 20_000,
      lastSpokeAt: Date.now() - 50_000,
    },
  };

  it('renders all human participants with names, roles, and IC badge', () => {
    render(
      <SpeakerPanel
        participants={mockParticipants}
        localVolumeLevel={{ sarah_ic: 45, marcus_sre: 0, priya_pm: 0 }}
        agentUid="aura_agent"
        agentLastSpokeAt={Date.now() - 15_000}
        agentIsSpeaking={false}
        cognitiveLoadScore={45}
        tempoLevel={3}
      />
    );

    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Incident Commander')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    expect(screen.getByText('Lead SRE')).toBeInTheDocument();
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Product Manager')).toBeInTheDocument();
  });

  it('renders AURA AI Commander tile and telemetry meters', () => {
    render(
      <SpeakerPanel
        participants={mockParticipants}
        localVolumeLevel={{}}
        agentUid="aura_agent"
        agentLastSpokeAt={Date.now() - 15_000}
        agentIsSpeaking={true}
        cognitiveLoadScore={65}
        tempoLevel={4}
      />
    );

    expect(screen.getByText('AI Incident Commander')).toBeInTheDocument();
    expect(screen.getByText('Bridge Vitality')).toBeInTheDocument();
    // Cognitive load score
    expect(screen.getByText('65%')).toBeInTheDocument();
  });
});
