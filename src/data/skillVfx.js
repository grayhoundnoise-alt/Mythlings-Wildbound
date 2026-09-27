// =============================================================================
// SKILL VFX DATA
// -----------------------------------------------------------------------------
// Pure data: adding a skill means adding one entry here, never touching the
// engine. Anything missing falls back to ELEMENT_VFX[element] + category, so a
// new move always plays something sensible.
//
//   cast        what gathers at the caster      (100-250ms)
//   projectile  what flies to the target        (150-500ms travel)
//   impact      what detonates on the target    (100-300ms)
//   aftermath   what lingers                    (200-700ms)
//   camera      shake / flash the scene applies
//
// Element identity rules baked into the palettes below:
//   nature -> leaves, vines, petals, roots, pollen (organic, never green magic)
//   water  -> droplets, splash arcs, ribbons, bubbles, foam, wave rings
//   fire   -> flame tongues, embers, smoke, sparks, heat glow (never a cloud)
// =============================================================================

export const ELEMENT_VFX = {
  nature: { core: '#d8ffb0', mid: '#6fd36a', deep: '#2f7c3f', glow: '#a8f08a', dark: '#17402a', spark: '#eaffd0' },
  water:  { core: '#f2fdff', mid: '#5cc0f5', deep: '#1a5c9e', glow: '#bfe9ff', dark: '#0d3557', spark: '#ffffff' },
  fire:   { core: '#fff3b0', mid: '#ff9a2e', deep: '#d8391a', glow: '#ffcf7a', dark: '#5a1405', spark: '#fff6d8' },
  none:   { core: '#ffffff', mid: '#d8e2f0', deep: '#7b8798', glow: '#ffffff', dark: '#2b3340', spark: '#ffffff' },
};

/** Fallback look for a category, used when a skill has no entry of its own. */
const CATEGORY_FALLBACK = {
  normal:  { cast: 'none', projectile: 'contact', impact: 'slash', shake: 3 },
  special: { cast: 'gather', projectile: 'orb', impact: 'burst', shake: 7 },
  buff:    { cast: 'gather', projectile: null, impact: null, shake: 0 },
  // debuffs fly to the foe as a dim orb; the stat-drop effect itself is played by the 'debuff' event
  debuff:  { cast: 'gather', projectile: 'orb', impact: 'burst', shake: 2 },
  ultimate:{ cast: 'charge', projectile: 'orb', impact: 'burst', shake: 14 },
};

/**
 * Every damage skill: CAST -> MOTION -> PROJECTILE -> IMPACT -> AFTERMATH.
 * `style` picks a named routine in SkillVFX; `color` keys come from ELEMENT_VFX.
 */
