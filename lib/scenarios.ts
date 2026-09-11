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
    costRate: 2,
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
    costRate: 1,
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
    costRate: 3,
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
    costRate: 2,
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
  {
    id: 'ml-pipeline-failure',
    name: 'ML Training Pipeline Failure',
    title: 'ML GPU Cluster Timeout — Training Pipeline Deadlock',
    severity: 'SEV-1',
    affectedServices: ['gpu-cluster', 'ml-pipeline', 'model-registry', 'feature-store'],
    personas: [
      {
        uid: 'zoe_mle',
        displayName: 'Zoe',
        role: 'ML Platform Lead / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'ML PLATFORM',
        description: 'Leads ML infrastructure response, owns GPU resource allocation and pipeline SLOs.',
      },
      {
        uid: 'ben_mlops',
        displayName: 'Ben',
        role: 'MLOps Engineer',
        avatarColor: 'var(--color-fact)',
        badge: 'MLOPS',
        description: 'Investigates distributed training job failures, NCCL timeouts, and checkpoint recovery.',
      },
      {
        uid: 'yuna_ds',
        displayName: 'Yuna',
        role: 'Senior Data Scientist',
        avatarColor: 'var(--color-hypothesis)',
        badge: 'DATA SCIENCE',
        description: 'Assesses impact on model freshness, fallback model performance, and business SLAs.',
      },
    ],
    channelName: 'incident-sev1-ml-pipeline',
    costRate: 2,
    description: 'GPU training cluster deadlocked. 24-hour model training job frozen at 67% completion. NCCL all-reduce timeout cascading.',
    impact: '3 critical production models are stale. Recommendation quality degraded. A/B experiment results blocked for 6 hours.',
    suspectedCause: 'A single GPU node in the training ring experienced hardware ECC memory errors, causing NCCL collective operation to stall indefinitely.',
    playbook: [
      { id: 'ml-1', phase: 'diagnose', priority: 'critical', title: 'Identify the stalled GPU node', detail: 'Check NCCL timeout logs to find which rank caused the deadlock. Check GPU health via nvidia-smi.', command: 'kubectl logs -n ml-jobs job/train-llm-v2 | grep "NCCL timeout"' },
      { id: 'ml-2', phase: 'diagnose', priority: 'critical', title: 'Check GPU hardware errors', detail: 'Run nvidia-smi on suspected node to check ECC errors and GPU utilization drop.', command: 'kubectl exec -it gpu-node-07 -- nvidia-smi --query-gpu=ecc.errors.uncorrected.aggregate.total --format=csv' },
      { id: 'ml-3', phase: 'diagnose', priority: 'high', title: 'Verify last good checkpoint', detail: 'Find most recent valid checkpoint for the training job to assess recovery point.', command: 'gsutil ls -l gs://ml-checkpoints/llm-v2/ | sort -k2 | tail -5' },
      { id: 'ml-4', phase: 'mitigate', priority: 'critical', title: 'Cordon and drain faulty GPU node', detail: 'Prevent faulty GPU node from being scheduled. Evict all pods and replace it in the training ring.', command: 'kubectl cordon gpu-node-07 && kubectl drain gpu-node-07 --ignore-daemonsets' },
      { id: 'ml-5', phase: 'mitigate', priority: 'critical', title: 'Resume training from last checkpoint', detail: 'Restart training job with --resume-from-checkpoint flag pointing to last valid state.', command: 'kubectl apply -f training-job-resume.yaml --overwrite' },
      { id: 'ml-6', phase: 'mitigate', priority: 'high', title: 'Promote previous stable model to production', detail: 'While training resumes, promote v1.8.3 model to production to unblock recommendations.', command: 'mlflow models set-tag llm-v2 stage Production --version 18' },
      { id: 'ml-7', phase: 'resolve', priority: 'medium', title: 'Confirm training job completion', detail: 'Monitor training progress. Resolve when new model version is trained and validated with >95% A/B parity.' },
    ],
  },
  {
    id: 'db-replication-lag',
    name: 'Database Replication Lag',
    title: 'MySQL Replica Sync Failure — Read Replica Staleness Critical',
    severity: 'SEV-2',
    affectedServices: ['mysql-primary', 'mysql-replica-eu', 'mysql-replica-apac', 'api-read-layer'],
    personas: [
      {
        uid: 'omar_dba',
        displayName: 'Omar',
        role: 'Database Administrator / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'DBA LEAD',
        description: 'Leads database incident response, owns replication topology and failover procedures.',
      },
      {
        uid: 'fen_sre',
        displayName: 'Fen',
        role: 'Platform SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'PLATFORM',
        description: 'Investigates network throughput between primary and replicas, I/O wait patterns.',
      },
      {
        uid: 'jade_be',
        displayName: 'Jade',
        role: 'Backend Engineer',
        avatarColor: 'var(--color-decision)',
        badge: 'APPLICATION',
        description: 'Traces stale read issues in application layer, identifies impacted user flows.',
      },
    ],
    channelName: 'incident-sev2-db-replication',
    costRate: 1,
    description: 'MySQL replicas in EU and APAC regions are 45+ minutes behind primary. Read queries returning stale data to users.',
    impact: 'User profile data up to 45 minutes stale in EU/APAC. Session invalidation errors affecting 12% of logins in affected regions.',
    suspectedCause: 'Large batch migration job on primary wrote 180GB in 30 minutes, overwhelming replica I/O bandwidth and causing binlog apply lag.',
    playbook: [
      { id: 'db-1', phase: 'diagnose', priority: 'critical', title: 'Check replica lag metrics', detail: 'Verify Seconds_Behind_Master on all replicas and identify which replica is furthest behind.', command: 'mysql -h replica-eu-01 -e "SHOW SLAVE STATUS\\G" | grep Seconds_Behind_Master' },
      { id: 'db-2', phase: 'diagnose', priority: 'high', title: 'Identify the large write operation', detail: 'Check binlog position and identify the large transaction causing the lag spike.', command: 'mysqlbinlog --start-datetime="2024-01-15 10:00:00" mysql-bin.000042 | grep -i "migration" | head -20' },
      { id: 'db-3', phase: 'mitigate', priority: 'critical', title: 'Throttle the migration job', detail: 'If migration is still running, add sleep intervals to reduce write pressure on primary.', command: 'pt-online-schema-change --max-lag=10 --sleep=0.5 --throttle-control-replicas=replica-eu-01' },
      { id: 'db-4', phase: 'mitigate', priority: 'high', title: 'Route EU/APAC reads to primary temporarily', detail: 'Override read routing to force stale-sensitive queries to primary while replicas catch up.', command: 'redis-cli SET db_read_route_override primary EX 3600' },
      { id: 'db-5', phase: 'communicate', priority: 'medium', title: 'Notify affected region teams', detail: 'Alert EU and APAC on-call teams about read staleness. Provide ETA for replica catch-up.' },
      { id: 'db-6', phase: 'resolve', priority: 'medium', title: 'Confirm replicas caught up', detail: 'Monitor Seconds_Behind_Master. Resolve when all replicas show < 5 seconds lag for 10 consecutive minutes.' },
    ],
  },
  {
    id: 'api-rate-limit-storm',
    name: 'API Rate Limit Storm',
    title: 'Third-Party API Rate Limit Exhaustion — Cascading Service Degradation',
    severity: 'SEV-2',
    affectedServices: ['notification-service', 'email-provider-api', 'sms-gateway', 'user-comms-service'],
    personas: [
      {
        uid: 'carlos_ic',
        displayName: 'Carlos',
        role: 'Engineering Manager / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'ENG MANAGER',
        description: 'Coordinates cross-team response and external vendor escalation for API contract violations.',
      },
      {
        uid: 'aisha_be',
        displayName: 'Aisha',
        role: 'Backend Engineer',
        avatarColor: 'var(--color-fact)',
        badge: 'BACKEND',
        description: 'Investigates notification queue depth, retry storm patterns, and circuit breaker state.',
      },
      {
        uid: 'tom_pm',
        displayName: 'Tom',
        role: 'Product Manager',
        avatarColor: 'var(--color-decision)',
        badge: 'PRODUCT',
        description: 'Prioritizes which notification types to preserve under rate limits, coordinates user comms.',
      },
    ],
    channelName: 'incident-sev2-rate-limit',
    costRate: 1,
    description: 'SendGrid and Twilio rate limits exhausted. 180,000 queued notifications failing with 429 errors. Retry storms amplifying the issue.',
    impact: 'Password reset, 2FA, and order confirmation emails/SMS are failing. 45,000 users unable to complete auth flows. Queue growing at 8,000/min.',
    suspectedCause: 'Marketing campaign email blast triggered at peak time without rate limit awareness, consuming entire monthly allowance in 20 minutes.',
    playbook: [
      { id: 'rl-1', phase: 'diagnose', priority: 'critical', title: 'Check current rate limit headroom', detail: 'Query SendGrid and Twilio APIs for current usage vs. plan limits. Calculate time to reset.', command: 'curl -H "Authorization: Bearer $SENDGRID_KEY" https://api.sendgrid.com/v3/user/credits' },
      { id: 'rl-2', phase: 'diagnose', priority: 'critical', title: 'Pause retry storms immediately', detail: 'Exponential backoff is compounding the 429s. Disable auto-retry in notification service now.', command: 'kubectl set env deployment/notification-service RETRY_ENABLED=false' },
      { id: 'rl-3', phase: 'mitigate', priority: 'critical', title: 'Halt non-critical notification batch jobs', detail: 'Stop marketing campaign job consuming the rate limit. Preserve transactional notifications.', command: 'kubectl delete job marketing-email-blast-20240115' },
      { id: 'rl-4', phase: 'mitigate', priority: 'high', title: 'Enable fallback provider routing', detail: 'Route transactional notifications through backup provider (Mailgun/Vonage) while primary limits reset.', command: 'kubectl set env deployment/notification-service EMAIL_PROVIDER=mailgun SMS_PROVIDER=vonage' },
      { id: 'rl-5', phase: 'mitigate', priority: 'high', title: 'Implement priority queue for auth notifications', detail: 'Configure notification service to process 2FA and password reset with highest priority from queue.' },
      { id: 'rl-6', phase: 'communicate', priority: 'medium', title: 'Status page update and user outreach', detail: 'Post incident update. Alert customer success about impacted users needing manual auth assistance.' },
      { id: 'rl-7', phase: 'resolve', priority: 'medium', title: 'Confirm notification queue cleared', detail: 'Monitor queue depth and 4xx rate. Resolve when queue < 1000 and error rate < 1%.' },
    ],
  },
  {
    id: 'dns-propagation-failure',
    name: 'DNS Propagation Failure',
    title: 'Multi-Region DNS Inconsistency — Split-Brain Traffic Routing',
    severity: 'SEV-1',
    affectedServices: ['dns-primary', 'dns-secondary', 'load-balancer', 'ssl-terminator', 'healthcheck-service'],
    personas: [
      {
        uid: 'maya_netops',
        displayName: 'Maya',
        role: 'Network Operations Lead / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'NETOPS LEAD',
        description: 'Owns global DNS architecture, coordinates with registrar and CDN provider for emergency TTL changes.',
      },
      {
        uid: 'ki_sre',
        displayName: 'Ki',
        role: 'Infrastructure SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'INFRASTRUCTURE',
        description: 'Traces DNS propagation state, analyzes resolver behavior across regions and ISPs.',
      },
      {
        uid: 'river_fe',
        displayName: 'River',
        role: 'Frontend Engineer',
        avatarColor: 'var(--color-decision)',
        badge: 'FRONTEND',
        description: 'Monitors user-facing connectivity errors, CORS failures, and cert validation issues from DNS split.',
      },
    ],
    channelName: 'incident-sev1-dns',
    costRate: 2,
    description: 'DNS zone update propagation stalled. 40% of global resolvers still pointing to deprecated IP. Split-brain routing causing intermittent failures.',
    impact: 'Users in APAC and South America experiencing 503 errors on ~40% of page loads. SSL cert mismatch errors on deprecated IP endpoint.',
    suspectedCause: 'DNS TTL was 86400s (24 hours) when the zone migration was executed. Resolvers caching old A record are now routing to decommissioned infrastructure.',
    playbook: [
      { id: 'dns-1', phase: 'diagnose', priority: 'critical', title: 'Map propagation status globally', detail: 'Use dnschecker.org and whatsmydns.net to identify which regions are still on old IP vs. new IP.', command: 'dig @8.8.8.8 api.example.com +short && dig @1.1.1.1 api.example.com +short' },
      { id: 'dns-2', phase: 'diagnose', priority: 'critical', title: 'Confirm old infrastructure status', detail: 'Check if old IP endpoint is still reachable. If decommissioned, users on old DNS are fully broken.', command: 'curl -v --connect-to api.example.com:443:OLD_IP:443 https://api.example.com/health' },
      { id: 'dns-3', phase: 'mitigate', priority: 'critical', title: 'Restore service on old IP endpoint', detail: 'If old infrastructure is accessible, restore it to serve traffic while DNS propagates. Do not decommission yet.', command: 'aws ec2 start-instances --instance-ids i-OLDINSTANCE' },
      { id: 'dns-4', phase: 'mitigate', priority: 'high', title: 'Emergency TTL reduction', detail: 'Reduce TTL to 60 seconds in DNS zone to accelerate propagation for remaining stale resolvers.', command: 'aws route53 change-resource-record-sets --hosted-zone-id ZONEID --change-batch file://ttl-reduce.json' },
      { id: 'dns-5', phase: 'mitigate', priority: 'high', title: 'Configure anycast routing as failsafe', detail: 'Enable anycast on new IP to absorb traffic from any region regardless of DNS resolution path.' },
      { id: 'dns-6', phase: 'communicate', priority: 'high', title: 'Notify status page and customer success', detail: 'Post incident update with affected regions and ETA. Recommend VPN as temporary workaround for APAC users.' },
      { id: 'dns-7', phase: 'resolve', priority: 'medium', title: 'Confirm full propagation globally', detail: 'Monitor with dnschecker.org. Resolve when 100% of test resolvers worldwide return new IP for 30 minutes.' },
    ],
  },
  {
    id: 'circuit-breaker-storm',
    name: 'Microservice Circuit Breaker Storm',
    title: 'Service Mesh Circuit Breaker Cascade — Cross-Service Failure Amplification',
    severity: 'SEV-0',
    affectedServices: ['service-mesh', 'order-service', 'inventory-service', 'pricing-service', 'cart-service', 'istio-control-plane'],
    personas: [
      {
        uid: 'felix_ic',
        displayName: 'Felix',
        role: 'Principal SRE / IC',
        avatarColor: 'var(--color-conflict)',
        badge: 'PRINCIPAL SRE',
        description: 'Owns service mesh architecture, coordinates distributed systems recovery across all service owners.',
      },
      {
        uid: 'amara_sre',
        displayName: 'Amara',
        role: 'Platform SRE',
        avatarColor: 'var(--color-fact)',
        badge: 'PLATFORM SRE',
        description: 'Investigates Istio circuit breaker states, Envoy sidecar behavior, and retry amplification patterns.',
      },
      {
        uid: 'leo_be',
        displayName: 'Leo',
        role: 'Senior Backend Engineer',
        avatarColor: 'var(--color-decision)',
        badge: 'BACKEND',
        description: 'Traces request flow through service graph, identifies origin failure and blast radius.',
      },
    ],
    channelName: 'incident-sev0-circuit-breaker',
    costRate: 3,
    description: 'SEV-0: Istio circuit breakers open across 6 critical microservices. Retry storms from upstream services amplifying load 8x. Full checkout unavailable.',
    impact: '100% of checkout requests failing. $42,000/minute revenue loss. 8 microservices in open-circuit state. Retry amplification causing 8x normal load.',
    suspectedCause: 'pricing-service latency spike (P99 > 30s) caused upstream services to exhaust circuit breaker thresholds simultaneously, triggering cascade.',
    playbook: [
      { id: 'cb-1', phase: 'diagnose', priority: 'critical', title: 'IMMEDIATE: Stop all retry amplification', detail: 'Disable retries globally in Istio VirtualServices to stop 8x traffic amplification NOW. This is the top priority.', command: 'kubectl patch virtualservice checkout-vs --patch \'{"spec":{"http":[{"retries":{"attempts":0}}]}}\'' },
      { id: 'cb-2', phase: 'diagnose', priority: 'critical', title: 'Identify origin failure service', detail: 'Check which service first showed elevated latency using Jaeger distributed traces. pricing-service is suspected.', command: 'kubectl exec -it istio-pilot -- pilot-discovery request GET /debug/syncz | jq .pricing' },
      { id: 'cb-3', phase: 'diagnose', priority: 'high', title: 'Map open circuit breakers', detail: 'Query Envoy admin API on each sidecar to see which upstream clusters are in open-circuit state.', command: 'kubectl exec -it pricing-service-pod -c istio-proxy -- curl localhost:15000/clusters | grep "cx_open"' },
      { id: 'cb-4', phase: 'mitigate', priority: 'critical', title: 'Restart pricing-service with resource limits', detail: 'Rolling restart pricing-service with reduced concurrency to break the latency spike at the origin.', command: 'kubectl rollout restart deployment/pricing-service && kubectl patch deployment pricing-service --patch \'{"spec":{"template":{"spec":{"containers":[{"name":"pricing","resources":{"limits":{"cpu":"500m"}}}]}}}}\'' },
      { id: 'cb-5', phase: 'mitigate', priority: 'critical', title: 'Reset Envoy circuit breaker state', detail: 'Force circuit breaker reset on all affected services after pricing-service recovery is confirmed.', command: 'for svc in order cart inventory; do kubectl exec -it ${svc}-pod -c istio-proxy -- curl -X POST localhost:15000/reset_counters; done' },
      { id: 'cb-6', phase: 'mitigate', priority: 'high', title: 'Enable load shedding on API gateway', detail: 'Configure gateway-level load shedding to 50% capacity while services stabilize. Drop non-critical requests.', command: 'kubectl set env deployment/api-gateway LOAD_SHEDDING_ENABLED=true LOAD_SHEDDING_RATIO=0.5' },
      { id: 'cb-7', phase: 'communicate', priority: 'high', title: 'Incident bridge and executive notification', detail: 'SEV-0 protocol: notify CTO, customer success VP, and open Slack incident bridge immediately.' },
      { id: 'cb-8', phase: 'resolve', priority: 'high', title: 'Confirm all circuit breakers closed', detail: 'Monitor circuit breaker states across all services. Resolve when all are closed and error rate < 0.1% for 10 minutes.' },
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
