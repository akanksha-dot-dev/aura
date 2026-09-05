import { IncidentState, Severity } from './types';

// ─── Core Scenario Types ───

export interface PersonaDefinition {
  uid: string;
  displayName: string;
  role: string;
  avatarColor: string;
  badge?: string;
  description?: string;
}

export interface ScenarioConfig {
  id: string;
  name: string;
  title: string;
  severity: Severity;
  affectedServices: string[];
  personas: PersonaDefinition[];
  channelName: string;
  costRate: number;
  description?: string;
  impact?: string;
  suspectedCause?: string;
}

// ─── Preset Scenarios ───

export const PRESET_SCENARIOS: ScenarioConfig[] = [
  {
    id: 'payment-outage',
    name: 'Payment Gateway Outage',
    title: 'Payment Gateway Degradation & Checkout Outage',
    severity: 'SEV-1',
    affectedServices: ['payment-api', 'checkout-service', 'postgres-primary'],
    personas: [
      {
        uid: 'sarah_ic',
        displayName: 'Sarah',
        role: 'Incident Commander',
        avatarColor: 'var(--color-conflict)',
        badge: 'MISSION COMMAND',
        description: 'Leads war room triage, arbitrates contradictions, issues mitigation & rollback directives.',
      },
      {
        uid: 'marcus_sre',
        displayName: 'Marcus',
        role: 'Senior SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'INFRASTRUCTURE',
        description: 'Investigates database pool exhaustion, verifies replica lag, executes canary deployment.',
      },
      {
        uid: 'priya_pm',
        displayName: 'Priya',
        role: 'Product Manager',
        avatarColor: 'var(--color-decision)',
        badge: 'PRODUCT IMPACT',
        description: 'Quantifies revenue loss, monitors user checkout failures, drafts executive stakeholder updates.',
      },
    ],
    channelName: 'incident-sev1-checkout',
    costRate: 150,
    description: 'SEV-1 checkout outage affecting payment processing. Error rate at 42%, database connection pool suspected.',
    impact: 'Error rates surged to 42% on payment services. Checkout flow frozen for ~1,420 checkout sessions.',
    suspectedCause: 'PR #492 deployed 15m ago. Stripe webhook v2 migration causing connection pool starvation.',
  },
  {
    id: 'cdn-degradation',
    name: 'CDN & Static Assets Degradation',
    title: 'CDN Cache Invalidation Storm — Global Latency Spike',
    severity: 'SEV-2',
    affectedServices: ['cdn-edge', 'static-assets', 'image-service'],
    personas: [
      {
        uid: 'alex_ic',
        displayName: 'Alex',
        role: 'Incident Commander',
        avatarColor: 'var(--color-conflict)',
        badge: 'MISSION COMMAND',
        description: 'Leads CDN incident response and coordinates with edge provider.',
      },
      {
        uid: 'jordan_sre',
        displayName: 'Jordan',
        role: 'Platform SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'PLATFORM',
        description: 'Investigates cache hit ratios, origin shield health, and edge node status.',
      },
      {
        uid: 'sam_fe',
        displayName: 'Sam',
        role: 'Frontend Lead',
        avatarColor: 'var(--color-decision)',
        badge: 'FRONTEND',
        description: 'Monitors Core Web Vitals impact and user experience degradation.',
      },
    ],
    channelName: 'incident-sev2-cdn',
    costRate: 75,
    description: 'CDN cache invalidation storm causing global latency spikes. Static assets loading 10x slower than baseline.',
    impact: 'p95 page load time at 12.4s (baseline 1.2s). Image service returning 503s across APAC and EU regions.',
    suspectedCause: 'Automated cache purge job triggered a full invalidation instead of selective purge after deploy #1847.',
  },
  {
    id: 'auth-breach',
    name: 'Authentication Service Compromise',
    title: 'Authentication Service Compromise — Suspicious Token Generation',
    severity: 'SEV-0',
    affectedServices: ['auth-service', 'token-service', 'user-api', 'audit-log'],
    personas: [
      {
        uid: 'dana_ciso',
        displayName: 'Dana',
        role: 'Security Incident Commander',
        avatarColor: 'var(--color-conflict)',
        badge: 'SECURITY LEAD',
        description: 'Leads security incident response, coordinates forensics and containment.',
      },
      {
        uid: 'chris_sec',
        displayName: 'Chris',
        role: 'Security Engineer',
        avatarColor: 'var(--color-fact)',
        badge: 'FORENSICS',
        description: 'Analyzes authentication logs, traces token generation anomalies.',
      },
      {
        uid: 'pat_dev',
        displayName: 'Pat',
        role: 'Auth Service Owner',
        avatarColor: 'var(--color-decision)',
        badge: 'SERVICE OWNER',
        description: 'Reviews auth service code changes, validates token signing integrity.',
      },
    ],
    channelName: 'incident-sev0-auth',
    costRate: 500,
    description: 'SEV-0 security incident. Suspicious token generation patterns detected. Potential credential compromise.',
    impact: 'Anomalous JWT tokens detected with elevated privileges. 847 suspicious sessions in the last 30 minutes.',
    suspectedCause: 'Token signing key rotation failed silently, allowing stale keys to generate valid tokens with admin scope.',
  },
  {
    id: 'k8s-cascade',
    name: 'Kubernetes Cascade Failure',
    title: 'Kubernetes Node Pool Exhaustion — Pod Eviction Cascade',
    severity: 'SEV-1',
    affectedServices: ['k8s-control-plane', 'api-gateway', 'worker-pool', 'hpa-controller'],
    personas: [
      {
        uid: 'nina_ic',
        displayName: 'Nina',
        role: 'Platform Lead / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'PLATFORM LEAD',
        description: 'Coordinates platform response, manages node scaling decisions and rollback authority.',
      },
      {
        uid: 'ravi_sre',
        displayName: 'Ravi',
        role: 'Kubernetes SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'K8S OPS',
        description: 'Inspects node resource utilization, pod scheduling, and HPA behavior.',
      },
      {
        uid: 'lisa_be',
        displayName: 'Lisa',
        role: 'Backend Engineer',
        avatarColor: 'var(--color-decision)',
        badge: 'APPLICATION',
        description: 'Analyzes application memory leaks and OOM kill patterns.',
      },
    ],
    channelName: 'incident-sev1-k8s',
    costRate: 200,
    description: 'Node pool at 98% capacity. HPA scaling maxed out. Pod evictions cascading across critical services.',
    impact: 'API gateway dropping 30% of requests. Worker pods being evicted every 45 seconds across 3 node pools.',
    suspectedCause: 'Memory leak in v3.2.1 of the recommendation service causing OOM kills that trigger cascading pod evictions.',
  },
];

