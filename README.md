# MYTHLINGS: WILDBOUND
### *Small Creatures. Big Adventures.*

An original, fully playable creature-collecting RPG that runs in the browser with **no build step, no
frameworks and no external assets** — every creature, map, effect and sound is generated procedurally
by the game's own code.

> **The core loop:** Explore → Encounter → Battle → **Defeat** → Catch → **the caught Mythling becomes Lv.1** →
> Train → Evolve at Lv.20 → Explore stronger regions → Repeat.

---

## Run it

**Easiest — no server, no install:** download **`MythlingsWildbound-Offline.html`** and double-click it.
It is the whole game (code + styles) inlined into one self-contained file.

**As a normal web project:**

```bash
npm start            # serves the folder on http://localhost:3000
# or any static server:  npx serve .   |   python3 -m http.server 3000
```

Then open the page. Everything is ES modules loaded straight from `index.html` — which is why
opening `index.html` directly from disk shows a black screen: browsers block `file://` module
imports. Use the offline build above for that, or rebuild it after changing the source:

```bash
npm run build:offline   # regenerates MythlingsWildbound-Offline.html
```

```bash
npm test             # 111 headless rule tests (levels, crits, capture, evolution, save/load, maps, rig, VFX…)
```

### MYTHLING EDIT — the standalone content editor (not part of the game)

**`MythlingEdit.html`** is a separate, single-file, fully offline editor for creatures, parts, anchors,
rigs, animations, skill VFX, props, NPCs, maps, collision, encounter zones and warps. Double-click it —
no server, no build step, no external dependencies. It never touches the game: it reads and writes its
own project JSON (`{ project, maps, mythlings, objects, animations, vfx, … }`, kept in IndexedDB with
autosave and snapshots) and exports JSON / JavaScript (`registerMythling`, `registerMap`,
`registerAnimation`, `registerVFX`, `registerObject`), PNG previews and a **COPY FOR ARENA AI**
implementation package that you can paste into a chat to have the content wired into the game.

**Game presets.** The build embeds a *read-only snapshot* of the game's data and art modules
(`src/data/*`, `creatureArt.js`, `creatureRig.js`, `worldRenderer.js`). A new project therefore starts
from the real content: the 9 maps (regions, water, bridges, buildings, landmarks, NPCs, trainers,
encounter zones, connections and the procedurally generated props, all at their game coordinates), the
55 Mythlings (the game's art layers as live, individually editable parts with anchors; the 12 game
animations sampled into editable keyframes; stats, evolutions, skill unlocks, palette), every skill and
skill-VFX descriptor. `PROJECT → Game Presets…` re-imports any of them, `HELP → About the Game Data
Snapshot` lists what was embedded, and the EXPORT screen's **Game format** option writes the edited
content back in the `maps.js` / `species.js` / `skills.js` / `skillVfx.js` schema (also included in the
ARENA AI package). Importing presets copies data into the project — the game files are never modified.

```bash
node tools/build-editor.mjs                 # regenerates MythlingEdit.html (with the game data snapshot)
node tools/build-editor.mjs --no-game       # variant without the snapshot (demo content only)
node tools/build-editor.mjs --check         # validate only; --out=path writes elsewhere
```

Optional headless regression test for the editor (drives the built file in jsdom with a real canvas):
`npm i --no-save jsdom @napi-rs/canvas` then `node tools/mythling-edit/test/game-presets.test.mjs`.

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Move (hold `Shift` to run) |
| `E` / `Enter` | Interact: NPCs, trainers, wild Mythlings, buildings, signs |
| `Esc` | Player menu (also the ☰ button) |
| `1` `2` `3` | The three battle buttons — your equipped skills, in the order you equipped them |
| `4` or `R` | Ultimate (when 8/8) |
| `Del` | Cheat menu (adds Wildcoins) — available anywhere in the game |
| Mouse / touch | Everything — the whole UI is clickable; a touch stick appears on touch devices |

---

## What's in this version

