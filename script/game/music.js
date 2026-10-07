/* =====================================================================
   Zene — saját szerzemények, WebAudio-szintézissel (nincs hangfájl)
   ---------------------------------------------------------------------
   Négy darab, mind D/C-moll körül, északi hangulatban:

     valley — „A Völgy dala": lant-arpeggio, furulyadallam, keretdob,
              bordó (orgonapont) alatta. 16 ütem, A és B rész.
     night  — ugyanaz a dal éjjel: lassabb, dob nélkül, kórus-párnával.
     battle — „Pajzsfal": dübörgő taikó, vonós ostinato, kürtdallam.
     boss   — „Níðhöggr ébredése": frigiai fordulat, mély kórus,
              nehéz dobok, rézfúvós ostinato.

   Ütemező: 50 ms-onként előre beütemezi a következő ~0,3 s hangjait
   (a Web Audio óráján, így pontos). Darabváltáskor másfél mp-es
   áttűnés. A zene a hangeffektek kimenetén megy át, így a némítás
   mindkettőre hat; külön ki is kapcsolható.
   ===================================================================== */

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/* --- Akkordok: alaphang (MIDI) + hangközök -------------------------------- */
const CH = {
  Dm: [50, [0, 7, 12, 15, 19]], C: [48, [0, 7, 12, 16, 19]], Bb: [46, [0, 7, 12, 16, 19]], A: [45, [0, 7, 12, 16, 19]],
  F: [41, [0, 7, 12, 16, 19]], G: [43, [0, 7, 12, 16, 19]], Am: [45, [0, 7, 12, 15, 19]],
  Cm: [48, [0, 7, 12, 15, 19]], Db: [49, [0, 7, 12, 16, 19]], Ab: [44, [0, 7, 12, 16, 19]], Gm: [43, [0, 7, 12, 15, 19]],
};
const chordNotes = (name, oct = 0) => CH[name][1].map((i) => CH[name][0] + i + oct * 12);

/* --- Dallamok: [ütem, nyolcad, MIDI, hossz nyolcadban] ------------------- */
const VALLEY_MEL = [
  [0, 0, 69, 3], [0, 3, 74, 1], [0, 4, 76, 2], [0, 6, 77, 2],
  [1, 0, 76, 4], [1, 4, 74, 2], [1, 6, 72, 2],
  [2, 0, 74, 3], [2, 3, 77, 1], [2, 4, 81, 4],
  [3, 0, 79, 2], [3, 2, 77, 2], [3, 4, 76, 4],
  [4, 0, 74, 3], [4, 3, 76, 1], [4, 4, 77, 2], [4, 6, 79, 2],
  [5, 0, 81, 4], [5, 4, 84, 2], [5, 6, 81, 2],
  [6, 0, 79, 2], [6, 2, 77, 2], [6, 4, 76, 2], [6, 6, 72, 2],
  [7, 0, 76, 4], [7, 4, 73, 4],
  [8, 0, 81, 3], [8, 3, 84, 1], [8, 4, 81, 2], [8, 6, 79, 2],
  [9, 0, 79, 4], [9, 4, 76, 4],
  [10, 0, 77, 3], [10, 3, 79, 1], [10, 4, 81, 2], [10, 6, 86, 2],
  [11, 0, 86, 4], [11, 4, 84, 2], [11, 6, 82, 2],
  [12, 0, 81, 3], [12, 3, 79, 1], [12, 4, 77, 2], [12, 6, 81, 2],
  [13, 0, 79, 4], [13, 4, 76, 2], [13, 6, 72, 2],
  [14, 0, 76, 4], [14, 4, 73, 2], [14, 6, 76, 2],
  [15, 0, 74, 8],
];
const VALLEY_CH = ['Dm', 'C', 'Bb', 'C', 'Dm', 'C', 'Bb', 'A', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'A', 'Dm'];

const BATTLE_MEL = [
  [0, 0, 62, 2], [0, 2, 69, 2], [0, 4, 65, 1], [0, 5, 67, 1], [0, 6, 69, 2],
  [1, 0, 74, 3], [1, 3, 72, 1], [1, 4, 69, 4],
  [2, 0, 70, 2], [2, 2, 69, 2], [2, 4, 67, 2], [2, 6, 65, 2],
  [3, 0, 67, 2], [3, 2, 69, 2], [3, 4, 72, 4],
  [4, 0, 74, 2], [4, 2, 77, 2], [4, 4, 76, 1], [4, 5, 74, 1], [4, 6, 72, 2],
  [5, 0, 69, 6], [5, 6, 74, 2],
  [6, 0, 70, 2], [6, 2, 74, 2], [6, 4, 77, 2], [6, 6, 74, 2],
  [7, 0, 76, 3], [7, 3, 73, 1], [7, 4, 69, 4],
];
const BATTLE_CH = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'];

