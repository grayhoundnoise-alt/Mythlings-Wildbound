/**
 * Mutations are cosmetic AND a small flat bonus to every stat:
 * Shiny +1, Darkness +2 — and a Mythling can carry BOTH at once.
 *
 * "Shiny Darkness" is a real, single mutation id (`shiny_dark`) rather than an
 * array, so every existing consumer — chips, filters, the Index, the renderer,
 * saves — keeps working unchanged. Use `combineMutations()` whenever something
 * applies a mutation on top of one a Mythling already has (Shiny Ball on a wild
 * Darkness, Dark Ball on a wild Shiny, ...), and `hasMutation()` to ask whether
 * a given Mythling shimmers, is shrouded, or both.
 */
export const MUTATIONS = {
  none: {
    id: 'none', name: 'Normal', icon: null, color: '#cfd8e3',
    chance: 1, // remainder
    parts: [],
    palette: null,
    aura: null,
  },
  shiny: {
    id: 'shiny', name: 'Shiny', icon: 'shiny', color: '#ffe680',
    chance: 0.035,
    statBonus: 1,
    parts: ['shiny'],
    palette: { hueShift: 40, saturate: 1.25, lighten: 1.12 },
    aura: { color: 'rgba(255,240,150,0.85)', particles: 'sparkle' },
  },
  darkness: {
    id: 'darkness', name: 'Darkness', icon: 'darkness', color: '#b07cff',
    chance: 0.02,
    statBonus: 2,
    parts: ['darkness'],
    palette: { hueShift: -25, saturate: 0.55, lighten: 0.48 },
    aura: { color: 'rgba(150,90,255,0.8)', particles: 'shadow' },
  },
  /**
   * BOTH at once: a shadow-drenched coat that still catches the light. Rolled
   * naturally at shiny x darkness odds (about 1 in 1,400) or created by catching
   * a Shiny with a Dark Ball (or a Darkness with a Shiny Ball).
   */
  shiny_dark: {
    id: 'shiny_dark', name: 'Shiny Darkness', icon: 'shiny', color: '#e0a8ff',
    chance: 0, // never rolled directly — see rollMutation()
    statBonus: 3, // 1 + 2: it carries both bonuses
    parts: ['shiny', 'darkness'],
    palette: { hueShift: 26, saturate: 1.2, lighten: 0.58 },
    aura: { color: 'rgba(214,150,255,0.88)', particles: 'sparkle' },
  },
};

export const MUTATION_IDS = Object.keys(MUTATIONS);

export function getMutation(id) {
  return MUTATIONS[id] || MUTATIONS.none;
}

/** The individual mutations an id carries: 'shiny_dark' -> ['shiny','darkness']. */
export function mutationParts(id) {
  return getMutation(id).parts || [];
}

/** Does this mutation id include `part` ('shiny' | 'darkness')? */
export function hasMutation(id, part) {
  return mutationParts(id).includes(part);
}

/** Merge two mutation ids into the one that carries every part of both. */
export function combineMutations(a, b) {
  const parts = new Set([...mutationParts(a), ...mutationParts(b)]);
  if (parts.has('shiny') && parts.has('darkness')) return 'shiny_dark';
  if (parts.has('shiny')) return 'shiny';
  if (parts.has('darkness')) return 'darkness';
  return 'none';
}

/**
 * Roll a wild Mythling's mutation. Shiny and Darkness are rolled INDEPENDENTLY,
 * so a Mythling can come out of the grass carrying both.
 */
export function rollMutation(rng, bonusMultiplier = 1) {
  const shiny = rng() < MUTATIONS.shiny.chance * bonusMultiplier;
  const dark = rng() < MUTATIONS.darkness.chance * bonusMultiplier;
  if (shiny && dark) return 'shiny_dark';
  if (dark) return 'darkness';
  if (shiny) return 'shiny';
  return 'none';
}