| | |
|---|---|
| **Mythlings** | 55 species — 20 originals, 25 new lines across Electric / Ice / Metal / Poison / Psychic (5 each), **5 Fighting lines** (pure-Fighting Cubrawl plus dual-typed Ironpaw, Emberfist, Stormkick and Zenram), two other **dual-typed** lines (Poison/Psychic Mirewisp, Electric/Metal Sparkbug) and three **legendaries** (Aetherion, Venomyr, Basaltyr: one form, 2–3 elements, rare spawns, Absolute Ball or better). 14 procedural body plans, 4 visibly different stages per line |
| **Regions** | 9 with **fixed level bands** — Verdant Vale 1–20, Azure Coast 15–30, Emberwild 28–40, Stonehollow Crags 38–48, Stormreach Plateau 46–56, Frostveil Tundra 54–64, Ironhold Foundry 62–72, Miremarsh Fen 70–80, Astral Spire 78–90. Wild levels never scale to your party and **trainer teams are fixed** at their written levels |
| **Elements** | 10 — Nature, Water, Fire, Rock, Electric, Ice, Metal, Poison, Psychic, Fighting. Every element beats two or three and fears one to three; dual / triple types multiply every one of their elements (1.5× / 0.75× / 1.0×) |
| **Battle** | Damage scaling reworked: no more Lv.100 coin-flip one-shots — a neutral Special takes ~7 hits, a super-effective Ultimate ~1.8. Crit is a lucky spike, not a coin flip: chance caps at 10 %, crit damage at +35 % |
| **Damage you can read** | Every attack button prints the damage it will do to the Mythling across the arena **right now** — green when super effective, red when resisted, white when neutral — and it updates the moment a buff, a debuff or a switch changes it |
| **Level cap** | Lv.100 — every evolution stage is reachable |
| **Evolution** | Lv.20 / Lv.60 / Lv.80. The **Index only reveals a form once you have owned it**. Legendaries never evolve; their Ultimate tiers unlock by level |
| **Ultimate** | 8-charge system, unlocks at Lv.10, upgrades a tier per evolution. A **Normal or Special attack** that lands grants **+1**, and so does a **Buff** — choosing support is never a dead turn for the bar. A **Debuff** grants nothing, since it acts on the foe. Support Ultimates buff the caster and/or debuff the foe with two effects per tier |
| **Sleep** | A small chance (30–35 %) to put the foe to sleep for **2–4 turns** (1–3 for the light ones). A sleeping Mythling **loses its whole turn** — but you can still switch or use an item, and a **Cleanse Tonic** wakes it. Re-sleeping adds to the counter, **capped at 5 turns** |
| **Seals** | Locks **the move the foe just used** for 1–2 turns. It cannot be pressed while sealed, so the Mythling falls back on its unlimited Normal attack instead of losing the turn. The unlimited attack can never be sealed, so you are never left with nothing to do |
| **Cheats** | Press **DEL** any time for the cheat menu: instant Wildcoins, or **GIVE ALL MYTHLINGS (SSS+)** — one of every species at its **highest form, Lv.100, SSS+**, sent straight to Mythling Storage (only as many as your bag has room for; nothing is ever released to make space). Mythling Storage also has a **Release All** button |
| **Weather** | Two ways in, both limited to the **twelve specialists** (two per element). The **exclusive** (Lv.60, one per element, 42 power, 6 uses, 75 % chance) is the main event. The **light route** (Lv.40) is a weak **Normal** (15 power, 2 uses) and a stat **Buff** (3 uses), both at a 45 % chance — the Normal hits *less* than the element's first attack and the Buff gives the same stat gain as the plain Buffs, so the weather is the only real payoff. Either way it **changes the arena in real time and lasts for the rest of the battle** — until it ends, you run, or another weather replaces it. Skills that **match** the weather's element hit **×1.5 — for both sides**; a Mythling on the field that does not match takes **100 damage every turn (180 if it is weak to the weather)**, flat at every level |
| **Secret settings** | **Ctrl + Enter**, from anywhere, opens a hidden panel that is not linked from any menu. It holds one switch, **HD Images**, off by default. On, and any Mythling or battle background that has a picture in `assets/` is drawn from that PNG instead of the animated rig; everything else keeps animating, and the roaming map is never touched. Battle keeps its particles, screen shake and the red hit-flash — only the model's own animation goes still. The offline build inlines the art as base64, so `file://` works too |
| **Mutations** | Shiny ✧ (+1 to every stat) and Darkness ☾ (+2), with their own colours and aura |
| **Legendaries stand out** | A legendary Mythling never looks like an ordinary card: wherever one appears — party, Mythling Storage, item and food pickers — its card gets a gold frame with a travelling sheen, a breathing aura and a **LEGENDARY** badge. Honours `prefers-reduced-motion` (it still looks legendary when the animation is off) |
| **Clean stat readout** | Every card and the detail panel lead with the plain numbers — `HP: 1446 · P.ATK: 109 · S.ATK: 205 …` — no bars, no bonus arithmetic. The bars and the Mood/Rational `(+n)` nets stay on the detail panel for anyone who wants the breakdown |
| **Stats** | 9: HP, P.ATK, S.ATK, P.DEF, S.DEF, SPD, **CNT** (evasion, 0.15 % dodge per point, capped at 6 %), **CRIT** (capped at 25 %), **C.DMG** |
| **Moods & Rationals** | Moods are purely positive: each raises **three** stats (25 unique trios, scaled by Rarity). Every Mythling also has a **Rational**: a fixed +10 / −10 on two stats. Mood Tonic / Temper Tonic re-roll them |
| **Balls** | Basic · Normal · Advanced · Absolute · **God** (guaranteed) · **Shiny** / **Dark** (guaranteed catch **and** guaranteed mutation). Each region's shop sells its own tier; the **last region's shop carries the complete catalogue** |
| **Treasure chests** | Bronze (max 2 per map) · Silver · Emerald · **Ultra Gold** (nearly impossible) scattered through the wild areas; coins always, balls / food from the rarer tiers, the best loot only from the best chests; a map re-rolls its chests after ~12 min of play |
| **Camera** | Settings → **Camera Zoom** (×1.1 – ×1.8), or the mouse wheel / `+` `−` in the world |
| **Systems** | Rarity, Skill Library, life-steal / Retaliate skills, Party (6), Storage, Inventory, Shops, Wildcoins, NPC trainers, Index & Collection grouped by type, Save/Load/Autosave, Settings, **Game Wiki** |

