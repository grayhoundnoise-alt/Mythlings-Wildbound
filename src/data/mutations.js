// Mutations are (currently) purely cosmetic. Architecture supports more types later.
export const MUTATIONS = {
  none: {
    id: 'none', name: 'Normal', icon: null, color: '#cfd8e3',
    chance: 1, // remainder
    palette: null,
    aura: null,
  },
  shiny: {
    id: 'shiny', name: 'Shiny', icon: 'shiny', color: '#ffe680',
    chance: 0.035,
    palette: { hueShift: 40, saturate: 1.25, lighten: 1.12 },
    aura: { color: 'rgba(255,240,150,0.85)', particles: 'sparkle' },
  },
  darkness: {
    id: 'darkness', name: 'Darkness', icon: 'darkness', color: '#b07cff',
    chance: 0.02,
    palette: { hueShift: -25, saturate: 0.55, lighten: 0.48 },
    aura: { color: 'rgba(150,90,255,0.8)', particles: 'shadow' },
  },
};

export const MUTATION_IDS = Object.keys(MUTATIONS);

export function getMutation(id) {
  return MUTATIONS[id] || MUTATIONS.none;
}

export function rollMutation(rng, bonusMultiplier = 1) {
  const shiny = MUTATIONS.shiny.chance * bonusMultiplier;
  const dark = MUTATIONS.darkness.chance * bonusMultiplier;
  const r = rng();
  if (r < dark) return 'darkness';
  if (r < dark + shiny) return 'shiny';
  return 'none';
}