// ─── Avatar Color Palette ───

const AVATAR_COLORS = [
  'var(--color-conflict)',
  'var(--color-fact)',
  'var(--color-decision)',
  'var(--color-hypothesis)',
  'var(--color-aura)',
  '#E87D3E',
  '#9B59B6',
  '#1ABC9C',
];

export function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// ─── Helpers ───

export function generateChannelName(title: string): string {
  return 'incident-' + title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

export function generatePersonaUid(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substring(2, 5);
}

/**
 * Creates a fresh IncidentState from a ScenarioConfig.
 * Used to initialize the client-side state when entering the dashboard.
 */
export function createIncidentStateFromScenario(config: ScenarioConfig): IncidentState {
  const now = Date.now();
  const participants: Record<string, {
    uid: string;
    displayName: string;
    role: string;
    isIncidentCommander: boolean;
    joinedAt: number;
    totalSpeakingMs: number;
    lastSpokeAt: number;
  }> = {};

  let icUid: string | null = null;

  config.personas.forEach((p) => {
    const isIC = p.role.toLowerCase().includes('commander') || p.role.toLowerCase().includes('lead');
    participants[p.uid] = {
      uid: p.uid,
      displayName: p.displayName,
      role: p.role,
      isIncidentCommander: isIC,
      joinedAt: now,
      totalSpeakingMs: 0,
      lastSpokeAt: now,
    };
    if (isIC && !icUid) {
      icUid = p.uid;
    }
  });

  // Always include AURA agent
  participants['aura_agent'] = {
    uid: 'aura_agent',
    displayName: 'AURA',
    role: 'AI Incident Commander',
    isIncidentCommander: false,
    joinedAt: now,
    totalSpeakingMs: 0,
    lastSpokeAt: now,
  };

  return {
    incidentId: `inc-${config.channelName.replace(/[^a-zA-Z0-9-]/g, '-')}`,
    title: config.title,
    severity: config.severity,
    status: 'investigating',
    openedAt: now,
    affectedServices: [...config.affectedServices],
    participants,
    incidentCommanderUid: icUid,
    evidenceItems: [],
    eventSeq: 0,
    currentOODAPhase: 'OBSERVE',
    costAccrued: 0,
    cognitiveLoadScore: 0,
    lastReadbackAt: 0,
  };
}

// ─── SessionStorage Key ───

export const SCENARIO_STORAGE_KEY = 'aura-scenario-config';

/**
 * Stores the active scenario config in sessionStorage for cross-page access.
 */
export function storeScenarioConfig(config: ScenarioConfig): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // quota exceeded or private browsing
  }
}

/**
 * Retrieves the active scenario config from sessionStorage.
 */
export function loadScenarioConfig(): ScenarioConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScenarioConfig;
  } catch {
    return null;
  }
}