### Battle & training rules (latest)

* **RUN is absolute** — you can leave *any* battle, wild **or** trainer, at any moment, and it
  always succeeds. The enemy gets no free hit; EXP already earned is kept; the trainer can be
  challenged again later.
* **TACTICAL skills — Guard, Purge, Ward** (every Mythling learns them; Lv.12 / Lv.20 / Lv.40 —
  exactly three, no elite variants). They deal **no damage**, so by the house
  rule they are **Buff-type** buttons — but each costs a whole turn, and they exist so a Mythling
  that is **faster than its foe** can act first and shape the round before the enemy's blow lands:
  * **Guard Stance** — the foe's **next attack is cancelled outright**: no damage, no crit, no
    Ultimate charge for the attacker. The answer to a telegraphed Ultimate — brace, eat nothing,
    then charge your own. It covers **exactly one attack** and lapses at the end of the round, so
    it can never be banked into a free double block. It also raises both Defenses.
  * **Purge** — wipes **every buff off the foe** (Attack, Defense, Speed). Debuffs untouched.
  * **Ward** — strips **every debuff off you**. Your own buffs are left alone.
  * They are **never auto-equipped** — the default loadout stays the species' real
    attacker / defender / debuff. Equip them by hand in the Skill Library.
* **BURN & POISON — damage over time** — Fire skills leave a **Burn**, Poison skills leave a
  **Poison**, and the foe bleeds Health at the **end of every round** for up to **10 turns**
  (the hard cap). The tick **scales with the TARGET's level**
  (`2 + 0.55 x level`, so Lv.20 takes 13 a round and Lv.100 takes 57) — the same burn is worth
  far more against something that can survive it, which is what makes a status a real turn to
  spend. Re-applying **refreshes** the counter, so a status can never be doubled into a double
  tick. Ticks are flat: no crit, no Defense reduction, and **Guard does not stop them** — bracing
  stops a blow, not the fire already inside you. Burn is <i>not</i> the weather field: see below.
  Fire learns Kindling / Wildfire / Immolation (Lv.12 / 40 / 80), Poison learns Toxic Bite /
  Venom Bloom / Creeping Toxin / Plague Bloom / Septic Rot (Lv.12 / 20 / 40 / 60 / 80), and no
  other element gets them. A green **BURN** / **POISON** chip on the card shows the rounds left.
* **Retaliate / Vengeance WAIT for the first blow** — they return a hit you have already taken, so
  picking one means *"you strike first, I give it back"*. **Speed does not go first here**, which
  used to be the whole problem: a fast Mythling always resolved before anything existed to return, so
  the skill fizzled and Speed became a liability.
  * If **exactly one** side picks a reactive skill, **that side attacks second** — foe first, then
    the mirror lands. This is symmetric: it works the same when the *enemy* uses one.
  * If **both** sides pick one, it falls back to **higher Speed attacks first** (coin-flip on a tie),
    because two Mythlings each waiting on the other would never strike at all.
  * Every other skill — Normal, Special, Buff, Debuff, Guard, Ward, Purge — is **untouched** and
    resolves on Speed as before.
  * A **sealed** or **used-up** reactive skill does **not** make you wait: it falls back on the
    unlimited attack, so you are not handing over the initiative for nothing.
  * If the foe only **buffs or debuffs**, there is nothing to mirror: the charge is spent and the
    turn is lost. That is the price of a reactive skill on a round that never offers a hit.
* **Elemental PHYSICAL (P.ATK) ladders for Water and Fire** — every element hands its brawlers a
  Physical elemental ladder *except* Water and Fire, whose specials all used Special (S.ATK) — so a
  Water or Fire attacker swinging with P.ATK had no elemental move to use. Filled with 7 new skills on
  the identical `PH_LADDER` every other element already uses (**15 / 28 / 40 / 54**, same use counts),
  so the balance is unchanged: **Brine Snap / Tide Fang / Undertow Rush / Maelstrom Crush** (Water) and
  **Ember Claw / Furnace Lunge / Inferno Maul** (Fire — its Lv.20 rung was already Burning Fang).
  Granted centrally and **only to a Mythling whose P.ATK beats its S.ATK**, the same rule the six
  newer elements use, so Aquini / Tidewyrm / Emberu / Cinderhawk are deliberately left out.