const BOSS_MEL = [
  [0, 0, 67, 8],
  [1, 0, 68, 4], [1, 4, 67, 4],
  [2, 0, 75, 4], [2, 4, 74, 2], [2, 6, 72, 2],
  [3, 0, 70, 8],
  [4, 0, 72, 2], [4, 2, 75, 2], [4, 4, 79, 4],
  [5, 0, 77, 4], [5, 4, 73, 4],
  [6, 0, 75, 2], [6, 2, 72, 2], [6, 4, 68, 4],
  [7, 0, 67, 4], [7, 4, 71, 4],
];
const BOSS_CH = ['Cm', 'Db', 'Cm', 'Bb', 'Cm', 'Db', 'Ab', 'G'];

/* --- A darabok ---------------------------------------------------------------- */
const TRACKS = {
  valley: { bpm: 78, chords: VALLEY_CH, mel: VALLEY_MEL, lead: 'flute', drums: 'frame', harp: true, drone: 38, pad: false },
  night:  { bpm: 64, chords: VALLEY_CH, mel: VALLEY_MEL, lead: 'flute', drums: null, harp: true, drone: 38, pad: true, leadOct: -12, sparse: true },
  battle: { bpm: 138, chords: BATTLE_CH, mel: BATTLE_MEL, lead: 'horn', drums: 'taiko', ostinato: true, pad: true },
  boss:   { bpm: 108, chords: BOSS_CH, mel: BOSS_MEL, lead: 'horn', drums: 'war', ostinato: true, pad: true, choir: true, drone: 36 },
};

export class GameMusic {
  constructor(sfx, state) {
    this.sfx = sfx;
    this.state = state;
    this.want = null;          // amit játszani kellene (akkor is, ha még nincs hang)
    this.cur = null;           // { name, bus, step, nextAt }
    this.timer = null;
  }

  get enabled() { return this.state.save.music !== false; }

  setEnabled(on) {
    this.state.save.music = !!on;
    this.state.touch?.();
    if (!on) this.#fadeOut(0.6);
    else if (this.want) { const w = this.want; this.want = null; this.play(w); }
  }

  /** Az első hangengedély után: ha már kértek darabot, induljon. */
  resume() { if (this.want && !this.cur) { const w = this.want; this.want = null; this.play(w); } }

  play(name) {
    if (this.want === name && this.cur?.name === name) return;
    this.want = name;
    if (!this.enabled || !this.sfx.ctx || !TRACKS[name]) return;
    this.#fadeOut(1.4);
    const ctx = this.sfx.ctx;
    this.#ensureFx();
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.6);
    bus.connect(this.dry); bus.connect(this.rev);
    this.cur = { name, t: TRACKS[name], bus, step: 0, nextAt: ctx.currentTime + 0.15, loop: 0 };
    if (!this.timer) this.timer = setInterval(() => this.#tick(), 50);
  }

