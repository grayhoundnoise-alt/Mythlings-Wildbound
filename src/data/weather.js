import { elementMultiplier } from './elements.js';

// =====================================================================
// WEATHER — a field condition that only a handful of exclusive skills
// can raise, and that lasts for the rest of the battle (or until another
// weather replaces it). Running never keeps it: it dies with the fight.
//
//   * Skills whose ELEMENT matches the weather hit x1.5 — for BOTH sides.
//     (A Normal / element-less move never gets the boost, even for a
//     Mythling that matches the weather.)
//   * A Mythling on the field that does NOT share the weather's element
//     is burned for a flat 100 HP every turn — the same 100 at Lv.1 and
//     at Lv.100.
//   * If it is WEAK to the weather's element the burn is x1.8 (180).
//   * A dual-element Mythling only needs ONE of its elements to match to
//     be safe — but the boost is still paid only to matching skills.
// =====================================================================

/** How much harder a same-element skill hits while the weather rages. */
export const WEATHER_BOOST = 1.5;
/** Flat damage per turn to a Mythling that does not share the element. */
export const WEATHER_DAMAGE = 100;
/** ...and this much more when it is weak to the weather's element. */
export const WEATHER_WEAK_MULT = 1.8;

export const WEATHERS = {
  wildfire: {
    id: 'wildfire', name: 'Wildfire', element: 'fire',
    desc: 'Magma vents split the ground open. Fire skills burn half again as hard; anything that is not a Fire Mythling is seared.',
    sky: ['#2b0a04', '#6d1c07', '#c4490f'],
    tint: 'rgba(255, 122, 40, 0.16)',
    particle: { color: '#ffb35c', kind: 'ember' },
  },
  monsoon: {
    id: 'monsoon', name: 'Monsoon', element: 'water',
    desc: 'A warm deluge drums on the field. Water skills swell; anything that is not a Water Mythling is ground down by the downpour.',
    sky: ['#061726', '#0d3a5c', '#1f6f96'],
    tint: 'rgba(90, 175, 255, 0.16)',
    particle: { color: '#a5e6ff', kind: 'rain' },
  },
  overgrowth: {
    id: 'overgrowth', name: 'Overgrowth', element: 'nature',
    desc: 'The field erupts into living green. Nature skills run wild; anything that is not a Nature Mythling is strangled by the growth.',
    sky: ['#0a2110', '#17512a', '#3f9c4e'],
    tint: 'rgba(110, 230, 130, 0.15)',
    particle: { color: '#9cff9c', kind: 'leaf' },
  },
  thunderhead: {
    id: 'thunderhead', name: 'Thunderhead', element: 'electric',
    desc: 'A black cloud squats over the battlefield, cracking with charge. Electric skills arc harder; anything that is not an Electric Mythling is struck.',
    sky: ['#141026', '#2f2a54', '#5b52a8'],
    tint: 'rgba(190, 190, 255, 0.16)',
    particle: { color: '#fff6a8', kind: 'spark' },
  },
  blizzard: {
    id: 'blizzard', name: 'Blizzard', element: 'ice',
    desc: 'A howling whiteout buries the field. Ice skills bite deeper; anything that is not an Ice Mythling freezes a little more each turn.',
    sky: ['#0d1a24', '#24455e', '#6d9fc0'],
    tint: 'rgba(200, 235, 255, 0.18)',
    particle: { color: '#e6fbff', kind: 'snow' },
  },
  miasma: {
    id: 'miasma', name: 'Miasma', element: 'poison',
    desc: 'A sour fog rolls in off the fen. Poison skills rot deeper; anything that is not a Poison Mythling breathes it in and sickens.',
    sky: ['#160a20', '#3d1450', '#6c2a86'],
    tint: 'rgba(200, 120, 255, 0.16)',
    particle: { color: '#e4c0ff', kind: 'bubble' },
  },
};

export const WEATHER_IDS = Object.keys(WEATHERS);

export function getWeather(id) { return id ? WEATHERS[id] || null : null; }

/**
 * What the active weather does to one Mythling on the field.
 * @param {string[]} elements  the Mythling's element(s)
 * @param {string} weather     the active weather id
 * @returns {{boost:boolean, damage:number, weak:boolean, burn:boolean}}
 */
export function weatherEffectOn(elements, weather) {
  const w = getWeather(weather);
  if (!w) return { boost: false, damage: 0, weak: false, burn: false };
  const els = Array.isArray(elements) ? elements : [elements].filter(Boolean);
  if (els.includes(w.element)) return { boost: true, damage: 0, weak: false, burn: false };
  const weak = els.length ? elementMultiplier(w.element, els) > 1.01 : false;
  return {
    boost: false,
    damage: Math.round(WEATHER_DAMAGE * (weak ? WEATHER_WEAK_MULT : 1)),
    weak,
    burn: true,
  };
}
