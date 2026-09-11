import { useMemo, useSyncExternalStore } from 'react';
import {
  ScenarioConfig,
  PRESET_SCENARIOS,
  SCENARIO_STORAGE_KEY,
} from '@/lib/scenarios';

const emptySubscribe = () => () => {};

/**
 * Loads scenario configuration from sessionStorage or falls back to URL parameters and presets.
 */
export function useScenarioConfig(
  scenarioId: string | null,
  channel: string
): ScenarioConfig | null {
  const rawStored = useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return sessionStorage.getItem(SCENARIO_STORAGE_KEY);
      } catch {
        return null;
      }
    },
    () => null
  );

  return useMemo(() => {
    if (rawStored) {
      try {
        return JSON.parse(rawStored) as ScenarioConfig;
      } catch {
        // fallback to presets
      }
    }
    return (
      (scenarioId ? PRESET_SCENARIOS.find((s) => s.id === scenarioId) : null) ||
      PRESET_SCENARIOS.find((s) => s.channelName.toLowerCase() === channel.toLowerCase()) ||
      PRESET_SCENARIOS[0]
    );
  }, [rawStored, scenarioId, channel]);
}