* **Wiki: Sort the skill tables by level or by element** — the **Skills & Ultimates** tab has a
  **Sort** control with **By level** (the order a skill is learned at) and **By element** (grouped
  under a headed band per element, element-less moves last). Every elemental row also carries its
  **element icon** and name, so you can see at a glance who owns what.
* **Debuff skills** — every species learns three (Lv.1 opener, Lv.12 defence breaker, Lv.40 curse)
  that lower one stat of the **foe**: P.ATK, S.ATK, P.DEF, S.DEF or Speed. They always land and
  stack up to 30 times, like buffs. 21 new skills in `src/data/skills.js`.
* **Skill Library without slot types** — a Mythling takes **3 skills** into battle, any mix of
  Normal / Special / Buff / Debuff. **The order you equip them is the order of the battle buttons**
  (first equipped = button 1 / key `1`). Old `{normal, special, buff}` saves migrate automatically.
* **Starter = S rarity** — whichever partner you pick starts as an S-tier Mythling.
* **Elemental Normal skills have limited uses** (30 / 25 / 20 by tier); only the element-less
  starter attack (Bite / Scratch / Peck / Pebble Toss) is unlimited and is the fallback move.
  Being element-less it is always neutral damage, so it never picks up a type advantage.
* **God Ball** — 12,000 Wildcoins, **100 % catch**. **Shiny Ball** (60,000) and **Dark Ball**
  (90,000) also force the Shiny / Darkness mutation; both are sold only in the Stonehollow Crags.
  (The King Ball is gone — old saves convert it to God Balls.)
* **Running out of uses** — limited-use skills stay limited, but a Mythling is never stuck: if every
  equipped skill is out of uses it falls back on its unlimited element-less attack instead of losing
  the turn. **Skill Tonic** (+8 uses) and **Skill Elixir** (a full reset) refill them from the bag.
* **Release** — a Mythling in Storage can be released from its card. It is permanent, but the species
  stays marked as seen in your Collection.

* **Food for high levels** — 10 new foods up to *Wildbound Ambrosia* (120,000 EXP), plus Hyper /
  Max Potion, Max Revive and Full Restore. Feed a **whole stack at once** (−/+/MAX); the amount is
  capped at what it takes to reach the level cap so nothing is wasted.

### Combat numbers

* **Counter (evasion)** — every point of Counter is **0.5 % dodge**, capped at **18 %** (Counter itself
  caps at 35). It used to be a full 1 % per point, which made attacks miss far too often.
* **Type match-up indicator** — in battle each card shows a chip when the match-up is
  actually for or against it (`YOUR ATTACKS · SUPER EFFECTIVE ×1.5`, `ITS ATTACKS · RESISTED ×0.75`);
  an even match-up shows nothing. Party cards in the switch picker carry the same tag.
* **The type sheet is about the element** — the icon button on either card opens a sheet titled
  by the **element**, not the creature: `NATURE — TYPE MATCH-UP`, then **STRONG AGAINST**
  (Water ×1.5, Rock ×1.5), **WEAK AGAINST** (Fire ×1.5, Ice ×1.5, Poison ×1.5) and **RESISTS**
  (the attacks it shrugs off — those land for less). A `RIGHT NOW · Nature vs Fire` block gives
  both directions against whatever is across the arena, and opening it from the enemy card is
  about the enemy's element.
* **Crits** — Crit Chance is the % chance an attack lands critically (hard cap **10 %**); Crit Damage is
  the bonus damage on a crit (`+20 %` = a 1.2× hit, hard cap **+35 %**). Five moods feed them.
* **Battle log** — every attack line now reports the exact damage:
  `Emberu used Burning Fang! — 163 damage! CRITICAL HIT! (x2.15)`.
* **Trainer teams** — the enemy card shows a pip strip and a `2/3 LEFT` counter, and shouts
  `LAST MYTHLING!` when you are down to the trainer's final Mythling.
* **The Ultimate is a finisher** — it used to be scaled to 70 % of its tier power, which left a
  full-charge Ultimate hitting *softer* than the best Special, so saving up felt pointless. At
  175 % every tier out-muscles the best Special in the game: a full charge takes about **two**
  hits to KO an equal foe, and even a super-effective crit lands around three quarters of the bar.
* **Regular skills hit a little harder** — Normal and Special moves carry an extra `×1.12`
  (`SKILL_POWER_SCALE` in `src/data/config.js`) so the buttons you press every turn have weight.
* **Element-less really means element-less** — Bite / Scratch / Peck / Pebble Toss used to borrow
  the element of the Mythling using them, so a Fire Mythling's Bite counted as Fire. They are
  neutral now, which is also why that button never turns red or green.
