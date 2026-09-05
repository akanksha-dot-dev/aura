'use client';

import React from 'react';
import { PersonaConfig } from '@/lib/constants';
import {
  ScenarioConfig,
  PersonaDefinition,
  PRESET_SCENARIOS,
  generateChannelName,
  generatePersonaUid,
  getAvatarColor,
} from '@/lib/scenarios';
import type { Severity } from '@/lib/types';

export interface LobbyScreenProps {
  onJoin: (
    persona: PersonaConfig,
    options?: { costRate?: number; simulateReplay?: boolean },
    scenario?: ScenarioConfig
  ) => void;
  isConnecting?: boolean;
}

const COST_PRESETS = [
  { label: 'Standard SaaS', rate: 25 },
  { label: 'Mid-Tier Service', rate: 75 },
  { label: 'E-Comm Checkout', rate: 150 },
  { label: 'Fintech / Cloud', rate: 500 },
];

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'SEV-0', label: 'SEV-0 CRITICAL', color: '#FF4444' },
  { value: 'SEV-1', label: 'SEV-1 HIGH', color: '#F87171' },
  { value: 'SEV-2', label: 'SEV-2 MEDIUM', color: '#FFA726' },
  { value: 'SEV-3', label: 'SEV-3 LOW', color: '#66BB6A' },
];

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
  // Scenario state
  const [activeScenarioId, setActiveScenarioId] = React.useState<string>(PRESET_SCENARIOS[0].id);
  const [customScenarios, setCustomScenarios] = React.useState<ScenarioConfig[]>([]);
  const [isCreatingCustom, setIsCreatingCustom] = React.useState(false);

  // Custom scenario builder state
  const [customTitle, setCustomTitle] = React.useState('');
  const [customSeverity, setCustomSeverity] = React.useState<Severity>('SEV-1');
  const [customServices, setCustomServices] = React.useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = React.useState('');
  const [customPersonas, setCustomPersonas] = React.useState<PersonaDefinition[]>([]);
  const [customDescription, setCustomDescription] = React.useState('');
  const [customImpact, setCustomImpact] = React.useState('');
  const [customCause, setCustomCause] = React.useState('');
  const [newPersonaName, setNewPersonaName] = React.useState('');
  const [newPersonaRole, setNewPersonaRole] = React.useState('');

  // Join config state
  const [selectedRate, setSelectedRate] = React.useState<number>(150);
  const [customRateInput, setCustomRateInput] = React.useState<string>('150');
  const [customName, setCustomName] = React.useState<string>('');
  const [customRole, setCustomRole] = React.useState<string>('');
  const [demoMode, setDemoMode] = React.useState<'simulation' | 'live'>('simulation');
  const [voiceLang, setVoiceLang] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('aura_voice_lang') || 'en-IN';
    }
    return 'en-IN';
  });

  const handleVoiceLangToggle = (lang: string) => {
    setVoiceLang(lang);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('aura_voice_lang', lang);
    }
  };

  // All scenarios (presets + custom)
  const allScenarios = React.useMemo(() => [...PRESET_SCENARIOS, ...customScenarios], [customScenarios]);
  const activeScenario = allScenarios.find((s) => s.id === activeScenarioId) || PRESET_SCENARIOS[0];

  // Sync cost rate from scenario
  React.useEffect(() => {
    setSelectedRate(activeScenario.costRate);
    setCustomRateInput(activeScenario.costRate.toString());
  }, [activeScenario.costRate]);

  const handleJoinPersona = (persona: PersonaConfig, overrideOptions?: { simulateReplay?: boolean }) => {
    const rate = Math.max(1, Number(customRateInput) || selectedRate);
    const shouldSimulate = overrideOptions?.simulateReplay ?? (demoMode === 'simulation');
    const scenarioWithRate = { ...activeScenario, costRate: rate };
    onJoin(persona, { costRate: rate, simulateReplay: shouldSimulate }, scenarioWithRate);
  };

  const handleJoinCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const uid = customName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_oncall';
    const customPersona: PersonaConfig = {
      uid,
      displayName: customName.trim(),
      role: customRole.trim() || 'Incident Responder',
      avatarColor: 'var(--color-aura)',
    };
    const rate = Math.max(1, Number(customRateInput) || selectedRate);
    const scenarioWithRate = { ...activeScenario, costRate: rate };
    onJoin(customPersona, { costRate: rate, simulateReplay: demoMode === 'simulation' }, scenarioWithRate);
  };

  const handleAddService = () => {
    const svc = customServiceInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (svc && !customServices.includes(svc)) {
      setCustomServices((prev) => [...prev, svc]);
    }
    setCustomServiceInput('');
  };

  const handleAddPersona = () => {
    if (!newPersonaName.trim()) return;
    const persona: PersonaDefinition = {
      uid: generatePersonaUid(newPersonaName),
      displayName: newPersonaName.trim(),
      role: newPersonaRole.trim() || 'Incident Responder',
      avatarColor: getAvatarColor(customPersonas.length),
      badge: newPersonaRole.trim().toUpperCase().split(' ').slice(0, 2).join(' ') || 'RESPONDER',
      description: `Active participant on the incident bridge as ${newPersonaRole.trim() || 'Responder'}.`,
    };
    setCustomPersonas((prev) => [...prev, persona]);
    setNewPersonaName('');
    setNewPersonaRole('');
  };

  const handleSaveCustomScenario = () => {
    if (!customTitle.trim() || customPersonas.length === 0) return;
    const scenario: ScenarioConfig = {
      id: 'custom-' + Date.now(),
      name: customTitle.trim(),
      title: customTitle.trim(),
      severity: customSeverity,
      affectedServices: customServices.length > 0 ? customServices : ['service-a'],
      personas: customPersonas,
      channelName: generateChannelName(customTitle),
      costRate: Math.max(1, Number(customRateInput) || selectedRate),
      description: customDescription.trim() || undefined,
      impact: customImpact.trim() || undefined,
      suspectedCause: customCause.trim() || undefined,
    };
    setCustomScenarios((prev) => [...prev, scenario]);
    setActiveScenarioId(scenario.id);
    setIsCreatingCustom(false);
    // Reset builder form
    setCustomTitle('');
    setCustomSeverity('SEV-1');
    setCustomServices([]);
    setCustomPersonas([]);
    setCustomDescription('');
    setCustomImpact('');
    setCustomCause('');
  };

  const currentEffectiveRate = Math.max(1, Number(customRateInput) || selectedRate);

  return (
    <div className="flightdeck-container">
      <style>{`
        .flightdeck-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 2.5rem 1.5rem 4rem 1.5rem;
          background: var(--bg-base);
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          color: var(--text-primary);
          font-family: var(--font-sans);
        }

        .flightdeck-content {
          width: 100%;
          max-width: 1180px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          position: relative;
          z-index: 1;
        }

        /* ─── Mission Hero Header ─── */
        .flightdeck-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 0.25rem;
        }

        .flightdeck-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 3px 10px;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-radius: var(--radius-full);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--color-aura);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .flightdeck-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-fact);
          box-shadow: 0 0 6px var(--color-fact);
          animation: flightdeck-pulse 2s ease-in-out infinite;
        }

        .flightdeck-brand-title {
          font-size: clamp(2.25rem, 5vw, 3.25rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 4px 0;
          color: var(--text-primary);
        }

        .flightdeck-subtitle {
          font-size: 16px;
          color: var(--text-secondary);
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .flightdeck-tagline {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
          max-width: 620px;
          margin: 0;
        }

        /* ─── Connecting Banner ─── */
        .flightdeck-connecting {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(212, 168, 83, 0.06);
          border: 1px solid rgba(212, 168, 83, 0.3);
          border-radius: var(--radius-sm);
        }

        .flightdeck-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(212, 168, 83, 0.2);
          border-top-color: var(--color-aura);
          border-radius: 50%;
          animation: flightdeck-spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        /* ─── Cohesive Flight Status Briefing Strip ─── */
        .flightdeck-briefing {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 18px 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .flightdeck-briefing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .flightdeck-chips-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .flightdeck-chip {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          letter-spacing: 0.04em;
        }

        .flightdeck-chip-incident {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
        }

        .flightdeck-chip-sev1 {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #F87171;
        }

        .flightdeck-chip-ready {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34D399;
          font-size: 10px;
          font-family: var(--font-mono);
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
        }

        .flightdeck-ready-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #34D399;
          box-shadow: 0 0 6px #34D399;
        }

        .flightdeck-briefing-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text-primary);
          margin: 0;
        }

        /* Continuous Horizontal Telemetry Strip */
        .flightdeck-narrative-strip {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        @media (max-width: 900px) {
          .flightdeck-narrative-strip {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-narrative-cell {
          padding: 12px 16px;
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .flightdeck-narrative-cell:last-child {
          border-right: none;
        }

        .flightdeck-narrative-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .flightdeck-narrative-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        /* ─── Authoritative Primary Simulation Launch Button ─── */
        .flightdeck-launch-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.35);
          border-radius: var(--radius-sm);
          color: var(--color-aura);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-launch-btn:hover:not(:disabled) {
          background: rgba(212, 168, 83, 0.18);
          border-color: rgba(212, 168, 83, 0.6);
        }

        .flightdeck-launch-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .flightdeck-launch-play {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-aura);
          color: #08090C;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .flightdeck-launch-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.25);
          color: var(--color-aura);
          letter-spacing: 0.04em;
        }

        /* ─── Responder Selection Grid ─── */
        .flightdeck-section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .flightdeck-section-title {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        /* ─── System Health Diagnostic Ribbon ─── */
        .flightdeck-diagnostics {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
        }

        .flightdeck-diag-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        .flightdeck-diag-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .flightdeck-diag-dot--live {
          background: #34D399;
          box-shadow: 0 0 5px rgba(52, 211, 153, 0.6);
        }

        .flightdeck-diag-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .flightdeck-diag-val {
          color: var(--text-muted);
          font-size: 10.5px;
        }

        /* ─── Responder Selection Grid ─── */
        .flightdeck-section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .flightdeck-section-title {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .flightdeck-mode-toggle {
          display: inline-flex;
          align-items: center;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xs);
          padding: 2px;
          gap: 2px;
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.02);
        }

        .flightdeck-mode-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 3px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-mode-btn:hover {
          color: var(--text-primary);
        }

        .flightdeck-mode-btn--active {
          background: var(--bg-surface);
          color: var(--text-primary);
          font-weight: 600;
          border-color: var(--border-subtle);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
        }

        .flightdeck-persona-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        @media (max-width: 900px) {
          .flightdeck-persona-grid {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-persona-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: all var(--duration-fast) var(--ease-standard);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
        }

        .flightdeck-persona-card:hover:not(:disabled) {
          background: var(--bg-surface-hover);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .flightdeck-persona-card:hover:not(:disabled) .flightdeck-persona-arrow {
          transform: translateX(3px);
        }

        .flightdeck-persona-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .flightdeck-persona-avatar {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-xs);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11.5px;
          font-family: var(--font-mono);
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
        }

        .flightdeck-persona-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .flightdeck-persona-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .flightdeck-persona-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .flightdeck-persona-badge {
          font-size: 9px;
          font-family: var(--font-mono);
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          letter-spacing: 0.04em;
        }

        .flightdeck-persona-role {
          font-size: 11px;
          color: var(--text-muted);
        }

        .flightdeck-persona-desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
          flex: 1;
        }

        .flightdeck-persona-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          font-size: 10.5px;
          font-family: var(--font-mono);
          font-weight: 700;
          color: var(--color-aura);
          letter-spacing: 0.04em;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-persona-card:hover:not(:disabled) .flightdeck-persona-cta {
          background: rgba(212, 168, 83, 0.1);
          border-color: rgba(212, 168, 83, 0.3);
        }

        .flightdeck-persona-arrow {
          transition: transform var(--duration-fast) var(--ease-standard);
        }

        /* ─── Bottom Telemetry & Custom Responder Grid ─── */
        .flightdeck-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .flightdeck-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-bottom-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .flightdeck-bottom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .flightdeck-burn-readout {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-aura);
          font-weight: 600;
        }

        .flightdeck-preset-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        @media (max-width: 600px) {
          .flightdeck-preset-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .flightdeck-preset-chip {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-preset-chip:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
        }

        .flightdeck-preset-chip--active {
          background: rgba(212, 168, 83, 0.08);
          border-color: rgba(212, 168, 83, 0.4);
          color: var(--color-aura);
        }

        .flightdeck-preset-label {
          font-size: 9.5px;
          font-weight: 500;
        }

        .flightdeck-preset-rate {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .flightdeck-preset-chip--active .flightdeck-preset-rate {
          color: var(--color-aura);
        }

        .flightdeck-custom-burn {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .flightdeck-custom-burn-label {
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .flightdeck-custom-burn-input-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 5px 10px;
          flex: 1;
          max-width: 200px;
          transition: border-color var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-custom-burn-input-wrap:focus-within {
          border-color: var(--color-aura);
        }

        .flightdeck-custom-burn-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          width: 100%;
          outline: none;
        }

        .flightdeck-custom-join-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .flightdeck-custom-join-fields {
          display: grid;
          grid-template-columns: 1.2fr 1fr auto;
          gap: 8px;
        }

        @media (max-width: 600px) {
          .flightdeck-custom-join-fields {
            grid-template-columns: 1fr;
          }
        }

        .flightdeck-input {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-size: 11.5px;
          color: var(--text-primary);
          outline: none;
          transition: border-color var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-input:focus {
          border-color: var(--color-aura);
        }

        .flightdeck-custom-submit-btn {
          background: var(--color-aura);
          color: #08090C;
          border: none;
          border-radius: var(--radius-sm);
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: opacity var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-custom-submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .flightdeck-custom-submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .flightdeck-tech-note {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.45;
        }

        @keyframes flightdeck-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.92); }
        }

        @keyframes flightdeck-spin {
          to { transform: rotate(360deg); }
        }
        /* ─── Scenario Selector Styles ─── */
        .scenario-selector {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .scenario-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }

        .scenario-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          color: var(--text-primary);
        }

        .scenario-card:hover {
          background: var(--bg-surface-hover);
          border-color: var(--border-glass-emphasis);
        }

        .scenario-card--active {
          border-color: var(--color-aura);
          background: rgba(212, 168, 83, 0.06);
          box-shadow: 0 0 0 1px rgba(212, 168, 83, 0.15);
        }

        .scenario-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .scenario-card__name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .scenario-card__sev {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius-full);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .scenario-card__desc {
          font-size: 10.5px;
          color: var(--text-muted);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .scenario-card__services {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 2px;
        }

        .scenario-card__service-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          padding: 1px 5px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
        }

        .scenario-add-btn {
          background: var(--bg-surface);
          border: 1px dashed var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: 11px;
          min-height: 100px;
        }

        .scenario-add-btn:hover {
          border-color: var(--color-aura);
          color: var(--color-aura);
          background: rgba(212, 168, 83, 0.04);
        }

        /* ─── Custom Scenario Builder ─── */
        .scenario-builder {
          background: var(--bg-surface);
          border: 1px solid rgba(212, 168, 83, 0.3);
          border-radius: var(--radius-md);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .scenario-builder__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 600px) {
          .scenario-builder__row { grid-template-columns: 1fr; }
        }

        .scenario-builder__field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .scenario-builder__label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .scenario-builder__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
        }

        .scenario-builder__tag {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 7px;
          background: rgba(212, 168, 83, 0.08);
          border: 1px solid rgba(212, 168, 83, 0.2);
          border-radius: var(--radius-full);
          color: var(--color-aura);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .scenario-builder__tag-remove {
          cursor: pointer;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1;
        }

        .scenario-builder__tag-remove:hover {
          color: var(--color-conflict);
        }

        .scenario-builder__add-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .scenario-builder__persona-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .scenario-builder__persona-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
        }

        .scenario-builder__persona-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 700;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .scenario-builder__persona-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .scenario-builder__persona-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .scenario-builder__persona-role {
          font-size: 10px;
          color: var(--text-muted);
        }

        .scenario-builder__actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 4px;
        }

        .scenario-builder__cancel {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .scenario-builder__save {
          background: var(--color-aura);
          border: none;
          border-radius: var(--radius-sm);
          padding: 6px 16px;
          font-size: 11px;
          font-weight: 700;
          color: #08090C;
          cursor: pointer;
        }

        .scenario-builder__save:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .flightdeck-select {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-size: 11.5px;
          color: var(--text-primary);
          outline: none;
          cursor: pointer;
          transition: border-color var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-select:focus {
          border-color: var(--color-aura);
        }

        .flightdeck-textarea {
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-size: 11.5px;
          color: var(--text-primary);
          outline: none;
          font-family: var(--font-sans);
          resize: vertical;
          min-height: 60px;
          transition: border-color var(--duration-fast) var(--ease-standard);
        }

        .flightdeck-textarea:focus {
          border-color: var(--color-aura);
        }
      `}</style>

      <div className="flightdeck-content">
        {/* Header with Visual Badge & Wordmark */}
        <header className="flightdeck-header">
          <div className="flightdeck-status-pill" aria-label="System status">
            <span className="flightdeck-status-dot" aria-hidden="true" />
            <span>VOICE INCIDENT COMMAND SYSTEM • {activeScenario.severity} ACTIVE</span>
          </div>

          <h1 className="flightdeck-brand-title">AURA</h1>
          <p className="flightdeck-subtitle">Autonomous Voice-Directed Incident Commander</p>
          <p className="flightdeck-tagline">
            Real-time multi-speaker acoustic intelligence • Live contradiction arbitration • Continuous SRE debrief
          </p>
        </header>

        {/* Connecting Banner */}
        {isConnecting && (
          <div className="flightdeck-connecting" role="status" aria-live="polite">
            <div className="flightdeck-spinner" aria-hidden="true" />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-aura)' }}>
                CONNECTING TO AGORA VOICE BRIDGE
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                Establishing sub-second SD-RTN audio channel &amp; telemetry pipeline...
              </div>
            </div>
          </div>
        )}

        {/* ═══ Scenario Selector ═══ */}
        <section className="scenario-selector" aria-label="Incident scenario selection">
          <div className="flightdeck-section-bar">
            <span className="flightdeck-section-title">Select Incident Scenario:</span>
          </div>

          <div className="scenario-grid">
            {allScenarios.map((scenario) => {
              const sevColor = SEVERITY_OPTIONS.find((s) => s.value === scenario.severity)?.color || '#F87171';
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`scenario-card ${activeScenarioId === scenario.id ? 'scenario-card--active' : ''}`}
                  onClick={() => setActiveScenarioId(scenario.id)}
                >
                  <div className="scenario-card__header">
                    <span className="scenario-card__name">{scenario.name}</span>
                    <span
                      className="scenario-card__sev"
                      style={{
                        background: `${sevColor}15`,
                        color: sevColor,
                        border: `1px solid ${sevColor}40`,
                      }}
                    >
                      {scenario.severity}
                    </span>
                  </div>
                  {scenario.description && (
                    <span className="scenario-card__desc">{scenario.description}</span>
                  )}
                  <div className="scenario-card__services">
                    {scenario.affectedServices.slice(0, 3).map((svc) => (
                      <span key={svc} className="scenario-card__service-tag">{svc}</span>
                    ))}
                    {scenario.affectedServices.length > 3 && (
                      <span className="scenario-card__service-tag">+{scenario.affectedServices.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Add Custom Scenario */}
            <button
              type="button"
              className="scenario-add-btn"
              onClick={() => setIsCreatingCustom(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Custom Scenario</span>
            </button>
          </div>

          {/* Custom Scenario Builder */}
          {isCreatingCustom && (
            <div className="scenario-builder">
              <div className="flightdeck-section-bar">
                <span className="flightdeck-section-title">⚡ Custom Scenario Builder</span>
              </div>

              <div className="scenario-builder__row">
                <div className="scenario-builder__field">
                  <label className="scenario-builder__label">Incident Title *</label>
                  <input
                    type="text"
                    className="flightdeck-input"
                    placeholder="e.g. Redis Cluster Split-Brain"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div className="scenario-builder__field">
                  <label className="scenario-builder__label">Severity</label>
                  <select
                    className="flightdeck-select"
                    value={customSeverity}
                    onChange={(e) => setCustomSeverity(e.target.value as Severity)}
                  >
                    {SEVERITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="scenario-builder__field">
                <label className="scenario-builder__label">Description</label>
                <textarea
                  className="flightdeck-textarea"
                  placeholder="Brief description of the incident scenario..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                />
              </div>

              <div className="scenario-builder__row">
                <div className="scenario-builder__field">
                  <label className="scenario-builder__label">Live Impact</label>
                  <input
                    type="text"
                    className="flightdeck-input"
                    placeholder="e.g. 30% of read queries returning stale data"
                    value={customImpact}
                    onChange={(e) => setCustomImpact(e.target.value)}
                  />
                </div>
                <div className="scenario-builder__field">
                  <label className="scenario-builder__label">Suspected Cause</label>
                  <input
                    type="text"
                    className="flightdeck-input"
                    placeholder="e.g. Network partition between primary and replica nodes"
                    value={customCause}
                    onChange={(e) => setCustomCause(e.target.value)}
                  />
                </div>
              </div>

              <div className="scenario-builder__field">
                <label className="scenario-builder__label">Affected Services</label>
                <div className="scenario-builder__add-row">
                  <input
                    type="text"
                    className="flightdeck-input"
                    style={{ flex: 1 }}
                    placeholder="e.g. redis-cluster"
                    value={customServiceInput}
                    onChange={(e) => setCustomServiceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddService(); } }}
                  />
                  <button type="button" className="flightdeck-custom-submit-btn" onClick={handleAddService}>
                    + Add
                  </button>
                </div>
                {customServices.length > 0 && (
                  <div className="scenario-builder__tags">
                    {customServices.map((svc) => (
                      <span key={svc} className="scenario-builder__tag">
                        {svc}
                        <span
                          className="scenario-builder__tag-remove"
                          onClick={() => setCustomServices((prev) => prev.filter((s) => s !== svc))}
                        >
                          ×
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="scenario-builder__field">
                <label className="scenario-builder__label">Responder Personas *</label>
                <div className="scenario-builder__add-row">
                  <input
                    type="text"
                    className="flightdeck-input"
                    style={{ flex: 1 }}
                    placeholder="Name (e.g. Alex)"
                    value={newPersonaName}
                    onChange={(e) => setNewPersonaName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="flightdeck-input"
                    style={{ flex: 1 }}
                    placeholder="Role (e.g. DBA Lead)"
                    value={newPersonaRole}
                    onChange={(e) => setNewPersonaRole(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPersona(); } }}
                  />
                  <button type="button" className="flightdeck-custom-submit-btn" onClick={handleAddPersona}>
                    + Add
                  </button>
                </div>
                {customPersonas.length > 0 && (
                  <div className="scenario-builder__persona-list">
                    {customPersonas.map((p, idx) => (
                      <div key={p.uid} className="scenario-builder__persona-chip">
                        <div
                          className="scenario-builder__persona-avatar"
                          style={{ background: p.avatarColor, opacity: 0.7 }}
                        >
                          {p.displayName[0]}
                        </div>
                        <div className="scenario-builder__persona-info">
                          <span className="scenario-builder__persona-name">{p.displayName}</span>
                          <span className="scenario-builder__persona-role">{p.role}</span>
                        </div>
                        <span
                          className="scenario-builder__tag-remove"
                          onClick={() => setCustomPersonas((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)' }}
                        >
                          ×
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="scenario-builder__actions">
                <button
                  type="button"
                  className="scenario-builder__cancel"
                  onClick={() => setIsCreatingCustom(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="scenario-builder__save"
                  disabled={!customTitle.trim() || customPersonas.length === 0}
                  onClick={handleSaveCustomScenario}
                >
                  Create Scenario
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Active Incident Briefing Card */}
        <section className="flightdeck-briefing" aria-labelledby="incident-briefing-title">
          <div className="flightdeck-briefing-header">
            <div className="flightdeck-chips-group">
              <span className="flightdeck-chip flightdeck-chip-incident">{activeScenario.channelName.toUpperCase()}</span>
              <span className="flightdeck-chip flightdeck-chip-sev1">{activeScenario.severity} {activeScenario.severity === 'SEV-0' ? 'CRITICAL' : activeScenario.severity === 'SEV-1' ? 'HIGH' : activeScenario.severity === 'SEV-2' ? 'MEDIUM' : 'LOW'}</span>
              <span className="flightdeck-chip" style={{ background: 'rgba(212, 168, 83, 0.08)', color: 'var(--color-aura)', border: '1px solid rgba(212, 168, 83, 0.2)' }}>
                {activeScenario.affectedServices[0]?.toUpperCase() || 'SERVICE'}
              </span>
            </div>
            <div className="flightdeck-chip-ready">
              <span className="flightdeck-ready-dot" aria-hidden="true" />
              <span>{activeScenario.id === 'payment-outage' ? 'SIMULATION READY' : 'LIVE MODE READY'}</span>
            </div>
          </div>

          <h2 id="incident-briefing-title" className="flightdeck-briefing-title">
            {activeScenario.title}
          </h2>

          <div className="flightdeck-narrative-strip">
            <div className="flightdeck-narrative-cell">
              <div className="flightdeck-narrative-label" style={{ color: '#F87171' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Live Impact</span>
              </div>
              <p className="flightdeck-narrative-desc">
                {activeScenario.impact || `${activeScenario.severity} incident affecting ${activeScenario.affectedServices.join(', ')}.`}
              </p>
            </div>

            <div className="flightdeck-narrative-cell">
              <div className="flightdeck-narrative-label" style={{ color: 'var(--color-hypothesis)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                  <line x1="6" y1="9" x2="6" y2="21" />
                </svg>
                <span>Suspected Root Cause</span>
              </div>
              <p className="flightdeck-narrative-desc">
                {activeScenario.suspectedCause || 'Root cause under investigation by incident responders.'}
              </p>
            </div>

            <div className="flightdeck-narrative-cell">
              <div className="flightdeck-narrative-label" style={{ color: 'var(--color-fact)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>AURA Mission Directives</span>
              </div>
              <p className="flightdeck-narrative-desc">
                Arbitrate conflicting responder statements, enforce evidence-based decisions, synthesize SRE postmortem.
              </p>
            </div>
          </div>

          {activeScenario.id === 'payment-outage' && (
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => handleJoinPersona(
                { uid: activeScenario.personas[0].uid, displayName: activeScenario.personas[0].displayName, role: activeScenario.personas[0].role, avatarColor: activeScenario.personas[0].avatarColor },
                { simulateReplay: true }
              )}
              className="flightdeck-launch-btn"
            >
              <div className="flightdeck-launch-left">
                <span className="flightdeck-launch-play" aria-hidden="true">▶</span>
                <span>
                  {isConnecting ? 'INITIALIZING SIMULATION...' : 'LAUNCH INCIDENT SIMULATION (RECOMMENDED FOR JUDGES)'}
                </span>
              </div>
              <span className="flightdeck-launch-badge">12 EVENTS · SUB-SECOND AGORA VOICE</span>
            </button>
          )}
        </section>

        {/* System Health Diagnostic Checklist */}
        <section className="flightdeck-diagnostics" aria-label="System health diagnostics">
          <div className="flightdeck-diag-item">
            <span className="flightdeck-diag-dot flightdeck-diag-dot--live" aria-hidden="true" />
            <span className="flightdeck-diag-label">Agora SD-RTN 48kHz Mesh:</span>
            <span className="flightdeck-diag-val">Operational (sub-second latency)</span>
          </div>
          <div className="flightdeck-diag-item">
            <span className="flightdeck-diag-dot flightdeck-diag-dot--live" aria-hidden="true" />
            <span className="flightdeck-diag-label">ConvAI Voice Agent:</span>
            <span className="flightdeck-diag-val">Ready (MiniMax managed TTS)</span>
          </div>
          <div className="flightdeck-diag-item">
            <span className="flightdeck-diag-dot flightdeck-diag-dot--live" aria-hidden="true" />
            <span className="flightdeck-diag-label">Epistemic Arbitration Engine:</span>
            <span className="flightdeck-diag-val">Armed (contradiction detection)</span>
          </div>
        </section>

        {/* Responder Selection */}
        <section aria-label="Responder callsign selection" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="flightdeck-section-bar">
            <span className="flightdeck-section-title">Select Responder Callsign:</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="flightdeck-mode-toggle" role="radiogroup" aria-label="Voice Accent">
                <button
                  type="button"
                  role="radio"
                  aria-checked={voiceLang === 'en-IN'}
                  className={`flightdeck-mode-btn ${voiceLang === 'en-IN' ? 'flightdeck-mode-btn--active' : ''}`}
                  onClick={() => handleVoiceLangToggle('en-IN')}
                  title="Optimized for Indian English accents with Deepgram Nova-3"
                >
                  <span>🇮🇳 Indian English</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={voiceLang === 'en-US'}
                  className={`flightdeck-mode-btn ${voiceLang === 'en-US' ? 'flightdeck-mode-btn--active' : ''}`}
                  onClick={() => handleVoiceLangToggle('en-US')}
                  title="Standard US English ASR model"
                >
                  <span>🇺🇸 US English</span>
                </button>
              </div>

              <div className="flightdeck-mode-toggle" role="radiogroup" aria-label="Operational Mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={demoMode === 'simulation'}
                  className={`flightdeck-mode-btn ${demoMode === 'simulation' ? 'flightdeck-mode-btn--active' : ''}`}
                  onClick={() => setDemoMode('simulation')}
                  title="Streams realistic 12-event multi-responder incident timeline with voice transcripts and postmortem"
                >
                  <span>⚡ Interactive Simulation</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={demoMode === 'live'}
                  className={`flightdeck-mode-btn ${demoMode === 'live' ? 'flightdeck-mode-btn--active' : ''}`}
                  onClick={() => setDemoMode('live')}
                  title="Connects to Agora RTC channel for live microphone streaming"
                >
                  <span>🎙 Live Microphone</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flightdeck-persona-grid">
            {activeScenario.personas.map((persona) => {
              const badge = persona.badge || persona.role.toUpperCase().split(' ').slice(0, 2).join(' ');
              const desc = persona.description || `Active incident participant as ${persona.role}.`;
              const personaConfig: PersonaConfig = {
                uid: persona.uid,
                displayName: persona.displayName,
                role: persona.role,
                avatarColor: persona.avatarColor,
              };

              return (
                <button
                  key={persona.uid}
                  disabled={isConnecting}
                  onClick={() => handleJoinPersona(personaConfig)}
                  className="flightdeck-persona-card"
                  type="button"
                >
                  <div className="flightdeck-persona-top">
                    <div
                      className="flightdeck-persona-avatar"
                      style={{
                        borderLeft: `2px solid ${persona.avatarColor}`,
                      }}
                      aria-hidden="true"
                    >
                      {persona.displayName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flightdeck-persona-meta">
                      <div className="flightdeck-persona-name-row">
                        <span className="flightdeck-persona-name">{persona.displayName}</span>
                        <span className="flightdeck-persona-badge">{badge}</span>
                      </div>
                      <span className="flightdeck-persona-role">{persona.role}</span>
                    </div>
                  </div>

                  <p className="flightdeck-persona-desc">{desc}</p>

                  <div className="flightdeck-persona-cta">
                    <span>{isConnecting ? 'CONNECTING...' : 'ENTER BRIDGE'}</span>
                    <span aria-hidden="true" className="flightdeck-persona-arrow">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bottom Grid: Financial Telemetry & Custom Responder */}
        <div className="flightdeck-bottom-grid">
          {/* Financial Loss Rate Config */}
          <section className="flightdeck-bottom-card" aria-label="Financial burn rate telemetry">
            <div className="flightdeck-bottom-header">
              <span className="flightdeck-section-title">Financial Burn Rate Telemetry:</span>
              <span className="flightdeck-burn-readout">
                ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 60)}/min • ${new Intl.NumberFormat('en-US').format(currentEffectiveRate * 3600)}/hr
              </span>
            </div>

            <div className="flightdeck-preset-grid">
              {COST_PRESETS.map((p) => (
                <button
                  key={p.rate}
                  type="button"
                  className={`flightdeck-preset-chip ${selectedRate === p.rate ? 'flightdeck-preset-chip--active' : ''}`}
                  onClick={() => {
                    setSelectedRate(p.rate);
                    setCustomRateInput(p.rate.toString());
                  }}
                >
                  <span className="flightdeck-preset-label">{p.label}</span>
                  <span className="flightdeck-preset-rate">${p.rate}/s</span>
                </button>
              ))}
            </div>

            <div className="flightdeck-custom-burn">
              <span className="flightdeck-custom-burn-label">Custom Loss Rate:</span>
              <div className="flightdeck-custom-burn-input-wrap">
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>$</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={customRateInput}
                  onChange={(e) => {
                    setCustomRateInput(e.target.value);
                    const val = Number(e.target.value);
                    if (val > 0) setSelectedRate(val);
                  }}
                  className="flightdeck-custom-burn-input"
                  placeholder="150"
                  aria-label="Custom loss rate in dollars per second"
                />
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>/s</span>
              </div>
            </div>
          </section>

          {/* Custom Responder + Architecture Note */}
          <section className="flightdeck-bottom-card" aria-label="Custom responder registration">
            <span className="flightdeck-section-title">Custom Responder Callsign:</span>

            <form onSubmit={handleJoinCustom} className="flightdeck-custom-join-form">
              <div className="flightdeck-custom-join-fields">
                <input
                  type="text"
                  placeholder="Your Name (e.g. Alex)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flightdeck-input"
                  aria-label="Custom responder name"
                />
                <input
                  type="text"
                  placeholder="Role (e.g. SecOps Lead)"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="flightdeck-input"
                  aria-label="Custom responder role"
                />
                <button
                  type="submit"
                  disabled={!customName.trim() || isConnecting}
                  className="flightdeck-custom-submit-btn"
                >
                  <span>{isConnecting ? 'CONNECTING...' : 'JOIN'}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>

            <div className="flightdeck-tech-note" role="note">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-aura)', flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Zero-Friction Audio Bridge:</strong> AURA voice AI activates automatically on entry. Multi-speaker audio is powered by Agora SD-RTN 48kHz HD Audio. Speak naturally to test live contradiction arbitration and SRE postmortem extraction.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

