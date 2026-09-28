// Wild spawn generation. Spawn tables support weights, level ranges, rarity &
// mutation rolls — future hooks (time of day, weather) slot in here.
import { createMythling } from '../core/mythling.js';
import { getMap } from '../data/maps.js';
import { SPECIES, LEGENDARY_IDS } from '../data/species.js';
import { speciesElements } from '../data/elements.js';
import { rollRarity } from '../data/rarity.js';
import { rollMutation } from '../data/mutations.js';
import { MOOD_IDS } from '../data/moods.js';
import { weightedChoice, randInt, choice, clamp } from '../core/utils.js';
import { LEVEL_CAP } from '../data/config.js';

/** Chance that a wild spawn is replaced by a legendary: home map vs. another map of its elements. */
export const LEGENDARY_HOME_CHANCE = 0.02;
export const LEGENDARY_AWAY_CHANCE = 0.005;

export const EncounterManager = {
  /**
   * Roll a wild Mythling for a given zone.
   *
   * Level bands are FIXED per zone (Verdant Vale 1-20 ... Astral Spire 78-90): the
   * world never scales up to the party, so out-levelling an area is the signal to
   * move on to the next one.
   */
  spawnForZone(zone, mapId, rng = Math.random, modifiers = {}) {
    let pick = weightedChoice(rng, zone.species);
    const [lo, hi] = zone.levelRange;
    let level = randInt(rng, lo, hi);
    // Legendaries never sit in a zone table: a tiny roll may replace the spawn with one
    // whose elements match this map — likelier (but still rare) on its home map.
    const legend = this.rollLegendary(mapId, rng);
    if (legend) { pick = { id: legend }; level = hi; }
    level = clamp(level, 1, LEVEL_CAP);
    return createMythling({
      speciesId: pick.id,
      level,
      rarity: rollRarity(rng, modifiers.rarityLuck || 0),
      mood: choice(rng, MOOD_IDS),
      mutation: rollMutation(rng, modifiers.mutationLuck || 1),
      originMap: mapId,
      rng,
    });
  },

  /** Legendaries that can appear on a map: any whose spawnMaps list it (home map first). */
  legendariesFor(mapId) {
    return LEGENDARY_IDS.filter((id) => (SPECIES[id].spawnMaps || []).includes(mapId));
  },

  /**
   * One roll per spawn: LEGENDARY_HOME_CHANCE on the legendary's home map,
   * LEGENDARY_AWAY_CHANCE elsewhere. Returns a species id or null.
   */
  rollLegendary(mapId, rng = Math.random) {
    for (const id of this.legendariesFor(mapId)) {
      const home = SPECIES[id].homeMap === mapId;
      if (rng() < (home ? LEGENDARY_HOME_CHANCE : LEGENDARY_AWAY_CHANCE)) return id;
    }
    return null;
  },

  zonesForMap(mapId) {
    const map = getMap(mapId);
    return map ? map.encounterZones : [];
  },

  zoneAt(mapId, x, y) {
    const map = getMap(mapId);
    if (!map) return null;
    for (const z of map.encounterZones) {
      const [zx, zy, zw, zh] = z.rect;
      if (x >= zx && x <= zx + zw && y >= zy && y <= zy + zh) return z;
    }
    return null;
  },
};
