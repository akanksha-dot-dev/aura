import { describe, it, expect } from 'vitest';
import {
  PERSONAS,
  AGENT_UID,
  COST_RATE_PER_SECOND,
  CONFIDENCE_CAP,
  CHANNEL_PREFIX,
} from '@/lib/constants';
import { springs } from '@/lib/springs';

describe('Constants & Spring Physics Presets (lib/constants.ts & lib/springs.ts)', () => {
  describe('Constants Configuration', () => {
    it('defines the 3 required incident personas with valid roles and colors', () => {
      expect(PERSONAS).toHaveLength(3);

      const sarah = PERSONAS.find((p) => p.uid === 'sarah_oncall');
      expect(sarah).toBeDefined();
      expect(sarah?.displayName).toBe('Sarah');
      expect(sarah?.role).toBe('Incident Commander');

      const marcus = PERSONAS.find((p) => p.uid === 'marcus_devops');
      expect(marcus).toBeDefined();
      expect(marcus?.displayName).toBe('Marcus');
      expect(marcus?.role).toBe('Senior SRE');

      const priya = PERSONAS.find((p) => p.uid === 'priya_lead');
      expect(priya).toBeDefined();
      expect(priya?.displayName).toBe('Priya');
      expect(priya?.role).toBe('Product Manager');
    });

    it('defines correct core operational constants', () => {
      expect(AGENT_UID).toBe('aura_agent');
      expect(COST_RATE_PER_SECOND).toBe(150); // $9,000/min SEV-1 financial impact
      expect(CONFIDENCE_CAP).toBe(85); // D-026 safety cap
      expect(CHANNEL_PREFIX).toBe('incident-');
    });
  });

  describe('Motion Spring Physics Presets', () => {
    it('defines emotion-specific spring physics configurations', () => {
      expect(springs.conflict).toBeDefined();
      expect(springs.conflict.stiffness).toBe(400);
      expect(springs.conflict.damping).toBe(25);
      expect(springs.conflict.mass).toBe(0.8);

      expect(springs.card).toBeDefined();
      expect(springs.card.stiffness).toBe(260);
      expect(springs.card.damping).toBe(30);

      expect(springs.disprove).toBeDefined();
      expect(springs.disprove.stiffness).toBe(180);
      expect(springs.disprove.damping).toBe(40);
      expect(springs.disprove.mass).toBe(1.5);

      expect(springs.resolve).toBeDefined();
      expect(springs.resolve.stiffness).toBe(120);
      expect(springs.resolve.damping).toBe(20);
      expect(springs.resolve.mass).toBe(0.6);
    });
  });
});
