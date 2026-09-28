// =====================================================================
// GAME WIKI — every rule, stat, mood, Mythling, skill, item and region
// in one searchable reference. Opened from Settings (and the title
// screen's Settings). Content is generated straight from the data files,
// so the Wiki can never drift away from the way the game actually works.
// =====================================================================
import { el, Screens, closeButton, elementChip, elementChips } from './ui.js';
import { icon } from './icons.js';
import { drawMythling } from '../render/creatures.js';
import { SPECIES, SPECIES_IDS, STARTER_IDS } from '../data/species.js';
import { SKILLS, ULTIMATES, ULTIMATE_MAX_CHARGE, MAX_BUFF_STACKS, buffSummary, skillStrength, isDamageSkill, SKILL_CATEGORY_LABEL, riderSummary, isSupportUltimate } from '../data/skills.js';
import { MAX_EQUIPPED_SKILLS } from '../core/mythling.js';
import {
  MOODS, MOOD_IDS, STAT_KEYS, STAT_LABELS, STAT_SHORT, STAT_INFO,
  STAT_BAR_MAX, formatStat, RATIONALS, RATIONAL_IDS, RATIONAL_STATS,
} from '../data/moods.js';
import { RATIONAL_AMOUNT, DAMAGE_LEVEL_SCALE, DAMAGE_STAGE_SCALE, ULTIMATE_POWER_SCALE, SKILL_POWER_SCALE } from '../data/config.js';
import { CollectionManager } from '../systems/GameState.js';
import { RARITIES, RARITY_ORDER } from '../data/rarity.js';
import { MUTATIONS, MUTATION_IDS } from '../data/mutations.js';
import { ITEMS, ITEM_CATEGORIES, BALL_IDS } from '../data/items.js';
import { ballCanvas, ballLook } from '../render/balls.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';
import { CHEST_TIERS, CHEST_TIER_IDS, CHEST_REROLL_MS } from '../data/chests.js';
import { ELEMENTS, ELEMENT_ORDER, EFFECTIVENESS, elementMultiplier, weakTo } from '../data/elements.js';
import {
  LEVEL_CAP, ABSOLUTE_MAX_LEVEL, PARTY_MAX, STORAGE_MAX, ULTIMATE_UNLOCK_LEVEL,
  EVOLUTION_LEVELS, MAX_UNLOCKED_EVOLUTION_STAGE, expToNextLevel, DEFEAT_COIN_PENALTY,
  COUNTER_MAX_PERCENT, COUNTER_MAX_DODGE, COUNTER_DODGE_SCALE, counterDodgePercent,
  CRIT_MAX_PERCENT, CRIT_MAX_MULT, GAME_VERSION, STARTER_RARITY,
} from '../data/config.js';
import { AudioManager } from '../systems/AudioManager.js';
import { coins } from '../core/utils.js';

