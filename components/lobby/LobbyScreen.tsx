'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { WarRoomInvite } from '@/components/modals/WarRoomInvite';
import { springs } from '@/lib/springs';

export interface LobbyScreenProps {
  onJoin: (
    persona: PersonaConfig,
    options?: { costRate?: number; simulateReplay?: boolean },
    scenario?: ScenarioConfig
  ) => void;
  isConnecting?: boolean;
}

const subscribeTheme = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('aura-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('aura-theme-change', callback);
  };
};

const getThemeSnapshot = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('aura-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return 'dark';
};

const getServerThemeSnapshot = (): 'dark' | 'light' => 'dark';

const COST_PRESETS = [
  { label: 'Microservice', rate: 1, perMin: 60 },
  { label: 'Standard SaaS', rate: 2, perMin: 120 },
  { label: 'Fintech / E-Comm', rate: 5, perMin: 300 },
  { label: 'Tier-1 Critical', rate: 17, perMin: 1020 },
];

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  'SEV-0': {
    label: 'SEV-0 CRITICAL',
    color: '#FF4444',
    bg: 'rgba(255, 68, 68, 0.14)',
    border: 'rgba(255, 68, 68, 0.35)',
  },
  'SEV-1': {
    label: 'SEV-1 HIGH',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  'SEV-2': {
    label: 'SEV-2 MEDIUM',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.35)',
  },
  'SEV-3': {
    label: 'SEV-3 LOW',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
};

const ROLE_PRESETS = [
  { role: 'Incident Commander', badge: 'MISSION COMMAND', color: 'var(--color-conflict)' },
  { role: 'Platform / Cloud SRE', badge: 'INFRASTRUCTURE', color: 'var(--color-fact)' },
  { role: 'Security Architect', badge: 'SECOPS', color: 'var(--color-decision)' },
  { role: 'Database Architect', badge: 'DATA PLANE', color: 'var(--color-hypothesis)' },
  { role: 'Network Operations Lead', badge: 'NETOPS', color: 'var(--color-action)' },
  { role: 'Product / Customer Liaison', badge: 'PRODUCT IMPACT', color: 'var(--color-aura)' },
];

const SCENARIO_TELEMETRY_SNIPPETS: Record<string, string> = {
  'payment-outage': '42% ERROR SPIKE · 1,420 FROZEN SESSIONS',
  'cdn-degradation': '12.4s P95 LATENCY · 503 ERROR STORM',
  'auth-breach': '85K REQ/S · TOKEN DRIFT ANOMALY',
  'k8s-cascade': '98% NODE OOM · POD EVICTION CASCADE',
  'ml-pipeline-failure': 'NCCL TIMEOUT · GPU CLUSTER DEADLOCK',
  'db-replication-lag': '45m REPLICA DRIFT · READ STALENESS',
  'api-rate-limit-storm': '180K 429s · RETRY AMPLIFICATION',
  'dns-propagation-failure': '40% SPLIT-BRAIN · NXDOMAIN CASCADE',
  'circuit-breaker-storm': '100% CHECKOUT DROP · CIRCUIT TRIPPED',
};

