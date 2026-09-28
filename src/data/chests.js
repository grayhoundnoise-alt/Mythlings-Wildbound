// Treasure chests scattered through the wild areas of every map.
//
// Four tiers. A map can hold at most TWO Bronze chests and ONE of every other tier
// at a time; the Ultra Gold chest is nearly impossible to find. Every chest holds
// Wildcoins (more for higher tiers and later regions); rarer chests also hold a ball
// or a food — and the good balls / foods only ever come out of the good chests.
//
// Chests re-roll a while after they were last rolled for that map (see
// CHEST_REROLL_MS), so a cleared map fills up again later — never instantly.
export const CHEST_TIERS = {
  bronze: {
    id: 'bronze', name: 'Bronze Chest', max: 2, chance: 0.55,
    coins: [40, 120], itemChance: 0.22,
    balls: ['basic_ball', 'normal_ball'],
    foods: ['sweet_berry', 'crunchy_root', 'honey_nut'],
    colors: { body: '#a8683a', dark: '#5e381c', trim: '#e0a866', glow: null },
  },
  silver: {
    id: 'silver', name: 'Silver Chest', max: 1, chance: 0.22,
    coins: [180, 420], itemChance: 0.45,
    balls: ['normal_ball', 'advanced_ball'],
    foods: ['moon_melon', 'river_jerky', 'glow_nectar'],
    colors: { body: '#a9b2c0', dark: '#55606f', trim: '#eef2f7', glow: null },
  },
  emerald: {
    id: 'emerald', name: 'Emerald Chest', max: 1, chance: 0.07,
    coins: [600, 1400], itemChance: 0.75,
    balls: ['advanced_ball', 'absolute_ball'],
    foods: ['ember_roast', 'coral_cake', 'tide_pudding', 'mythic_feast'],
    colors: { body: '#2f9a6a', dark: '#155238', trim: '#9ff5c8', glow: 'rgba(80,240,160,0.55)' },
  },
  ultra_gold: {
    id: 'ultra_gold', name: 'Ultra Gold Chest', max: 1, chance: 0.004,
    coins: [4000, 9000], itemChance: 1,
    balls: ['god_ball', 'shiny_ball', 'dark_ball'],
    foods: ['phoenix_pepper', 'titan_broth', 'wildbound_ambrosia'],
    colors: { body: '#e6b74a', dark: '#8a5f12', trim: '#fff3c0', glow: 'rgba(255,215,90,0.7)' },
  },
};
export const CHEST_TIER_IDS = Object.keys(CHEST_TIERS);

/** Coins scale with the region: a Bronze chest in the Crags pays more than one in the Vale. */
export const CHEST_REGION_MULT = [1, 1.6, 2.4, 3.4];

/** How long (play time, ms) a map keeps its rolled chest set before it is rolled again. */
export const CHEST_REROLL_MS = 12 * 60 * 1000;

/** Chests are never placed closer than this to the player's spawn or to each other. */
export const CHEST_MIN_SPACING = 260;

export function getChestTier(id) {
  return CHEST_TIERS[id] || null;
}

/**
 * Roll which chests a map holds right now: up to `max` of each tier, each slot
 * passing its own `chance`. Returns the list of tier ids (positions are chosen by
 * the world, which knows what is walkable).
 */
export function rollChestTiers(rng = Math.random) {
  const out = [];
  for (const tier of Object.values(CHEST_TIERS)) {
    for (let i = 0; i < tier.max; i++) if (rng() < tier.chance) out.push(tier.id);
  }
  return out;
}

/**
 * What a chest of `tierId` holds when opened on the map with `regionIndex`
 * (0 = first region). Always coins; a ball or a food with the tier's item chance —
 * top balls / foods only ever come out of the top chests.
 * @returns {{ coins:number, item:null|{id:string, qty:number} }}
 */
export function rollChestLoot(tierId, regionIndex = 0, rng = Math.random) {
  const tier = getChestTier(tierId);
  if (!tier) return { coins: 0, item: null };
  const mult = CHEST_REGION_MULT[Math.max(0, Math.min(CHEST_REGION_MULT.length - 1, regionIndex))] || 1;
  const [lo, hi] = tier.coins;
  const coins = Math.round((lo + rng() * (hi - lo)) * mult / 5) * 5;
  let item = null;
  if (rng() < tier.itemChance) {
    const pool = rng() < 0.5 ? tier.balls : tier.foods;
    const id = pool[Math.floor(rng() * pool.length)];
    // small stacks from the small chests, single copies of the precious things
    const qty = tier.id === 'bronze' ? 1 + Math.floor(rng() * 3) : tier.id === 'silver' ? 1 + Math.floor(rng() * 2) : 1;
    item = { id, qty };
  }
  return { coins, item };
}
