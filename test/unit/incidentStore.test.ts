import { describe, it, expect } from 'vitest';
import {
  initializeLiveIncident,
  getIncidentState,
  buildDynamicContext,
  getSpeakerDisplayName,
} from '@/lib/incidentStore';

describe('incidentStore dynamic operator & context engine', () => {
  it('initializes a clean live incident state with a custom operator', () => {
    const channel = 'incident-test-live';
    const state = initializeLiveIncident(channel, {
      uid: 'bhaskar_oncall',
      displayName: 'Bhaskar',
      role: 'SecOps Lead',
    });

    expect(state.incidentId).toContain('incident-test-live');
    expect(state.incidentCommanderUid).toBe('bhaskar_oncall');
    expect(state.participants['bhaskar_oncall']).toBeDefined();
    expect(state.participants['bhaskar_oncall'].displayName).toBe('Bhaskar');
    expect(state.participants['bhaskar_oncall'].role).toBe('SecOps Lead');
    expect(state.participants['aura_agent']).toBeDefined();
    expect(state.participants['aura_agent'].displayName).toBe('AURA');

    // Fictional mock personas MUST NOT exist in a live incident
    expect(state.participants['user-sarah']).toBeUndefined();
    expect(state.participants['user-marcus']).toBeUndefined();
    expect(state.participants['user-priya']).toBeUndefined();
    expect(state.participants['operator_1']).toBeUndefined();

    // Evidence starts empty for a clean live room
    expect(state.evidenceItems).toHaveLength(0);
  });

  it('buildDynamicContext includes active human responders and excludes fictional personas', () => {
    const channel = 'incident-dynamic-context';
    const state = initializeLiveIncident(channel, {
      uid: 'bhaskar_oncall',
      displayName: 'Bhaskar',
      role: 'SecOps Lead',
    });

    const context = buildDynamicContext(state);

    expect(context).toContain('IC: Bhaskar');
    expect(context).toContain('Bhaskar');
    expect(context).toContain('SecOps Lead');
    expect(context).toContain('Active Responders on Bridge: Bhaskar');

    // Must NOT mention Sarah, Marcus, or Priya in active responders
    expect(context).not.toContain('Sarah Chen');
    expect(context).not.toContain('Marcus Vance');
    expect(context).not.toContain('Priya Patel');
  });

  it('resolves speaker display names correctly via getSpeakerDisplayName', () => {
    const channel = 'incident-speaker-names';
    initializeLiveIncident(channel, {
      uid: 'bhaskar_oncall',
      displayName: 'Bhaskar',
      role: 'SecOps Lead',
    });

    expect(getSpeakerDisplayName(channel, 'bhaskar_oncall')).toBe('Bhaskar');
    expect(getSpeakerDisplayName(channel, 'aura_agent')).toBe('AURA');
    expect(getSpeakerDisplayName(channel, 'unknown_uid')).toBe('unknown_uid');
  });
});
