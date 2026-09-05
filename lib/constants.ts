export interface PersonaConfig {
  uid: string;
  displayName: string;
  role: string;
  avatarColor: string;
}

export const PERSONAS: PersonaConfig[] = [
  { uid: 'sarah_ic', displayName: 'Sarah', role: 'Incident Commander', avatarColor: 'var(--color-conflict)' },
  { uid: 'marcus_sre', displayName: 'Marcus', role: 'Senior SRE', avatarColor: 'var(--color-fact)' },
  { uid: 'priya_pm', displayName: 'Priya', role: 'Product Manager', avatarColor: 'var(--color-decision)' },
];

export const AGENT_UID = 'aura_agent';
export const COST_RATE_PER_SECOND = 150; // $9,000/min
export const CONFIDENCE_CAP = 85;
export const CHANNEL_PREFIX = 'incident-';
