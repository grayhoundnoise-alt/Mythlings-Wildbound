# MYTHLINGS: WILDBOUND
### *Small Creatures. Big Adventures.*

An original, fully playable creature-collecting RPG that runs in the browser with **no build step, no
frameworks and no external assets** — every creature, map, effect and sound is generated procedurally
by the game's own code.

> **The core loop:** Explore → Encounter → Battle → **Defeat** → Catch → **the caught Mythling becomes Lv.1** →
> Train → Evolve at Lv.20 → Explore stronger regions → Repeat.

---

## Run it

```bash
npm start            # serves the folder on http://localhost:3000
# or any static server:  npx serve .   |   python3 -m http.server 3000
```

Then open the page. Everything is ES modules loaded straight from `index.html`.

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
    creatures.js           original procedural Mythling art (fox/feline/dragon/wolf/avian body plans)
    worldRenderer.js       terrain, water, props, buildings, weather
  scenes/
    MenuScene.js  OverworldScene.js  BattleScene.js
  ui/
    ui.js  styles.css  screens.js  PlayerMenu.js
tests/smoke.test.js        headless rule tests
```

Systems talk through a small event bus and shared managers rather than direct references, so a
**Map 4**, a new element, a sixth Mythling or the Lv.60 evolution stage can be added by editing
`src/data/*` alone.

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
