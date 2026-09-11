import { Severity } from './types';

/**
 * Baseline financial burn rates per minute based on SRE industry standards:
 * SEV-0: Core revenue/auth outage ($2,500/min)
 * SEV-1: Critical customer-facing degradation ($500/min)
 * SEV-2: Internal or degraded redundancy ($150/min)
 * SEV-3: Minor operational friction ($50/min)
 */
export const BASE_SEVERITY_BURN_RATES: Record<Severity, number> = {
  'SEV-0': 2500,
  'SEV-1': 500,
  'SEV-2': 150,
  'SEV-3': 50,
};

const CRITICAL_SERVICE_KEYWORDS = [
  'payment',
  'checkout',
  'auth',
  'database',
  'postgres',
  'k8s',
  'redis',
  'stripe',
  'billing',
  'gateway',
];

/**
 * Computes real-time dynamic burn rate ($/min) weighted by severity and critical service blast radius.
 */
export function calculateDynamicBurnRate(
  severity: Severity,
  affectedServices: string[] = [],
  customRate?: number
): number {
  if (customRate && customRate > 0) return customRate;

  const base = BASE_SEVERITY_BURN_RATES[severity] ?? 150;
  const criticalCount = affectedServices.filter((svc) =>
    CRITICAL_SERVICE_KEYWORDS.some((kw) => svc.toLowerCase().includes(kw))
  ).length;

  // 15% blast radius multiplier per critical tier-1 service
  const blastRadiusMultiplier = 1 + Math.min(1.5, criticalCount * 0.15);
  return Math.round(base * blastRadiusMultiplier);
}