  stop() { this.want = null; this.#fadeOut(1.2); }

  #fadeOut(sec) {
    const c = this.cur;
    if (!c) return;
    const ctx = this.sfx.ctx;
    c.bus.gain.cancelScheduledValues(ctx.currentTime);
    c.bus.gain.setValueAtTime(Math.max(0.0001, c.bus.gain.value), ctx.currentTime);
    c.bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + sec);
    setTimeout(() => c.bus.disconnect(), sec * 1000 + 400);
    this.cur = null;
  }

  /** Közös zengető (generált lecsengés) és a zenei fő hangerő. */
  #ensureFx() {
    if (this.master) return;
    const ctx = this.sfx.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.62;
    this.master.connect(this.sfx.out);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.master);
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    conv.buffer = ir;
    this.rev = ctx.createGain(); this.rev.gain.value = 0.42;
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    this.rev.connect(conv).connect(revOut).connect(this.master);
    // a zajgenerátor a dobokhoz
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
  }

  /* ------------------------------------------------------------------ */
  /* Ütemező                                                             */
  /* ------------------------------------------------------------------ */
  #tick() {
    const c = this.cur;
    if (!c) { clearInterval(this.timer); this.timer = null; return; }
    const ctx = this.sfx.ctx;
    // háttérbe tett lapon a böngésző lassítja az időzítőt: ne zúdítsunk be sok hangot
    if (c.nextAt < ctx.currentTime - 0.5) c.nextAt = ctx.currentTime + 0.05;
    const dt = 60 / c.t.bpm / 2;             // nyolcad
    while (c.nextAt < ctx.currentTime + 0.3) {
      this.#step(c, c.step, c.nextAt, dt);
      c.step++;
      c.nextAt += dt;
    }
  }

  #step(c, n, at, dt) {
    const T = c.t;
    const bars = T.chords.length;
    const bar = Math.floor(n / 8) % bars;
    const s = n % 8;
    const loop = Math.floor(n / 8 / bars);
    const chord = T.chords[bar];
    const notes = chordNotes(chord);
    const out = c.bus;

    // Orgonapont / mély alap
    if (s === 0 && T.drone) {
      this.#drone(out, at, dt * 8, mtof(T.drone), 0.05);
      this.#drone(out, at, dt * 8, mtof(T.drone + 7), 0.03);
    }
    // Párna (akkord) — ütemenként
    if (s === 0 && T.pad) this.#pad(out, at, dt * 8, notes.slice(1, 4).map((m) => mtof(m + 12)), T.choir ? 0.05 : 0.035, T.choir);

    // Lant-arpeggio
    if (T.harp && (!T.sparse || s % 2 === 0)) {
      const pat = [0, 1, 2, 3, 4, 3, 2, 1];
      const m = notes[pat[s]] + 12;
      this.#pluck(out, at, mtof(m), s === 0 ? 0.11 : 0.07);
    }

    // Vonós / rézfúvós ostinato
    if (T.ostinato) {
      const r = CH[chord][0];
      const pat = T.choir ? [r - 12, r - 12, r - 11, r - 12, r - 12, r - 12, r - 9, r - 12] : [r - 12, r - 12, r, r - 12, r - 12, r, r - 5, r];
      this.#bow(out, at, dt * 0.9, mtof(pat[s]), s === 0 || s === 4 ? 0.09 : 0.06, T.choir);
    }

    // Dobok
    if (T.drums === 'frame' && (loop > 0 || bar >= 8)) {
      if (s === 0) this.#drum(out, at, 0.28, 110);
      if (s === 4) this.#drum(out, at, 0.16, 120);
      if (s === 7) this.#drum(out, at, 0.08, 140);
    }
    if (T.drums === 'taiko') {
      const v = [0.6, 0, 0.18, 0.35, 0.55, 0, 0.35, 0.22][s];
      if (v) this.#taiko(out, at, v, 72);
      if (s === 2 || s === 6) this.#click(out, at, 0.12);
      if (s === 7 && bar % 4 === 3) { this.#taiko(out, at + dt / 2, 0.3, 90); }
    }
    if (T.drums === 'war') {
      const v = [0.8, 0, 0.25, 0.45, 0.7, 0, 0.45, 0.3][s];
      if (v) this.#taiko(out, at, v, 58);
      if (s === 4) this.#click(out, at, 0.1);
    }

    // Dallam (minden harmadik körben pihen: csak a kíséret szól)
    const restLoop = T.lead === 'flute' ? loop % 3 === 2 : (loop % 2 === 1 && bar < 4);
    if (!restLoop) {
      for (const [b, st, m, len] of T.mel) {
        if (b !== bar || st !== s) continue;
        const f = mtof(m + (T.leadOct || 0));
        if (T.lead === 'flute') this.#flute(out, at, dt * len, f, 0.085);
        else this.#horn(out, at, dt * len, f, T.choir ? 0.06 : 0.07, T.choir);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hangszerek                                                          */
  /* ------------------------------------------------------------------ */
  #env(g, at, a, hold, rel, peak) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.setValueAtTime(peak, at + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel);
  }

  #osc(type, f, at, end, dest, detune = 0) {
    const o = this.sfx.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(dest); o.start(at); o.stop(end);
    return o;
  }

  /** Lant: pengetett húr — gyors felfutás, hosszú, lágyuló lecsengés. */
  #pluck(dest, at, f, v) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, at); lp.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.9);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    lp.connect(g).connect(dest);
    this.#osc('triangle', f, at, at + 1.7, lp);
    const sg = ctx.createGain(); sg.gain.value = 0.3; sg.connect(lp);
    this.#osc('sawtooth', f, at, at + 1.7, sg, 4);
  }

  /** Furulya: lágy szinusz, késleltetett vibrato, enyhe levegőzaj. */
  #flute(dest, at, dur, f, v) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain();
    this.#env(g, at, 0.08, Math.max(0.05, dur - 0.12), 0.35, v);
    g.connect(dest);
    const o = this.#osc('sine', f, at, at + dur + 0.5, g);
    const g2 = ctx.createGain(); g2.gain.value = 0.12; g2.connect(g);
    const o2 = this.#osc('triangle', f * 2, at, at + dur + 0.5, g2);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(f * 0.006, at + 0.35);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    lfo.start(at); lfo.stop(at + dur + 0.5);
    // levegő
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 6;
    const ng = ctx.createGain(); this.#env(ng, at, 0.04, 0.05, 0.2, v * 0.25);
    n.connect(bp).connect(ng).connect(dest); n.start(at, Math.random() * 0.5); n.stop(at + 0.4);
  }

  /** Kürt / kórus-kürt: fűrész, nyíló szűrővel. */
  #horn(dest, at, dur, f, v, dark = false) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.2, at);
    lp.frequency.exponentialRampToValueAtTime(f * (dark ? 3 : 5), at + 0.12);
    lp.frequency.exponentialRampToValueAtTime(f * (dark ? 2 : 3), at + dur);
    this.#env(g, at, 0.06, Math.max(0.05, dur - 0.1), 0.3, v);
    lp.connect(g).connect(dest);
    for (const det of [-7, 7]) this.#osc('sawtooth', f, at, at + dur + 0.4, lp, det);
    this.#osc('square', f / 2, at, at + dur + 0.4, lp).detune.value = 3;
  }

  /** Vonós/rézfúvós staccato. */
  #bow(dest, at, dur, f, v, dark) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = dark ? 700 : 1400; lp.Q.value = 0.8;
    this.#env(g, at, 0.015, dur * 0.4, dur * 0.6, v);
    lp.connect(g).connect(dest);
    this.#osc('sawtooth', f, at, at + dur + 0.1, lp, -5);
    this.#osc('sawtooth', f, at, at + dur + 0.1, lp, 5);
  }

  /** Párna: lassan nyíló akkord; kórusnál magánhangzó-formánsokkal („áá"). */
  #pad(dest, at, dur, freqs, v, choir) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + dur * 0.35);
    g.gain.setValueAtTime(v, at + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.15);
    let node = g;
    if (choir) {
      const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 720; f1.Q.value = 3; f1.gain.value = 10;
      const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 1150; f2.Q.value = 4; f2.gain.value = 8;
      g.connect(f1).connect(f2); node = f2;
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = choir ? 1800 : 1100;
    node.connect(lp).connect(dest);
    for (const f of freqs) for (const det of [-9, 0, 9]) this.#osc('sawtooth', f, at, at + dur * 1.2, g, det);
  }

  #drone(dest, at, dur, f, v) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.4);
    g.gain.setValueAtTime(v, at + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.4);
    lp.connect(g).connect(dest);
    this.#osc('sawtooth', f, at, at + dur + 0.5, lp, -4);
    this.#osc('sawtooth', f, at, at + dur + 0.5, lp, 4);
  }

  /** Keretdob: tompa, mély ütés + bőrzaj. */
  #drum(dest, at, v, f0) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    g.connect(dest);
    const o = this.#osc('sine', f0, at, at + 0.5, g);
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, at + 0.3);
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 0.5, at); ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    n.connect(lp).connect(ng).connect(dest); n.start(at, Math.random() * 0.5); n.stop(at + 0.15);
  }

  /** Taikó: nagy, mély dob hosszabb zengéssel. */
  #taiko(dest, at, v, f0) {
    const ctx = this.sfx.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 0.9, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
    g.connect(dest);
    const o = this.#osc('sine', f0, at, at + 0.85, g);
    o.frequency.setValueAtTime(f0 * 1.5, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, at + 0.5);
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 0.6, at); ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    n.connect(lp).connect(ng).connect(dest); n.start(at, Math.random() * 0.5); n.stop(at + 0.25);
  }

  #click(dest, at, v) {
    const ctx = this.sfx.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    n.connect(bp).connect(g).connect(dest); n.start(at, Math.random() * 0.5); n.stop(at + 0.1);
  }
}
