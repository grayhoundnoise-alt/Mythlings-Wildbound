// =====================================================================
// GAME WIKI — every rule, stat, mood, Mythling, skill, item and region
// in one searchable reference. Opened from Settings (and the title
// screen's Settings). Content is generated straight from the data files,
// so the Wiki can never drift away from the way the game actually works.
// =====================================================================
import { el, Screens, closeButton, elementChip } from './ui.js';
import { icon } from './icons.js';
import { drawMythling } from '../render/creatures.js';
import { SPECIES, SPECIES_IDS, STARTER_IDS } from '../data/species.js';
import { SKILLS, ULTIMATES, ULTIMATE_MAX_CHARGE, MAX_BUFF_STACKS, buffSummary, skillStrength, isDamageSkill, SKILL_CATEGORY_LABEL } from '../data/skills.js';
import { MAX_EQUIPPED_SKILLS } from '../core/mythling.js';
import {
  MOODS, MOOD_IDS, STAT_KEYS, STAT_LABELS, STAT_SHORT, STAT_INFO,
  STAT_BAR_MAX, formatStat,
} from '../data/moods.js';
import { RARITIES, RARITY_ORDER } from '../data/rarity.js';
import { MUTATIONS, MUTATION_IDS } from '../data/mutations.js';
import { ITEMS, ITEM_CATEGORIES, BALL_IDS } from '../data/items.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';
import { ELEMENTS, EFFECTIVENESS, elementMultiplier } from '../data/elements.js';
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
    note(`Counter was nerfed: it used to give a full 1% dodge per point (up to 35%). It is now
      half that, capped at ${COUNTER_MAX_DODGE}%, so a missed attack is a surprise instead of a routine.`),
    h3('Crit Chance & Crit Damage', 'crit critical chance multiplier damage'),
    table([
      ['CRIT — Crit Chance', `Percent chance that an attack lands critically. Caps at <b>${CRIT_MAX_PERCENT}%</b>.`],
      ['C.DMG — Crit Damage', `Bonus damage on a critical hit. +50% means a crit deals <b>1.5x</b>. Caps at <b>+${CRIT_MAX_MULT}%</b> (x3).`],
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
    const up = m.up.map((k) => `<b class="good">+${STAT_SHORT[k]}</b>`).join(' ');
    return [
      `${m.name}${m.up.includes('crit') || m.up.includes('critMult') ? ' <span class="chip evolve">CRIT</span>' : ''}`,
      `${up} &nbsp;&nbsp; <b class="bad">-${STAT_SHORT[m.down]}</b>`,
    ];
  });
  return [
    h3('What a Mood is', 'mood personality nature'),
    para(`Every Mythling has a <b>Mood</b>: a fixed trait that raises <b>three</b> stats and lowers
      <b>one</b>. Moods are rolled when a wild Mythling appears and are kept forever — through
      capture, evolution and every level up. There are <b>${MOOD_IDS.length}</b> moods.`),
    h3('Rarity amplifies the Mood', 'rarity magnitude scale'),
    para(`Rarity does not change base stats by itself — it sets the <b>magnitude</b> of the Mood bonus.
      Rarity <b>D</b> adds nothing at all; <b>SSS+</b> adds a huge swing. HP counts triple and Crit Damage counts double.`),
    table(RARITY_ORDER.map((id) => [
      `<b style="color:${RARITIES[id].color}">Rarity ${id}</b>`,
      `Mood magnitude <b>+${RARITIES[id].magnitude}</b>`,
    ])),
    h3('All moods', 'list table of moods'),
    table(rows),
    note(`Example — a <b>Brave</b> Mythling at Rarity <b>S</b> (magnitude 5): <b>+15 HP, +5 P.ATK, +5 CNT, −5 S.DEF</b>.
      The same Mood at Rarity D (magnitude 0) changes nothing.`),
  ];
}

