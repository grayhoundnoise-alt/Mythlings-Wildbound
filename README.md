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
npm test             # 31 headless rule tests (levels, capture, evolution, save/load, maps…)
```

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Move (hold `Shift` to run) |
| `E` / `Enter` | Interact: NPCs, trainers, wild Mythlings, buildings, signs |
| `Esc` | Player menu (also the ☰ button) |
| `1` `2` `3` | Normal / Special / Buff skill in battle |
| `4` or `R` | Ultimate (when 8/8) |
| Mouse / touch | Everything — the whole UI is clickable; a touch stick appears on touch devices |

---

## What's in this version

| | |
|---|---|
| **Mythlings** | 5 species — Spriggo, Aquini, Emberu, Rivruff, Leaflet |
| **Regions** | 3 — Verdant Vale (Lv.1–10), Azure Coast (Lv.10–20), Emberwild (Lv.20–30) |
| **Elements** | 🌿 Nature > 💧 Water > 🔥 Fire > 🌿 Nature (1.5× / 0.75× / 1.0×) |
| **Level cap** | Lv.30 (EXP hard-stops; architecture supports raising it) |
| **Evolution** | Lv.20 first evolution only. Lv.60 / Lv.80 stages exist in data but are **locked** |
| **Ultimate** | 8-charge system, unlocks at Lv.10, upgrades to tier " I" on evolution |
| **Mutations** | Shiny ✧ and Darkness ☾ — cosmetic only, never a power boost |
| **Systems** | Rarity, Mood, Skill Library, Party (6), Storage, Inventory, Shops, Wildcoins, NPC trainers, Collection index, Save/Load/Autosave, Settings |

### The rule that never bends

A wild **Emberu Lv.30** can be found in Emberwild. You must **defeat it first** (the Catch button is
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
                                                              (Flame Warden → Version Complete)
```

Gates are item-locked, so Emberwild can never be reached at Lv.1. After the Flame Warden the world
stays fully open for collecting, mutation hunting and training to Lv.30.

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
    moods.js  rarity.js  mutations.js  elements.js  items.js
    maps.js                3 regions: regions, water, buildings, NPCs, trainers, spawn tables, gates
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
    creatures.js           original procedural Mythling art (fox/feline/dragon/wolf/avian body plans),
                           per-species faces with 7 expressions, evolution growth, mutation palettes
    worldRenderer.js       terrain, water, props, buildings, weather
  scenes/
    MenuScene.js  OverworldScene.js  BattleScene.js
  ui/
    ui.js  styles.css  screens.js  PlayerMenu.js
    icons.js               hand-built SVG icon set — the game ships zero emoji
tests/smoke.test.js        headless rule tests
design-bible.html          live creature design bible (see below)
```

Systems talk through a small event bus and shared managers rather than direct references, so a
**Map 4**, a new element, a sixth Mythling or the Lv.60 evolution stage can be added by editing
`src/data/*` alone.

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