// ------------------------------------------------------------------ helpers
function h3(text, search = '') {
  const n = el('h3', { class: 'wiki-h3', text });
  n.dataset.wikitext = `${text} ${search}`.toLowerCase();
  return n;
}
function para(html, search = '') {
  const n = el('p', { class: 'wiki-p', html });
  n.dataset.wikitext = search ? search.toLowerCase() : strip(html).toLowerCase();
  return n;
}
function strip(html) { return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '); }

/** Two-column label/value table. */
function table(rows, search = '') {
  const body = rows.filter(Boolean).map(([k, v]) => el('div', { class: 'wiki-tr' }, [
    el('div', { class: 'wiki-td k', html: k }),   // keys may carry chips / colour
    el('div', { class: 'wiki-td v', html: v }),
  ]));
  const n = el('div', { class: 'wiki-table' }, body);
  n.dataset.wikitext = `${rows.map((r) => `${r?.[0] || ''} ${strip(r?.[1] || '')}`).join(' ')} ${search}`.toLowerCase();
  return n;
}

function bullets(items, search = '') {
  const n = el('ul', { class: 'wiki-ul' }, items.filter(Boolean).map((t) => el('li', { html: t })));
  n.dataset.wikitext = `${items.join(' ')} ${search}`.toLowerCase();
  return n;
}

function note(html, search = '') {
  const n = el('div', { class: 'wiki-note', html });
  n.dataset.wikitext = `${strip(html)} ${search}`.toLowerCase();
  return n;
}

function block(children, search = '') {
  const n = el('div', { class: 'wiki-block' }, children);
  if (search) n.dataset.wikitext = search.toLowerCase();
  return n;
}

/** Static portrait of a Mythling drawn straight from the creature renderer. */
function creature(speciesId, stage = 0, size = 92) {
  const cv = el('canvas', { class: 'wiki-portrait', width: size, height: size });
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.translate(size / 2, size * 0.9);
  drawMythling(ctx, {
    speciesId, stage, mutation: 'none',
    x: -size * 0.05, y: 0, size: size * 0.8, t: 0, facing: 1, shadow: false,
  });
  ctx.restore();
  return cv;
}

function chip(text) { return el('span', { class: 'chip', text }); }

// ------------------------------------------------------------------ sections
const SECTIONS = [
  ['basics', 'Getting Started', 'play', basics],
  ['stats', 'Stats', 'dna', statsSection],
  ['moods', 'Moods', 'user', moodsSection],
  ['rarity', 'Rarity & Mutations', 'diamond', raritySection],
  ['elements', 'Elements', 'spark', elementsSection],
  ['battle', 'Battle Rules', 'strike', battleSection],
  ['mythlings', 'Mythlings', 'box', speciesSection],
  ['skills', 'Skills & Ultimates', 'ultimate', skillsSection],
  ['items', 'Items & Balls', 'bag', itemsSection],
  ['world', 'World & Trainers', 'map', worldSection],
  ['progress', 'Levelling & Evolution', 'levelup', progressSection],
  ['controls', 'Controls & Menus', 'settings', controlsSection],
  ['version', 'Version & Roadmap', 'flag', versionSection],
];

function basics() {
  return [
    h3('The journey', 'story objective goal'),
    para(`Mythlings: Wildbound is a creature-collecting RPG. Explore three regions, battle wild
      Mythlings and NPC trainers, and grow a team of up to ${PARTY_MAX} Mythlings.`,
      'explore regions journey overview'),
    bullets([
      '<b>Walk the routes</b> — wild Mythlings appear while you move through tall grass and wild zones.',
      '<b>Defeat a wild Mythling first</b> — a living one will never hold still, so you must knock it out before you can catch it.',
      '<b>Catch it</b> — choose a ball on the victory screen. Every caught Mythling restarts at <b>Lv.1</b> and keeps its species, Mood, Rarity and mutation.',
      '<b>Raise it</b> — battle, or feed it food from your bag to convert items straight into EXP.',
      '<b>Evolve at Lv.20</b> — the first evolution is live in this version.',
      '<b>Beat each region Guardian</b> to unlock the gate to the next region.',
    ], 'rules core loop catch defeat evolve guardian gate'),
    note(`<b>The golden rule:</b> a Mythling you catch is always reset to <b>Lv.1</b>. Its level in the
      wild only decides how hard the fight and the catch are — never how strong it becomes for you.`),
    h3('Where to go', 'route order'),
    table(MAP_ORDER.map((id, i) => [
      `${i + 1}. ${MAPS[id].displayName}`,
      `Wild Mythlings <b>Lv.${MAPS[id].levelRange[0]}–${MAPS[id].levelRange[1]}</b>`,
    ])),
    h3('Saving', 'save autosave slot'),
    bullets([
      'The game autosaves after important moments (battles, catches, evolutions, purchases).',
      'Open the menu with <b>ESC</b> and use the <b>SAVE</b> tab to save manually to any of 3 slots.',
    ]),
  ];
}

function statsSection() {
  return [
    h3('The nine stats', 'stat list hp attack defense speed counter crit'),
    para('Species base stats grow with level, get multiplied by the evolution stage, and are then modified by Mood (scaled by Rarity). Buffs from skills stack on top during a battle only.'),
    table(STAT_KEYS.map((k) => [
      `${STAT_SHORT[k]} — ${STAT_LABELS[k]}`,
      `${STAT_INFO[k]} <span class="wiki-dim">(bar scale: 0–${STAT_BAR_MAX[k]})</span>`,
    ])),
    h3('Counter — the evasion stat', 'counter dodge evasion miss nerf'),
    table([
      ['What it does', 'Gives the defender a chance to dodge an incoming attack entirely.'],
      ['Conversion', `Each point of Counter = <b>${COUNTER_DODGE_SCALE * 100}%</b> dodge chance.`],
      ['Dodge cap', `<b>${COUNTER_MAX_DODGE}%</b> — no Mythling can ever become untouchable.`],
      ['Stat cap', `Counter itself caps at <b>${COUNTER_MAX_PERCENT}</b>.`],
    ]),
    note(`Counter has been nerfed twice: it used to give a full 1% dodge per point (up to 35%), then half a percent
      (up to 18%). It is now <b>${COUNTER_DODGE_SCALE}% per point, capped at ${COUNTER_MAX_DODGE}%</b>, so a missed attack is a rare surprise
      instead of a routine. Crit Chance was nerfed alongside it: it grows far more slowly with level and caps at
      <b>${CRIT_MAX_PERCENT}%</b>, so a critical hit stays special even at Lv.${LEVEL_CAP}.`),
    h3('Crit Chance & Crit Damage', 'crit critical chance multiplier damage'),
    table([
      ['CRIT — Crit Chance', `Percent chance that an attack lands critically. Caps at <b>${CRIT_MAX_PERCENT}%</b>.`],
      ['C.DMG — Crit Damage', `Bonus damage on a critical hit. +50% means a crit deals <b>1.5x</b>. Caps at <b>+${CRIT_MAX_MULT}%</b> (x${(1 + CRIT_MAX_MULT / 100).toFixed(1)}).`],
      ['Base values', 'Every species starts around 4–10% crit chance and +40% to +65% crit damage.'],
      ['Growth', 'Crit Chance grows with level; Crit Damage grows with level and jumps with evolution.'],
      ['Moods', 'Feral, Savage, Precise, Brutal and Keen moods push crit chance and/or crit damage.'],
    ]),
    para('A critical hit multiplies the whole damage roll (after element effectiveness), shows a golden damage number and a <b>CRITICAL HIT!</b> line in the battle log.'),
  ];
}

function moodsSection() {
  const rows = MOOD_IDS.map((id) => {
    const m = MOODS[id];
    const up = m.up.map((k) => `<b class="good">+${STAT_LABELS[k]}</b>`).join(' ');
    return [
      `${m.name}${m.up.includes('crit') || m.up.includes('critMult') ? ' <span class="chip evolve">CRIT</span>' : ''}`,
      `${up}<br><span class="wiki-dim">${m.desc || ''}</span>`,
    ];
  });
  // Rational table: one row per "up" stat, listing the five names that lower each other stat
  const ratRows = RATIONAL_STATS.map((up) => [
    `<b class="good">+${RATIONAL_AMOUNT} ${STAT_SHORT[up]}</b>`,
    RATIONAL_STATS.filter((d) => d !== up).map((down) => {
      const r = Object.values(RATIONALS).find((x) => x.up === up && x.down === down);
      return `<b>${r.name}</b> <span class="wiki-dim">(−${RATIONAL_AMOUNT} ${STAT_SHORT[down]})</span>`;
    }).join(' · '),
  ]);
  return [
    h3('What a Mood is', 'mood personality'),
    para(`Every Mythling has a <b>Mood</b>: a fixed, purely <b>positive</b> trait that raises <b>three</b> stats and lowers
      nothing. There are <b>${MOOD_IDS.length}</b> Moods and no two share the same trio, so every stat is covered several times
      over. Moods are rolled when a wild Mythling appears and are kept through capture, evolution and every level up.
      A <b>Mood Tonic</b> (sold from Azure Coast onward) re-rolls it into a different Mood.`),
    h3('Rarity amplifies the Mood', 'rarity magnitude scale'),
    para(`Rarity does not change base stats by itself — it sets the <b>magnitude</b> of the Mood bonus:
      <b>+magnitude</b> to each of the three stats (HP counts triple, Crit Damage double). Rarity <b>D</b> adds
      nothing at all; <b>SSS+</b> adds a huge boost.`),
    table(RARITY_ORDER.map((id) => [
      `<b style="color:${RARITIES[id].color}">Rarity ${id}</b>`,
      `Mood magnitude <b>${RARITIES[id].magnitude}</b> → <b>+${RARITIES[id].magnitude}</b> to each Mood stat (HP <b>+${RARITIES[id].magnitude * 3}</b>, Crit Damage <b>+${RARITIES[id].magnitude * 2}%</b>)`,
    ])),
    h3('All moods', 'list table of moods'),
    table(rows),
    note(`Example — a <b>Brave</b> Mythling at Rarity <b>S</b> (magnitude 5): <b>+15 HP, +5 Physical Attack, +5 Counter</b>.
      The same Mood at Rarity D changes nothing. When a Mood plus and a Rational minus land on the <b>same</b> stat the
      profile shows the <b>net</b> change — green when the plus wins (+15 −10 = <b>+5</b>), red when the penalty wins.`),
    h3('Rational — the +10 / −10 trait', 'rational temper nature plus minus trade-off'),
    para(`Where the Mood only ever helps, the <b>Rational</b> is a trade-off: a fixed <b>+${RATIONAL_AMOUNT}</b> to one of the six
      main stats and a fixed <b>−${RATIONAL_AMOUNT}</b> to another. It is flat (not scaled by rarity or level) and it stacks with the
      Mood, the Rarity magnitude and the mutation bonus. All <b>${RATIONAL_IDS.length}</b> possible pairs exist, so any stat can be
      traded for any other. A <b>Temper Tonic</b> re-rolls it into a different Rational.`),
    table(ratRows, 'rational names table'),
    note(`Example — a <b>Hasty</b> Mythling: <b>+${RATIONAL_AMOUNT} Speed, −${RATIONAL_AMOUNT} HP</b>. A <b>Stoic</b> one: <b>+${RATIONAL_AMOUNT} HP, −${RATIONAL_AMOUNT} Speed</b>.
      The profile marks the two stats with arrows and names the trait next to the Mood.`),
  ];
}

function raritySection() {
  const combinedOdds = MUTATIONS.shiny.chance * MUTATIONS.darkness.chance;
  const mut = MUTATION_IDS.filter((id) => id !== 'none').map((id) => {
    const odds = id === 'shiny_dark' ? combinedOdds : MUTATIONS[id].chance;
    const extra = id === 'shiny'
      ? ' · guaranteed by the <b>Shiny Ball</b>'
      : id === 'darkness'
        ? ' · guaranteed by the <b>Dark Ball</b>'
        : ' · both mutations at once. Rolled naturally at these odds, or made by catching a <b>Shiny</b> with a <b>Dark Ball</b> (or a <b>Darkness</b> with a <b>Shiny Ball</b>) — the ball ADDS its mutation instead of replacing it';
    return [
      `<span style="color:${MUTATIONS[id].color}">${MUTATIONS[id].name}</span>`,
      `${(odds * 100).toFixed(odds < 0.01 ? 3 : 1)}% chance in the wild · <b>+${MUTATIONS[id].statBonus} to every stat</b> (after caps) · unique colours and aura${extra}`,
    ];
  });
  return [
    h3('Rarity', 'rarity tiers D C B A S SSS'),
    para('Rarity is rolled independently from the species. It sets how strongly the Mood applies and slightly changes how easy the Mythling is to catch.'),
    table(RARITY_ORDER.map((id) => {
      const r = RARITIES[id];
      return [
        `<b style="color:${r.color}">${r.name}</b>`,
        `Mood magnitude <b>+${r.magnitude}</b> · catch modifier <b>x${r.catchMod.toFixed(2)}</b> · roll weight <b>${r.weight}</b>`,
      ];
    })),
    h3('Mutations', 'shiny darkness mutation cosmetic stat bonus'),
    para(`Mutations are rare variants recorded in your Collection. Besides looking different, they carry a
      flat bonus to <b>every</b> stat: <b>Shiny +1</b> and <b>Darkness +2</b>, applied after the stat caps so the
      bonus always lands.`),
    table(mut),
    h3('Catch chance', 'catch capture ball formula'),
    para(`<code>chance = catchRate × ballMultiplier × rarityModifier × levelFactor × hpFactor</code><br>
      A fainted wild Mythling is much easier to catch (x1.35) than a weakened one; the lower its HP, the better.
      You must <b>defeat</b> a wild Mythling before any ball will work.`),
    para(`Every ball has its own look, and the ball you throw is the one you see in battle:`),
    table(BALL_IDS.map((id) => {
      const it = ITEMS[id];
      const img = `<img class="ball-icon" width="28" height="28" src="${ballCanvas(id, 28).toDataURL()}" alt="">`;
      return [`<span class="wiki-ball">${img}<span>${it.name}<br><small>${ballLook(id)}</small></span></span>`,
        `${it.guaranteed ? '<b>Guaranteed catch</b>' : `x${it.catchMult.toFixed(2)} catch`}${it.forceMutation ? ` · <b>always ${MUTATIONS[it.forceMutation].name}</b>` : ''} · ${coins(it.price)} Wildcoins<br><small>${it.desc}</small>`];
    }), 'balls'),
  ];
}

function elementsSection() {
  const ids = Object.keys(ELEMENTS);
  const grid = el('div', { class: 'wiki-elgrid' });
  for (const a of ids) {
    for (const d of ids) {
      const m = elementMultiplier(a, d);
      const cell = el('div', {
        class: `wiki-el ${m > 1 ? 'strong' : m < 1 ? 'weak' : ''}`,
        text: `${ELEMENTS[a].name} → ${ELEMENTS[d].name}: x${m}`,
      });
      grid.appendChild(cell);
    }
  }
  return [
    h3('The element chart', 'element effectiveness chart nature water fire rock electric ice metal poison psychic'),
    para(`There are <b>${ids.length} elements</b>. Attacks use the <b>element of the skill</b>. Hitting a weakness multiplies damage by
      <b>x${EFFECTIVENESS.STRONG}</b>; hitting a resistance multiplies it by <b>x${EFFECTIVENESS.WEAK}</b>.
      Same element vs same element is neutral. Every element is strong against two or three others and weak to one to three.`),
    bullets(ids.map((id) => {
      const beats = ids.filter((d) => elementMultiplier(id, d) > 1).map((d) => ELEMENTS[d].name);
      const fears = weakTo(id).map((d) => ELEMENTS[d].name);
      return `<b style="color:${ELEMENTS[id].color}">${ELEMENTS[id].name}</b> is strong against ${beats.join(', ')} · weak to ${fears.join(', ') || 'nothing'}`;
    })),
    block([grid], 'element chart table'),
    h3('Dual and triple types', 'dual type two elements legendary triple multiplier'),
    para(`A few Mythlings carry <b>two</b> elements (the Poison/Psychic <b>Mirewisp</b> line and the Electric/Metal <b>Sparkbug</b> line) and the
      three <b>legendaries</b> carry two or three. They learn the attacks of <b>every</b> one of their elements, and when they are hit
      every element weighs in: Fire against Poison/Psychic is 1.0 × 0.75 = <b>x0.75</b>; Rock against Electric/Metal is 1.5 × 0.75 = <b>x1.125</b>.
      Dual types spawn on the map of either element and are most common on their home map.`),
  ];
}

function battleSection() {
  return [
    h3('Turn order', 'speed first turn order'),
    para('The Mythling with the higher <b>Speed</b> acts first each turn (a coin flip on a tie). Using an item or switching always resolves before anything else — they are "fast" actions.'),
    h3('Damage', 'damage formula calculation attack defense'),
    para(`<code>damage = floor( (Power × OFF / DEF) × levelFactor × stageFactor × random(0.85–1.0) × elementMultiplier )</code>`),
    bullets([
      '<b>OFF</b> is P.ATK and <b>DEF</b> is P.DEF for Physical skills; S.ATK / S.DEF for Special skills and Ultimates.',
      `<b>levelFactor</b> grows ${(DAMAGE_LEVEL_SCALE * 100).toFixed(1)}% per level above Lv.1 (it used to be 8.5% — at Lv.100 two equal Mythlings one-shot each other and speed decided everything; a neutral Special now takes about seven hits, a super-effective Ultimate two or three).`,
      `<b>stageFactor</b> adds ${(DAMAGE_STAGE_SCALE * 100).toFixed(0)}% per evolution stage on top of the stats the stage already multiplies.`,
      `<b>Ultimates</b> use ${Math.round(ULTIMATE_POWER_SCALE * 100)}% of their tier power (the Power shown everywhere is already that number). They used to be cut to 70%, which left a full-charge Ultimate hitting <i>softer than the best Special</i> — pointless to save up for. Now every tier out-muscles it: a full charge takes about <b>two</b> hits to KO an equal foe, and even a super-effective crit lands around three quarters of the bar rather than deleting it.`,
      `<b>Regular skills</b> (Normal and Special) get a further <b>\u00d7${SKILL_POWER_SCALE}</b> on top, so the buttons you press every turn land with weight.`,
      'A move with <b>no element</b> stays element-less: a plain Bite never borrows the element of the Mythling using it, so it is always neutral damage.',
      '<b>elementMultiplier</b> multiplies once per defender element: a Poison/Psychic Mythling hit by Fire takes 1.5 × 0.75 = <b>x1.125</b>; hit by Psychic it takes 1.5 × 1.0 = <b>x1.5</b>.',
      'Every hit deals at least <b>1</b> damage.',
      'The battle log now reports the exact damage of every attack.',
    ], 'power off def level factor random'),
    h3('Reading your damage', 'damage number button preview green red white neutral'),
    bullets([
      'Every attack button prints the damage that move will do to the Mythling across the arena <b>right now</b> — the same sum the engine rolls, with the dice averaged out.',
      '<span class="wiki-good">Green</span> = super effective. <span class="wiki-bad">Red</span> = resisted. <span class="wiki-dim">Plain white</span> = neutral. The number carries a <b>\u00d71.5</b> or <b>\u00d70.75</b> tag whenever the match-up is not even.',
      'It moves with the fight: buffing a stat raises every number that uses it, a debuff drops them the moment it lands, and switching the foe re-reads the match-up at once.',
      'The Ultimate prints its number too, and it is the biggest one on the bar.',
      'Hover a button for the exact range the hit lands in, and press the type button on either card for the full element sheet: <b>Strong against</b>, <b>Weak against</b> and <b>Resists</b>, all by element.',
    ]),
    h3('Dodging (Counter)', 'dodge miss counter evasion'),
    para(`Before damage is rolled, the defender gets a <b>${COUNTER_DODGE_SCALE * 100}% per point of Counter</b>
      chance to dodge, capped at <b>${COUNTER_MAX_DODGE}%</b>. A dodge grants the attacker no Ultimate Charge.`),
    h3('Critical hits', 'crit critical hit chance damage multiplier'),
    para(`After a successful hit, the attacker rolls its <b>Crit Chance</b>. On a crit the damage is
      multiplied by <code>1 + CritDamage/100</code>, the number floats in gold and the log shouts
      <b>CRITICAL HIT!</b>.`),
    h3('Buffs & debuffs', 'buff debuff stacks lower'),
    bullets([
      `<b>Buff</b> skills raise one of YOUR stats at a time and stack up to <b>${MAX_BUFF_STACKS}</b> stacks per stat.`,
      `<b>Debuff</b> skills lower one of the FOE's stats (P.ATK, S.ATK, P.DEF, S.DEF or Speed) — they always land, never miss, and also stack up to <b>${MAX_BUFF_STACKS}</b> times. Every species learns three.`,
      'Buffs and debuffs are shown as chips on both combatant cards (▲ up / ▼ down, total and stacks). Neither grants Ultimate Charge.',
      'Some Special skills carry a rider that debuffs the target (for example Speed).',
      'All buffs and debuffs clear when the battle ends.',
    ]),
    h3('The Ultimate', 'ultimate charge unleash'),
    bullets([
      `Unlocks at <b>Lv.${ULTIMATE_UNLOCK_LEVEL}</b>.`,
      `Every successful Normal or Special attack adds <b>1</b> charge; <b>${ULTIMATE_MAX_CHARGE}</b> charges unleashes it. Buffs, misses and being hit grant no charge.`,
      'The Ultimate is fixed to the species and upgrades with evolution (base → I).',
      'Using it spends all charge.',
    ]),
    h3('Fainting, items & fleeing', 'faint item switch run flee escape'),
    bullets([
      'When your Mythling faints, the next healthy one is sent out automatically — or you can switch yourself.',
      `Items and switching happen first in the turn, but the enemy still gets to act.`,
      '<b>RUN is absolute:</b> you can flee <b>any</b> battle — wild <i>or</i> trainer — at any time, even mid-fight, and it <b>always</b> succeeds. The enemy gets no free hit. EXP already earned in that battle is kept; a trainer you walked away from can be challenged again.',
      `Losing all your Mythlings sends you back to the nearest Mythling Center and costs <b>${Math.round(DEFEAT_COIN_PENALTY * 100)}%</b> of your Wildcoins. Nothing else is lost.`,
    ]),
    h3('Trainer battles', 'trainer team party count'),
    para(`Trainers field a fixed team. The enemy card shows a <b>team pip strip</b> and a
      <b>"X/Y LEFT"</b> counter, and it says <b>LAST MYTHLING!</b> when you are down to their final one —
      so you always know how much fight is left.`),
    h3('EXP from battle', 'exp experience reward'),
    para('Every Mythling that took part earns full EXP; bench members earn 40%. Trainer battles pay a x1.6 bonus. Over-levelled opponents pay far less.'),
  ];
}

function speciesSection() {
  const out = [
    h3(`The ${SPECIES_IDS.length} species of this version`, 'species mythling dex list'),
    para(`Wild Mythlings are rolled with a random Mood, Rarity and mutation. Starters use their species
      default Mood and Rarity D. Open the <b>INDEX</b> tab in the menu to see every Mythling's four forms drawn side by side.`),
    h3('Legendaries', 'legendary rare spawn aetherion venomyr basaltyr absolute ball'),
    para(`Three <b>legendary</b> Mythlings — <b>Aetherion</b> (Psychic / Electric / Ice, home: Astral Spire), <b>Venomyr</b> (Poison / Metal,
      home: Miremarsh Fen) and <b>Basaltyr</b> (Rock / Fire / Metal, home: Ironhold Foundry) — never sit in a spawn table. Any wild
      spawn on a map of one of their elements has a tiny chance to be one of them (a few times likelier on the home map). They have
      <b>one form</b> (no evolution), stronger stats, their own Ultimate that climbs its tiers by <b>level</b> (Lv.20 / 60 / 80), and
      they slip out of anything weaker than an <b>Absolute Ball</b> — the weak ball is refused, not wasted.`),
  ];
  const order = [...ELEMENT_ORDER, ...Object.keys(ELEMENTS).filter((e) => !ELEMENT_ORDER.includes(e))];
  const grouped = order.flatMap((elId) => SPECIES_IDS.filter((id) => SPECIES[id].element === elId).map((id) => [elId, id]));
  let lastEl = null;
  for (const [elId, id] of grouped) {
    if (elId !== lastEl) {
      lastEl = elId;
      out.push(h3(`${ELEMENTS[elId].name} type`, `${elId} type species list`));
    }
    const sp = SPECIES[id];
    // evolutions are revealed only once the player has owned that form
    const evoLine = sp.evolutions.map((ev, st) => (st === 0 || CollectionManager.hasForm(id, st))
      ? `${ev.name} <span class="wiki-dim">(Lv.${ev.level})</span>`
      : `<span class="wiki-dim">??? (Lv.${ev.level}) 🔒</span>`.replace('🔒', '<span class="wiki-lock">locked</span>')).join('  →  ');
    const card = el('div', { class: 'wiki-card' }, [
      el('div', { class: 'wiki-card-head' }, [
        creature(id, 0, 96),
        el('div', {}, [
          el('div', { class: 'wiki-card-title' }, [
            el('span', { text: sp.displayName }),
            ...elementChips(sp),
            el('span', { class: 'chip', text: sp.breed }),
            el('span', { class: 'chip', text: sp.role }),
            sp.starter ? el('span', { class: 'chip max', text: 'STARTER' }) : null,
          ]),
          el('div', { class: 'wiki-p', html: sp.description }),
          el('div', { class: 'wiki-dim', text: `Ultimate: ${ULTIMATES[sp.ultimate].baseName} · catch rate ${(sp.catchRate * 100).toFixed(0)}% · EXP yield ${sp.expYield}` }),
        ]),
      ]),
      table([
        ['Base stats', STAT_KEYS.map((k) => `${STAT_SHORT[k]} ${formatStat(k, sp.baseStats[k])}`).join(' · ')],
        ['Evolution line', evoLine],
        ['Found in', sp.spawnMaps.map((m) => MAPS[m].displayName).join(', ')],
        ['Default mood / rarity', `${MOODS[sp.defaultMood].name} / ${sp.defaultRarity}`],
        ['Skills', Object.keys(sp.skillUnlocks).sort((a, b) => a - b)
          .map((lv) => `Lv.${lv}: ${sp.skillUnlocks[lv].map((s) => SKILLS[s]?.name || s).join(', ')}`)
          .join(' &nbsp;|&nbsp; ')],
      ]),
    ]);
    card.dataset.wikitext = `${sp.displayName} ${sp.breed} ${sp.role} ${sp.element} ${sp.description} ${sp.evolutions.filter((e, st) => st === 0 || CollectionManager.hasForm(id, st)).map((e) => e.name).join(' ')}`.toLowerCase();
    out.push(card);
  }
  return out;
}

function skillsSection() {
  // reverse map: skill id -> species that learn it, and the level each species learns it at
  const owners = {};
  const learnLevels = {};
  for (const sp of Object.values(SPECIES)) {
    for (const lv of Object.keys(sp.skillUnlocks)) {
      for (const sid of sp.skillUnlocks[lv]) {
        (owners[sid] = owners[sid] || []).push(`${sp.displayName} (Lv.${lv})`);
        (learnLevels[sid] = learnLevels[sid] || new Set()).add(Number(lv));
      }
    }
  }
  const firstLevel = (sid) => Math.min(...(learnLevels[sid] ? [...learnLevels[sid]] : [Infinity]));
  const levelsText = (sid) => [...(learnLevels[sid] || [])].sort((a, b) => a - b).map((lv) => `Lv.${lv}`).join(' · ') || '—';
  // "by level and power": the level a skill is first learned at, then its strength
  const byRank = (a, b) => firstLevel(a.id) - firstLevel(b.id) || skillStrength(a) - skillStrength(b) || a.name.localeCompare(b.name);

  const skillRow = (s) => {
    const rider = riderSummary(s);
    const meta = isDamageSkill(s)
      ? `${s.reflect ? `<b>Returns the last hit x${s.reflect}</b>` : `Power <b>${s.power}</b>`} · ${s.damageType === 'physical' ? 'Physical (P.ATK)' : 'Special (S.ATK)'}${s.element ? ` · ${ELEMENTS[s.element].name}` : ''}${rider && !s.reflect ? ` · <b>${rider}</b>` : ''} · ${Number.isFinite(s.uses) ? `${s.uses} uses` : 'unlimited'}`
      : `<b>${buffSummary(s, ' ')}</b>${(s.effects || []).some((e) => e.target) ? '' : (s.category === 'debuff' ? ' on the foe' : ' on self')}${(s.effects || []).length > 1 ? ' · <span class="chip evolve">ELITE</span>' : ''} · ${s.uses} uses`;
    const lv = firstLevel(s.id);
    return [
      `<span class="wiki-learn">Lv.${Number.isFinite(lv) ? lv : '—'}</span> <b>${s.name}</b>`
        + ` <span class="cat-tag ${s.category}">${SKILL_CATEGORY_LABEL[s.category]}</span>`
        + `<br><span class="wiki-learn">Learned at ${levelsText(s.id)}</span>`,
      `${meta}<br><span class="wiki-dim">${s.desc}${s.debuff ? ` · ${Math.round(s.debuff.chance * 100)}% chance to lower ${STAT_SHORT[s.debuff.stat]} by ${s.debuff.amount}` : ''}</span>`
        + `<br><span class="wiki-dim">Learned by: ${(owners[s.id] || ['—']).join(', ')}</span>`,
    ];
  };
  const catRows = (cat) => Object.values(SKILLS).filter((s) => s.category === cat && s.id !== 'struggle').sort(byRank).map(skillRow);

  // Ultimates: every tier, ordered by unlock level then power
  const ultRows = [];
  for (const u of Object.values(ULTIMATES)) {
    u.tiers.forEach((t, i) => ultRows.push({ u, t, i }));
  }
  ultRows.sort((a, b) => a.t.unlockLevel - b.t.unlockLevel || (a.t.power || 0) - (b.t.power || 0) || a.u.baseName.localeCompare(b.u.baseName));
  const ultOwners = (uid) => Object.values(SPECIES).filter((sp) => sp.ultimate === uid).map((sp) => sp.displayName).join(', ') || '—';

  return [
    h3('Battle buttons & the Skill Library', 'equip buttons library order loadout'),
    para(`A Mythling takes <b>${MAX_EQUIPPED_SKILLS} skills</b> into battle — any mix of Normal, Special, Buff and Debuff,
      there are no slot types. <b>The order you equip them in is the order of the battle buttons</b>: the first
      skill you equip is button <b>1</b> (leftmost), the next is <b>2</b>, then <b>3</b> (keys 1 / 2 / 3). Unequip a
      skill and the ones after it move up; ◀ ▶ in the library re-order them. Everything a Mythling ever learns stays
      in its <b>Skill Library</b> forever, and leaving a button empty is allowed (nothing refills it, and the choice
      is saved). The Ultimate is fixed to the species and always sits on button <b>4</b>.`),
    bullets([
      '<b>Normal</b> skills: the element-less starter attack (Bite / Scratch / Peck / Pebble Toss) has unlimited uses and is the move a Mythling falls back on. Being element-less it is always <b>neutral</b> damage — it never borrows its user\u2019s element. The stronger <b>elemental</b> Normals every evolution teaches carry an element, are judged on it, and therefore have <b>limited uses</b> (30 / 25 / 20).',
      '<b>Special</b> skills hit harder and carry the elemental damage, but have limited uses. <b>Uses are a per-battle resource: every fight starts with every skill full</b> — a limited move is a budget for one battle, not for the whole trip.',
      '<b>Buff</b> skills raise one of your own stats. <b>Debuff</b> skills lower one of the foe\'s stats (P.ATK, S.ATK, P.DEF, S.DEF or Speed). Neither grants Ultimate Charge.',
      'Every species learns three Debuffs: an opener at <b>Lv.1</b>, a defence breaker at <b>Lv.12</b> and a sharp curse at <b>Lv.40</b>.',
      '<b>ELITE</b> support skills (Lv.60 / Lv.80, only 4 uses) carry <b>two</b> effects — two buffs, two debuffs, or one of each. Effects on the foe are always debuffs; effects on yourself are always buffs.',
      '<b>Life steal</b> skills attack and heal in the same move: <i>drain</i> skills heal a share of the damage they deal (a crit heals more), <i>mending</i> skills heal a fixed share of max HP after any hit.',
      '<b>Retaliate</b> / <b>Vengeance</b> return the <b>last hit you took</b> at x2 / x3. You still take the hit first, and if the foe only buffed or debuffed there is nothing to return — the move fizzles.',
      'If every equipped skill is out of uses, the Mythling falls back on its strongest <b>unlimited</b> Normal move instead of losing the turn.',
    ]),
    h3('Normal skills', 'normal unlimited bite scratch peck'),
    table(catRows('normal'), 'normal skill level learned at'),
    h3('Special skills', 'special elemental power uses'),
    table(catRows('special'), 'special skill level learned at'),
    h3('Buff skills', 'buff raise stat stacks'),
    table(catRows('buff'), 'buff skill level learned at'),
    h3('Debuff skills', 'debuff lower stat foe enemy weaken'),
    table(catRows('debuff'), 'debuff skill level learned at'),
    h3('Ultimates — by unlock level and power', 'ultimate charge tier'),
    table(ultRows.map(({ u, t, i }) => [
      `<span class="wiki-learn">Lv.${t.unlockLevel}</span> <b>${u.baseName}${t.suffix}</b>${t.future ? ' <span class="wiki-dim">(late game)</span>' : ''}`
        + `<br><span class="wiki-learn">${i === 0 ? 'Base tier' : `Tier${t.suffix}`} · evolution stage ${i + 1}</span>`,
      (isSupportUltimate(u)
        ? `<b>${u.kind === 'support' ? 'Support Ultimate' : ''}</b> · ${ELEMENTS[u.element].name} · <b>${(t.effects || []).map((e) => `${e.target === 'foe' ? 'foe ' : ''}${STAT_SHORT[e.stat]} ${e.target === 'foe' ? '-' : '+'}${e.amount}`).join(', ')}</b> · never misses, no damage`
        : `Power <b>${Math.round(t.power * ULTIMATE_POWER_SCALE)}</b> · ${ELEMENTS[u.element].name} · ${u.damageType === 'physical' ? 'Physical' : 'Special'}`)
        + `${t.selfBuff ? ` · also ${t.selfBuff.map((e) => `${STAT_SHORT[e.stat]} +${e.amount}`).join(', ')} on self` : ''}`
        + `<br><span class="wiki-dim">${u.desc}</span><br><span class="wiki-dim">Used by: ${ultOwners(u.id)}</span>`,
    ]), 'ultimate tier power level'),
    note(`An Ultimate needs <b>${ULTIMATE_MAX_CHARGE}/${ULTIMATE_MAX_CHARGE}</b> charge. Charge comes only from
      successful Normal and Special attacks. The tier matches the evolution stage (Base → I → II → III).
      <b>Support Ultimates</b> (Granite Bastion, Quake Curse, Crystal Resonance) deal no damage: they are Ultimate-grade
      buffs / debuffs with two effects — buffs on yourself, debuffs on the foe, or one of each.`),
  ];
}

function itemsSection() {
  const rowsFor = (catId) => Object.values(ITEMS).filter((i) => i.category === catId).map((i) => {
    let effect = i.desc;
    if (i.heal) effect += ` <span class="wiki-dim">(restores ${i.heal} HP)</span>`;
    if (i.revive) effect += ` <span class="wiki-dim">(revives with ${Math.round(i.revive * 100)}% HP)</span>`;
    if (i.restoreUses) effect += ` <span class="wiki-dim">(+${i.restoreUses} uses to every limited skill)</span>`;
    if (i.restoreAllUses) effect += ' <span class="wiki-dim">(resets every limited skill to full uses)</span>';
    if (i.healFull) effect += ' <span class="wiki-dim">(restores ALL HP)</span>';
    if (i.exp) effect += ` <span class="wiki-dim">(grants ${i.exp.toLocaleString()} EXP)</span>`;
    if (i.guaranteed) effect += ` <span class="wiki-dim">(<b>100%</b> catch — guaranteed${i.forceMutation ? `, always <b>${MUTATIONS[i.forceMutation].name}</b>` : ''})</span>`;
    else if (i.catchMult) effect += ` <span class="wiki-dim">(x${i.catchMult.toFixed(2)} catch)</span>`;
    if (i.rerollMood) effect += ' <span class="wiki-dim">(re-rolls the Mood — use from the Mythling\'s profile)</span>';
    if (i.rerollRational) effect += ' <span class="wiki-dim">(re-rolls the Rational — use from the Mythling\'s profile)</span>';
    return [
      `<b>${i.name}</b>${i.price ? '' : ' <span class="wiki-dim">(not sold)</span>'}`,
      `${effect}${i.price ? ` · <b>${i.price.toLocaleString()}</b> Wildcoins` : ''}`,
    ];
  });
  return [
    h3('Bags & money', 'bag inventory wildcoins shop'),
    para(`Wildcoins are earned from trainer battles and are spent in the shops of each region.
      Your bag has no size limit in this version.`),
    ...ITEM_CATEGORIES.map((c) => block([
      h3(c.name, c.id),
      table(rowsFor(c.id)),
    ], c.name)),
    note(`<b>Food</b> is the fast way to train: feeding it converts straight into EXP. You can feed a whole
      <b>stack at once</b> (−/+/MAX picker) and the game caps the amount at what it takes to reach Lv.${LEVEL_CAP},
      so no food is ever wasted. The <b>God Ball</b> is the supreme regular ball — a guaranteed catch — and the
      <b>Shiny Ball</b> / <b>Dark Ball</b> go one step further: guaranteed catch <i>and</i> a guaranteed Shiny / Darkness
      mutation. They are sold only at the Crags Outfitter in Stonehollow Crags, and they are priced like it.`),
  ];
}

function worldSection() {
  const out = [
    h3('Regions', 'region map area'),
    para(`Wild levels are <b>fixed per region</b> — they never scale up to your party. Verdant Vale spawns
      Lv.1–20, Azure Coast Lv.15–30, Emberwild Lv.30–45 and Stonehollow Crags Lv.45–60. When the wild Mythlings
      of an area start to feel weak, that is the signal to beat its Guardian and move on to the next one.
      Each region is the home of one element: Nature, Water, Fire and Rock.`),
  ];
  for (const id of MAP_ORDER) {
    const map = MAPS[id];
    const gates = (map.connections || []).map((c) =>
      `→ ${MAPS[c.toMap].displayName}${c.requiresItem ? ` (needs ${ITEMS[c.requiresItem]?.name || c.requiresItem})` : ''}`).join(', ');
    out.push(block([
      table([
        [`<b>${map.displayName}</b>`, `Wild Mythlings <b>Lv.${map.levelRange[0]}–${map.levelRange[1]}</b> · routes: ${map.regions.map((r) => r.name).join(' → ')}`],
        ['Gates', gates || '—'],
      ]),
    ], map.displayName));
  }
  out.push(h3('Trainers', 'trainer npc boss guardian'));
  for (const id of MAP_ORDER) {
    const map = MAPS[id];
    const trainers = (map.trainers || []).map((t) => [
      `<b>${t.name}</b>${t.guardian ? ' <span class="chip evolve">GUARDIAN</span>' : ''}${t.finalBoss ? ' <span class="chip max">FINAL</span>' : ''}`,
      `${t.team.map((m) => `${SPECIES[m.species].displayName} Lv.${m.level}${m.rarity && m.rarity !== 'D' ? ` (${m.rarity})` : ''}`).join(', ')}`
      + ` · reward ${t.reward?.coins || 0} Wildcoins${Object.keys(t.reward?.items || {}).length ? ` + ${Object.entries(t.reward.items).map(([i, q]) => `${q}x ${ITEMS[i]?.name || i}`).join(', ')}` : ''}`,
    ]);
    out.push(block([table(trainers)], map.displayName));
  }
  out.push(h3('Buildings', 'center shop heal healpoint'));
  out.push(bullets([
    '<b>Mythling Center</b> — free, instant healing: HP, skill uses and status restored. Your last used Center is where you wake up after a wipe.',
    '<b>Shops</b> — buy balls, healing items and food with Wildcoins.',
    '<b>Gates</b> — sealed until you defeat that region’s Guardian and earn its key item.',
  ]));
  out.push(note('Healing at a Center restores HP and skill uses and resets Ultimate Charge to 0 — it never touches your EXP.'));
  out.push(h3('Treasure chests', 'chest treasure bronze silver emerald ultra gold loot'));
  out.push(para(`Chests are scattered through the wild areas of every map. A map holds at most <b>two Bronze</b> chests and
    <b>one</b> of each other tier at a time; an opened chest is gone, and the map rolls a fresh set of chests
    after about <b>${Math.round(CHEST_REROLL_MS / 60000)} minutes</b> of play. Every chest holds Wildcoins (more in later regions);
    the rarer the chest, the likelier it also holds a ball or a food — and the best balls and foods only ever come out of the best chests.`));
  out.push(table(CHEST_TIER_IDS.map((id) => {
    const t = CHEST_TIERS[id];
    return [
      `<b style="color:${t.colors.trim}">${t.name}</b>`,
      `${(t.chance * 100).toFixed(t.chance < 0.01 ? 1 : 0)}% per slot · up to <b>${t.max}</b> on a map · ${t.coins[0]}–${t.coins[1]} Wildcoins (× region) · `
        + `${Math.round(t.itemChance * 100)}% item: ${[...t.balls, ...t.foods].map((i) => ITEMS[i]?.name || i).join(', ')}`,
    ];
  }), 'chest tiers loot table'));
  return out;
}

function progressSection() {
  const curve = [1, 5, 10, 15, 20, 25, 29].map((lv) => [
    `Lv.${lv} → Lv.${lv + 1}`, `${expToNextLevel(lv)} EXP`,
  ]);
  return [
    h3('EXP & levelling', 'exp experience level up curve'),
    para(`Defeating Mythlings and trainers, and feeding food, all grant EXP. Up to <b>Lv.30</b> the
      requirement is <code>24 + 9 × level^1.85</code>. Past the story cap it continues as a straight line
      through that same Lv.30 cost, so a level always costs roughly what a level-appropriate battle
      pays out — reaching Lv.100 is a long post-game grind instead of an impossible one.`),
    table(curve),
    bullets([
      `Every Mythling can reach <b>Lv.${LEVEL_CAP}</b>. At the cap no more EXP is stored.`,
      'Wild Mythlings and trainer teams keep pace with your party: once you out-level a zone or a trainer, their levels rise with you, so late grinding still pays.',
      'Levelling up raises every stat and tops up HP by the amount max HP grew.',
      'Levels are also where new skills are learned — they are added to the library automatically.',
    ]),
    h3('Evolution', 'evolve evolution stage level 20'),
    table([
      ['Stage 0', 'The base form you catch or start with.'],
      ['Lv.20', 'First evolution (stat multiplier ~1.34) and Ultimate tier “ I ”.'],
      ['Lv.60', 'Second evolution (~1.75) and Ultimate tier “ II ”.'],
      ['Lv.80', 'Final evolution (~2.20) and Ultimate tier “ III ”.'],
    ]),
    para(`All four stages are live. Evolution is offered automatically after a battle or feed: it raises
      stats, upgrades the Ultimate, and unlocks that stage’s skills — a new <b>Special</b>, a new
      <b>Buff</b> and a stronger <b>unlimited Normal</b> move. The INDEX tab shows what every form looks like.`),
    h3('Capture resets level', 'catch capture reset level one'),
    note('A captured Mythling is <b>always</b> reset to Lv.1 with its library rebuilt for Lv.1. Its species, Mood, Rarity and mutation are preserved, and the level you caught it at is recorded on its info panel.'),
    h3('Collection', 'collection dex seen caught'),
    para('Every species and mutation you see or catch is recorded in the COLLECTION tab, and the INDEX tab shows all four forms of each species once you have seen it.'),
  ];
}

function controlsSection() {
  return [
    h3('World', 'controls keys movement'),
    table([
      ['W A S D / arrows', 'Move'],
      ['Shift (held)', 'Run while moving'],
      ['E / Enter', 'Interact with people, buildings and signs'],
      ['ESC', 'Open the menu — or close whatever panel is on top'],
      ['Touch devices', 'An on-screen stick appears on first touch'],
    ]),
    h3('Battle', 'battle keys shortcuts'),
    table([
      ['1 / 2 / 3', `Battle buttons — the ${MAX_EQUIPPED_SKILLS} equipped skills, in the order you equipped them`],
      ['4 / R', 'Ultimate (when fully charged)'],
      ['Mouse / tap', 'Every action is clickable: ITEM, PARTY, CATCH, RUN'],
      ['RUN', 'Leaves any battle — wild or trainer — instantly and always succeeds'],
    ]),
    h3('Shortcuts', 'shortcuts keys cheat coins'),
    table([
      ['Esc', 'Player menu (also the ☰ button). Esc also closes any panel or dialogue.'],
      ['Del', 'Cheat menu — instantly adds 100 / 1,000 / 100,000 / 1,000,000 Wildcoins.'],
    ]),
    para('Defeating a wild Mythling drops <b>Wildcoins</b>: the reward grows with its level and EXP '
      + 'yield and shrinks when you out-level it, so early areas cannot be farmed forever. '
      + 'Trainer battles pay their own bounty instead.', 'wildcoins drop reward'),
    h3('Menu tabs', 'menu tabs party bag'),
    table([
      ['PARTY', 'Your team: reorder, inspect, evolve. Click a Mythling for full details.'],
      ['MYTHLINGS', 'Storage with filters and sorting. <b>RELEASE</b> on a card removes that Mythling for good — the species stays marked as seen in your Collection.'],
      ['SKILLS', `Skill Library — equip up to ${MAX_EQUIPPED_SKILLS} skills of any kind; equip order = button order.`],
      ['BAG', 'Balls, healing, food and key items; feed food (a whole stack at once) for EXP.'],
      ['MAP', 'Regions you have unlocked.'],
      ['COLLECTION', 'Species and mutations discovered.'],
      ['INDEX', 'Every species with all four forms.'],
      ['STATS', 'Trainer record: play time, coins, progress.'],
      ['SAVE', 'Manual save, slot switching, quit to menu.'],
      ['SETTINGS', 'Audio, text speed, display, and the Game Wiki.'],
    ]),
    h3('Bars you will see', 'bar hp exp ult charge label'),
    table([
      ['HP bar (green/yellow/red)', 'Current health. Healing fills it back to full.'],
      ['EXP bar (blue)', `Progress to the next level — <b>never</b> lost when healing. At Lv.${LEVEL_CAP} it shows MAX.`],
      ['ULT bar (orange)', 'Ultimate Charge, 0–8. A Center heal resets it to 0.'],
    ]),
  ];
}

function versionSection() {
  return [
    h3(`Version ${GAME_VERSION}`, 'version number build'),
    table([
      ['Level cap', `Lv.${LEVEL_CAP}`],
      ['Species', `${SPECIES_IDS.length} (${STARTER_IDS.length} starters — your partner is always ${STARTER_RARITY} rarity)`],
      ['Regions', `${MAP_ORDER.length}`],
      ['Moods', `${MOOD_IDS.length}`],
      ['Party / Storage', `${PARTY_MAX} / ${STORAGE_MAX}`],
      ['Evolution stages live', `Lv.1 and Lv.20 (${EVOLUTION_LEVELS.slice(0, 2).join(', ')})`],
    ]),
    h3('Coming in future updates', 'roadmap future locked'),
    bullets([
      'Lv.60 and Lv.80 evolutions (already described in the data).',
      'Higher level caps and more regions.',
      'More species, skills and moods.',
    ]),
    note('Everything in this Wiki is generated from the same data files the game runs on, so it always matches the build you are playing.'),
  ];
}

// ------------------------------------------------------------------ screen
/** The section list, exposed so tests can render every page headlessly. */
export const WIKI_SECTIONS = SECTIONS;

export function openWiki(sectionId = 'basics') {
  if (Screens.top()?.dataset.id === 'wiki') return;
  let current = sectionId;

  const nav = el('div', { class: 'wiki-nav' });
  const bodyWrap = el('div', { class: 'wiki-body' });
  const status = el('div', { class: 'wiki-status', text: '' });

  const searchInput = el('input', {
    type: 'text', class: 'wiki-search', placeholder: 'Search this page…',
    oninput: () => applySearch(),
    onkeydown: (e) => e.stopPropagation(),
  });

  const node = el('div', { class: 'wiki-screen panel screen-inner' }, [
    el('div', { class: 'panel-head sticky' }, [
      el('div', { class: 'panel-head-text' }, [
        el('h2', { class: 'panel-title', text: 'Game Wiki' }),
        el('p', { class: 'sub', text: 'Every rule, stat, Mythling, skill and item — generated live from the game data.' }),
      ]),
      el('div', { class: 'row', style: { gap: '8px' } }, [
        searchInput,
        closeButton(() => Screens.pop(), 'Close wiki (ESC)'),
      ]),
    ]),
    el('div', { class: 'wiki-main' }, [nav, el('div', { class: 'wiki-col' }, [status, bodyWrap])]),
  ]);

  const renderNav = () => {
    nav.innerHTML = '';
    for (const [id, label, ico] of SECTIONS) {
      const b = el('button', { class: `wiki-tab ${current === id ? 'active' : ''}`, title: label }, [icon(ico), el('span', { text: label })]);
      b.addEventListener('click', () => {
        AudioManager.sfx('click');
        current = id;
        searchInput.value = '';
        renderNav();
        renderBody();
      });
      nav.appendChild(b);
    }
    nav.appendChild(el('div', { class: 'wiki-nav-foot', text: `Mythlings: Wildbound v${GAME_VERSION}` }));
  };

  const renderBody = () => {
    const sec = SECTIONS.find((s) => s[0] === current) || SECTIONS[0];
    bodyWrap.innerHTML = '';
    bodyWrap.scrollTop = 0;
    bodyWrap.appendChild(el('div', { class: 'wiki-section' }, sec[3]()));
    status.textContent = sec[1];
    applySearch();
  };

  function applySearch() {
    const q = searchInput.value.trim().toLowerCase();
    const blocks = bodyWrap.querySelectorAll('[data-wikitext]');
    let shown = 0;
    for (const b of blocks) {
      const hit = !q || (b.dataset.wikitext || '').includes(q);
      b.classList.toggle('wiki-hidden', !hit);
      if (hit) shown += 1;
    }
    // hide an empty section header if everything under it was filtered out
    if (q) status.textContent = `${shown} result${shown === 1 ? '' : 's'} for “${searchInput.value.trim()}”`;
    else status.textContent = (SECTIONS.find((s) => s[0] === current) || SECTIONS[0])[1];
  }

  renderNav();
  renderBody();
  Screens.push(node, 'wiki', () => Screens.pop());
  setTimeout(() => searchInput.blur(), 30);
  return node;
}

export default openWiki;
