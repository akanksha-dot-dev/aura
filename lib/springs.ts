export const springs = {
  conflict: { stiffness: 400, damping: 25, mass: 0.8 },
  card: { stiffness: 260, damping: 30, mass: 1.0 },
  disprove: { stiffness: 180, damping: 40, mass: 1.5 },
  resolve: { stiffness: 120, damping: 20, mass: 0.6 },
  stiff: { stiffness: 380, damping: 28, mass: 0.75 },
} as const;
