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

export interface PlaybookStep {
  id: string;
  phase: 'diagnose' | 'mitigate' | 'resolve' | 'communicate';
  title: string;
  detail: string;
  command?: string;  // Shell / dashboard command hint
  priority: 'critical' | 'high' | 'medium';
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
  playbook?: PlaybookStep[];
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
    playbook: [
      { id: 'po-1', phase: 'diagnose', priority: 'critical', title: 'Check DB connection pool metrics', detail: 'Verify pool utilization and wait queue depth in Grafana → postgres-primary dashboard.', command: 'kubectl exec -it postgres-primary -- psql -c "SELECT count(*) FROM pg_stat_activity;"' },
      { id: 'po-2', phase: 'diagnose', priority: 'critical', title: 'Verify replica lag', detail: 'High replica lag means writes are backing up. Check replication status on all 3 replicas.', command: 'kubectl exec postgres-replica-0 -- psql -c "SELECT now() - pg_last_xact_replay_timestamp();"' },
      { id: 'po-3', phase: 'diagnose', priority: 'high', title: 'Trace Stripe webhook failures', detail: 'Correlate error spike with PR #492 deploy time. Check webhook event queue depth.', command: 'stripe events list --limit=50 | grep payment_intent.failed' },
      { id: 'po-4', phase: 'mitigate', priority: 'critical', title: 'Rollback PR #492', detail: 'Execute immediate rollback of Stripe webhook v2 migration to restore connection pool headroom.', command: 'git revert HEAD --no-edit && git push origin main' },
      { id: 'po-5', phase: 'mitigate', priority: 'high', title: 'Scale connection pool emergency limits', detail: 'Temporarily raise PgBouncer max_client_conn to shed load while rollback deploys.', command: 'kubectl set env deployment/pgbouncer MAX_CLIENT_CONN=500' },
      { id: 'po-6', phase: 'communicate', priority: 'high', title: 'Post Slack status update', detail: 'Notify #incidents and #customer-success with current impact scope and ETA.' },
      { id: 'po-7', phase: 'resolve', priority: 'medium', title: 'Confirm error rate recovery', detail: 'Monitor payment-api error rate for 5 min post-rollback. Resolve when < 1%.' },
    ],
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
    playbook: [
      { id: 'cdn-1', phase: 'diagnose', priority: 'critical', title: 'Check CDN cache hit ratio', detail: 'Open Fastly/Cloudflare dashboard and verify MISS rate across all edge POPs. Expected < 5%, current likely > 90%.', command: 'curl -sI https://cdn.example.com/static/app.js | grep x-cache' },
      { id: 'cdn-2', phase: 'diagnose', priority: 'high', title: 'Identify purge job trigger', detail: 'Check deploy #1847 CI logs for cache-busting steps. Find if purge was scoped correctly.', command: 'kubectl logs -n ci job/deploy-1847 | grep "cache purge"' },
      { id: 'cdn-3', phase: 'mitigate', priority: 'critical', title: 'Enable Stale-While-Revalidate', detail: 'Configure CDN to serve stale cached assets for 10 minutes while origin refills edge caches.', command: 'fastly surrogate-control --stale-while-revalidate=600' },
      { id: 'cdn-4', phase: 'mitigate', priority: 'high', title: 'Increase origin shield capacity', detail: 'Scale origin shield replicas to absorb refill traffic spike without overloading primary origin.' },
      { id: 'cdn-5', phase: 'communicate', priority: 'medium', title: 'Status page update', detail: 'Post to status page: Investigating increased page load times. Mitigation in progress.' },
      { id: 'cdn-6', phase: 'resolve', priority: 'medium', title: 'Verify p95 recovery', detail: 'Monitor p95 load time. Declare resolved when < 2s sustained for 10 minutes.' },
    ],
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
    playbook: [
      { id: 'auth-1', phase: 'diagnose', priority: 'critical', title: 'IMMEDIATE: Revoke all active admin tokens', detail: 'Do not wait for root cause. Revoke all sessions with admin scope as containment action NOW.', command: 'redis-cli FLUSHDB 0  # Clears all session store entries' },
      { id: 'auth-2', phase: 'diagnose', priority: 'critical', title: 'Audit stale signing keys', detail: 'Verify which JWT signing keys are active in the key vault. Identify keys that should have been rotated.', command: 'aws secretsmanager list-secret-version-ids --secret-id jwt-signing-key' },
      { id: 'auth-3', phase: 'diagnose', priority: 'high', title: 'Enumerate compromised accounts', detail: 'Query audit-log for all sessions created with the stale key in the last 2 hours.', command: 'SELECT user_id, created_at FROM sessions WHERE signing_key_id = old_key_id;' },
      { id: 'auth-4', phase: 'mitigate', priority: 'critical', title: 'Force-rotate signing keys', detail: 'Generate new RS256 key pair, update all services, and purge old key from vault immediately.', command: 'openssl genrsa -out jwt-private.pem 4096 && aws secretsmanager put-secret-value' },
      { id: 'auth-5', phase: 'communicate', priority: 'high', title: 'Notify security & legal', detail: 'Notify CISO, legal, and potentially affected users per breach protocol.' },
      { id: 'auth-6', phase: 'resolve', priority: 'high', title: 'Confirm anomalous token generation stopped', detail: 'Monitor auth-service logs for 15 min. Verify zero new tokens with stale key signatures.' },
    ],
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
    playbook: [
      { id: 'k8s-1', phase: 'diagnose', priority: 'critical', title: 'Identify top memory consumers', detail: 'Sort all pods by memory consumption. Find the recommendation-service pods leaking memory.', command: 'kubectl top pods -A --sort-by=memory | head -20' },
      { id: 'k8s-2', phase: 'diagnose', priority: 'critical', title: 'Check OOM kill events', detail: 'Verify OOMKilled pods in the last 30 minutes to confirm memory leak as root cause.', command: 'kubectl get events -A --field-selector=reason=OOMKilling --sort-by=.lastTimestamp' },
      { id: 'k8s-3', phase: 'mitigate', priority: 'critical', title: 'Scale down recommendation-service', detail: 'Temporarily reduce replicas to 0 to stop OOM cascade. Feature degrades gracefully.', command: 'kubectl scale deployment recommendation-service --replicas=0 -n production' },
      { id: 'k8s-4', phase: 'mitigate', priority: 'high', title: 'Emergency node pool scale-out', detail: 'Add 5 nodes to the primary pool to recover evicted critical pods immediately.', command: 'gcloud container clusters resize prod-cluster --num-nodes=15 --node-pool=default' },
      { id: 'k8s-5', phase: 'mitigate', priority: 'high', title: 'Rollback recommendation-service to v3.1.8', detail: 'Deploy previous stable version. Verify memory stabilizes within 3 minutes.', command: 'kubectl set image deployment/recommendation-service app=gcr.io/prod/recommendation:v3.1.8' },
      { id: 'k8s-6', phase: 'resolve', priority: 'medium', title: 'Verify node pool pressure resolved', detail: 'Monitor node resource utilization. Resolve when all pools are < 70% memory utilization.' },
    ],
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