* **Level ups** — a whole party levelling at once collapses into one entry per Mythling
  (`Lv.12 → Lv.15`) in a scrollable summary.

### Wildcoins from winning

Defeating a **wild** Mythling drops Wildcoins: the reward scales with its level and EXP yield
(`coinReward()` in `src/data/config.js`) and falls off when you are heavily over-levelled, so low
areas cannot be farmed forever. Trainer battles still pay their own bounty — a defeated trainer
Mythling never double-pays. Need coins right now? Press **`Del`** anywhere for the cheat menu
(`+100`, `+1,000`, `+100,000`, `+1,000,000`).

### Bags, shop shelves & premium balls

**Your bag is the limit.** Party *and* storage together can never hold more than your bag allows.
You start on **Bag 1** (20 Mythlings) and buy permanent upgrades from any shop:

| Bag | Capacity | Price | | Bag | Capacity | Price |
|---|---|---|---|---|---|---|
| Bag 1 | 20 | — (start) | | Bag 6 | 70 | 130,000 |
| Bag 2 | 30 | 2,500 | | Bag 7 | 80 | 260,000 |
| Bag 3 | 40 | 9,000 | | Bag 8 | 90 | 500,000 |
| Bag 4 | 50 | 25,000 | | Bag 9 | 100 | 900,000 |
| Bag 5 | 60 | 60,000 | | | | |

Every shop sells bags — but only ones **bigger than the bag you carry** and never past its own
ceiling, so you can upgrade from wherever you are while the last bags still demand that you push
deeper into the world (Verdant Vale stops at Bag 2; only the Ironfist Colosseum stocks Bag 9).
A full bag **refuses the catch before the ball is spent** — capacity is never used to delete a
Mythling from a save.

**Shelves are finite.** Staples arrive by the dozen; the further up the price ladder an item sits,
the fewer it stocks and the likelier it is missing entirely. An empty row reads `SOLD OUT`, and the
whole shelf is refilled every **5 minutes of play** (live countdown above the goods).

**Premium balls** — God (120,000) · Shiny (800,000) · Dark (950,000) — all guarantee the catch
*and* land at **SSS+**, with the Shiny and Dark balls also forcing their mutation. They are priced
so that owning a second one is an achievement, and late shops only list them occasionally.

**Food** gets steadily worse value per EXP as it gets stronger (2.25 coins/EXP at the bottom →
15 coins/EXP for Wildbound Ambrosia at 1,800,000), so early berries stay the efficient everyday
food and the top of the ladder is endgame money.

### Creature rig — Mythlings are puppets, not pictures

Every Mythling is still drawn procedurally (this project ships **zero external art**), but the
renderer is now a lightweight **2D puppet rig** instead of one monolithic drawing pass:

```
src/render/creatureArt.js    the artwork, authored as 8-12 animatable layers per species
src/render/creatureRig.js    asset baking/cache, animation controller, compositor
src/render/creatures.js      drawMythling() — the entry point every game system calls
```

* **8-12 transforms per creature** — `ROOT · BODY · HEAD · FRONT_LEG_L/R · BACK_LEG_L/R · TAIL`
  plus `EAR_L/R` (Spriggo, Aquini, Rivruff), `WING_L/R` (Emberu, Leaflet) and Rivruff's water
  `MANE`. Fur tufts, leaf veins, claws, scales, feathers and markings are **baked into the layer
  they belong to** — no bone is ever spent on a detail.
* **Layers are baked once** into cached offscreen canvases (`CreatureAssetLoader`, LRU-capped,
  keyed by species | stage | mutation | size bucket) and re-composited with ~10 `drawImage` calls
  per frame instead of hundreds of paths. Layers are authored so they read as **one seamless
  creature** at rest — the split exists only so parts can move.
* **`CreatureAnimationController`** drives 12 states — `idle, walk, run, battleIdle, normalAttack,
  specialAttack, buff, ultimate, hit, faint, capture, evolve` — with simple easing and procedural
  interpolation, no keyframe tables. Idle breathes and flicks an ear every few seconds instead of
  shaking; attacks anticipate → strike → recover with squash & stretch; hits recoil without
  distorting the model; faints lower and fade.
* **The face stays live** (eyes, brows, mouth are drawn on top of the baked head), so expressions,
  blinking and eye shape cost nothing to bake and can change at any time.
* Shiny and Darkness reuse **the same rig** — palette + aura + particles only.

### Skill VFX

`src/render/vfx/SkillVFX.js` + `src/data/skillVfx.js` turn every skill into a data-driven
sequence: **CAST → ATTACK MOTION → PROJECTILE → IMPACT → AFTERMATH → DAMAGE NUMBER**. Cast
100-250 ms, travel 150-500 ms, impact 100-300 ms, aftermath 200-700 ms, ultimates 0.8-1.8 s.

