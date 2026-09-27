import { DEFAULT_SETTINGS } from '../data/config.js';
import { SaveManager } from './SaveManager.js';
import { AudioManager } from './AudioManager.js';
import { GameState, bus } from './GameState.js';

const TEXT_SPEEDS = { slow: 42, normal: 20, fast: 8, instant: 0 };

export const SettingsManager = {
  settings: { ...DEFAULT_SETTINGS },

  load() {
    this.settings = SaveManager.loadSettings();
    GameState.settings = this.settings;
    this.apply();
    return this.settings;
  },

  get(key) { return this.settings[key]; },

  set(key, value) {
    this.settings[key] = value;
    GameState.settings = this.settings;
    SaveManager.saveSettings(this.settings);
    this.apply();
    bus.emit('settings:changed', this.settings);
  },

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    GameState.settings = this.settings;
    SaveManager.saveSettings(this.settings);
    this.apply();
    bus.emit('settings:changed', this.settings);
  },

  textDelay() { return TEXT_SPEEDS[this.settings.textSpeed] ?? 20; },

  apply() {
    AudioManager.applySettings({
      masterVolume: this.settings.masterVolume,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume,
    });
    document.documentElement.dataset.quality = this.settings.graphicsQuality;
    document.documentElement.dataset.shake = this.settings.screenShake ? 'on' : 'off';
  },
};
