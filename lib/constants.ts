export interface PersonaConfig {
  uid: string;
  displayName: string;
  role: string;
  avatarColor: string;
}

export const PERSONAS: PersonaConfig[] = [
  { uid: 'sarah_oncall', displayName: 'Sarah', role: 'Incident Commander', avatarColor: 'var(--color-conflict)' },
  { uid: 'marcus_devops', displayName: 'Marcus', role: 'Senior SRE', avatarColor: 'var(--color-fact)' },
  { uid: 'priya_lead', displayName: 'Priya', role: 'Product Manager', avatarColor: 'var(--color-decision)' },
];

export const PERSONA_ALIASES: Record<string, string> = {
  sarah_ic: 'sarah_oncall',
  marcus_sre: 'marcus_devops',
  priya_pm: 'priya_lead',
};

export const AGENT_UID = 'aura_agent';
export const COST_RATE_PER_SECOND = 150; // $9,000/min
export const CONFIDENCE_CAP = 85;
export const CHANNEL_PREFIX = 'incident-';
