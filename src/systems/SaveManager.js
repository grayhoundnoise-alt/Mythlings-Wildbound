// Persistent storage abstraction. IndexedDB primary, localStorage fallback.
// Gameplay code only ever touches save()/load()/hasSave()/deleteSlot()/listSlots().
import { SAVE_PREFIX, SAVE_SLOT_COUNT, GAME_VERSION, DEFAULT_SETTINGS } from '../data/config.js';

/** localStorage is unavailable in some contexts (file:// with strict settings,
 *  private modes). Fall back to an in-memory store so the game still runs. */
const memoryStore = new Map();
export const LS = {
  available: (() => {
    try { window.localStorage.setItem('__mw_t', '1'); window.localStorage.removeItem('__mw_t'); return true; }
    catch (e) { return false; }
  })(),
  get(k) { try { return this.available ? window.localStorage.getItem(k) : (memoryStore.has(k) ? memoryStore.get(k) : null); } catch (e) { return memoryStore.get(k) ?? null; } },
  set(k, v) { try { if (this.available) window.localStorage.setItem(k, v); else memoryStore.set(k, v); } catch (e) { memoryStore.set(k, v); } },
  del(k) { try { if (this.available) window.localStorage.removeItem(k); else memoryStore.delete(k); } catch (e) { memoryStore.delete(k); } },
};

const DB_NAME = `${SAVE_PREFIX}_db`;
const DB_VERSION = 1;
const STORE = 'saves';
const SETTINGS_KEY = `${SAVE_PREFIX}_settings`;
const LS_SLOT = (slot) => `${SAVE_PREFIX}_slot_${slot}`;

class SaveManagerImpl {
  constructor() {
    this.db = null;
    this.backend = 'localStorage';
    this.ready = this._init();
  }

  async _init() {
    if (typeof indexedDB === 'undefined' || location.protocol === 'file:') return; // file:// blocks IndexedDB
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('indexedDB timeout')), 4000);
      });
      this.backend = 'indexedDB';
    } catch (e) {
      console.warn('[SaveManager] IndexedDB unavailable, using localStorage.', e);
      this.db = null;
      this.backend = 'localStorage';
    }
  }

  async _idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _put(key, value) {
    await this.ready;
    if (this.db) { try { return await this._idb('readwrite', (s) => s.put(value, key)); } catch (e) { /* fall through */ } }
    LS.set(key, JSON.stringify(value));
  }

  async _get(key) {
    await this.ready;
    if (this.db) {
      try {
        const v = await this._idb('readonly', (s) => s.get(key));
        if (v !== undefined) return v;
      } catch (e) { /* fall through */ }
    }
    const raw = LS.get(key);
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  async _del(key) {
    await this.ready;
    if (this.db) { try { await this._idb('readwrite', (s) => s.delete(key)); } catch (e) { /* ignore */ } }
    LS.del(key);
  }

  /** @param {number} slot 1..3 */
  async save(slot, data) {
    const payload = { ...data, gameVersion: GAME_VERSION, savedAt: Date.now() };
    await this._put(LS_SLOT(slot), payload);
    return payload;
  }

  async load(slot) {
    const raw = await this._get(LS_SLOT(slot));
    return raw || null;
  }

  async hasSave(slot) {
    return !!(await this._get(LS_SLOT(slot)));
  }

  async deleteSlot(slot) {
    await this._del(LS_SLOT(slot));
  }

  /** Lightweight header info for the slot-select screens. */
  async listSlots() {
    const out = [];
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      const data = await this.load(i);
      if (!data) { out.push({ slot: i, empty: true }); continue; }
      out.push({
        slot: i,
        empty: false,
        playerName: data.player?.name ?? '???',
        mapName: data.meta?.locationName ?? '—',
        leadMythling: data.meta?.leadMythling ?? '—',
        playTime: data.meta?.playTime ?? 0,
        savedAt: data.savedAt ?? Date.now(),
        gameVersion: data.gameVersion ?? '?',
        starter: data.meta?.starter ?? null,
      });
    }
    return out;
  }

  // ---- Settings persist independently of save slots ----
  saveSettings(settings) {
    LS.set(SETTINGS_KEY, JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const raw = LS.get(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
}

export const SaveManager = new SaveManagerImpl();