export const SKILL_VFX = {
  // ---------------------------------------------------------------- normal
  bite:    { id: 'bite',    element: 'none',   category: 'normal',
    cast: { style: 'crouch', dur: 0.14 }, projectile: { style: 'lunge', dur: 0.2 },
    impact: { style: 'bite', shake: 3 }, aftermath: { style: 'dust', dur: 0.24 } },
  scratch: { id: 'scratch', element: 'none',   category: 'normal',
    cast: { style: 'crouch', dur: 0.12 }, projectile: { style: 'lunge', dur: 0.18 },
    impact: { style: 'claw', shake: 3 }, aftermath: { style: 'dust', dur: 0.22 } },
  peck:    { id: 'peck',    element: 'none',   category: 'normal',
    cast: { style: 'crouch', dur: 0.1 }, projectile: { style: 'dash', dur: 0.16 },
    impact: { style: 'peck', shake: 2.5 }, aftermath: { style: 'feathers', dur: 0.3 } },

  // ---------------------------------------------------------------- nature
  vine_lash: { id: 'vine_lash', element: 'nature', category: 'special',
    cast: { style: 'gather', dur: 0.18, shape: 'leaf' },
    projectile: { style: 'vine', dur: 0.26, trail: 'leaf', spin: 6 },
    impact: { style: 'vineWhip', shake: 7, ring: true },
    aftermath: { style: 'pollen', dur: 0.4 } },
  leaf_shot: { id: 'leaf_shot', element: 'nature', category: 'special',
    cast: { style: 'gather', dur: 0.14, shape: 'leaf' },
    projectile: { style: 'leafDisc', dur: 0.22, spin: 18, trail: 'leaf' },
    impact: { style: 'leafBurst', shake: 5 },
    aftermath: { style: 'pollen', dur: 0.3 } },
  razor_wing: { id: 'razor_wing', element: 'nature', category: 'special',
    cast: { style: 'crouch', dur: 0.14 },
    projectile: { style: 'lunge', dur: 0.2 },
    impact: { style: 'claw', shake: 6, tint: 'nature' },
    aftermath: { style: 'feathers', dur: 0.34 } },
  thorn_spear: { id: 'thorn_spear', element: 'nature', category: 'special',
    cast: { style: 'gather', dur: 0.2, shape: 'shard' },
    projectile: { style: 'spear', dur: 0.24, trail: 'leaf' },
    impact: { style: 'thorns', shake: 8, ring: true },
    aftermath: { style: 'pollen', dur: 0.4 } },
  ancient_bloom: { id: 'ancient_bloom', element: 'nature', category: 'special',
    cast: { style: 'bloom', dur: 0.26 },
    projectile: { style: 'petalStorm', dur: 0.34 },
    impact: { style: 'bloom', shake: 9, ring: true },
    aftermath: { style: 'pollen', dur: 0.7 } },
  nature_burst: { id: 'nature_burst', element: 'nature', category: 'special',
    cast: { style: 'gather', dur: 0.2 }, projectile: { style: 'orb', dur: 0.26, trail: 'leaf' },
    impact: { style: 'leafBurst', shake: 8, ring: true }, aftermath: { style: 'pollen', dur: 0.45 } },
  sky_cutter: { id: 'sky_cutter', element: 'nature', category: 'special',
    cast: { style: 'crouch', dur: 0.16 }, projectile: { style: 'dash', dur: 0.22, trail: 'wind' },
    impact: { style: 'slashWind', shake: 7 }, aftermath: { style: 'feathers', dur: 0.36 } },
  sky_cyclone: { id: 'sky_cyclone', element: 'nature', category: 'special',
    cast: { style: 'gather', dur: 0.24 }, projectile: { style: 'cyclone', dur: 0.34 },
    impact: { style: 'cyclone', shake: 9, ring: true }, aftermath: { style: 'feathers', dur: 0.6 } },

  // ---------------------------------------------------------------- water
  water_shot: { id: 'water_shot', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.15, shape: 'droplet' },
    projectile: { style: 'droplet', dur: 0.22, trail: 'droplet' },
    impact: { style: 'splash', shake: 5, ring: true },
    aftermath: { style: 'mist', dur: 0.35 } },
  water_splash: { id: 'water_splash', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.14, shape: 'droplet' },
    projectile: { style: 'wave', dur: 0.24 },
    impact: { style: 'splash', shake: 6, ring: true },
    aftermath: { style: 'mist', dur: 0.4 } },
  aqua_spear: { id: 'aqua_spear', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.18, shape: 'droplet' },
    projectile: { style: 'spear', dur: 0.24, trail: 'droplet' },
    impact: { style: 'pierce', shake: 8, ring: true },
    aftermath: { style: 'mist', dur: 0.4 } },
  heavy_wave: { id: 'heavy_wave', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.2 }, projectile: { style: 'wave', dur: 0.3, big: true },
    impact: { style: 'splash', shake: 9, ring: true }, aftermath: { style: 'mist', dur: 0.5 } },
  whirlpool: { id: 'whirlpool', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.24 }, projectile: { style: 'whirl', dur: 0.32 },
    impact: { style: 'whirlpool', shake: 8, ring: true }, aftermath: { style: 'mist', dur: 0.6 } },
  ocean_pressure: { id: 'ocean_pressure', element: 'water', category: 'special',
    cast: { style: 'charge', dur: 0.26 }, projectile: { style: 'column', dur: 0.36 },
    impact: { style: 'pressure', shake: 11, ring: true }, aftermath: { style: 'mist', dur: 0.6 } },
  crushing_current: { id: 'crushing_current', element: 'water', category: 'special',
    cast: { style: 'gather', dur: 0.2 }, projectile: { style: 'wave', dur: 0.3, big: true },
    impact: { style: 'splash', shake: 9, ring: true }, aftermath: { style: 'mist', dur: 0.5 } },
  abyssal_wave: { id: 'abyssal_wave', element: 'water', category: 'special',
    cast: { style: 'charge', dur: 0.26 }, projectile: { style: 'wave', dur: 0.34, big: true },
    impact: { style: 'whirlpool', shake: 10, ring: true }, aftermath: { style: 'mist', dur: 0.6 } },

  // ---------------------------------------------------------------- fire
  flame_rawr: { id: 'flame_rawr', element: 'fire', category: 'special',
    cast: { style: 'gather', dur: 0.18, shape: 'ember' },
    projectile: { style: 'flameCone', dur: 0.28, trail: 'ember' },
    impact: { style: 'burn', shake: 7 },
    aftermath: { style: 'smoke', dur: 0.45 } },
  burning_fang: { id: 'burning_fang', element: 'fire', category: 'special',
    cast: { style: 'crouch', dur: 0.14 }, projectile: { style: 'lunge', dur: 0.2, tint: 'fire' },
    impact: { style: 'burn', shake: 8, bite: true }, aftermath: { style: 'smoke', dur: 0.4 } },
  inferno_roar: { id: 'inferno_roar', element: 'fire', category: 'special',
    cast: { style: 'charge', dur: 0.24 }, projectile: { style: 'flameCone', dur: 0.32, big: true },
    impact: { style: 'burn', shake: 10, ring: true }, aftermath: { style: 'smoke', dur: 0.6 } },
  dragon_inferno: { id: 'dragon_inferno', element: 'fire', category: 'special',
    cast: { style: 'charge', dur: 0.28 }, projectile: { style: 'fireball', dur: 0.36 },
    impact: { style: 'inferno', shake: 12, ring: true }, aftermath: { style: 'smoke', dur: 0.7 } },

  // ---------------------------------------------------------------- ultimates
  verdant_crush: { id: 'verdant_crush', element: 'nature', category: 'ultimate',
    cast: { style: 'charge', dur: 0.3 }, projectile: { style: 'rootErupt', dur: 0.4 },
    impact: { style: 'verdantCrush', shake: 16, ring: true, flash: 0.5 },
    aftermath: { style: 'pollen', dur: 0.8 }, camera: { shake: 16, flash: 0.45, dur: 1.5 } },
  tidal_burst: { id: 'tidal_burst', element: 'water', category: 'ultimate',
    cast: { style: 'charge', dur: 0.3 }, projectile: { style: 'tidalColumn', dur: 0.42 },
    impact: { style: 'tidalBurst', shake: 16, ring: true, flash: 0.5 },
    aftermath: { style: 'mist', dur: 0.9 }, camera: { shake: 16, flash: 0.45, dur: 1.5 } },
  fire_blast: { id: 'fire_blast', element: 'fire', category: 'ultimate',
    cast: { style: 'charge', dur: 0.32 }, projectile: { style: 'fireball', dur: 0.4, big: true },
    impact: { style: 'fireBlast', shake: 18, ring: true, flash: 0.6 },
    aftermath: { style: 'smoke', dur: 0.9 }, camera: { shake: 18, flash: 0.55, dur: 1.6 } },
  ocean_guard: { id: 'ocean_guard', element: 'water', category: 'ultimate', defensive: true,
    cast: { style: 'charge', dur: 0.3 }, projectile: null,
    impact: { style: 'oceanGuard', shake: 6, ring: true },
    aftermath: { style: 'mist', dur: 0.9 }, camera: { shake: 4, flash: 0.2, dur: 1.4 } },
  leafstorm: { id: 'leafstorm', element: 'nature', category: 'ultimate',
    cast: { style: 'charge', dur: 0.3 }, projectile: { style: 'leafStorm', dur: 0.44 },
    impact: { style: 'leafStorm', shake: 15, ring: true },
    aftermath: { style: 'pollen', dur: 0.9 }, camera: { shake: 15, flash: 0.35, dur: 1.5 } },
};

