/* =====================================================================
   Hangok — WebAudio szintézis, nulla letöltött hangfájl
   ---------------------------------------------------------------------
   A böngésző csak felhasználói gesztus után enged hangot: az első
   kattintás/billentyű hozza létre a hangkörnyezetet (unlock()).
   ===================================================================== */
export class GameSfx {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : 0.5;
      // Enyhe kompresszor: a sok egyidejű hang se torzuljon
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      this.out.connect(comp).connect(this.ctx.destination);
      this.noise = this.#noiseBuffer();
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  get ok() { return !!this.ctx && !this.muted; }
  get t() { return this.ctx.currentTime; }

  #noiseBuffer() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  #env(node, peak, a, d, at = this.t) {
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(peak, at + a);
    node.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  }

  #tone(type, f0, f1, peak, a, d, at = this.t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + a + d);
    this.#env(g, peak, a, d, at);
    o.connect(g).connect(this.out);
    o.start(at); o.stop(at + a + d + 0.05);
  }

  #burst(filterType, freq, q, peak, a, d, at = this.t, sweepTo = null) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, at); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + a + d);
    const g = this.ctx.createGain();
    this.#env(g, peak, a, d, at);
    src.connect(f).connect(g).connect(this.out);
    src.start(at, Math.random()); src.stop(at + a + d + 0.05);
  }

  /* --- Harc ----------------------------------------------------------- */
  hit(crit = false) {
    if (!this.ok) return;
    this.#tone('sine', 160, 55, 0.7, 0.005, 0.18);
    this.#burst('lowpass', 1800, 0.7, 0.45, 0.004, 0.12);
    if (crit) { this.#tone('triangle', 1400, 900, 0.25, 0.005, 0.25); this.#tone('triangle', 2100, 1500, 0.15, 0.01, 0.3); }
  }
  miss() { if (this.ok) this.#burst('bandpass', 2400, 2, 0.25, 0.01, 0.18, this.t, 700); }
  fire() { if (this.ok) { this.#burst('lowpass', 500, 0.8, 0.6, 0.05, 0.7, this.t, 2600); this.#tone('sawtooth', 90, 60, 0.15, 0.05, 0.6); } }
  frost() {
    if (!this.ok) return;
    [1760, 2350, 2960, 3520].forEach((f, i) => this.#tone('triangle', f, f * 0.98, 0.12, 0.004, 0.35, this.t + i * 0.045));
    this.#burst('highpass', 5000, 0.5, 0.2, 0.005, 0.25);
  }
  venom() { if (!this.ok) return; for (let i = 0; i < 5; i++) this.#tone('sine', 300 + Math.random() * 300, 700, 0.18, 0.005, 0.08, this.t + i * 0.06); }
  thunder() {
    if (!this.ok) return;
    this.#burst('lowpass', 4000, 0.4, 0.8, 0.002, 0.15);
    this.#burst('lowpass', 180, 0.5, 0.7, 0.05, 1.3, this.t + 0.08, 60);
  }
  drain() { if (this.ok) { this.#tone('sine', 880, 180, 0.3, 0.02, 0.6); this.#tone('sine', 660, 140, 0.2, 0.05, 0.6); } }
  roar() {
    if (!this.ok) return;
    this.#tone('sawtooth', 180, 70, 0.35, 0.08, 0.9);
    this.#tone('sawtooth', 120, 50, 0.3, 0.1, 1.0);
    this.#burst('bandpass', 400, 1.2, 0.35, 0.08, 0.9, this.t, 200);
  }
  heal() { if (!this.ok) return; [523, 659, 784].forEach((f, i) => this.#tone('sine', f, f, 0.2, 0.01, 0.4, this.t + i * 0.08)); }
  faint() { if (this.ok) this.#tone('triangle', 330, 90, 0.3, 0.02, 0.8); }

  /* --- Technikák -------------------------------------------------------- */
  whoosh(dur = 0.35) { if (this.ok) this.#burst('bandpass', 500, 1.4, 0.35, 0.03, dur, this.t, 2600); }
  boom() {
    if (!this.ok) return;
    this.#tone('sine', 120, 35, 0.9, 0.005, 0.9);
    this.#burst('lowpass', 900, 0.6, 0.8, 0.004, 0.8, this.t, 80);
  }
  quake() {
    if (!this.ok) return;
    this.#burst('lowpass', 140, 0.8, 0.9, 0.1, 1.6, this.t, 50);
    for (let i = 0; i < 5; i++) this.#tone('sine', 60 + Math.random() * 30, 40, 0.35, 0.02, 0.3, this.t + i * 0.22);
  }
  meteor() {
    if (!this.ok) return;
    this.#tone('sine', 1800, 220, 0.18, 0.05, 0.75);
    this.#burst('bandpass', 2400, 2, 0.2, 0.1, 0.7, this.t, 400);
  }
  buff() { if (!this.ok) return; [392, 494, 587, 784].forEach((f, i) => this.#tone('sawtooth', f, f, 0.07, 0.01, 0.28, this.t + i * 0.06)); }
  shield() {
    if (!this.ok) return;
    this.#tone('triangle', 1250, 1180, 0.2, 0.003, 0.6);
    this.#tone('sine', 625, 600, 0.2, 0.003, 0.5);
  }
  chant() {
    if (!this.ok) return;
    [262, 330, 392].forEach((f) => this.#tone('sine', f, f * 1.003, 0.13, 0.25, 0.9));
    this.#tone('sine', 523, 523, 0.08, 0.4, 0.8, this.t + 0.2);
  }
  mark() {
    if (!this.ok) return;
    this.#tone('square', 220, 110, 0.12, 0.004, 0.25);
    this.#burst('highpass', 2000, 0.8, 0.25, 0.003, 0.12);
  }
  gale() { if (this.ok) { this.#burst('bandpass', 300, 0.9, 0.5, 0.2, 1.1, this.t, 1400); this.#burst('bandpass', 1200, 3, 0.2, 0.3, 0.9, this.t + 0.1, 500); } }
  shadow() { if (this.ok) { this.#tone('sine', 400, 900, 0.15, 0.02, 0.3); this.#burst('highpass', 3500, 0.6, 0.15, 0.01, 0.3); } }
  root() {
    if (!this.ok) return;
    for (let i = 0; i < 6; i++) this.#burst('lowpass', 600, 1.5, 0.35, 0.005, 0.12, this.t + i * 0.07 + Math.random() * 0.03);
    this.#tone('sawtooth', 70, 45, 0.3, 0.1, 1.0);
  }
  /** A Sárkánykórus: lassan nyíló, lebegő akkord, a végén csattanás. */
  chorus() {
    if (!this.ok) return;
    const t = this.t;
    for (const f of [131, 196, 262, 330, 392]) {
      for (const det of [0.995, 1.005]) {
        const o = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f * det;
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.exponentialRampToValueAtTime(4200, t + 1.8);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        o.connect(lp).connect(g).connect(this.out);
        o.start(t); o.stop(t + 2.7);
      }
    }
  }

  /* --- Saga -------------------------------------------------------------- */
  blip() { if (this.ok) this.#tone('triangle', 520 + Math.random() * 80, 480, 0.025, 0.002, 0.03); }
  caw() {
    if (!this.ok) return;
    for (let i = 0; i < 2; i++) {
      const at = this.t + i * 0.28;
      this.#tone('sawtooth', 780, 520, 0.12, 0.01, 0.18, at);
      this.#burst('bandpass', 1300, 4, 0.18, 0.01, 0.18, at);
    }
  }
  drum() {
    if (!this.ok) return;
    [0, 0.42, 0.62].forEach((dt, i) => {
      this.#tone('sine', 95, 45, i === 2 ? 0.9 : 0.6, 0.004, 0.5, this.t + dt);
      this.#burst('lowpass', 400, 0.7, 0.3, 0.003, 0.15, this.t + dt);
    });
  }

  /* --- Felület és jutalmak ------------------------------------------- */
  click() { if (this.ok) this.#tone('triangle', 900, 700, 0.12, 0.003, 0.06); }
  pickup() { if (!this.ok) return; this.#tone('sine', 880, 880, 0.2, 0.005, 0.15); this.#tone('sine', 1320, 1320, 0.2, 0.005, 0.25, this.t + 0.08); }
  levelUp() { if (!this.ok) return; [523, 659, 784, 1047, 1319].forEach((f, i) => this.#tone('triangle', f, f, 0.2, 0.01, 0.35, this.t + i * 0.07)); }
  victory() {
    if (!this.ok) return;
    const seq = [[392, 0], [523, 0.14], [659, 0.28], [784, 0.42], [659, 0.62], [1047, 0.76]];
    seq.forEach(([f, dt]) => { this.#tone('square', f, f, 0.09, 0.01, 0.3, this.t + dt); this.#tone('triangle', f / 2, f / 2, 0.15, 0.01, 0.35, this.t + dt); });
  }
  defeat() { if (!this.ok) return; [392, 349, 311, 262].forEach((f, i) => this.#tone('triangle', f, f * 0.97, 0.18, 0.02, 0.5, this.t + i * 0.22)); }
  crack() { if (!this.ok) return; for (let i = 0; i < 4; i++) this.#burst('highpass', 3000, 1, 0.35, 0.002, 0.05, this.t + i * 0.09 + Math.random() * 0.03); }
  portal() { if (this.ok) { this.#burst('bandpass', 300, 3, 0.4, 0.2, 0.8, this.t, 1800); this.#tone('sine', 110, 55, 0.3, 0.2, 0.9); } }
}