* Element identity is baked into the palettes and shapes: **nature** grows leaves, vines, petals,
  roots and pollen; **water** throws droplets, splash arcs, ribbons, bubbles, foam and wave rings;
  **fire** is alive with flame tongues, embers, smoke and sparks. No generic colour clouds.
* Buffs read as a stat rising (`↑P.ATK` + upward energy), defensive buffs get a shield ring, speed
  buffs get wind trails. Debuffs stay subtle and never cover the target.
* Ultimates are cinematic — camera emphasis → charge → big sequence → impact → aftermath — and
  `ocean_guard` is flagged `defensive` so it raises a barrier instead of looking like an attack.
  A Mythling sitting on 8/8 charge keeps a soft elemental aura.
* Camera: a nudge for normals, a small shake on special impacts, a controlled one for ultimates.
  Never constant, never enough to lose track of the battle.
* Performance: a pooled particle system (hard cap 340), cached gradients, zero per-frame
  allocation, no DOM elements. A fireball is one glow + one core + one trail + ~20 sparks, not 500.

### Game Wiki

`SETTINGS → OPEN WIKI` (also on the title screen's Settings) opens a searchable reference built
straight from `src/data/*`: getting started, all nine stats, every mood and rarity, mutations (including double Shiny+Darkness), the
element chart, the full battle rules and damage formula, all fifty species with base stats and
evolution lines, every skill and Ultimate, all items, the ten regions with their trainers, the EXP
curve, controls and the roadmap. It is generated from the same data files the game runs on, so it
can never drift out of date.

### The rule that never bends

A wild **Emberu Lv.45** can be found in Emberwild. You must **defeat it first** (the Catch button is
disabled while it lives), then capture it — and it joins you as **Emberu Lv.1**. Its species, Mood,
Rarity and Mutation are preserved; its level, EXP, evolution stage and skills all restart.
You raise every Mythling yourself.

---

## Progression

```
Leafrest Town → Petal Path → Whisperwood → Verdant Gate      (Verdant Guardian → Vale Charm)
        ↓
Tidecrest Port → Coralway → Moonlit River → Azure Caverns    (Cavern Guardian → Coast Pass)
        ↓
Emberwatch Outpost → Ashen Trail → Cinder Forest → Molten Cavern → Volcanic Ruins
                                                              (Flame Warden → Ember Sigil)
        ↓
Quarry Camp → Gravel Pass → Crystal Hollow → Shale Ridge → Titan Summit   (Stone Warden → Crag Seal)
        ↓
Stormreach Plateau (Storm Warden → Storm Sigil) → Frostveil Tundra (Frost Warden → Frost Sigil)
        ↓
Ironhold Foundry (Forge Warden → Iron Sigil) → Miremarsh Fen (Plague Warden → Mire Sigil)
        ↓
Astral Spire: Spire Base → Dream Garden → Mirror Lake → Void Steps → Astral Summit
                                                              (Astral Warden → Version Complete)
```

Gates are item-locked, so a region can never be reached under-levelled. After the Astral Warden the
world stays fully open for collecting, mutation hunting, legendary hunting and training to Lv.100.

---

## Architecture

```
index.html                 markup + HUD shell
src/
  main.js                  Game orchestrator: loop, scenes, flows, autosave, HUD
  data/                    ← everything is data-driven; new content is added here
    config.js              level cap, EXP curve, growth, damage constants
    species.js             the 5 Mythlings + full 4-stage evolution lines (Lv.60/80 marked future)
    skills.js              skills, buffs, debuff riders, Ultimates (base → I → II → III)
    skillVfx.js            per-skill VFX data (element, category, cast/projectile/impact/aftermath)
    moods.js  rarity.js  mutations.js  elements.js  items.js
    config.js also owns the Counter->dodge curve and the crit caps
    maps.js               10 regions: regions, water, buildings, NPCs, trainers, spawn tables, gates
  core/
    mythling.js            the Mythling model: stats, EXP/levels, evolution, skills, resetToLevelOne()
    utils.js               RNG, colour maths, event bus, helpers
  systems/
    GameState.js           state + Player/Party/Storage/Inventory/Collection/World managers
    BattleManager.js       turn engine → emits an event list the UI animates
    CaptureManager.js      capture rules (defeated-only, always Lv.1)
    EncounterManager.js    wild spawn rolls (weights, level ranges, rarity, mutation)
    EvolutionManager.js    gating: only stage 1 is reachable in this build
    SaveManager.js         IndexedDB with localStorage fallback — save/load/hasSave/deleteSlot/listSlots
    SettingsManager.js  AudioManager.js (procedural music + SFX, no copyrighted audio)
  render/
    creatureArt.js         original procedural Mythling art (fox/feline/dragon/wolf/avian body plans),
                           authored as 8-12 rig layers per species + per-species faces (7 expressions)
    creatureRig.js         layer baking/LRU cache, animation controller, compositor, drawMythling()
    creatures.js           the public entry point every game system imports
    worldRenderer.js       terrain, water, props, buildings, weather
    vfx/
      particles.js         pooled particle + effect system (rings, slashes, bursts, columns)
      SkillVFX.js          data-driven skill sequences: cast → projectile → impact → aftermath
  scenes/
    MenuScene.js  OverworldScene.js  BattleScene.js
  ui/
    ui.js  styles.css  screens.js  PlayerMenu.js
    wiki.js                 searchable in-game reference generated from src/data/*
    logo.js                SVG wordmark + element crest for the title screen
    icons.js               hand-built SVG icon set — the game ships zero emoji
tests/smoke.test.js        headless rule tests
design-bible.html          live creature design bible (see below)
```

Systems talk through a small event bus and shared managers rather than direct references, so a
**Map 4**, a new element, a sixth Mythling or the Lv.60 evolution stage can be added by editing
`src/data/*` alone.

### Title screen

The main menu is a single animated scene drawn live on the game canvas — layered
sky, parallax cloud banks, faceted snow-capped ranges, a floating isle with its own
waterfall, an aerial-perspective forest, a lakeside village, god rays, drifting
pollen and four Mythlings idling on the foreground shelf while Leaflet circles
overhead. The UI column sits on the left over a soft reading scrim so the cast on
the right is never covered: SVG wordmark and element crest, four fantasy buttons
with icon, hint line, hover/selected glow and a sliding sheen, the tagline bottom
left and the build facts bottom right. Arrow keys / W / S move the selection and
Enter confirms; hovering with the mouse selects too. Composition is tuned for
1920x1080 and re-flows for 1600x900 and 1366x768 (narrower screens shift the cast
right so the menu never overlaps a face).

### Creature design bible

`design-bible.html` (run `npm start`, then open <http://localhost:3000/design-bible.html>) is a
living style guide rendered by the **same** `src/render/creatures.js` the game uses — roster line-up,
per-species turnaround, the seven expressions, the full evolution line with the Lv.60/Lv.80 stages
marked as locked future content, both mutations, and a scale comparison against the trainer.
It needs the dev server because it imports ES modules (the double-click offline build is the game
only). Design rules the renderer enforces:

* **Silhouette first** — each species is built from 3-5 signature forms that survive at 24 px:
  Spriggo's leaf-blade tail, Aquini's fin-ears and fluked tail, Emberu's back-swept ember horns and
  wings, Rivruff's water mane and wave tail, Leaflet's three-leaf crest and leaf-feather wing.
* **Real anatomy** — haunch, chest, neck, muzzle and articulated limbs are separate volumes with
  their own shading, not a ball with stickers.
* **Element through anatomy**, not hue: water flows through Rivruff's mane, fire lives in Emberu's
  gems and tail, growth sprouts from Spriggo's shoulders.
* **Controlled palette** — three body colours per species plus a shared belly tone and one accent.
* **Evolution = growth**, never a rescale: limbs lengthen, the torso thickens, the head shrinks in
  proportion and the signature feature gets bigger and more elaborate.

### Saving

3 slots, real persistence (IndexedDB → localStorage fallback), autosave after meaningful events
(map change, capture, evolution, trainer win, purchase, healing) with a debounce so nothing is ever
granted twice. Loads are **validated and migrated**: unknown items are dropped, missing fields get
safe defaults (`mutation: none`, full HP, relearned skills), levels above the cap are clamped and
future evolution stages are rejected. Every save stores its `gameVersion`.

---

## Originality

All creatures, names, evolution lines, regions, UI, music and sound effects in this repository are
original work created for Mythlings: Wildbound. No third-party game assets, art, audio, names or
trademarks are used or reproduced.

---

## Roadmap (intentionally not implemented yet)

Lv.60 `Verdantor / Tideron / Inferno / Cascadon / Galecrest` and Lv.80 `Floragon / Leviaron /
Ignidrake / Maelwolf / Zephyrax` stages, their skills, Ultimate tiers II & III, Map 4+, new elements
and mutations, tournaments, quests, breeding, weather and day/night — the data structures and
managers already account for them.

---

## The image editor

`MythlingEdit.html` is a small tool for lining up the HD stills. Open it through
a local server (`npm start`, then visit `MythlingEdit.html`) and it will list
everything in `assets/mythlings/`.

Pick a file and the art appears at 1:1 with a gold crosshair over it.

* **The crosshair is the anchor** — the one pixel in the picture that the game
  places on the ground line. It starts on the creature's **feet** (bottom centre
  of the opaque area, found by reading the alpha channel), and you can drag it
  or nudge it with the arrow keys. **Nothing is ever cropped to centre the art.**
* **The dashed cyan box** is the animated rig's own footprint, correctly mapped
  into the picture's pixel space, so you can see how much room the sprite gets.
* **Height** is how tall to draw the picture, in the same units the rig uses.
  It defaults to the form's rig box height.
* **The two previews** on the right — a 52px list icon and a 176px battle
  sprite — are drawn with the *exact placement maths the game uses*, not an
  approximation.
* **Undo / Redo / Reset** sit in the top bar. Undo is `Ctrl+Z` (and `Ctrl+Shift+Z`
  or `Ctrl+Y` to redo). A whole drag is a single undo step, and a run of held
  arrow keys collapses into one, so backing out is always a few presses rather
  than hundreds. **Reset** returns to where the picture opened: the placement
  already saved in `src/data/hdManifest.js` when there is one, otherwise the
  auto-detected feet.
* **Copy** puts the matching manifest entry on your clipboard so you can paste
  it into `src/data/hdManifest.js` — that is the whole hand-off, since a page
  cannot write back over a file you never gave it access to.

**The editor opens on the numbers the game is using.** On build it reads
`src/data/hdManifest.js` and injects every saved placement, so a measured anchor
shows up immediately instead of being re-guessed. The same goes for
`MythlingsWildbound-Offline.html`: it is a generated **snapshot** — after
editing the manifest, rebuild it with `npm run build:offline` (and the editor
with `npm run edit:images`) so the copies stay in step with the source.

Placement is **per-asset data**, not something the renderer guesses. Each model
entry carries its own height and anchor:

```js
'model:spriggo:0': {
  src: 'assets/mythlings/spriggo_0.png',
  height: 108,                      // rig units tall
  anchor: { x: 503, y: 512 },       // a pixel inside the PNG — the feet
},
```

The game scales the picture to `height` units and puts that exact pixel on the
rig's `(cx, feetY)` ground spot. One high-resolution PNG therefore serves a 52px
icon and a 190px battle sprite without ever being re-exported per size, and it
lands correctly whatever shape the artwork is.

| | |
|---|---|
| `npm run edit:images` | rebuilds the editor (re-reads the rig geometry, the species list and the folder) |
| `npm run edit:rig` | builds the full creature / rig / map editor as `MythlingEdit-rig.html` |
| `tools/make-hd-image.py` | keys a chroma-keyed raw drawing out to a transparent PNG |

A starter Mythling that has HD art is drawn **once, dead still** — there is no
turn-around to drag and nothing to idle against. A species with no art yet keeps
its animated rig, so the three starter cards can differ until all are converted.

`tools/gen-rig-bounds.mjs` walks `creatureArt.js` and records the visual box of
all **211** forms. The editor previews from that table, so if the rig is ever
re-tuned, one command re-syncs the tool with it.

`tools/make-hd-image.py` does more than cut out a key. It *unmixes* the key out
of every partially transparent edge pixel rather than thresholding it, blurs the
alpha by half a pixel to soften the cut, and then scrubs whatever magenta is
left. Thresholding alone is what leaves a pink halo around a creature.

---

## Secret: HD Images mode

A hidden panel, opened with **Ctrl + Enter** from any screen, holds a single
switch: **HD Images**. It is off by default and saves like any other setting.

Turning it on swaps pre-rendered PNGs in for the live creature rig — but only
where a PNG actually exists. Every other Mythling keeps animating, and the
roaming overworld map is deliberately left on the rig, because a creature that
walks and turns cannot be a still.

**How it works.** There is one switch point, `drawCreature()` in
`src/render/creatures.js`. Every screen that *shows* a Mythling calls it;
`drawMythling()` stays as the fallback, so a missing asset is a normal state
rather than an error. Adding a species is dropping a PNG in `assets/mythlings/`
and adding one line to `src/data/hdManifest.js` — no other file needs to know.

| Asset key | File | Used for |
|---|---|---|
| `model:<species>:<stage>` | `assets/mythlings/<species>_<stage>.png` | that Mythling form, transparent |
| `bg:<mapTheme>` | `assets/backgrounds/<theme>.jpg` | that battle arena |

**In battle**, the creature models go still and the background becomes a
picture. Particles, screen shake and the weather all still run: weather repaints
the sky over the image exactly as it does over the painted one, and the
full-arena tint lands on top unchanged. The hit reaction survives as a **red
wash** driven by the same `flash` value the rig already computes, so a critical
still reads harder than a glancing one.

**Offline build.** `file://` cannot fetch a sibling PNG, so
`tools/build-standalone.mjs` reads the manifest and inlines each asset as a
base64 data URI. A missing or unreadable asset warns and is left as a path — the
game then just falls back to the rig, it never breaks.

**Art pipeline.** `tools/make-hd-image.py` turns a chroma-keyed raw drawing into
a transparent model PNG: it keys out a flat backdrop, ramps the edge so the
outline stays anti-aliased, trims to the creature and scales it.

This is still a trial: only Spriggo's first form and the nature background have
art, and Shiny / Darkness variants have none, so those keep animating.