/** Buff VFX keyed by the stat they raise (element tints the palette). */
export const BUFF_VFX = {
  patk: { icon: '↑P.ATK', ring: 'spike', color: '#ffb27a' },
  satk: { icon: '↑S.ATK', ring: 'spike', color: '#c9a6ff' },
  pdef: { icon: '↑P.DEF', ring: 'shield', color: '#9fd8ff' },
  sdef: { icon: '↑S.DEF', ring: 'shield', color: '#a8f0d8' },
  spd:  { icon: '↑SPD',  ring: 'wind',  color: '#bff0ff' },
  hp:   { icon: '↑HP',   ring: 'shield', color: '#8ff0a8' },
  counter: { icon: '↑CTR', ring: 'wind', color: '#ffe08a' },
  crit: { icon: '↑CRIT', ring: 'spike', color: '#ffd76a' },
};

/** Timing budgets (seconds) — every skill obeys these. */
export const VFX_TIMING = {
  cast: [0.10, 0.25],
  travel: [0.15, 0.50],
  impact: [0.10, 0.30],
  aftermath: [0.20, 0.70],
  ultimate: [0.80, 1.80],
};

/** Resolves the VFX definition for any skill id, with sensible fallbacks. */
export function vfxFor(skillId, hint = {}) {
  const direct = SKILL_VFX[skillId];
  if (direct) return direct;
  const element = hint.element || 'none';
  const cat = hint.category || 'special';
  const f = CATEGORY_FALLBACK[cat] || CATEGORY_FALLBACK.special;
  return {
    id: skillId, element, category: cat,
    cast: { style: f.cast, dur: 0.16 },
    projectile: f.projectile ? { style: f.projectile, dur: cat === 'normal' ? 0.18 : 0.26 } : null,
    impact: f.impact ? { style: f.impact, shake: f.shake } : null,
    aftermath: cat === 'normal' ? { style: 'dust', dur: 0.24 } : { style: 'pollen', dur: 0.35 },
  };
}

export function paletteFor(element) {
  return ELEMENT_VFX[element] || ELEMENT_VFX.none;
}
