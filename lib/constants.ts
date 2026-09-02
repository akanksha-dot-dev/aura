export interface PersonaConfig {
  uid: string;
  displayName: string;
  role: string;
  avatarColor: string;
}

export const PERSONAS: PersonaConfig[] = [
  { uid: 'sarah_oncall', displayName: 'Sarah', role: 'Incident Commander', avatarColor: '#E85454' },
  { uid: 'marcus_devops', displayName: 'Marcus', role: 'Senior SRE', avatarColor: '#3BD4A2' },
  { uid: 'priya_lead', displayName: 'Priya', role: 'Product Manager', avatarColor: '#7B8CFF' },
];

export const AGENT_UID = 'aura_agent';
export const COST_RATE_PER_SECOND = 150; // $9,000/min
export const CONFIDENCE_CAP = 85;
export const CHANNEL_PREFIX = 'incident-';
