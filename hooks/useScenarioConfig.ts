'use client';

import { useState, useEffect } from 'react';
import {
  ScenarioConfig,
  loadScenarioConfig,
  PRESET_SCENARIOS,
} from '@/lib/scenarios';

/**
 * Loads scenario configuration from sessionStorage or falls back to URL parameters and presets.
 */
export function useScenarioConfig(
  scenarioId: string | null,
  channel: string
): ScenarioConfig | null {
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = loadScenarioConfig();
      if (stored) return stored;
    }
    return (
      (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
      PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase()) ||
      PRESET_SCENARIOS[0]
    );
  });

  useEffect(() => {
    const config =
      loadScenarioConfig() ||
      (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
      PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase());
    if (config) setScenarioConfig(config);
  }, [scenarioId, channel]);

  return scenarioConfig;
}
