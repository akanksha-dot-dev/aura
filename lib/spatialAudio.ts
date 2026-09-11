/**
 * 3D Spatial Audio & Soundstage Positioning for Multi-Participant IT War Rooms.
 * Maps participants onto a virtual circular mission control conference table
 * to reduce cognitive fatigue, improve voice clarity, and enhance speaker separation.
 */

export interface SpatialPosition {
  azimuth: number;   // Degrees: -90 (full left) to +90 (full right)
  pan: number;       // Stereo pan: -1.0 to +1.0
  elevation: number; // Degrees: -90 to +90
  distance: number;  // Radial distance (meters)
  label: string;
}

/**
 * Resolves spatial soundstage orientation for any participant by UID or role.
 */
export function getPersonaSoundstagePosition(uid: string, role?: string): SpatialPosition {
  const cleanUid = (uid || '').toLowerCase();
  const cleanRole = (role || '').toLowerCase();

  // AURA AI Commander: Elevated Center (Directly front & overhead)
  if (cleanUid === 'aura_agent' || cleanUid.includes('aura')) {
    return { azimuth: 0, pan: 0, elevation: 20, distance: 1.2, label: 'Elevated Center' };
  }

  // Incident Commander: Center Stage (0 degrees)
  if (cleanRole.includes('commander') || cleanUid.includes('ic') || cleanUid.includes('sarah')) {
    return { azimuth: 0, pan: 0, elevation: 0, distance: 1.0, label: 'Center (0°)' };
  }

  // Infrastructure / SRE: Left Flank (-45 degrees)
  if (cleanRole.includes('sre') || cleanUid.includes('sre') || cleanUid.includes('marcus')) {
    return { azimuth: -45, pan: -0.5, elevation: 0, distance: 1.5, label: 'Left (-45°)' };
  }

  // API / Frontend Engineers: Right Flank (+45 degrees)
  if (cleanRole.includes('api') || cleanRole.includes('frontend') || cleanUid.includes('priya')) {
    return { azimuth: 45, pan: 0.5, elevation: 0, distance: 1.5, label: 'Right (+45°)' };
  }

  // Security / CISO: Far Left (-70 degrees)
  if (cleanRole.includes('security') || cleanRole.includes('ciso') || cleanUid.includes('dana')) {
    return { azimuth: -70, pan: -0.75, elevation: 0, distance: 1.8, label: 'Far Left (-70°)' };
  }

  // DevOps / Network: Far Right (+70 degrees)
  if (cleanRole.includes('devops') || cleanRole.includes('network') || cleanUid.includes('alex')) {
    return { azimuth: 70, pan: 0.75, elevation: 0, distance: 1.8, label: 'Far Right (+70°)' };
  }

  // Hash-based distributed fallback for ad-hoc participants
  let hash = 0;
  for (let i = 0; i < cleanUid.length; i++) {
    hash = (hash << 5) - hash + cleanUid.charCodeAt(i);
    hash |= 0;
  }
  const pan = Math.max(-0.8, Math.min(0.8, ((hash % 100) / 100)));
  const azimuth = Math.round(pan * 60);

  return {
    azimuth,
    pan,
    elevation: 0,
    distance: 1.5,
    label: `${azimuth >= 0 ? '+' : ''}${azimuth}°`,
  };
}
