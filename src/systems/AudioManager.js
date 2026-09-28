// 100% original procedurally-synthesised audio (WebAudio). No external/copyrighted media.
const THEMES = {
  menu:   { scale: [0, 4, 7, 11, 14, 16], root: 293.66, tempo: 0.46, wave: 'triangle', pad: true,  bassEvery: 4, gain: 0.22 },
  vale:   { scale: [0, 2, 4, 7, 9, 12],   root: 329.63, tempo: 0.40, wave: 'triangle', pad: true,  bassEvery: 4, gain: 0.18 },
  coast:  { scale: [0, 2, 5, 7, 9, 12],   root: 261.63, tempo: 0.44, wave: 'sine',     pad: true,  bassEvery: 4, gain: 0.19 },
  ember:  { scale: [0, 3, 5, 7, 10, 12],  root: 220.00, tempo: 0.34, wave: 'sawtooth', pad: true,  bassEvery: 2, gain: 0.15 },
  town:   { scale: [0, 2, 4, 5, 7, 9],    root: 349.23, tempo: 0.42, wave: 'triangle', pad: false, bassEvery: 4, gain: 0.17 },
  battle: { scale: [0, 2, 3, 5, 7, 10],   root: 196.00, tempo: 0.22, wave: 'square',   pad: false, bassEvery: 2, gain: 0.13 },
  boss:   { scale: [0, 1, 3, 5, 7, 8],    root: 174.61, tempo: 0.20, wave: 'sawtooth', pad: false, bassEvery: 2, gain: 0.13 },
  evolve: { scale: [0, 4, 7, 12, 16, 19], root: 392.00, tempo: 0.26, wave: 'triangle', pad: true,  bassEvery: 4, gain: 0.22 },
};

class AudioManagerImpl {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.current = null;
    this.timer = null;
    this.step = 0;
    this.settings = { masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.75 };
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applySettings(this.settings);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  applySettings(s) {
    this.settings = { ...this.settings, ...s };
    if (!this.ctx) return;
    this.master.gain.value = this.settings.masterVolume;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  // ---------------- music ----------------
  playTheme(name) {
    if (!this.enabled) return;
    this.init();
    if (this.current === name) return;
    this.stopMusic();
    const theme = THEMES[name];
    if (!theme || !this.ctx) return;
    this.current = name;
    this.step = 0;
    const tick = () => {
      if (this.current !== name) return;
      this._playStep(theme);
      this.timer = setTimeout(tick, theme.tempo * 1000);
    };
    tick();
  }

  stopMusic() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current = null;
  }

  _playStep(theme) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.step++;
    const deg = theme.scale[(s * 3 + Math.floor(s / 7)) % theme.scale.length];
    const oct = (Math.floor(s / 8) % 2) * 12;
    const freq = theme.root * Math.pow(2, (deg + oct) / 12);

    this._note(freq, t, theme.tempo * 0.95, theme.wave, theme.gain, this.musicGain);
    if (s % theme.bassEvery === 0) {
      this._note(theme.root / 2, t, theme.tempo * 1.6, 'sine', theme.gain * 1.2, this.musicGain);
    }
    if (theme.pad && s % 8 === 0) {
      this._note(theme.root * Math.pow(2, theme.scale[2] / 12), t, theme.tempo * 6, 'sine', theme.gain * 0.35, this.musicGain);
    }
    if (s % 16 === 12) {
      this._note(theme.root * Math.pow(2, (theme.scale[4] + 12) / 12), t, theme.tempo * 0.7, theme.wave, theme.gain * 0.6, this.musicGain);
    }
  }

  _note(freq, when, dur, wave, gain, dest) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    osc.connect(g); g.connect(dest || this.sfxGain);
    osc.start(when); osc.stop(when + dur + 0.05);
  }

  _sweep(f0, f1, dur, wave = 'sawtooth', gain = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noise(dur, gain = 0.2, filterFreq = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  // ---------------- sfx ----------------
  sfx(name) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click': this._note(660, t, 0.08, 'square', 0.16); break;
      case 'hover': this._note(880, t, 0.04, 'sine', 0.07); break;
      case 'confirm': this._note(523, t, 0.1, 'triangle', 0.18); this._note(784, t + 0.08, 0.14, 'triangle', 0.18); break;
      case 'cancel': this._note(330, t, 0.1, 'square', 0.14); this._note(247, t + 0.07, 0.12, 'square', 0.12); break;
      case 'hit': this._noise(0.18, 0.28, 900); this._sweep(300, 90, 0.18, 'square', 0.18); break;
      case 'hit-strong': this._noise(0.3, 0.34, 1400); this._sweep(420, 70, 0.3, 'sawtooth', 0.22); break;
      case 'miss': this._sweep(700, 1400, 0.16, 'sine', 0.12); break;
      case 'faint': this._sweep(420, 60, 0.6, 'triangle', 0.22); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this._note(f, t + i * 0.09, 0.22, 'sine', 0.16)); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this._note(f, t + i * 0.1, 0.25, 'triangle', 0.2)); break;
      case 'charge': this._note(880, t, 0.07, 'sine', 0.12); break;
      case 'ultimate-ready': [784, 988, 1319, 1568].forEach((f, i) => this._note(f, t + i * 0.07, 0.3, 'square', 0.16)); break;
      case 'ultimate': this._sweep(140, 1400, 0.5, 'sawtooth', 0.3); this._noise(0.6, 0.3, 2600); break;
      case 'capture': [392, 523, 659].forEach((f, i) => this._note(f, t + i * 0.12, 0.3, 'sine', 0.2)); break;
      case 'capture-fail': this._sweep(500, 180, 0.35, 'square', 0.18); break;
      case 'capture-success': [523, 659, 784, 1047, 1319].forEach((f, i) => this._note(f, t + i * 0.11, 0.35, 'triangle', 0.22)); break;
      case 'evolve': [392, 494, 587, 784, 988, 1175].forEach((f, i) => this._note(f, t + i * 0.16, 0.5, 'triangle', 0.2)); break;
      case 'save': this._note(784, t, 0.1, 'sine', 0.14); this._note(1047, t + 0.1, 0.18, 'sine', 0.14); break;
      case 'coin': this._note(1319, t, 0.06, 'square', 0.14); this._note(1760, t + 0.06, 0.12, 'square', 0.12); break;
      case 'encounter': this._sweep(200, 900, 0.35, 'square', 0.2); this._sweep(900, 200, 0.35, 'square', 0.15); break;
      case 'step': this._noise(0.05, 0.05, 500); break;
      case 'crit':
        this._noise(0.26, 0.36, 2200);
        this._sweep(1200, 240, 0.3, 'square', 0.22);
        this._note(1568, t + 0.04, 0.16, 'triangle', 0.16);
        this._note(2093, t + 0.1, 0.14, 'triangle', 0.12);
        break;
      default: break;
    }
  }
}

export const AudioManager = new AudioManagerImpl();
