// Wild spawn generation. Spawn tables support weights, level ranges, rarity &
// mutation rolls — future hooks (time of day, weather) slot in here.
import { createMythling } from '../core/mythling.js';
import { getMap } from '../data/maps.js';
import { rollRarity } from '../data/rarity.js';
import { rollMutation } from '../data/mutations.js';
import { MOOD_IDS } from '../data/moods.js';
import { weightedChoice, randInt, choice, clamp } from '../core/utils.js';
import { LEVEL_CAP } from '../data/config.js';

export const EncounterManager = {
  /**
   * Roll a wild Mythling for a given zone.
   *
   * Level bands are FIXED per zone (Verdant Vale 1-20, Azure Coast 15-30,
   * Emberwild 30-45, Stonehollow Crags 45-60): the world never scales up to the
   * party, so out-levelling an area is the signal to move on to the next one.
   */
  spawnForZone(zone, mapId, rng = Math.random, modifiers = {}) {
    const pick = weightedChoice(rng, zone.species);
    const [lo, hi] = zone.levelRange;
    let level = randInt(rng, lo, hi);
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
