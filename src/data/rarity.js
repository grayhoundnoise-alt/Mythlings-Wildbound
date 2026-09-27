// Rarity is stored independently from species. It only scales the Mood bonus magnitude.
export const RARITIES = {
  D:     { id: 'D',     name: 'D',     magnitude: 0,  color: '#9aa7b4', weight: 1000, catchMod: 1.00 },
  C:     { id: 'C',     name: 'C',     magnitude: 1,  color: '#79c46b', weight: 420,  catchMod: 0.96 },
  B:     { id: 'B',     name: 'B',     magnitude: 2,  color: '#58b6e8', weight: 170,  catchMod: 0.92 },
  A:     { id: 'A',     name: 'A',     magnitude: 3,  color: '#a97ce8', weight: 60,   catchMod: 0.86 },
  S:     { id: 'S',     name: 'S',     magnitude: 5,  color: '#f2c14e', weight: 18,   catchMod: 0.78 },
  SSS:   { id: 'SSS',   name: 'SSS',   magnitude: 10, color: '#ff7a3d', weight: 4,    catchMod: 0.68 },
  'SSS+':{ id: 'SSS+',  name: 'SSS+',  magnitude: 15, color: '#ff4d6d', weight: 1,    catchMod: 0.58 },
};

export const RARITY_ORDER = ['D', 'C', 'B', 'A', 'S', 'SSS', 'SSS+'];

export function getRarity(id) {
  return RARITIES[id] || RARITIES.D;
}

export function rarityMagnitude(id) {
  return getRarity(id).magnitude;
}

/** Weighted roll for a wild Mythling's rarity. `luck` gently shifts toward rarer tiers. */
export function rollRarity(rng, luck = 0) {
  const entries = RARITY_ORDER.map((id) => {
    const r = RARITIES[id];
    const bonus = 1 + luck * (r.magnitude / 5);
    return [id, r.weight * bonus];
  });
  const total = entries.reduce((s, e) => s + e[1], 0);
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return 'D';
}