export function LobbyScreen({ onJoin, isConnecting = false }: LobbyScreenProps) {
  // Theme state synced with flight deck
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('aura-theme', next);
      window.dispatchEvent(new CustomEvent('aura-theme-change', { detail: next }));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  }, [theme]);

  // Sticky header scroll detection
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live UTC mission clock
  const [utcTime, setUtcTime] = useState('');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setUtcTime(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cumulative staging loss dollar ticker
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard hotkey flash feedback state
  const [activeHotkeyFlash, setActiveHotkeyFlash] = useState<string | null>(null);
  const triggerHotkeyFlash = useCallback((key: string) => {
    setActiveHotkeyFlash(key.toLowerCase());
    const t = setTimeout(() => setActiveHotkeyFlash(null), 240);
    return () => clearTimeout(t);
  }, []);

  // Dynamic interactive acoustic spotlight
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const x = ((e.clientX / window.innerWidth) * 100).toFixed(1);
        const y = ((e.clientY / window.innerHeight) * 100).toFixed(1);
        if (containerRef.current) {
          containerRef.current.style.setProperty('--mouse-x', `${x}%`);
          containerRef.current.style.setProperty('--mouse-y', `${y}%`);
        }
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Scenario management
  const [activeScenarioId, setActiveScenarioId] = useState<string>(PRESET_SCENARIOS[0].id);
  const [customScenarios, setCustomScenarios] = useState<ScenarioConfig[]>([]);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'SEV-0' | 'SEV-1' | 'SEV-2'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'rail' | 'grid'>('rail');
  const [isCreatingCustomScenario, setIsCreatingCustomScenario] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollRail = (direction: 'prev' | 'next') => {
    if (railRef.current) {
      const offset = direction === 'prev' ? -280 : 280;
      railRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Custom scenario builder state
  const [customTitle, setCustomTitle] = useState('');
  const [customSeverity, setCustomSeverity] = useState<Severity>('SEV-1');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState('');
  const [customPersonas, setCustomPersonas] = useState<PersonaDefinition[]>([]);
  const [customImpact, setCustomImpact] = useState('');
  const [customCause, setCustomCause] = useState('');
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaRole, setNewPersonaRole] = useState('');

  // Responder & Ingress state
  const [selectedPersonaUid, setSelectedPersonaUid] = useState<string>(PRESET_SCENARIOS[0].personas[0]?.uid || 'sarah_ic');
  const [isCustomPersonaActive, setIsCustomPersonaActive] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customRole, setCustomRole] = useState<string>('Platform / Cloud SRE');
  const [customColor, setCustomColor] = useState<string>('var(--color-fact)');
  const [customBadge, setCustomBadge] = useState<string>('INFRASTRUCTURE');
  const [isCreatingCustomPersona, setIsCreatingCustomPersona] = useState<boolean>(false);

  // Financial loss rate state
  const [selectedRate, setSelectedRate] = useState<number>(2);
  const [customRateInput, setCustomRateInput] = useState<string>('2');

  // Modals & Voice model
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>(() => {
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

  // Live Audio Hardware Check State (Web Audio API)
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  const [, setMicPermissionState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimRef = useRef<number | null>(null);

  const stopMicTest = useCallback(() => {
    if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsMicTesting(false);
    setMicAudioLevel(0);
  }, []);

  const toggleMicTest = useCallback(async () => {
    if (isMicTesting) {
      stopMicTest();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermissionState('granted');
      setIsMicTesting(true);

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micAnimRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      setMicPermissionState('denied');
      setIsMicTesting(false);
    }
  }, [isMicTesting, stopMicTest]);

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, [stopMicTest]);

  // Scenarios list
  const allScenarios = useMemo(() => [...PRESET_SCENARIOS, ...customScenarios], [customScenarios]);
  const activeScenario = allScenarios.find((s) => s.id === activeScenarioId) || PRESET_SCENARIOS[0];

  // Filtered scenarios
  const filteredScenarios = useMemo(() => {
    let list = allScenarios;
    if (severityFilter !== 'ALL') {
      list = list.filter((s) => s.severity === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.severity.toLowerCase().includes(q) ||
        s.channelName.toLowerCase().includes(q) ||
        s.affectedServices.some((svc) => svc.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allScenarios, severityFilter, searchQuery]);

  // Sync cost rate from scenario
  useEffect(() => {
    setSelectedRate(activeScenario.costRate);
    setCustomRateInput(activeScenario.costRate.toString());
  }, [activeScenario.costRate]);

  // Sync persona selection on scenario change
  useEffect(() => {
    if (!isCustomPersonaActive && activeScenario.personas.length > 0) {
      setSelectedPersonaUid(activeScenario.personas[0].uid);
    }
  }, [activeScenarioId, activeScenario.personas, isCustomPersonaActive]);

  // Active persona resolution
  const activePersona: PersonaConfig = useMemo(() => {
    if (isCustomPersonaActive) {
      return {
        uid: (customName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'responder') + '_oncall',
        displayName: customName.trim() || 'Custom Responder',
        role: customRole.trim() || 'Incident Responder',
        avatarColor: customColor,
      };
    }
    const found = activeScenario.personas.find((p) => p.uid === selectedPersonaUid);
    if (found) {
      return {
        uid: found.uid,
        displayName: found.displayName,
        role: found.role,
        avatarColor: found.avatarColor,
      };
    }
    const fallback = activeScenario.personas[0] || PRESET_SCENARIOS[0].personas[0];
    return {
      uid: fallback.uid,
      displayName: fallback.displayName,
      role: fallback.role,
      avatarColor: fallback.avatarColor,
    };
  }, [isCustomPersonaActive, customName, customRole, customColor, activeScenario.personas, selectedPersonaUid]);

  const effectiveRate = Math.max(1, Number(customRateInput) || selectedRate);
  const liveSessionDowntimeCost = elapsedSec * effectiveRate;

  const handleJoinBridge = useCallback((simulate = false) => {
    const scenarioToUse = simulate && activeScenario.id !== 'payment-outage'
      ? PRESET_SCENARIOS[0]
      : activeScenario;
    const personaToUse = simulate
      ? { uid: 'sarah_ic', displayName: 'Sarah Chen', role: 'Incident Commander', avatarColor: 'var(--color-conflict)' }
      : activePersona;

    const scenarioWithRate = { ...scenarioToUse, costRate: effectiveRate };
    onJoin(personaToUse, { costRate: effectiveRate, simulateReplay: simulate }, scenarioWithRate);
  }, [activeScenario, activePersona, effectiveRate, onJoin]);

  // Keyboard Shortcuts with visual flash feedback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreatingCustomScenario(false);
        setIsCreatingCustomPersona(false);
        setIsInviteOpen(false);
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          if (!isCreatingCustomScenario && !isCreatingCustomPersona) {
            e.preventDefault();
            triggerHotkeyFlash('enter');
            handleJoinBridge(false);
          }
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        triggerHotkeyFlash('/');
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        triggerHotkeyFlash('1');
        if (activeScenario.personas[0]) {
          setIsCustomPersonaActive(false);
          setSelectedPersonaUid(activeScenario.personas[0].uid);
        }
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        triggerHotkeyFlash('2');
        if (activeScenario.personas[1]) {
          setIsCustomPersonaActive(false);
          setSelectedPersonaUid(activeScenario.personas[1].uid);
        }
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        triggerHotkeyFlash('3');
        if (activeScenario.personas[2]) {
          setIsCustomPersonaActive(false);
          setSelectedPersonaUid(activeScenario.personas[2].uid);
        }
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        triggerHotkeyFlash('4');
        if (!customName.trim()) {
          setIsCreatingCustomPersona(true);
        } else {
          setIsCustomPersonaActive(true);
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        triggerHotkeyFlash('m');
        setViewMode((prev) => (prev === 'rail' ? 'grid' : 'rail'));
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        triggerHotkeyFlash('t');
        toggleTheme();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerHotkeyFlash('enter');
        handleJoinBridge(false);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    activeScenario.personas,
    customName,
    isCreatingCustomScenario,
    isCreatingCustomPersona,
    handleJoinBridge,
    toggleTheme,
    triggerHotkeyFlash,
  ]);

  const handleAddService = () => {
    const svc = customServiceInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (svc && !customServices.includes(svc)) {
      setCustomServices((prev) => [...prev, svc]);
    }
    setCustomServiceInput('');
  };

  const handleAddPersonaToCustomScenario = () => {
    if (!newPersonaName.trim()) return;
    const persona: PersonaDefinition = {
      uid: generatePersonaUid(newPersonaName),
      displayName: newPersonaName.trim(),
      role: newPersonaRole.trim() || 'Incident Responder',
      avatarColor: getAvatarColor(customPersonas.length),
      badge: newPersonaRole.trim().toUpperCase().split(' ').slice(0, 2).join(' ') || 'RESPONDER',
      description: `Active bridge participant as ${newPersonaRole.trim() || 'Responder'}.`,
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
      affectedServices: customServices.length > 0 ? customServices : ['core-service'],
      personas: customPersonas,
      channelName: generateChannelName(customTitle),
      costRate: effectiveRate,
      description: customImpact.trim() || undefined,
      impact: customImpact.trim() || undefined,
      suspectedCause: customCause.trim() || undefined,
    };
    setCustomScenarios((prev) => [...prev, scenario]);
    setActiveScenarioId(scenario.id);
    setIsCreatingCustomScenario(false);
    setCustomTitle('');
    setCustomSeverity('SEV-1');
    setCustomServices([]);
    setCustomPersonas([]);
    setCustomImpact('');
    setCustomCause('');
  };

  const handleSaveCustomPersona = () => {
    if (!customName.trim()) return;
    setIsCustomPersonaActive(true);
    setIsCreatingCustomPersona(false);
  };

  // Live telemetry pulse
  const [telemetry, setTelemetry] = useState({
    activeIncidents: 3,
    avgMttr: '22m',
    sreCoverage: 99.4,
    p99Latency: 138,
  });

  useEffect(() => {
    const t = setInterval(() => {
      setTelemetry((prev) => ({
        activeIncidents: Math.max(1, prev.activeIncidents + (Math.random() > 0.7 ? 1 : Math.random() > 0.5 ? -1 : 0)),
        avgMttr: `${Math.floor(20 + Math.random() * 6)}m`,
        sreCoverage: Math.min(99.9, Math.max(98.5, parseFloat((prev.sreCoverage + (Math.random() > 0.5 ? 0.1 : -0.1)).toFixed(1)))),
        p99Latency: Math.round(122 + Math.random() * 32),
      }));
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const activeSev = SEVERITY_CONFIG[activeScenario.severity] || SEVERITY_CONFIG['SEV-1'];

  return (
    <div className={`aura-lobby aura-lobby--${theme}`} data-theme={theme} ref={containerRef}>
      <style>{`
        /* ─── AURA Mission Control Theme Tokens & Canvas ─── */
        .aura-lobby {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #08090C;
          color: #F4F4F6;
          font-family: var(--font-sans);
          position: relative;
          overflow-x: hidden;
          padding-top: 52px;
          padding-bottom: 60px;
        }

        [data-theme="light"] .aura-lobby,
        .aura-lobby[data-theme="light"],
        .aura-lobby--light {
          background: #F8FAFC;
          color: #0F172A;
        }

        /* ─── Living Atmosphere & Precision Mesh ─── */
        .aura-lobby__bg-ambient {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: 
            radial-gradient(circle 800px at 50% -120px, rgba(212, 168, 83, 0.14) 0%, rgba(14, 165, 233, 0.04) 40%, transparent 80%),
            radial-gradient(circle 600px at 85% 85%, rgba(16, 185, 129, 0.05) 0%, transparent 60%);
        }

        [data-theme="light"] .aura-lobby__bg-ambient {
          background: 
            radial-gradient(circle 800px at 50% -120px, rgba(212, 168, 83, 0.16) 0%, rgba(14, 165, 233, 0.06) 40%, transparent 80%),
            radial-gradient(circle 600px at 85% 85%, rgba(16, 185, 129, 0.06) 0%, transparent 60%);
        }

        .aura-lobby__bg-grid {
          position: fixed;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 90% 75% at 50% 30%, #000 35%, transparent 90%);
          -webkit-mask-image: radial-gradient(ellipse 90% 75% at 50% 30%, #000 35%, transparent 90%);
          pointer-events: none;
          z-index: 0;
        }

        [data-theme="light"] .aura-lobby__bg-grid {
          background-image: 
            linear-gradient(to right, rgba(15, 23, 42, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.045) 1px, transparent 1px);
        }

        .aura-lobby__spotlight {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(circle 440px at var(--mouse-x, 50%) var(--mouse-y, 25%), rgba(212, 168, 83, 0.09) 0%, transparent 75%);
          transition: background 0.04s linear;
        }

        [data-theme="light"] .aura-lobby__spotlight {
          background: radial-gradient(circle 440px at var(--mouse-x, 50%) var(--mouse-y, 25%), rgba(212, 168, 83, 0.12) 0%, transparent 75%);
        }

        /* ─── Permanently Stuck Fixed Flight Deck Bar ─── */
        .aura-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 50px;
          z-index: 1000;
          background: rgba(10, 11, 15, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          display: flex;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .aura-topbar--scrolled {
          background: rgba(8, 9, 12, 0.95);
          border-bottom-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
        }

        [data-theme="light"] .aura-topbar {
          background: rgba(255, 255, 255, 0.8);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        [data-theme="light"] .aura-topbar--scrolled {
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
        }

        .aura-topbar__inner {
          width: 100%;
          max-width: 1280px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          height: 100%;
        }

        .aura-topbar__brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .aura-topbar__logo-wrap {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(212, 168, 83, 0.35);
          box-shadow: 0 0 10px rgba(212, 168, 83, 0.15);
          flex-shrink: 0;
        }

        .aura-topbar__logo-wrap img {
          width: 20px;
          height: 20px;
          object-fit: contain;
        }

        .aura-topbar__title {
          font-family: var(--font-mono);
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--text-primary);
        }

        .aura-topbar__status-pill {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          color: #10B981;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 2px 7px;
          border-radius: 3px;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .aura-live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 8px #10B981;
          animation: aura-live-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes aura-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .aura-topbar__clock {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          font-variant-numeric: tabular-nums;
        }

        .aura-topbar__tools {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .aura-btn-chip {
          height: 28px;
          padding: 0 9px;
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        [data-theme="light"] .aura-btn-chip {
          border-color: rgba(0, 0, 0, 0.09);
          background: rgba(0, 0, 0, 0.03);
          color: #475569;
        }

        .aura-btn-chip:hover {
          background: rgba(255, 255, 255, 0.07);
          color: var(--text-primary);
          border-color: rgba(212, 168, 83, 0.4);
        }

        .aura-lang-segmented {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          padding: 2px;
        }

        [data-theme="light"] .aura-lang-segmented {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .aura-lang-option {
          border: none;
          background: transparent;
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-muted);
          padding: 2px 7px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .aura-lang-option--active {
          background: rgba(212, 168, 83, 0.15);
          color: #D4A853;
          border: 1px solid rgba(212, 168, 83, 0.35);
          font-weight: 700;
        }

        /* ─── Hero Brand Header with Acoustic Radar Pulse ─── */
        .aura-hero-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 4px;
          padding: 28px 16px 14px;
          position: relative;
          z-index: 1;
        }

        .aura-hero-emblem-wrap {
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        /* Acoustic Radar Wave Rings */
        .aura-radar-ring-1 {
          position: absolute;
          inset: -6px;
          border-radius: 18px;
          border: 1px solid rgba(212, 168, 83, 0.35);
          animation: aura-radar-wave 3s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          pointer-events: none;
        }

        .aura-radar-ring-2 {
          position: absolute;
          inset: -14px;
          border-radius: 22px;
          border: 1px solid rgba(16, 185, 129, 0.25);
          animation: aura-radar-wave 3s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 1.5s;
          pointer-events: none;
        }

        @keyframes aura-radar-wave {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { opacity: 0.3; }
          100% { transform: scale(1.35); opacity: 0; }
        }

        .aura-hero-emblem {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(14, 16, 22, 0.85);
          border: 1px solid rgba(212, 168, 83, 0.45);
          box-shadow: 0 4px 20px rgba(212, 168, 83, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 2;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        [data-theme="light"] .aura-hero-emblem {
          background: #FFFFFF;
        }

        .aura-hero-emblem:hover {
          transform: scale(1.06);
          border-color: #D4A853;
        }

        .aura-hero-emblem img {
          width: 36px;
          height: 36px;
          object-fit: contain;
        }

        .aura-hero-title {
          font-size: clamp(2rem, 3.5vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0;
          color: var(--text-primary);
        }

        .aura-hero-subtitle {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-secondary);
          margin: 0;
          letter-spacing: -0.01em;
        }

        /* Hero Standby Acoustic Carrier Waveform */
        .aura-hero-carrier-wave {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          height: 18px;
          margin: 6px 0 3px;
        }

        .aura-hero-carrier-bar {
          width: 2.5px;
          border-radius: 1px;
          background: #D4A853;
          opacity: 0.65;
          animation: aura-carrier-pulse 1.3s ease-in-out infinite alternate;
        }

        @keyframes aura-carrier-pulse {
          0% { transform: scaleY(0.35); opacity: 0.3; }
          100% { transform: scaleY(1.3); opacity: 0.95; }
        }

        /* Ticker Pill */
        .aura-hero-ticker {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 4px 16px;
          background: rgba(18, 20, 28, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        [data-theme="light"] .aura-hero-ticker {
          background: rgba(255, 255, 255, 0.85);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .aura-hero-ticker strong {
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }

        /* ─── 2-Column Incident Command Stage ─── */
        .aura-stage-grid {
          width: 100%;
          max-width: 1280px;
          display: grid;
          grid-template-columns: 1.16fr 0.84fr;
          gap: 20px;
          padding: 0 18px;
          position: relative;
          z-index: 1;
        }

        @media (max-width: 1020px) {
          .aura-stage-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ─── Cards & Containers ─── */
        .aura-card {
          background: rgba(14, 16, 22, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        [data-theme="light"] .aura-card {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.05);
        }

        .aura-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        [data-theme="light"] .aura-card__header {
          background: rgba(0, 0, 0, 0.015);
          border-bottom-color: rgba(0, 0, 0, 0.06);
        }

        .aura-card__title {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .aura-card__body {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ─── Crisis Scenario Dispatch & Telemetry Track ─── */
        .aura-crisis-filter-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .aura-crisis-filters {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .aura-filter-btn {
          padding: 4px 10px;
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        [data-theme="light"] .aura-filter-btn {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
          color: #64748B;
        }

        .aura-filter-btn:hover {
          border-color: rgba(212, 168, 83, 0.4);
          color: var(--text-primary);
        }

        .aura-filter-btn--active {
          background: rgba(212, 168, 83, 0.15);
          border-color: #D4A853;
          color: #D4A853;
          font-weight: 700;
        }

        .aura-crisis-tools {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .aura-crisis-search {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 5px;
          padding: 5px 9px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-primary);
          outline: none;
          width: 150px;
          transition: all 0.2s ease;
        }

        [data-theme="light"] .aura-crisis-search {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.1);
        }

        .aura-crisis-search:focus {
          width: 190px;
          border-color: #D4A853;
        }

        /* Crisis Rail Slider (Zero Native Gray Scrollbars) */
        .aura-crisis-rail-wrap {
          position: relative;
          overflow: hidden;
        }

        .aura-crisis-rail {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 2px;
          scroll-snap-type: x mandatory;
        }

        .aura-crisis-rail::-webkit-scrollbar {
          display: none;
        }

        .aura-crisis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .aura-scenario-card {
          flex: 0 0 210px;
          scroll-snap-align: start;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 5px;
          transition: all 0.18s ease;
          position: relative;
        }

        [data-theme="light"] .aura-scenario-card {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.07);
        }

        .aura-scenario-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-1px);
        }

        .aura-scenario-card--active {
          border-color: #D4A853;
          background: rgba(212, 168, 83, 0.08);
          box-shadow: 0 4px 16px rgba(212, 168, 83, 0.15), inset 0 0 0 1px #D4A853;
        }

        .aura-scenario-card__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aura-scenario-card__sev {
          font-family: var(--font-mono);
          font-size: 8.5px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 3px;
          letter-spacing: 0.05em;
        }

        .aura-scenario-card__status {
          font-family: var(--font-mono);
          font-size: 8px;
          color: var(--text-muted);
        }

        .aura-scenario-card--active .aura-scenario-card__status {
          color: #D4A853;
          font-weight: 700;
        }

        .aura-scenario-card__title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .aura-scenario-card__snippet {
          font-family: var(--font-mono);
          font-size: 8.5px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Selected Crisis Projection Centerpiece ─── */
        .aura-dossier-centerpiece {
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(212, 168, 83, 0.25);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
          position: relative;
        }

        [data-theme="light"] .aura-dossier-centerpiece {
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
        }

        .aura-dossier-centerpiece__meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .aura-badge-sev {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 800;
          padding: 2.5px 8px;
          border-radius: 3px;
          letter-spacing: 0.08em;
        }

        .aura-badge-channel {
          font-family: var(--font-mono);
          font-size: 9.5px;
          color: #D4A853;
          background: rgba(212, 168, 83, 0.1);
          border: 1px solid rgba(212, 168, 83, 0.25);
          padding: 2.5px 8px;
          border-radius: 3px;
        }

        .aura-badge-service {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 2px 7px;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .aura-service-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #F59E0B;
        }

        .aura-dossier-centerpiece__title {
          font-size: clamp(18px, 1.8vw, 22px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.25;
        }

        /* 2-Column Telemetry Matrix */
        .aura-telemetry-duo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 640px) {
          .aura-telemetry-duo {
            grid-template-columns: 1fr;
          }
        }

        .aura-telemetry-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        [data-theme="light"] .aura-telemetry-box {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.07);
        }

        .aura-telemetry-box__label {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .aura-telemetry-box__desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
        }

        /* Financial Loss Velocity Deck with Live Staging Loss Ticker */
        .aura-burn-strip {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        [data-theme="light"] .aura-burn-strip {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.07);
        }

        .aura-burn-strip__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
        }

        .aura-burn-strip__label {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .aura-burn-ticker-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .aura-burn-ticker-session {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #EF4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          padding: 2px 7px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-variant-numeric: tabular-nums;
        }

        .aura-burn-strip__rate {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 800;
          color: #F59E0B;
          font-variant-numeric: tabular-nums;
        }

        .aura-burn-strip__chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .aura-burn-chip {
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          font-family: var(--font-mono);
          font-size: 9.5px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        [data-theme="light"] .aura-burn-chip {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.08);
          color: #475569;
        }

        .aura-burn-chip:hover {
          border-color: rgba(212, 168, 83, 0.4);
          color: var(--text-primary);
        }

        .aura-burn-chip--active {
          border-color: #D4A853;
          background: rgba(212, 168, 83, 0.15);
          color: #D4A853;
          font-weight: 700;
        }

        /* ─── Tactical Callsigns Grid ─── */
        .aura-persona-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .aura-persona-tile {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        [data-theme="light"] .aura-persona-tile {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .aura-persona-tile--custom-unconfigured {
          border: 1px dashed rgba(212, 168, 83, 0.45);
          background: rgba(212, 168, 83, 0.03);
        }

        .aura-persona-tile:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .aura-persona-tile--active {
          border-color: #D4A853 !important;
          background: rgba(212, 168, 83, 0.08) !important;
          box-shadow: 0 6px 20px rgba(212, 168, 83, 0.18), inset 0 0 0 1px #D4A853 !important;
        }

        .aura-persona-tile__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aura-callsign-tag {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          color: #D4A853;
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.3);
          padding: 1.5px 5px;
          border-radius: 3px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .aura-persona-badge {
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .aura-persona-tile__identity {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .aura-persona-avatar {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-weight: 800;
          font-size: 12px;
          color: #FFFFFF;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .aura-persona-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .aura-persona-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .aura-persona-role {
          font-size: 10.5px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Living Acoustic Carrier & Mic Hardware ─── */
        .aura-acoustic-card {
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        [data-theme="light"] .aura-acoustic-card {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .aura-acoustic-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aura-acoustic-card__title {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .aura-btn-probe {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          padding: 2.5px 8px;
          border-radius: 3px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .aura-btn-probe--active {
          border-color: #10B981;
          color: #10B981;
          background: rgba(16, 185, 129, 0.15);
        }

        /* Animated Spectrum Bars (Idle Carrier Wave + Active Mic Analyzer) */
        .aura-spectrum-rack {
          display: flex;
          align-items: flex-end;
          gap: 3.5px;
          height: 22px;
          padding: 2px 0;
        }

        .aura-spectrum-bar {
          flex: 1;
          background: linear-gradient(180deg, #D4A853 0%, rgba(212, 168, 83, 0.3) 100%);
          border-radius: 1.5px;
          min-height: 3px;
          transition: height 0.07s ease;
        }

        .aura-spectrum-bar--idle {
          animation: aura-eq-idle 1.6s ease-in-out infinite alternate;
        }

        @keyframes aura-eq-idle {
          0% { height: 4px; opacity: 0.45; }
          50% { height: 16px; opacity: 0.95; }
          100% { height: 6px; opacity: 0.55; }
        }

        .aura-acoustic-spec {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ─── Grand Master Ignition Button (Aerospace Shimmer & Pulse) ─── */
        .aura-launch-station {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .aura-btn-launch-primary {
          width: 100%;
          padding: 16px 22px;
          border-radius: 10px;
          border: 1px solid rgba(212, 168, 83, 0.55);
          background: linear-gradient(180deg, #E5BA65 0%, #C49842 100%);
          color: #0A0A0E;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          box-shadow: 0 6px 26px rgba(212, 168, 83, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.45);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        /* Ambient Glass Reflection Shimmer */
        .aura-btn-launch-primary::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            60deg,
            transparent 35%,
            rgba(255, 255, 255, 0.35) 50%,
            transparent 65%
          );
          animation: aura-btn-shimmer 4.5s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes aura-btn-shimmer {
          0% { transform: translateX(-100%); }
          25%, 100% { transform: translateX(100%); }
        }

        .aura-btn-launch-primary:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: 0 8px 34px rgba(212, 168, 83, 0.5);
          transform: translateY(-1px);
        }

        .aura-btn-launch-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .aura-btn-launch-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .aura-btn-launch__heading {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 1;
        }

        .aura-btn-launch__sub {
          font-size: 10.5px;
          font-weight: 600;
          opacity: 0.85;
          letter-spacing: 0.02em;
          z-index: 1;
        }

        .aura-sim-pill-btn {
          border: none;
          background: transparent;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 9999px;
          margin: 0 auto;
          transition: all 0.15s ease;
        }

        .aura-sim-pill-btn:hover {
          color: #D4A853;
          text-decoration: underline;
        }

        /* Readiness Strip & Hotkey Flash States */
        .aura-readiness-hud {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding-top: 5px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        [data-theme="light"] .aura-readiness-hud {
          border-top-color: rgba(0, 0, 0, 0.07);
        }

        .aura-readiness-hud__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-muted);
        }

        .aura-readiness-hud__hotkeys {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
          font-family: var(--font-mono);
          font-size: 8.5px;
          color: var(--text-muted);
        }

        .aura-key-badge {
          font-family: var(--font-mono);
          font-size: 8px;
          font-weight: 700;
          padding: 1px 4.5px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-secondary);
          transition: all 0.12s ease;
        }

        [data-theme="light"] .aura-key-badge {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
          color: #475569;
        }

        .aura-key-badge--flash {
          background: #D4A853 !important;
          color: #08090C !important;
          border-color: #D4A853 !important;
          transform: scale(1.18);
          box-shadow: 0 0 10px #D4A853;
        }

        /* ─── Modal System ─── */
        .aura-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .aura-modal-window {
          width: 100%;
          max-width: 560px;
          max-height: 88vh;
          background: #0E1017;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 20px 56px rgba(0, 0, 0, 0.65);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        [data-theme="light"] .aura-modal-window {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 20px 56px rgba(0, 0, 0, 0.12);
        }

        .aura-modal-window__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        [data-theme="light"] .aura-modal-window__header {
          background: rgba(0, 0, 0, 0.02);
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }

        .aura-modal-window__body {
          padding: 18px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aura-modal-window__footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 10px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        [data-theme="light"] .aura-modal-window__footer {
          background: rgba(0, 0, 0, 0.02);
          border-top-color: rgba(0, 0, 0, 0.08);
        }

        .aura-input-field {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 11px;
          color: var(--text-primary);
          outline: none;
          font-family: var(--font-sans);
          transition: border-color 0.15s ease;
        }

        [data-theme="light"] .aura-input-field {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.12);
        }

        .aura-input-field:focus {
          border-color: #D4A853;
        }
      `}</style>

      {/* Living Atmospheric Mesh & Cursor Spotlight */}
      <div className="aura-lobby__bg-ambient" aria-hidden="true" />
      <div className="aura-lobby__bg-grid" aria-hidden="true" />
      <div className="aura-lobby__spotlight" aria-hidden="true" />

      {/* Fixed Mission Control Flight Deck Bar */}
      <header
        className={`aura-topbar ${isScrolled ? 'aura-topbar--scrolled' : ''}`}
        role="navigation"
        aria-label="War room mission control bar"
      >
        <div className="aura-topbar__inner">
          <div className="aura-topbar__brand">
            <div className="aura-topbar__logo-wrap" aria-hidden="true">
              <img src="/logo.png" alt="AURA Logo" width={20} height={20} />
            </div>
            <span className="aura-topbar__title">AURA // MISSION CONTROL</span>
            <span className="aura-topbar__status-pill">
              <span className="aura-live-dot" aria-hidden="true" />
              SD-RTN™ ONLINE
            </span>
            <span className="aura-topbar__clock" title="Mission Elapsed Time UTC">
              ⏱ {utcTime || '00:00:00 UTC'}
            </span>
          </div>

          <div className="aura-topbar__tools">
            {/* Voice Model Selector */}
            <div className="aura-lang-segmented" role="radiogroup" aria-label="Voice Accent Language">
              <button
                type="button"
                role="radio"
                aria-checked={voiceLang === 'en-IN'}
                className={`aura-lang-option ${voiceLang === 'en-IN' ? 'aura-lang-option--active' : ''}`}
                onClick={() => handleVoiceLangToggle('en-IN')}
                title="Indian English voice model (en-IN)"
              >
                🇮🇳 en-IN
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={voiceLang === 'en-US'}
                className={`aura-lang-option ${voiceLang === 'en-US' ? 'aura-lang-option--active' : ''}`}
                onClick={() => handleVoiceLangToggle('en-US')}
                title="US English voice model (en-US)"
              >
                🇺🇸 en-US
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              className="aura-btn-chip"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode (T)`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              <span>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</span>
              <kbd className={`aura-key-badge ${activeHotkeyFlash === 't' ? 'aura-key-badge--flash' : ''}`}>T</kbd>
            </button>

            {/* Invite Button */}
            <button
              type="button"
              className="aura-btn-chip"
              onClick={() => setIsInviteOpen(true)}
              title="Share War Room Link"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Invite Team</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Brand Header with Acoustic Radar Pulse & Magic Branding ─── */}
      <section className="aura-hero-brand">
        <div className="aura-hero-emblem-wrap">
          <div className="aura-radar-ring-1" aria-hidden="true" />
          <div className="aura-radar-ring-2" aria-hidden="true" />
          <div className="aura-hero-emblem" aria-hidden="true">
            <img src="/logo.png" alt="AURA Logo" width={36} height={36} />
          </div>
        </div>
        <h1 className="aura-hero-title">AURA</h1>
        <p className="aura-hero-subtitle">
          Autonomous Voice-Directed Incident Commander
        </p>

        {/* Standby Acoustic Carrier Waveform */}
        <div className="aura-hero-carrier-wave" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="aura-hero-carrier-bar"
              style={{
                animationDelay: `${(i * 85) % 900}ms`,
                height: `${5 + ((i * 5) % 13)}px`,
              }}
            />
          ))}
        </div>

        {/* Real-Time Telemetry Ticker */}
        <div className="aura-hero-ticker" role="status" aria-label="Live Fleet Status">
          <span>
            Active War Rooms: <strong>{telemetry.activeIncidents}</strong>
          </span>
          <span>·</span>
          <span>
            Avg MTTR: <strong>{telemetry.avgMttr}</strong>
          </span>
          <span>·</span>
          <span>
            SRE Coverage: <strong>{telemetry.sreCoverage.toFixed(1)}%</strong>
          </span>
          <span>·</span>
          <span>
            Audio Mesh: <strong>{telemetry.p99Latency}ms P99</strong>
          </span>
        </div>
      </section>

      {/* ─── 2-Column Master Command Deck ─── */}
      <main className="aura-stage-grid">
        {/* Left Column: Crisis Scenario Dispatch & Telemetry Centerpiece */}
        <section className="aura-card" aria-labelledby="scenario-dispatch-heading">
          <div className="aura-card__header">
            <span id="scenario-dispatch-heading" className="aura-card__title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              Crisis Scenario Dispatch &amp; Telemetry
            </span>
            <button
              type="button"
              className="aura-btn-chip"
              style={{ fontSize: '9px', height: '22px', padding: '0 7px' }}
              onClick={() => setIsCreatingCustomScenario(true)}
            >
              + New Incident
            </button>
          </div>

          <div className="aura-card__body">
            {/* Filter Pills, Instant Search & View Controls */}
            <div className="aura-crisis-filter-bar">
              <div className="aura-crisis-filters" role="tablist" aria-label="Filter crises by severity">
                <button
                  type="button"
                  className={`aura-filter-btn ${severityFilter === 'ALL' ? 'aura-filter-btn--active' : ''}`}
                  onClick={() => setSeverityFilter('ALL')}
                >
                  ALL ({allScenarios.length})
                </button>
                <button
                  type="button"
                  className={`aura-filter-btn ${severityFilter === 'SEV-0' ? 'aura-filter-btn--active' : ''}`}
                  onClick={() => setSeverityFilter('SEV-0')}
                >
                  🔴 SEV-0 ({allScenarios.filter((s) => s.severity === 'SEV-0').length})
                </button>
                <button
                  type="button"
                  className={`aura-filter-btn ${severityFilter === 'SEV-1' ? 'aura-filter-btn--active' : ''}`}
                  onClick={() => setSeverityFilter('SEV-1')}
                >
                  🟠 SEV-1 ({allScenarios.filter((s) => s.severity === 'SEV-1').length})
                </button>
                <button
                  type="button"
                  className={`aura-filter-btn ${severityFilter === 'SEV-2' ? 'aura-filter-btn--active' : ''}`}
                  onClick={() => setSeverityFilter('SEV-2')}
                >
                  🟡 SEV-2 ({allScenarios.filter((s) => s.severity === 'SEV-2').length})
                </button>
              </div>

              <div className="aura-crisis-tools">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="aura-crisis-search"
                  placeholder="Filter incidents... [/]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="aura-btn-chip"
                  style={{ fontSize: '9px', height: '24px', padding: '0 6px' }}
                  onClick={() => setViewMode((prev) => (prev === 'rail' ? 'grid' : 'rail'))}
                  title="Toggle Rail / Matrix View (M)"
                >
                  <span>{viewMode === 'rail' ? '⊞ Matrix' : '≡ Rail'}</span>
                  <kbd className={`aura-key-badge ${activeHotkeyFlash === 'm' ? 'aura-key-badge--flash' : ''}`}>M</kbd>
                </button>
                {viewMode === 'rail' && (
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      type="button"
                      className="aura-btn-chip"
                      style={{ width: '22px', height: '24px', padding: 0, justifyContent: 'center' }}
                      onClick={() => scrollRail('prev')}
                      aria-label="Previous scenario"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="aura-btn-chip"
                      style={{ width: '22px', height: '24px', padding: 0, justifyContent: 'center' }}
                      onClick={() => scrollRail('next')}
                      aria-label="Next scenario"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Command Slider or Tactical Matrix */}
            <div className="aura-crisis-rail-wrap">
              <div
                ref={railRef}
                className={viewMode === 'rail' ? 'aura-crisis-rail' : 'aura-crisis-grid'}
              >
                {filteredScenarios.map((sc) => {
                  const sev = SEVERITY_CONFIG[sc.severity] || SEVERITY_CONFIG['SEV-1'];
                  const isSelected = sc.id === activeScenarioId;
                  const snippet = SCENARIO_TELEMETRY_SNIPPETS[sc.id] || `${sc.severity} · Production`;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      className={`aura-scenario-card ${isSelected ? 'aura-scenario-card--active' : ''}`}
                      onClick={() => setActiveScenarioId(sc.id)}
                    >
                      <div className="aura-scenario-card__top">
                        <span
                          className="aura-scenario-card__sev"
                          style={{ color: sev.color, background: sev.bg }}
                        >
                          {sc.severity}
                        </span>
                        <span className="aura-scenario-card__status">
                          {isSelected ? '● ARMED' : '○ STANDBY'}
                        </span>
                      </div>
                      <div className="aura-scenario-card__title" title={sc.name}>{sc.name}</div>
                      <div className="aura-scenario-card__snippet">{snippet}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Crisis Centerpiece Stage */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeScenario.id}
                className="aura-dossier-centerpiece"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={springs.card}
              >
                <div className="aura-dossier-centerpiece__meta">
                  <span
                    className="aura-badge-sev"
                    style={{ color: activeSev.color, background: activeSev.bg, border: `1px solid ${activeSev.border}` }}
                  >
                    {activeScenario.severity}
                  </span>
                  <span className="aura-badge-channel">#{activeScenario.channelName}</span>
                  {activeScenario.affectedServices.map((svc) => (
                    <span key={svc} className="aura-badge-service">
                      <span className="aura-service-dot" />
                      {svc}
                    </span>
                  ))}
                </div>

                <h2 className="aura-dossier-centerpiece__title">{activeScenario.title}</h2>

                {/* 2-Pillar Diagnostic Telemetry Duo */}
                <div className="aura-telemetry-duo">
                  <div className="aura-telemetry-box">
                    <span className="aura-telemetry-box__label" style={{ color: '#F87171' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      </svg>
                      Live Blast Radius
                    </span>
                    <p className="aura-telemetry-box__desc">
                      {activeScenario.impact || 'Critical service degradation affecting customer checkout sessions.'}
                    </p>
                  </div>

                  <div className="aura-telemetry-box">
                    <span className="aura-telemetry-box__label" style={{ color: 'var(--color-hypothesis)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      </svg>
                      Suspected Root Cause
                    </span>
                    <p className="aura-telemetry-box__desc">
                      {activeScenario.suspectedCause || 'Diagnostic hypothesis under investigation by SRE triage bridge.'}
                    </p>
                  </div>
                </div>

                {/* Financial Loss Burn Rate Strip with Live Staging Dollar Counter */}
                <div className="aura-burn-strip">
                  <div className="aura-burn-strip__header">
                    <span className="aura-burn-strip__label">Financial Loss Burn Rate</span>
                    <div className="aura-burn-ticker-group">
                      <span className="aura-burn-ticker-session" title="Live staging downtime loss calculated from active crisis rate">
                        <span className="aura-live-dot" style={{ background: '#EF4444', boxShadow: '0 0 6px #EF4444' }} />
                        Session Loss: ${new Intl.NumberFormat('en-US').format(liveSessionDowntimeCost)}
                      </span>
                      <span className="aura-burn-strip__rate">
                        ${new Intl.NumberFormat('en-US').format(effectiveRate * 60)}/min · ${new Intl.NumberFormat('en-US').format(effectiveRate * 3600)}/hr
                      </span>
                    </div>
                  </div>
                  <div className="aura-burn-strip__chips">
                    {COST_PRESETS.map((p) => (
                      <button
                        key={p.rate}
                        type="button"
                        className={`aura-burn-chip ${selectedRate === p.rate ? 'aura-burn-chip--active' : ''}`}
                        onClick={() => {
                          setSelectedRate(p.rate);
                          setCustomRateInput(p.rate.toString());
                        }}
                      >
                        {p.label}: ${p.perMin}/min (${p.rate}/s)
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Right Column: Responder Callsign & Ingress Station */}
        <section className="aura-card" aria-labelledby="responder-ingress-heading">
          <div className="aura-card__header">
            <span id="responder-ingress-heading" className="aura-card__title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Responder Callsign &amp; Ingress Station
            </span>
            <button
              type="button"
              className="aura-btn-chip"
              style={{ fontSize: '9px', height: '22px', padding: '0 7px' }}
              onClick={() => setIsCreatingCustomPersona(true)}
            >
              + Deploy Custom Callsign
            </button>
          </div>

          <div className="aura-card__body">
            {/* 4 Clean Responder Callsign Tiles */}
            <div className="aura-persona-grid">
              {activeScenario.personas.map((persona, index) => {
                const isSelected = !isCustomPersonaActive && selectedPersonaUid === persona.uid;
                const callsign = index === 0 ? 'CMD-01' : index === 1 ? 'SRE-02' : index === 2 ? 'PRD-03' : `OP-0${index + 1}`;
                const duty = persona.badge || (index === 0 ? 'MISSION COMMAND' : index === 1 ? 'INFRASTRUCTURE' : 'PRODUCT IMPACT');
                const hotkeyChar = String(index + 1);

                return (
                  <button
                    key={persona.uid}
                    type="button"
                    className={`aura-persona-tile ${isSelected ? 'aura-persona-tile--active' : ''}`}
                    onClick={() => {
                      setIsCustomPersonaActive(false);
                      setSelectedPersonaUid(persona.uid);
                    }}
                  >
                    <div className="aura-persona-tile__header">
                      <span className="aura-callsign-tag">
                        {callsign}{' '}
                        <kbd className={`aura-key-badge ${activeHotkeyFlash === hotkeyChar ? 'aura-key-badge--flash' : ''}`}>
                          {index + 1}
                        </kbd>
                      </span>
                      <span className="aura-persona-badge">{duty}</span>
                    </div>
                    <div className="aura-persona-tile__identity">
                      <div
                        className="aura-persona-avatar"
                        style={{ background: persona.avatarColor }}
                        aria-hidden="true"
                      >
                        {persona.displayName[0]}
                      </div>
                      <div className="aura-persona-info">
                        <span className="aura-persona-name">{persona.displayName}</span>
                        <span className="aura-persona-role">{persona.role}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 4th Callsign: Elevated Custom / On-Call Specialist Tile */}
              <button
                type="button"
                className={`aura-persona-tile ${!customName.trim() ? 'aura-persona-tile--custom-unconfigured' : ''} ${isCustomPersonaActive ? 'aura-persona-tile--active' : ''}`}
                onClick={() => {
                  if (!customName.trim()) {
                    setIsCreatingCustomPersona(true);
                  } else {
                    setIsCustomPersonaActive(true);
                  }
                }}
              >
                <div className="aura-persona-tile__header">
                  <span className="aura-callsign-tag">
                    SPEC-04{' '}
                    <kbd className={`aura-key-badge ${activeHotkeyFlash === '4' ? 'aura-key-badge--flash' : ''}`}>
                      4
                    </kbd>
                  </span>
                  <span className="aura-persona-badge">
                    {customName ? (customBadge || 'ON-CALL GUEST') : '+ SPECIALIST'}
                  </span>
                </div>
                <div className="aura-persona-tile__identity">
                  <div
                    className="aura-persona-avatar"
                    style={{ background: customName ? customColor : 'linear-gradient(135deg, rgba(212, 168, 83, 0.3) 0%, rgba(56, 189, 248, 0.2) 100%)', border: '1px solid rgba(212, 168, 83, 0.4)' }}
                    aria-hidden="true"
                  >
                    {customName ? customName[0].toUpperCase() : '⚡'}
                  </div>
                  <div className="aura-persona-info">
                    <span className="aura-persona-name">
                      {customName ? customName : 'Deploy Specialist'}
                    </span>
                    <span className="aura-persona-role">
                      {customName ? customRole : 'DBA, SecOps, or On-Call'}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Living Acoustic Carrier & Mic Hardware Check */}
            <div className="aura-acoustic-card">
              <div className="aura-acoustic-card__header">
                <span className="aura-acoustic-card__title">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Acoustic Carrier &amp; Mic Hardware
                </span>
                <button
                  type="button"
                  className={`aura-btn-probe ${isMicTesting ? 'aura-btn-probe--active' : ''}`}
                  onClick={toggleMicTest}
                >
                  {isMicTesting ? '● Live Probe Active' : '▶ Test Voice Carrier'}
                </button>
              </div>

              {/* Dynamic Animated Spectrum Bars with Idle Sinusoidal Undulation */}
              <div className="aura-spectrum-rack" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => {
                  const dynamicHeight = isMicTesting
                    ? Math.max(3, Math.min(22, Math.round((micAudioLevel / 100) * 22 * (0.35 + (i % 5) * 0.15))))
                    : undefined;

                  return (
                    <span
                      key={i}
                      className={`aura-spectrum-bar ${!isMicTesting ? 'aura-spectrum-bar--idle' : ''}`}
                      style={{
                        height: isMicTesting ? `${dynamicHeight}px` : undefined,
                        animationDelay: !isMicTesting ? `${(i * 65) % 1100}ms` : undefined,
                      }}
                    />
                  );
                })}
              </div>

              <div className="aura-acoustic-spec">
                <span>Opus 48kHz HD Carrier · SD-RTN™ Mesh · Latency &lt;40ms</span>
                <span style={{ color: isMicTesting ? '#10B981' : 'var(--text-muted)' }}>
                  {isMicTesting ? 'Microphone Live' : 'Carrier Warm & Armed'}
                </span>
              </div>
            </div>

            {/* Launch CTA Station with Aerospace Shimmer & Pulse */}
            <div className="aura-launch-station">
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => handleJoinBridge(false)}
                className="aura-btn-launch-primary"
                title="Launch live war room flight deck (Ctrl+Enter)"
              >
                <span className="aura-btn-launch__heading">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {isConnecting ? 'ESTABLISHING BRIDGE...' : `ENTER LIVE WAR ROOM (${activePersona.displayName.toUpperCase()})`}
                </span>
                <span className="aura-btn-launch__sub">
                  Joining as {activePersona.displayName} ({activePersona.role}) · Press Ctrl+↵
                </span>
              </button>

              {/* Minimal Scripted Audio Simulation Link (Strictly for payment-outage) */}
              {activeScenario.id === 'payment-outage' && (
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => handleJoinBridge(true)}
                  className="aura-sim-pill-btn"
                  title="Automated 6-beat voice & telemetry playback without requiring mic input"
                >
                  <span>▶</span>
                  <span>Run Scripted Audio Simulation (Demo Replay · Zero-Mic)</span>
                </button>
              )}
            </div>

            {/* Readiness Strip & Tactical Hotkey Legend with Interactive Flash Feedback */}
            <div className="aura-readiness-hud">
              <div className="aura-readiness-hud__row">
                <span>
                  <span className="aura-live-dot" style={{ display: 'inline-block', marginRight: '5px' }} />
                  Voice Bridge: Ready
                </span>
                <span>
                  <span className="aura-live-dot" style={{ display: 'inline-block', marginRight: '5px' }} />
                  ASR Nova-3: Armed
                </span>
                <span>
                  <span className="aura-live-dot" style={{ display: 'inline-block', marginRight: '5px' }} />
                  Safety Gatekeeper: Armed
                </span>
              </div>

              <div className="aura-readiness-hud__hotkeys">
                <span>HOTKEYS:</span>
                <span>
                  <kbd className={`aura-key-badge ${activeHotkeyFlash === '/' ? 'aura-key-badge--flash' : ''}`}>/</kbd> Filter
                </span>
                <span>
                  <kbd className={`aura-key-badge ${['1', '2', '3', '4'].includes(activeHotkeyFlash || '') ? 'aura-key-badge--flash' : ''}`}>1-4</kbd> Callsigns
                </span>
                <span>
                  <kbd className={`aura-key-badge ${activeHotkeyFlash === 'm' ? 'aura-key-badge--flash' : ''}`}>M</kbd> View
                </span>
                <span>
                  <kbd className={`aura-key-badge ${activeHotkeyFlash === 't' ? 'aura-key-badge--flash' : ''}`}>T</kbd> Theme
                </span>
                <span>
                  <kbd className={`aura-key-badge ${activeHotkeyFlash === 'enter' ? 'aura-key-badge--flash' : ''}`}>Ctrl+↵</kbd> Launch
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Custom Callsign Builder Modal ─── */}
      {isCreatingCustomPersona && (
        <div className="aura-modal-backdrop" onClick={() => setIsCreatingCustomPersona(false)}>
          <div className="aura-modal-window" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="custom-callsign-title">
            <div className="aura-modal-window__header">
              <span id="custom-callsign-title" className="aura-card__title">
                Deploy Custom Callsign
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingCustomPersona(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="aura-modal-window__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CALLSIGN / FULL NAME *</label>
                <input
                  type="text"
                  className="aura-input-field"
                  placeholder="e.g. Alex Vance"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>ROLE PRESET TEMPLATE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.role}
                      type="button"
                      className="aura-burn-chip"
                      style={{
                        textAlign: 'left',
                        borderColor: customRole === preset.role ? '#D4A853' : 'rgba(255, 255, 255, 0.08)',
                        background: customRole === preset.role ? 'rgba(212, 168, 83, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        padding: '6px 8px',
                      }}
                      onClick={() => {
                        setCustomRole(preset.role);
                        setCustomBadge(preset.badge);
                        setCustomColor(preset.color);
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '10.5px' }}>{preset.role}</div>
                      <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>{preset.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CUSTOM ROLE TITLE</label>
                <input
                  type="text"
                  className="aura-input-field"
                  placeholder="e.g. Principal Database Reliability Engineer"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                />
              </div>
            </div>

            <div className="aura-modal-window__footer">
              <button
                type="button"
                className="aura-btn-chip"
                onClick={() => setIsCreatingCustomPersona(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aura-btn-chip"
                style={{ borderColor: '#D4A853', color: '#D4A853', background: 'rgba(212, 168, 83, 0.15)', fontWeight: 700 }}
                disabled={!customName.trim()}
                onClick={handleSaveCustomPersona}
              >
                Confirm Callsign &amp; Arm Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Custom Scenario Builder Modal ─── */}
      {isCreatingCustomScenario && (
        <div className="aura-modal-backdrop" onClick={() => setIsCreatingCustomScenario(false)}>
          <div className="aura-modal-window" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="custom-scenario-title">
            <div className="aura-modal-window__header">
              <span id="custom-scenario-title" className="aura-card__title">
                ⚡ Create Custom Incident Scenario
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingCustomScenario(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="aura-modal-window__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>INCIDENT TITLE *</label>
                <input
                  type="text"
                  className="aura-input-field"
                  placeholder="e.g. Global DNS Cache Poisoning Outage"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SEVERITY LEVEL</label>
                  <select
                    className="aura-input-field"
                    value={customSeverity}
                    onChange={(e) => setCustomSeverity(e.target.value as Severity)}
                  >
                    <option value="SEV-0">🔴 SEV-0 (Catastrophic)</option>
                    <option value="SEV-1">🟠 SEV-1 (Critical)</option>
                    <option value="SEV-2">🟡 SEV-2 (Degraded)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>AFFECTED SERVICES</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      className="aura-input-field"
                      placeholder="e.g. dns-auth"
                      value={customServiceInput}
                      onChange={(e) => setCustomServiceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddService();
                        }
                      }}
                    />
                    <button type="button" className="aura-btn-chip" onClick={handleAddService}>+ Add</button>
                  </div>
                </div>
              </div>

              {customServices.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {customServices.map((svc) => (
                    <span key={svc} className="aura-badge-service" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {svc}
                      <button
                        type="button"
                        onClick={() => setCustomServices(customServices.filter((s) => s !== svc))}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>LIVE IMPACT SCOPE</label>
                <textarea
                  className="aura-input-field"
                  style={{ resize: 'vertical', minHeight: '50px' }}
                  placeholder="Describe blast radius, affected users, and error rate spike..."
                  value={customImpact}
                  onChange={(e) => setCustomImpact(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SUSPECTED ROOT CAUSE</label>
                <textarea
                  className="aura-input-field"
                  style={{ resize: 'vertical', minHeight: '50px' }}
                  placeholder="Describe initial hypothesis or commit/deploy trigger..."
                  value={customCause}
                  onChange={(e) => setCustomCause(e.target.value)}
                />
              </div>

              {/* Scenario Personas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>WAR ROOM RESPONDERS ({customPersonas.length}) *</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="aura-input-field"
                    placeholder="Name (e.g. Sarah)"
                    value={newPersonaName}
                    onChange={(e) => setNewPersonaName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="aura-input-field"
                    placeholder="Role (e.g. Incident Commander)"
                    value={newPersonaRole}
                    onChange={(e) => setNewPersonaRole(e.target.value)}
                  />
                  <button type="button" className="aura-btn-chip" onClick={handleAddPersonaToCustomScenario}>+ Add</button>
                </div>

                {customPersonas.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {customPersonas.map((p, idx) => (
                      <span key={p.uid} className="aura-burn-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {p.displayName} ({p.role})
                        <button
                          type="button"
                          onClick={() => setCustomPersonas(customPersonas.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px' }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="aura-modal-window__footer">
              <button
                type="button"
                className="aura-btn-chip"
                onClick={() => setIsCreatingCustomScenario(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aura-btn-chip"
                style={{ borderColor: '#D4A853', color: '#D4A853', background: 'rgba(212, 168, 83, 0.15)', fontWeight: 700 }}
                disabled={!customTitle.trim() || customPersonas.length === 0}
                onClick={handleSaveCustomScenario}
              >
                Create Scenario &amp; Arm Bridge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* War Room Invite Modal */}
      {isInviteOpen && (
        <WarRoomInvite
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </div>
  );
}
