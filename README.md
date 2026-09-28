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
npm test             # 87 headless rule tests (levels, crits, capture, evolution, save/load, maps, rig, VFX…)
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
from the real content: the 4 maps (regions, water, bridges, buildings, landmarks, NPCs, trainers,
encounter zones, connections and the procedurally generated props, all at their game coordinates), the
20 Mythlings (the game's art layers as live, individually editable parts with anchors; the 12 game
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
| **Mythlings** | 20 species — 15 across Nature / Water / Fire plus 5 **Rock** lines (Pebbleshell, Gravelhog, Shalecrawl, Quartzling, Rubblekin) with their own tortoise / boar / lizard / beetle / golem body plans; every line has 4 visibly different evolution stages |
| **Regions** | 4 with **fixed level bands** — Verdant Vale (Lv.1–20), Azure Coast (Lv.15–30), Emberwild (Lv.30–45), **Stonehollow Crags** (Lv.45–60). Wild levels never scale to your party: out-grow an area and move on |
| **Elements** | 🌿 Nature > 💧 Water > 🔥 Fire > 🌿 Nature, plus 🪨 **Rock** (crushes Fire, crumbles to Water and Nature) — 1.5× / 0.75× / 1.0× |
| **Level cap** | Lv.100 — every evolution stage is reachable |
| **Evolution** | Lv.20 / Lv.60 / Lv.80. The **Index only reveals a form once you have owned it** |
| **Ultimate** | 8-charge system, unlocks at Lv.10, upgrades a tier per evolution. New **support Ultimates** buff the caster and/or debuff the foe with two effects per tier |
| **Mutations** | Shiny ✧ (+1 to every stat) and Darkness ☾ (+2), with their own colours and aura |
| **Stats** | 9: HP, P.ATK, S.ATK, P.DEF, S.DEF, SPD, **CNT** (evasion, 0.15 % dodge per point, capped at 6 %), **CRIT** (capped at 25 %), **C.DMG** |
| **Moods & Rationals** | Moods are purely positive (one per stat, scaled by Rarity). Every Mythling also has a **Rational**: a fixed +10 / −10 on two stats. Mood Tonic / Temper Tonic re-roll them |
| **Balls** | Basic · Normal · Advanced · Absolute · **God** (guaranteed) · **Shiny** / **Dark** (guaranteed catch **and** guaranteed mutation) |
| **Systems** | Rarity, Skill Library, life-steal / Retaliate skills, Party (6), Storage, Inventory, Shops, Wildcoins, NPC trainers, Index & Collection grouped by type, Save/Load/Autosave, Settings, **Game Wiki** |

### Battle & training rules (latest)

* **RUN is absolute** — you can leave *any* battle, wild **or** trainer, at any moment, and it
  always succeeds. The enemy gets no free hit; EXP already earned is kept; the trainer can be
  challenged again later.
* **Debuff skills** — every species learns three (Lv.1 opener, Lv.12 defence breaker, Lv.40 curse)
  that lower one stat of the **foe**: P.ATK, S.ATK, P.DEF, S.DEF or Speed. They always land and
  stack up to 30 times, like buffs. 21 new skills in `src/data/skills.js`.
* **Skill Library without slot types** — a Mythling takes **3 skills** into battle, any mix of
  Normal / Special / Buff / Debuff. **The order you equip them is the order of the battle buttons**
  (first equipped = button 1 / key `1`). Old `{normal, special, buff}` saves migrate automatically.
* **Starter = S rarity** — whichever partner you pick starts as an S-tier Mythling.
* **God Ball** — 12,000 Wildcoins, **100 % catch**. **Shiny Ball** (60,000) and **Dark Ball**
  (90,000) also force the Shiny / Darkness mutation; both are sold only in the Stonehollow Crags.
  (The King Ball is gone — old saves convert it to God Balls.)
* **Food for high levels** — 10 new foods up to *Wildbound Ambrosia* (120,000 EXP), plus Hyper /
  Max Potion, Max Revive and Full Restore. Feed a **whole stack at once** (−/+/MAX); the amount is
  capped at what it takes to reach the level cap so nothing is wasted.

### Combat numbers

* **Counter (evasion)** — every point of Counter is **0.5 % dodge**, capped at **18 %** (Counter itself
  caps at 35). It used to be a full 1 % per point, which made attacks miss far too often.
* **Crits** — Crit Chance is the % chance an attack lands critically (caps at 60 %); Crit Damage is the
  bonus damage on a crit (`+50 %` = a 1.5× hit, caps at `+200 %`). Five moods feed them.
* **Battle log** — every attack line now reports the exact damage:
  `Emberu used Burning Fang! — 163 damage! CRITICAL HIT! (x2.15)`.
* **Trainer teams** — the enemy card shows a pip strip and a `2/3 LEFT` counter, and shouts
  `LAST MYTHLING!` when you are down to the trainer's final Mythling.
* **Level ups** — a whole party levelling at once collapses into one entry per Mythling
  (`Lv.12 → Lv.15`) in a scrollable summary.

### Wildcoins from winning

Defeating a **wild** Mythling drops Wildcoins: the reward scales with its level and EXP yield
(`coinReward()` in `src/data/config.js`) and falls off when you are heavily over-levelled, so low
areas cannot be farmed forever. Trainer battles still pay their own bounty — a defeated trainer
Mythling never double-pays. Need coins right now? Press **`Del`** anywhere for the cheat menu
(`+100`, `+1,000`, `+100,000`, `+1,000,000`).

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
straight from `src/data/*`: getting started, all nine stats, every mood and rarity, mutations, the
element chart, the full battle rules and damage formula, all twenty species with base stats and
evolution lines, every skill and Ultimate, all items, the four regions with their trainers, the EXP
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
Quarry Camp → Gravel Pass → Crystal Hollow → Shale Ridge → Titan Summit
                                                              (Stone Warden → Version Complete)
```

Gates are item-locked, so a region can never be reached under-levelled. After the Stone Warden the
world stays fully open for collecting, mutation hunting and training to Lv.100.

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
    maps.js                4 regions: regions, water, buildings, NPCs, trainers, spawn tables, gates
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
