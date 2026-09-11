import { describe, it, expect } from 'vitest';
import { calculateDynamicBurnRate, BASE_SEVERITY_BURN_RATES } from '@/lib/costModel';
import { getPersonaSoundstagePosition } from '@/lib/spatialAudio';

describe('Cost Model: calculateDynamicBurnRate (lib/costModel.ts)', () => {
  it('returns baseline burn rate for standard severity without critical services', () => {
    expect(calculateDynamicBurnRate('SEV-0')).toBe(BASE_SEVERITY_BURN_RATES['SEV-0']);
    expect(calculateDynamicBurnRate('SEV-1')).toBe(BASE_SEVERITY_BURN_RATES['SEV-1']);
    expect(calculateDynamicBurnRate('SEV-2')).toBe(BASE_SEVERITY_BURN_RATES['SEV-2']);
    expect(calculateDynamicBurnRate('SEV-3')).toBe(BASE_SEVERITY_BURN_RATES['SEV-3']);
  });

  it('scales burn rate based on affected critical tier-1 services', () => {
    const rateWithOne = calculateDynamicBurnRate('SEV-1', ['payment-api']);
    expect(rateWithOne).toBeGreaterThan(BASE_SEVERITY_BURN_RATES['SEV-1']);

    const rateWithThree = calculateDynamicBurnRate('SEV-1', ['payment-api', 'checkout-service', 'postgres-primary']);
    expect(rateWithThree).toBeGreaterThan(rateWithOne);
  });

  it('honors customRate override if explicitly passed', () => {
    expect(calculateDynamicBurnRate('SEV-1', ['payment-api'], 350)).toBe(350);
  });
});

describe('Spatial Audio Soundstage: getPersonaSoundstagePosition (lib/spatialAudio.ts)', () => {
  it('positions AURA at Elevated Center', () => {
    const pos = getPersonaSoundstagePosition('aura_agent');
    expect(pos.pan).toBe(0);
    expect(pos.elevation).toBe(20);
    expect(pos.label).toBe('Elevated Center');
  });

  it('positions Incident Commander at Center stage', () => {
    const pos = getPersonaSoundstagePosition('sarah_ic', 'Incident Commander');
    expect(pos.pan).toBe(0);
    expect(pos.azimuth).toBe(0);
    expect(pos.label).toBe('Center (0°)');
  });

  it('positions Senior SRE on the Left flank', () => {
    const pos = getPersonaSoundstagePosition('marcus_sre', 'Senior SRE');
    expect(pos.pan).toBeLessThan(0);
    expect(pos.azimuth).toBe(-45);
    expect(pos.label).toBe('Left (-45°)');
  });

  it('positions API / Frontend Engineers on the Right flank', () => {
    const pos = getPersonaSoundstagePosition('priya_dev', 'Frontend Engineer');
    expect(pos.pan).toBeGreaterThan(0);
    expect(pos.azimuth).toBe(45);
    expect(pos.label).toBe('Right (+45°)');
  });
});
