// MYTHLINGS: WILDBOUND — game entry point / orchestrator.
import { GAME_VERSION, LEVEL_CAP, DEFEAT_COIN_PENALTY, SAVE_SLOT_COUNT } from './data/config.js';
import { MAPS, getMap } from './data/maps.js';
import { SPECIES } from './data/species.js';
import { ELEMENTS } from './data/elements.js';
import {
  GameState, PlayerManager, PartyManager, StorageManager, InventoryManager,
  CollectionManager, WorldManager, createNewGameState, serialize, deserialize, bus,
} from './systems/GameState.js';
import { SaveManager } from './systems/SaveManager.js';
import { SettingsManager } from './systems/SettingsManager.js';
import { AudioManager } from './systems/AudioManager.js';
import { EvolutionManager } from './systems/EvolutionManager.js';
import { ChestManager } from './systems/ChestManager.js';
import { Battle, BattleType } from './systems/BattleManager.js';
import { createMythling, displayName, maxHp, hpPercent, restoreAll, speciesOf, isFainted } from './core/mythling.js';
import { MenuScene } from './scenes/MenuScene.js';
import { OverworldScene } from './scenes/OverworldScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { PlayerMenu, mythCanvas } from './ui/PlayerMenu.js';
import {
  mainMenuScreen, slotScreen, nameEntryScreen, starterScreen, settingsScreen,
  shopScreen, centerScreen, evolutionCinematic, levelUpSummary, versionCompleteScreen, INTRO_LINES,
} from './ui/screens.js';
import {
  el, button, Screens, Dialogue, toast, modal, confirmDialog, fade, bar, hpClass,
  handleGlobalEscape, modalOpen,
} from './ui/ui.js';
import { icon, iconSvg } from './ui/icons.js';
import { clamp, coins, formatTime } from './core/utils.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.hud = document.getElementById('hud');
    this.mode = 'menu';
    this.lastTime = performance.now();
    this.lastSaveInfo = null;
    this.autosaveLock = false;
    this.playerMenu = new PlayerMenu(this);
    this.pendingIntro = null;

    this.menuScene = new MenuScene(this.canvas);
    this.overworld = new OverworldScene(this.canvas);
    this.battleScene = new BattleScene(this.canvas);

    Screens.init();
    Dialogue.init();
    SettingsManager.load();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('pointerdown', () => AudioManager.resume(), { once: false });
    // Mouse wheel over the world zooms the camera (within the allowed range).
    this.canvas.addEventListener('wheel', (e) => {
      if (this.mode !== 'overworld' || Dialogue.open) return;
      e.preventDefault();
      this.showZoomHint(this.overworld.zoomBy(e.deltaY < 0 ? 1 : -1));
    }, { passive: false });

    document.getElementById('btn-menu').addEventListener('click', () => this.openMenu());
    document.getElementById('btn-interact').addEventListener('click', () => this.overworld.interact());

    this.bindTouchControls();
    this.bindWorldEvents();
    bus.on('party:changed', () => this.updateHud());
    bus.on('inventory:changed', () => this.updateHud());
    bus.on('coins:changed', () => this.updateHud());

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.toMainMenu();
  }

  // ------------------------------------------------------------ core
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.menuScene.dpr = dpr;
    this.overworld.dpr = dpr;
    this.battleScene.dpr = dpr;
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.mode === 'menu') { this.menuScene.update(dt); this.menuScene.render(); }
    else if (this.mode === 'overworld') {
      this.overworld.paused = Screens.count > 0 || Dialogue.open;
      this.overworld.update(dt);
      this.overworld.render();
      this.hudTick = (this.hudTick || 0) + dt;
      if (this.hudTick > 0.25) { this.hudTick = 0; this.updateHud(); }
    } else if (this.mode === 'battle') {
      this.battleScene.update(dt);
      this.battleScene.render();
    }
    requestAnimationFrame(this.loop);
  }

  /** Small transient "Camera zoom ×1.35" note in the objective slot of the HUD. */
  showZoomHint(z) {
    const obj = document.getElementById('objective');
    if (!obj) return;
    clearTimeout(this._zoomHintTimer);
    obj.innerHTML = `${iconSvg('objective', 'gold')} <span>Camera zoom ×${z.toFixed(2)}</span>`;
    obj.classList.add('show');
    this._zoomHintTimer = setTimeout(() => this.updateHud(), 900);
  }

  onKeyDown(e) {
    const k = e.key.toLowerCase();
    // + / - zoom the world camera
    if (this.mode === 'overworld' && !Dialogue.open && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
      const ae = document.activeElement;
      if (!(ae && /input|textarea|select/i.test(ae.tagName || ''))) {
        e.preventDefault();
        this.showZoomHint(this.overworld.zoomBy(e.key === '-' || e.key === '_' ? -1 : 1));
        return;
      }
    }
    // ESC closes whatever is on top — modal first, then any panel — in every mode.
    if (k === 'escape') {
      e.preventDefault();
      if (handleGlobalEscape()) return;
      if (this.mode === 'overworld' && !Dialogue.open) this.openMenu();
      return;
    }
    // DEL anywhere in the game opens the cheat menu (never while typing).
    if (k === 'delete') {
      const ae = document.activeElement;
      if (ae && /input|textarea|select/i.test(ae.tagName || '')) return;
      e.preventDefault();
      this.openCheatMenu();
      return;
    }
    if (modalOpen()) return;
    if (Dialogue.open) { if (k === ' ' || k === 'enter' || k === 'e') { e.preventDefault(); Dialogue.advance(); } return; }
    if (this.mode === 'overworld') {
      if (Screens.count) return;
      if (k === 'e' || k === 'enter') { e.preventDefault(); this.overworld.interact(); return; }
      this.overworld.onKeyDown(e);
    } else if (this.mode === 'battle') {
      const bs = this.battleScene;
      if (bs.busy || !bs.battle) return;
      // 1 / 2 / 3 = the battle buttons, in the order the skills were equipped
      if (k === '1') bs.pressSlot(0);
      else if (k === '2') bs.pressSlot(1);
      else if (k === '3') bs.pressSlot(2);
      else if (k === '4' || k === 'r') {
        const p = bs.battle.player;
        if (p.ultCharge >= 8) bs.doAction({ type: 'ultimate' });
      }
    }
  }

  onKeyUp(e) { if (this.mode === 'overworld') this.overworld.onKeyUp(e); }

  // ------------------------------------------------------------ menus / flow
  toMainMenu() {
    this.mode = 'menu';
    this.hud.classList.add('hidden');
    this.battleScene.stop();
    AudioManager.playTheme('menu');
    mainMenuScreen({
      onNewGame: () => this.newGameFlow(),
      onLoad: () => this.loadGameFlow(),
      onSettings: () => settingsScreen({ onBack: () => this.toMainMenu() }),
      onExit: async () => {
        const ok = await confirmDialog('EXIT GAME', 'Leave Wildbound? Your saved games are kept safely.', 'EXIT', 'STAY');
        if (!ok) return;
        Screens.replace(el('div', { class: 'dialog panel screen-inner', style: { textAlign: 'center' } }, [
          el('h2', { text: 'Thanks for playing!' }),
          el('p', { class: 'sub', text: 'Mythlings: Wildbound — Small Creatures. Big Adventures.' }),
          button('RETURN TO TITLE', { class: 'primary', onclick: () => this.toMainMenu() }),
        ]), 'exit');
        AudioManager.stopMusic();
      },
    });
  }

  async newGameFlow() {
    const slots = await SaveManager.listSlots();
    slotScreen({
      title: 'New Game — Choose a Save Slot',
      subtitle: 'Your adventure will be stored in this slot. Existing saves are never overwritten without asking.',
      slots, mode: 'new',
      onBack: () => this.toMainMenu(),
      onPick: async ({ slot, action, empty }) => {
        if (action === 'delete') { await SaveManager.deleteSlot(slot); toast(`Slot ${slot} deleted`); this.newGameFlow(); return; }
        if (!empty) {
          const ok = await confirmDialog('OVERWRITE SAVE?', `Slot ${slot} already contains a save. <b>Overwrite this save?</b>`, 'YES, OVERWRITE', 'NO');
          if (!ok) return;
        }
        this.startNewGame(slot);
      },
    });
  }

  startNewGame(slot) {
    nameEntryScreen({
      onBack: () => this.newGameFlow(),
      onConfirm: async (name) => {
        Screens.clear();
        await Dialogue.show(INTRO_LINES, 'WILDBOUND');
        starterScreen({
          onBack: () => this.startNewGame(slot),
          onChoose: async (starterId) => {
            Screens.clear();
            createNewGameState({ slot, playerName: name, starterId, settings: SettingsManager.settings });
            const starter = PartyManager.lead();
            await modal({
              title: 'A NEW PARTNER',
              body: el('div', { style: { textAlign: 'center' } }, [
                mythCanvas(starter, 180, true),
                el('p', { html: `<b>${displayName(starter)}</b> joined your team!` }),
                el('p', { class: 'sub', text: 'Lv.1  ·  EXP 0  ·  Ultimate Charge 0/8' }),
              ]),
              buttons: [{ label: "LET'S GO!", value: true, primary: true }],
            });
            await this.enterWorld('verdant_vale', MAPS.verdant_vale.spawn);
            await this.saveGame(slot, false, 'Game Saved');
            if (SettingsManager.get('tutorialHints')) {
              await Dialogue.show([
                `Welcome to Leafrest Town, ${GameState.player.name}!`,
                'Move with W A S D. Press E to interact with people, buildings and Mythlings.',
                'Talk to Professor Fern nearby — she will explain how Mythlings work.',
                'Then head east along Petal Path to find your first wild Mythling.',
              ], 'GUIDE');
            }
          },
        });
      },
    });
  }

  async loadGameFlow() {
    const slots = await SaveManager.listSlots();
    if (slots.every((s) => s.empty)) {
      await modal({ title: 'NO SAVES FOUND', body: 'There are no saved games yet. Start a New Game first!', buttons: [{ label: 'OK', value: true, primary: true }] });
      this.toMainMenu();
      return;
    }
    slotScreen({
      title: 'Load Game',
      subtitle: 'Choose a save slot to continue your adventure.',
      slots, mode: 'load',
      onBack: () => this.toMainMenu(),
      onPick: async ({ slot, action }) => {
        if (action === 'delete') { await SaveManager.deleteSlot(slot); this.loadGameFlow(); return; }
        const data = await SaveManager.load(slot);
        if (!data) { toast('That slot is empty', 'bad'); return; }
        const ok = deserialize(data);
        if (!ok) { toast('Save data could not be read', 'bad'); return; }
        GameState.slot = slot;
        Screens.clear();
        toast('Game loaded', 'ok');
        await this.enterWorld(GameState.player.map, { x: GameState.player.x, y: GameState.player.y });
      },
    });
  }

  async openSlotPicker(mode) {
    const slots = await SaveManager.listSlots();
    slotScreen({
      title: 'Save to Slot',
      subtitle: 'Choose which slot to write your progress to.',
      slots, mode: 'save',
      onBack: () => { Screens.clear(); this.openMenu('save'); },
      onPick: async ({ slot, empty, action }) => {
        if (action === 'delete') { await SaveManager.deleteSlot(slot); this.openSlotPicker(mode); return; }
        if (!empty && slot !== GameState.slot) {
          const ok = await confirmDialog('OVERWRITE SAVE?', `Slot ${slot} already contains a save. <b>Overwrite this save?</b>`, 'YES', 'NO');
          if (!ok) return;
        }
        GameState.slot = slot;
        await this.saveGame(slot, true);
        Screens.clear();
        this.openMenu('save');
      },
    });
  }

  // ------------------------------------------------------------ world
  async enterWorld(mapId, point) {
    await fade(true);
    this.mode = 'overworld';
    this.hud.classList.remove('hidden');
    this.battleScene.stop();
    this.overworld.enter(mapId, point?.x, point?.y);
    this.overworld.clearKeys();
    const map = getMap(mapId);
    AudioManager.playTheme(map.music);
    this.updateHud();
    await fade(false);
  }

  resumeOverworld() {
    if (this.mode !== 'overworld') return;
    this.overworld.clearKeys();
    const map = getMap(this.overworld.mapId);
    AudioManager.playTheme(map.music);
  }

  openMenu(tab = 'party') {
    if (this.mode !== 'overworld') return;
    AudioManager.sfx('click');
    Screens.clear();
    this.playerMenu.open(tab);
  }

  /** Optional on-screen stick for touch devices (desktop keeps WASD + mouse). */
  bindTouchControls() {
    const stick = document.getElementById('touch-joystick');
    const knob = stick.querySelector('.joystick-knob');
    const show = () => stick.classList.remove('hidden');
    window.addEventListener('touchstart', show, { once: true });
    let active = false;
    const setKnob = (dx, dy) => {
      knob.style.left = `${35 + dx * 32}px`;
      knob.style.top = `${35 + dy * 32}px`;
    };
    const move = (e) => {
      if (!active) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2);
      let dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      if (len > 1) { dx /= len; dy /= len; }
      this.overworld.joy = { x: dx, y: dy };
      setKnob(dx, dy);
    };
    stick.addEventListener('pointerdown', (e) => { active = true; stick.setPointerCapture(e.pointerId); move(e); });
    stick.addEventListener('pointermove', move);
    const stop = () => { active = false; this.overworld.joy = null; setKnob(0, 0); };
    stick.addEventListener('pointerup', stop);
    stick.addEventListener('pointercancel', stop);
  }

  bindWorldEvents() {
    bus.on('overworld:wild', (m) => this.startWildBattle(m));
    bus.on('overworld:trainer', (t) => this.startTrainerBattle(t));
    bus.on('overworld:sign', (s) => Dialogue.show([s.text], 'SIGN'));
    bus.on('overworld:chest', async (chest) => {
      const res = ChestManager.open(this.overworld.mapId, chest.id);
      if (!res.ok) return;
      AudioManager.sfx(res.tier.id === 'bronze' ? 'coin' : 'heal');
      const lines = [`You found a ${res.tier.name}! Inside: ${coins(res.coins)} Wildcoins${res.item ? ` and ${res.item.qty}× ${res.item.name}` : ''}.`];
      if (res.tier.id === 'ultra_gold') lines.push('An ULTRA GOLD chest — almost nobody ever finds one of these.');
      await Dialogue.show(lines, 'TREASURE');
      this.updateHud();
      await this.autosave();
    });
    bus.on('overworld:npc', async (n) => {
      await Dialogue.show(n.dialogue, n.name);
    });
    bus.on('overworld:center', (b) => this.openCenter(b));
    bus.on('overworld:shop', (b) => {
      Screens.clear();
      shopScreen(b, { onClose: () => { Screens.clear(); this.resumeOverworld(); this.autosave('Game Saved'); } });
    });
    bus.on('overworld:transition', async ({ toMap, toPoint }) => {
      WorldManager.unlockMap(toMap);
      await this.enterWorld(toMap, toPoint);
      const map = getMap(toMap);
      toast(`Entering ${map.displayName}`, 'ok');
      await this.autosave();
      if (SettingsManager.get('tutorialHints') && !GameState.world.flags[`intro_${toMap}`]) {
        WorldManager.setFlag(`intro_${toMap}`);
        const lines = {
          azure_coast: ['Azure Coast — wild Mythlings here are Lv.15 to Lv.30.', 'Aquini and Rivruff live along these shores. Your Mythlings can evolve at Lv.20!'],
          emberwild: ['Emberwild — wild Mythlings here are Lv.28 to Lv.40.', 'Emberu rules the ash. Remember: anything you catch still starts again at Lv.1.'],
          stonehollow_crags: ['Stonehollow Crags — wild Mythlings are Lv.38 to Lv.48, and every one of them is Rock type.', 'Rock smothers Fire and crumbles under Water and Nature. The Stone Warden waits at the Titan Summit — and beyond her, the storm country.'],
          stormreach_plateau: ['Stormreach Plateau — Electric country, Lv.46 to Lv.56.', 'Rock grounds lightning; Water and Metal conduct it. A legendary aurora elk is said to visit the peak.'],
          frostveil_tundra: ['Frostveil Tundra — Ice country, Lv.54 to Lv.64.', 'Fire and Metal melt the locals; they freeze Nature and Electric solid.'],
          ironhold_foundry: ['Ironhold Foundry — Metal country, Lv.62 to Lv.72.', 'Fire, Electric and Poison eat through steel. Something molten sleeps in the Forge Core.'],
          miremarsh_fen: ['Miremarsh Fen — Poison country, Lv.70 to Lv.80.', 'Only Psychic purges venom. Half-Psychic wisps drift here from the Spire, and an iron wyrm sleeps under the sludge.'],
          astral_spire: ['Astral Spire — the top of the world. Psychic country, Lv.78 to Lv.90.', 'Poison clouds the mind; nothing else touches it. The Astral Warden keeps the summit.'],
          verdant_vale: ['Verdant Vale — home turf. Wild Mythlings Lv.1 to Lv.20.'],
        }[toMap];
        if (lines) await Dialogue.show(lines, 'GUIDE');
      }
    });
  }

  openCenter(building) {
    Screens.clear();
    centerScreen({
      onHeal: async () => {
        PartyManager.healAll();
        AudioManager.sfx('heal');
        toast('Your Mythlings are fully healed!', 'ok');
        GameState.player.lastHealMap = this.overworld.mapId;
        GameState.player.lastHealPoint = { x: this.overworld.player.x, y: this.overworld.player.y + 40 };
        this.openCenter(building);
        await this.autosave();
      },
      onParty: () => { Screens.clear(); this.playerMenu.open('party'); },
      onStorage: () => { Screens.clear(); this.playerMenu.open('mythlings'); },
      onSave: async () => { await this.saveGame(GameState.slot, true); },
      onClose: () => { Screens.clear(); this.resumeOverworld(); },
    });
  }

  // ------------------------------------------------------------ battles
  startWildBattle(wildMythling) {
    const lead = PartyManager.firstHealthy();
    if (!lead) { toast('All your Mythlings have fainted!', 'bad'); this.handleWhiteout(); return; }
    const battle = new Battle({
      type: BattleType.WILD,
      party: PartyManager.list(),
      enemies: [wildMythling],
      mapId: this.overworld.mapId,
    });
    this.beginBattle(battle);
  }

  startTrainerBattle(trainer) {
    const lead = PartyManager.firstHealthy();
    if (!lead) { toast('All your Mythlings have fainted!', 'bad'); this.handleWhiteout(); return; }
    // Trainer teams are FIXED at the levels written in the map data. They never
    // follow the party: a Lv.100 partner you ground for should feel like one.
    const enemies = trainer.team.map((spec) => createMythling({
      speciesId: spec.species, level: Math.min(LEVEL_CAP, spec.level || 1),
      rarity: spec.rarity || SPECIES[spec.species].defaultRarity,
      mood: spec.mood || SPECIES[spec.species].defaultMood,
      mutation: 'none',
    }));
    const battle = new Battle({
      type: BattleType.TRAINER,
      party: PartyManager.list(),
      enemies,
      trainer,
      mapId: this.overworld.mapId,
    });
    this.beginBattle(battle);
  }

  async beginBattle(battle) {
    await fade(true);
    AudioManager.sfx('encounter');
    this.mode = 'battle';
    this.hud.classList.add('hidden');
    Screens.clear();
    const map = getMap(this.overworld.mapId);
    this.battleScene.start(battle, {
      mapTheme: map.visualTheme,
      onEnd: (outcome, b) => this.endBattle(outcome, b),
    });
    await fade(false);
  }

  async endBattle(outcome, battle) {
    // level-up + evolution follow-ups
    const levelEntries = [];
    for (const r of battle.rewards.exp) {
      for (const lv of r.result.levels) levelEntries.push({ uid: r.uid, name: r.name, ...lv });
    }

    await fade(true);
    this.mode = 'overworld';
    this.hud.classList.remove('hidden');
    this.overworld.clearKeys();
    AudioManager.playTheme(getMap(this.overworld.mapId).music);
    await fade(false);

    if (outcome === 'lost') { await this.handleWhiteout(); return; }

    // Wildcoins dropped by defeated wild Mythlings (trainer bounties are paid below).
    if (battle.rewards.coins > 0) {
      PlayerManager.addCoins(battle.rewards.coins);
      toast(`+${coins(battle.rewards.coins)} Wildcoins`, 'ok');
      this.updateHud();
    }

    if (levelEntries.length) {
      await new Promise((res) => levelUpSummary(levelEntries, res));
    }

    // trainer rewards
    if (battle.type === BattleType.TRAINER && (outcome === 'won')) {
      const t = battle.trainer;
      if (!WorldManager.isTrainerDefeated(t.flag)) {
        WorldManager.defeatTrainer(t.flag);
        const rw = t.reward || {};
        if (rw.coins) PlayerManager.addCoins(rw.coins);
        for (const [id, qty] of Object.entries(rw.items || {})) InventoryManager.add(id, qty);
        AudioManager.sfx('coin');
        await Dialogue.show([t.defeat, `You received ${coins(rw.coins || 0)} Wildcoins${Object.keys(rw.items || {}).length ? ` and ${Object.entries(rw.items).map(([i, q]) => `${q}× ${i.replace(/_/g, ' ')}`).join(', ')}` : ''}!`], t.name);
        if (t.guardian) toast(`${t.name} defeated — a new path has opened!`, 'ok');
        await this.autosave();
        if (t.finalBoss) {
          WorldManager.setFlag('version_complete');
          await new Promise((res) => versionCompleteScreen(res));
          await this.autosave();
        }
      }
    }

    if (outcome === 'captured') await this.autosave();

    // evolutions
    await this.checkEvolutions();
    this.updateHud();
  }

  async checkEvolutions() {
    const ready = EvolutionManager.pending(PartyManager.list());
    for (const m of ready) {
      await new Promise((resolve) => this.runEvolution(m, resolve));
    }
  }

  runEvolution(m, done) {
    const result = EvolutionManager.perform(m);
    if (!result) { done && done(); return; }
    evolutionCinematic(m, result, async () => {
      AudioManager.playTheme(this.mode === 'overworld' ? getMap(this.overworld.mapId).music : 'battle');
      await this.autosave();
      this.updateHud();
      done && done();
    });
  }

  async handleWhiteout() {
    const penalty = Math.floor(GameState.player.wildcoins * DEFEAT_COIN_PENALTY);
    PlayerManager.addCoins(-penalty);
    await modal({
      title: 'YOU WERE DEFEATED',
      body: `All of your Mythlings fainted. You hurried back to the nearest Mythling Center and paid <b>${coins(penalty)} Wildcoins</b> in care fees.<br><br>Your Mythlings, items and progress are all safe.`,
      buttons: [{ label: 'CONTINUE', value: true, primary: true }],
    });
    PartyManager.healAll();
    // Nearest centre: the one in the region the player is currently in, else the last one used.
    const here = this.overworld.mapId;
    const hasCentre = getMap(here)?.buildings.some((b) => b.type === 'center');
    const healMap = hasCentre ? here : (GameState.player.lastHealMap || 'verdant_vale');
    const map = getMap(healMap);
    const center = map.buildings.find((b) => b.type === 'center');
    const point = center ? { x: center.x + center.w / 2, y: center.y + center.h + 60 } : map.spawn;
    await this.enterWorld(healMap, point);
    toast('Your team was fully healed.', 'ok');
    await this.autosave();
  }

  // ------------------------------------------------------------ cheat menu
  /** Press DEL any time during play. Adds Wildcoins instantly. */
  openCheatMenu() {
    if (this.mode === 'menu') return;
    const layer = document.getElementById('modal');
    if (layer && !layer.classList.contains('hidden')) return;   // never stack on a modal
    AudioManager.sfx('confirm');

    const bal = el('b', { style: { color: '#ffe08a', fontSize: '1.15rem' }, text: GameState.player.wildcoins.toLocaleString() });
    const add = (n) => {
      PlayerManager.addCoins(n);
      AudioManager.sfx('coin');
      bal.textContent = GameState.player.wildcoins.toLocaleString();
      this.updateHud();
      toast(`+${n.toLocaleString()} Wildcoins`, 'ok');
    };
    const coinBtn = (n) => button(`+${n.toLocaleString()}`, {
      class: 'small primary', sfx: 'coin',
      title: `Add ${n.toLocaleString()} Wildcoins`,
      onclick: () => add(n),
    });

    const body = el('div', {}, [
      el('p', { class: 'sub', text: 'Cheat menu — press DEL again any time to reopen it. Wildcoins are added instantly.' }),
      el('div', { class: 'coin-pill', style: { display: 'inline-flex', marginBottom: '14px' } }, [
        icon('coin', 'gold'), el('span', { text: 'Wildcoins:' }), bal,
      ]),
      el('div', { class: 'row', style: { gap: '8px' } }, [100, 1000, 100000, 1000000].map(coinBtn)),
      el('div', { style: { height: '12px' } }),
      el('p', { class: 'sub', style: { margin: 0 }, text: 'Spend them in any region shop: balls, potions, revive herbs and EXP food.' }),
    ]);

    modal({ title: 'CHEAT MENU', body, buttons: [{ label: 'CLOSE', value: true, primary: true }] })
      .then(() => this.autosave());
  }

  // ------------------------------------------------------------ saving
  async saveGame(slot, manual = false, message = 'Game saved successfully.') {
    if (this.savingLock) return;
    this.savingLock = true;
    try {
      const data = serialize();
      await SaveManager.save(slot, data);
      this.lastSaveInfo = Date.now();
      AudioManager.sfx('save');
      toast(manual ? message : 'Game Saved', 'ok');
    } catch (e) {
      console.error(e);
      toast('Save failed!', 'bad');
    } finally {
      this.savingLock = false;
    }
  }

  /** Autosave after meaningful events; debounced so it never duplicates rewards. */
  async autosave(label) {
    if (this.autosaveLock) return;
    this.autosaveLock = true;
    toast('Saving…');
    try {
      await SaveManager.save(GameState.slot, serialize());
      this.lastSaveInfo = Date.now();
      setTimeout(() => toast(label || 'Game Saved', 'ok'), 260);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => { this.autosaveLock = false; }, 1200);
    }
  }

  // ------------------------------------------------------------ HUD
  updateHud() {
    if (this.mode !== 'overworld') return;
    const strip = document.getElementById('hud-party');
    strip.innerHTML = '';
    for (const m of PartyManager.list()) {
      const pct = hpPercent(m);
      const chip = el('div', { class: `party-chip ${isFainted(m) ? 'fainted' : ''}` }, [
        mythCanvas(m, 76),
        el('div', { class: 'pc-name', text: displayName(m) }),
        el('div', { class: 'pc-lv', text: `Lv.${m.level}${m.level >= LEVEL_CAP ? ' MAX' : ''}` }),
        // Labelled bars: green is HP, orange is Ultimate Charge. Neither is EXP —
        // EXP is only shown (and only ever grows) on the party cards in the menu.
        el('div', { class: 'pc-bar', title: `HP ${m.currentHp}/${maxHp(m)}` }, [
          el('span', { class: 'pc-tag', text: 'HP' }), bar('hp', pct, hpClass(pct)),
        ]),
        el('div', { class: 'pc-bar', title: `Ultimate Charge ${m.ultCharge}/8 — reset to 0 by a Center heal, never affects EXP` }, [
          el('span', { class: 'pc-tag', text: 'ULT' }), bar('ult', m.ultCharge / 8),
        ]),
      ]);
      chip.addEventListener('click', () => this.openMenu('party'));
      strip.appendChild(chip);
    }
    document.getElementById('hud-coins').textContent = coins(GameState.player.wildcoins);
    document.getElementById('hud-location').textContent = this.overworld.currentRegionName();

    const obj = document.getElementById('objective');
    const objective = this.currentObjective();
    obj.innerHTML = objective ? `${iconSvg(objective.done ? 'check' : 'objective', objective.done ? 'good' : 'gold')} <span>${objective.text}</span>` : '';
    obj.classList.toggle('show', !!objective);

    this.drawMinimap();
  }

  currentObjective() {
    const goal = (text) => ({ text, done: false });
    if (WorldManager.getFlag('version_complete')) return { text: 'Current version complete — free exploration!', done: true };
    const mapId = this.overworld.mapId;
    if (mapId === 'verdant_vale') {
      if (!WorldManager.isTrainerDefeated('vale_guardian')) return goal('Defeat the Verdant Guardian at the Verdant Gate');
      return goal('Travel east to Azure Coast');
    }
    if (mapId === 'azure_coast') {
      if (!WorldManager.isTrainerDefeated('coast_guardian')) return goal('Defeat the Cavern Guardian in Azure Caverns');
      return goal('Travel east to Emberwild');
    }
    if (mapId === 'emberwild') {
      if (!WorldManager.isTrainerDefeated('flame_warden')) return goal('Challenge the Flame Warden in the Volcanic Ruins');
      return goal('Travel east through the Emberwild Pass to Stonehollow Crags');
    }
    const chain = [
      ['stonehollow_crags', 'stone_warden', 'Climb to the Titan Summit and defeat the Stone Warden', 'Travel east through the Storm Gate to Stormreach Plateau'],
      ['stormreach_plateau', 'storm_warden', 'Defeat the Storm Warden on Stormeye Peak', 'Travel east through the Frost Gate to Frostveil Tundra'],
      ['frostveil_tundra', 'frost_warden', 'Defeat the Frost Warden on the Aurora Summit', 'Travel east through the Iron Gate to Ironhold Foundry'],
      ['ironhold_foundry', 'iron_warden', 'Defeat the Forge Warden in the Forge Core', 'Travel east through the Mire Gate to Miremarsh Fen'],
      ['miremarsh_fen', 'mire_warden', 'Defeat the Plague Warden in Plague Hollow', 'Travel east through the Spire Gate to the Astral Spire'],
      ['astral_spire', 'astral_warden', 'Climb to the Astral Summit and defeat the Astral Warden', null],
    ];
    for (const [id, flag, fight, travel] of chain) {
      if (mapId !== id) continue;
      if (!WorldManager.isTrainerDefeated(flag)) return goal(fight);
      return travel ? goal(travel) : null;
    }
    return null;
  }

  drawMinimap() {
    const cv = document.getElementById('minimap');
    const ctx = cv.getContext('2d');
    const d = this.overworld.minimapData();
    const sx = cv.width / d.w, sy = cv.height / d.h;
    ctx.clearRect(0, 0, cv.width, cv.height);
    // The static picture of the map (ground, water, bridges, buildings, gates)
    // is drawn once per map and cached, so the minimap always matches the
    // world instead of showing floating rectangles.
    ctx.drawImage(this.minimapBase(d, cv.width, cv.height), 0, 0);
    // encounter zones: a faint hatch so tall grass reads as "wild area"
    ctx.fillStyle = 'rgba(60,220,110,0.16)';
    for (const z of d.zones) ctx.fillRect(z[0] * sx, z[1] * sy, z[2] * sx, z[3] * sy);
    // trainers (red) and NPCs (yellow)
    for (const t of d.trainers) {
      ctx.fillStyle = t[2] ? 'rgba(255,255,255,0.55)' : '#ff5a5a';
      ctx.beginPath(); ctx.arc(t[0] * sx, t[1] * sy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd76a';
    for (const n of d.npcs) { ctx.beginPath(); ctx.arc(n[0] * sx, n[1] * sy, 1.8, 0, Math.PI * 2); ctx.fill(); }
    // roaming wild Mythlings in their element colour
    for (const w of d.wild) {
      ctx.fillStyle = ELEMENTS[w[2]]?.color || '#fff';
      ctx.beginPath(); ctx.arc(w[0] * sx, w[1] * sy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // the player
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(d.px * sx, d.py * sy, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
  }

  /** Cached base layer of the minimap for the current map (regions, water, bridges, buildings, gates). */
  minimapBase(d, W, H) {
    const key = `${d.mapId}:${W}x${H}`;
    if (this._minimapBase?.key === key) return this._minimapBase.canvas;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sx = W / d.w, sy = H / d.h;
    g.fillStyle = 'rgba(12,22,34,0.9)';
    g.fillRect(0, 0, W, H);
    for (const r of d.regions) {
      g.fillStyle = r[4];
      g.fillRect(r[0] * sx, r[1] * sy, Math.ceil(r[2] * sx), Math.ceil(r[3] * sy));
    }
    // the central corridor the world renderer keeps walkable
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, (d.h * 0.55 - 90) * sy, W, 180 * sy);
    for (const w of d.water) {
      g.fillStyle = w[4] === 'lava' ? '#ff7a2a' : '#3fa9f5';
      g.fillRect(w[0] * sx, w[1] * sy, Math.max(2, w[2] * sx), Math.max(2, w[3] * sy));
    }
    g.fillStyle = '#c99a5a';
    for (const b of d.bridges) g.fillRect(b[0] * sx, b[1] * sy, Math.max(2, b[2] * sx), Math.max(2, b[3] * sy));
    for (const b of d.buildings) {
      g.fillStyle = b[4] === 'center' ? '#ff8a8a' : b[4] === 'shop' ? '#7fc4ff' : 'rgba(240,200,120,0.95)';
      g.fillRect(b[0] * sx, b[1] * sy, Math.max(3, b[2] * sx), Math.max(3, b[3] * sy));
    }
    g.fillStyle = 'rgba(160,220,255,0.95)';
    for (const cn of d.conns) g.fillRect(cn[0] * sx, cn[1] * sy, Math.max(3, cn[2] * sx), Math.max(3, cn[3] * sy));
    this._minimapBase = { key, canvas: c };
    return c;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__game = new Game();
  console.log(`%cMYTHLINGS: WILDBOUND v${GAME_VERSION}`, 'color:#f2c761;font-weight:bold;font-size:14px');
});
