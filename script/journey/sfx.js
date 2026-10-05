/* =====================================================================
   Eljárásgenerált hangeffektek — WebAudio, nulla letöltött hangfájl.
   Mind rövid, és csak akkor szólal meg, ha a játékos engedélyezte.
   ===================================================================== */

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.droneGain = null;
  }

  /** Felhasználói gesztus után hívandó (különben a böngésző blokkol). */
  start(enabled) {
    this.enabled = enabled;
    if (!enabled) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }

    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.#drone();
    } catch {
      this.enabled = false;
    }
  }

  stop() {
    this.enabled = false;
    if (this.droneGain) {
      this.droneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
    }
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Folyamatos, mély szél/zúgás alaphang. */
  #drone() {
    const { ctx } = this;

    const noise = ctx.createBufferSource();
    noise.buffer = this.#noiseBuffer(4);
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    lp.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 4);

    noise.connect(lp).connect(gain).connect(this.master);
    noise.start();

    // Lassú lélegzés a szélben
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.045;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    this.droneGain = gain;
  }

  #noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Barna zaj — melegebb, mint a fehér
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  #env(gain, peak, attack, decay) {
    const t = this.now;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Mély dobbanás — csavarok nyitányához. */
  boom(peak = 0.9) {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, this.now);
    osc.frequency.exponentialRampToValueAtTime(26, this.now + 1.1);

    const gain = ctx.createGain();
    this.#env(gain, peak, 0.012, 1.5);

    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.now + 1.8);

    // Testesebb dörej: szűrt zaj réteg
    const noise = ctx.createBufferSource();
    noise.buffer = this.#noiseBuffer(1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, this.now);
    lp.frequency.exponentialRampToValueAtTime(90, this.now + 1.2);
    const ng = ctx.createGain();
    this.#env(ng, peak * 0.5, 0.02, 1.4);
    noise.connect(lp).connect(ng).connect(this.master);
    noise.start();
    noise.stop(this.now + 1.6);
  }

  /** Suhogás — átrepülő szárny. */
  whoosh() {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;

    const noise = ctx.createBufferSource();
    noise.buffer = this.#noiseBuffer(2);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(180, this.now);
    bp.frequency.exponentialRampToValueAtTime(1500, this.now + 0.5);
    bp.frequency.exponentialRampToValueAtTime(140, this.now + 1.5);

    const gain = ctx.createGain();
    this.#env(gain, 0.5, 0.25, 1.2);

    noise.connect(bp).connect(gain).connect(this.master);
    noise.start();
    noise.stop(this.now + 1.8);
  }

  /** Villámcsapás. */
  thunder() {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;

    const noise = ctx.createBufferSource();
    noise.buffer = this.#noiseBuffer(2.4);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2600, this.now);
    hp.frequency.exponentialRampToValueAtTime(120, this.now + 1.8);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.now);
    gain.gain.exponentialRampToValueAtTime(0.85, this.now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.28, this.now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.now + 2.3);

    noise.connect(hp).connect(gain).connect(this.master);
    noise.start();
    noise.stop(this.now + 2.4);

    this.boom(0.7);
  }

  /** Tiszta csengés — checkpoint, választás. */
  chime(freq = 620) {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;

    [1, 1.5, 2.01].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq * mult;

      const gain = ctx.createGain();
      const peak = 0.22 / (i + 1);
      gain.gain.setValueAtTime(0.0001, this.now);
      gain.gain.exponentialRampToValueAtTime(peak, this.now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.now + 1.6 + i * 0.4);

      osc.connect(gain).connect(this.master);
      osc.start();
      osc.stop(this.now + 2.2);
    });
  }

  /** Sárkányüvöltés a fináléhoz. */
  roar() {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(74, this.now);
    osc.frequency.linearRampToValueAtTime(128, this.now + 0.45);
    osc.frequency.linearRampToValueAtTime(58, this.now + 2.2);

    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 3.4);
    }
    dist.curve = curve;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, this.now);
    lp.frequency.exponentialRampToValueAtTime(260, this.now + 2.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.now);
    gain.gain.exponentialRampToValueAtTime(0.5, this.now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.now + 2.6);

    osc.connect(dist).connect(lp).connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.now + 2.8);

    this.boom(0.8);
  }
}
