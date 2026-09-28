// Element definitions & effectiveness chart (data-driven, extensible).
// `icon` names an entry in src/ui/icons.js — the UI never uses emoji.
export const ELEMENTS = {
  nature:   { id: 'nature',   name: 'Nature',   icon: 'nature',   color: '#4fc76a', glow: '#9cff9c' },
  water:    { id: 'water',    name: 'Water',    icon: 'water',    color: '#3fa9f5', glow: '#a5e6ff' },
  fire:     { id: 'fire',     name: 'Fire',     icon: 'fire',     color: '#ff7a3d', glow: '#ffd08a' },
  rock:     { id: 'rock',     name: 'Rock',     icon: 'rock',     color: '#b99a6b', glow: '#f0dcb0' },
  electric: { id: 'electric', name: 'Electric', icon: 'electric', color: '#f4d03f', glow: '#fff6a8' },
  ice:      { id: 'ice',      name: 'Ice',      icon: 'ice',      color: '#8fdcff', glow: '#e6fbff' },
  metal:    { id: 'metal',    name: 'Metal',    icon: 'metal',    color: '#a9b4c2', glow: '#e8eef5' },
  poison:   { id: 'poison',   name: 'Poison',   icon: 'poison',   color: '#b06fe0', glow: '#e4c0ff' },
  psychic:  { id: 'psychic',  name: 'Psychic',  icon: 'psychic',  color: '#ff6fb5', glow: '#ffc6e4' },
  // Future elements can simply be appended here.
};

/** Display order used by the Index, the Collection and the Wiki (grouped by element). */
export const ELEMENT_ORDER = ['nature', 'water', 'fire', 'rock', 'electric', 'ice', 'metal', 'poison', 'psychic'];

export const EFFECTIVENESS = {
  STRONG: 1.5,
  WEAK: 0.75,
  NEUTRAL: 1.0,
};

// attacker -> defenders it is strong against.
//   Nature   roots crack Rock and drink Water.
//   Water    drowns Fire and erodes Rock.
//   Fire     burns Nature, melts Ice and Metal.
//   Rock     smothers Fire and grounds Electric.
//   Electric conducts through Water and Metal.
//   Ice      freezes Nature and stills Electric.
//   Metal    grinds Rock and shatters Ice.
//   Poison   withers Nature, corrodes Metal and clouds the Psychic mind.
//   Psychic  purges Poison and snuffs Fire.
// Every element is strong against two or three others and weak to one to three.
const STRONG_AGAINST = {
  nature:   ['water', 'rock'],
  water:    ['fire', 'rock'],
  fire:     ['nature', 'ice', 'metal'],
  rock:     ['fire', 'electric'],
  electric: ['water', 'metal'],
  ice:      ['nature', 'electric'],
  metal:    ['rock', 'ice'],
  poison:   ['nature', 'metal', 'psychic'],
  psychic:  ['poison', 'fire'],
};

export function elementMultiplier(attackElement, defenderElement) {
  if (!attackElement || !defenderElement) return EFFECTIVENESS.NEUTRAL;
  // a dual / triple-typed defender: every one of its elements weighs in (1.5 × 0.75 = 1.125 ...)
  if (Array.isArray(defenderElement)) {
    let m = EFFECTIVENESS.NEUTRAL;
    for (const d of defenderElement) m *= elementMultiplier(attackElement, d);
    return Math.round(m * 1000) / 1000;
  }
  if (attackElement === defenderElement) return EFFECTIVENESS.NEUTRAL;
  if ((STRONG_AGAINST[attackElement] || []).includes(defenderElement)) return EFFECTIVENESS.STRONG;
  if ((STRONG_AGAINST[defenderElement] || []).includes(attackElement)) return EFFECTIVENESS.WEAK;
  return EFFECTIVENESS.NEUTRAL;
}

/** Elements an element is strong against (for the Wiki and the professor). */
export function strongAgainst(id) { return [...(STRONG_AGAINST[id] || [])]; }
/** Elements that are strong against `id` (its weaknesses). */
export function weakTo(id) { return Object.keys(STRONG_AGAINST).filter((a) => STRONG_AGAINST[a].includes(id)); }

/**
 * The element list of a species: `elements` for dual / triple types (legendaries,
 * the Poison/Psychic and Electric/Metal lines), otherwise just `element`.
 */
export function speciesElements(sp) {
  if (!sp) return [];
  if (Array.isArray(sp.elements) && sp.elements.length) return sp.elements;
  return sp.element ? [sp.element] : [];
}

export function effectivenessLabel(mult) {
  if (mult > 2.0) return "It's devastatingly effective!";
  if (mult > 1.01) return "It's super effective!";
  if (mult < 0.6) return "It barely scratches it...";
  if (mult < 0.99) return "It's not very effective...";
  return null;
}

export function elementOf(id) {
  return ELEMENTS[id] || { id, name: id, icon: 'spark', color: '#bbb', glow: '#fff' };
}