function raritySection() {
  const mut = MUTATION_IDS.filter((id) => id !== 'none').map((id) => [
    `<span style="color:${MUTATIONS[id].color}">${MUTATIONS[id].name}</span>`,
    `${(MUTATIONS[id].chance * 100).toFixed(1)}% chance · cosmetic only (no stat change)`,
  ]);
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
    table(BALL_IDS.map((id) => {
      const it = ITEMS[id];
      return [`${it.name}`, `x${it.catchMult.toFixed(2)} catch · ${coins(it.price)} Wildcoins`];
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
    h3('The elemental triangle', 'element effectiveness chart nature water fire'),
    para(`Attacks use the <b>element of the skill</b>. Hitting a weakness multiplies damage by
      <b>x${EFFECTIVENESS.STRONG}</b>; hitting a resistance multiplies it by <b>x${EFFECTIVENESS.WEAK}</b>.
      Same element vs same element is neutral.`),
    bullets(ids.map((id) => {
      const beats = ids.filter((d) => elementMultiplier(id, d) > 1).map((d) => ELEMENTS[d].name);
      return `<b style="color:${ELEMENTS[id].color}">${ELEMENTS[id].name}</b> is strong against ${beats.join(', ')}`;
    })),
    block([grid], 'element chart table'),
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
      '<b>levelFactor</b> grows 8.5% per level above Lv.1.',
      '<b>stageFactor</b> is the evolution stat multiplier (1.00 base, 1.34 evolved).',
      'Every hit deals at least <b>1</b> damage.',
      'The battle log now reports the exact damage of every attack.',
    ], 'power off def level factor random'),
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
  ];
  for (const id of SPECIES_IDS) {
    const sp = SPECIES[id];
    const evoLine = sp.evolutions.map((ev) => `${ev.name} <span class="wiki-dim">(Lv.${ev.level})</span>`).join('  →  ');
    const card = el('div', { class: 'wiki-card' }, [
      el('div', { class: 'wiki-card-head' }, [
        creature(id, 0, 96),
        el('div', {}, [
          el('div', { class: 'wiki-card-title' }, [
            el('span', { text: sp.displayName }),
            elementChip(sp.element),
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
    card.dataset.wikitext = `${sp.displayName} ${sp.breed} ${sp.role} ${sp.element} ${sp.description} ${sp.evolutions.map((e) => e.name).join(' ')}`.toLowerCase();
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
    const meta = isDamageSkill(s)
      ? `Power <b>${s.power}</b> · ${s.damageType === 'physical' ? 'Physical (P.ATK)' : 'Special (S.ATK)'}${s.element ? ` · ${ELEMENTS[s.element].name}` : ''} · ${Number.isFinite(s.uses) ? `${s.uses} uses` : 'unlimited'}`
      : `<b>${buffSummary(s, ' ')}</b> ${s.category === 'debuff' ? 'on the foe' : 'on self'} · ${s.uses} uses`;
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
  const allByLevel = Object.values(SKILLS).filter((s) => s.id !== 'struggle' && learnLevels[s.id]).sort(byRank);

  // Ultimates: every tier, ordered by unlock level then power
  const ultRows = [];
  for (const u of Object.values(ULTIMATES)) {
    u.tiers.forEach((t, i) => ultRows.push({ u, t, i }));
  }
  ultRows.sort((a, b) => a.t.unlockLevel - b.t.unlockLevel || a.t.power - b.t.power || a.u.baseName.localeCompare(b.u.baseName));
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
      '<b>Normal</b> skills have unlimited uses but low power — every evolution teaches a stronger one.',
      '<b>Special</b> skills hit harder and carry the elemental damage, but have limited uses.',
      '<b>Buff</b> skills raise one of your own stats. <b>Debuff</b> skills lower one of the foe\'s stats (P.ATK, S.ATK, P.DEF, S.DEF or Speed). Neither grants Ultimate Charge.',
      'Every species learns three Debuffs: an opener at <b>Lv.1</b>, a defence breaker at <b>Lv.12</b> and a sharp curse at <b>Lv.40</b>.',
      'If every equipped skill is out of uses, the Mythling falls back on its strongest <b>unlimited</b> Normal move instead of losing the turn.',
    ]),
    h3('All skills by unlock level', 'all skills level order list'),
    para('Every learnable skill, from the earliest to the latest unlock. Within a level, weaker skills come before stronger ones.'),
    table(allByLevel.map(skillRow), 'skill level learned at rank'),
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
      `Power <b>${t.power}</b> · ${ELEMENTS[u.element].name} · ${u.damageType === 'physical' ? 'Physical' : 'Special'}`
        + `${t.selfBuff ? ` · also ${t.selfBuff.map((e) => `${STAT_SHORT[e.stat]} +${e.amount}`).join(', ')} on self` : ''}`
        + `<br><span class="wiki-dim">${u.desc}</span><br><span class="wiki-dim">Used by: ${ultOwners(u.id)}</span>`,
    ]), 'ultimate tier power level'),
    note(`An Ultimate needs <b>${ULTIMATE_MAX_CHARGE}/${ULTIMATE_MAX_CHARGE}</b> charge. Charge comes only from
      successful Normal and Special attacks. The tier matches the evolution stage (Base → I → II → III).`),
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
    if (i.guaranteed) effect += ' <span class="wiki-dim">(<b>100%</b> catch — guaranteed)</span>';
    else if (i.catchMult) effect += ` <span class="wiki-dim">(x${i.catchMult.toFixed(2)} catch)</span>`;
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
      so no food is ever wasted. The <b>King Ball</b> is the only ball with a guaranteed catch — and it is priced like it.`),
  ];
}

function worldSection() {
  const out = [
    h3('Regions', 'region map area'),
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
      ['MYTHLINGS', 'Storage with filters and sorting.'],
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
