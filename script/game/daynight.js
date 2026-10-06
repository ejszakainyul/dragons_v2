/* =====================================================================
   Napszakok a völgyben — közös világóra
   ---------------------------------------------------------------------
   Egy nap 12 perc, és a VALÓDI órához igazodik: minden játékosnál
   ugyanakkor van alkony és éjfél (mint egy MMO-ban).

   - egyetlen szorzó (MULTIPLY) réteg színezi a képet: nappal kikapcsol,
     alkonyatkor narancs, éjjel mélykék — olcsó, nincs utófeldolgozás
   - éjjel kigyulladnak a fények: hosszúház, tábortűz, kohó, oltár,
     szentélyek, és a sárkányod körül is dereng egy lámpásfény
   - éjjel az „éji vadak" járnak: erősebbek, de másfélszeres zsákmány
   - a zene is vált (völgy ↔ éjszaka)
   ===================================================================== */
import { TILE } from './world.js';

export const DAY_LEN = 720;                    // mp — egy teljes nap

/** Kulcskockák: [fázis, szín, éjszakaság 0..1] */
const KEYS = [
  [0.00, 0xffffff, 0], [0.47, 0xffffff, 0], [0.54, 0xffc49a, 0.2], [0.61, 0x8a76b0, 0.65],
  [0.68, 0x4c5a92, 1], [0.88, 0x4c5a92, 1], [0.95, 0xd0a8b8, 0.4], [1.00, 0xffffff, 0],
];

const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (a, b, t) => {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
};

/** A nap fázisa (0..1) a valódi idő szerint. */
export function dayPhase(now = Date.now() / 1000) { return (now % DAY_LEN) / DAY_LEN; }

/** Az ég állapota egy fázisban. */
export function skyAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const [p0, c0, n0] = KEYS[i], [p1, c1, n1] = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (p - p0) / Math.max(1e-6, p1 - p0)));
  const night = lerp(n0, n1, t);
  const label = p < 0.47 ? 'Nappal' : p < 0.6 ? 'Alkony' : p < 0.9 ? 'Éjszaka' : 'Hajnal';
  const icon = p < 0.47 ? '☀' : p < 0.6 ? '🌇' : p < 0.9 ? '🌙' : '🌅';
  return { color: lerpColor(c0, c1, t), night, label, icon };
}

/** Az éjszakáig / reggelig hátralévő idő szövegként. */
function untilText(p) {
  const next = p < 0.6 ? 0.6 : 1.0;
  const sec = Math.round((next - p) * DAY_LEN);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${p < 0.6 ? 'Éjszakáig' : 'Hajnalig'}: ${m}:${String(s).padStart(2, '0')}`;
}

const LIGHT = {
  home:    [0xffb060, 3.6, 0.55, -34],
  trainer: [0xffb060, 2.2, 0.35, -20],
  nest:    [0xffd08a, 1.6, 0.25, -10],
  cave:    [0xff5d6c, 2.2, 0.3, -24],
  shrine:  [0xc8a0ff, 2.6, 0.4, -40],
  npc:     [0xffc070, 2.2, 0.4, -16],
  ruins:   [0x9fe8ff, 2.4, 0.3, -20],
};
const SHRINE_LIGHT = { dwarf: 0xff8a3d, muspell: 0xff6a1f, frost: 0x9fe8ff, valkyrie: 0xfff3c4, hermit: 0xffd08a };

export class DayNight {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.night = 0;
    this.phase = 0;
    this.lastMusic = null;
    const { width, height } = scene.scale;
    // A szorzó réteg: képernyőhöz rögzítve, bőven túlméretezve (a kamera nagyítása miatt)
    this.veil = scene.add.rectangle(-width, -height, width * 3, height * 3, 0xffffff)
      .setOrigin(0).setScrollFactor(0).setDepth(8.9e5).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    scene.scale.on('resize', (s) => this.veil.setPosition(-s.width, -s.height).setSize(s.width * 3, s.height * 3));

    // Fények a helyszíneken (összeadó keverés, a réteg fölött)
    this.lights = [];
    for (const p of g.world.pois) {
      const def = LIGHT[p.type];
      if (!def) continue;
      const color = p.type === 'shrine' ? SHRINE_LIGHT[p.place] || def[0] : def[0];
      const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE - 4 + def[3];
      const img = scene.add.image(x, y, 'fx-dot').setTint(color).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(def[1]).setAlpha(0).setDepth(8.95e5);
      this.lights.push({ img, a: def[2], s: def[1], seed: Math.random() * 10 });
    }
    // Lámpásfény a sárkány körül
    this.halo = scene.add.image(0, 0, 'fx-dot').setTint(0xffd8a0).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(4.2).setAlpha(0).setDepth(8.95e5);

    this.clock = document.getElementById('hudClock');
    this.nextUi = 0;
    this.update(0, true);
  }

  /** Éjjel-e (az éji vadakhoz és a zenéhez). */
  get isNight() { return this.night > 0.6; }

  update(time, force = false) {
    const sc = this.scene;
    // A fény finoman lobog; a színezés ritkábban frissül (elég 4×/mp)
    if (this.night > 0.02) {
      const t = time / 1000;
      for (const l of this.lights) l.img.setAlpha(this.night * l.a * (0.85 + Math.sin(t * 3 + l.seed) * 0.08 + Math.sin(t * 7.3 + l.seed) * 0.05));
      if (sc.player) this.halo.setPosition(sc.player.x, sc.player.y - 22).setAlpha(this.night * 0.32);
    }
    if (!force && time < this.nextUi) return;
    this.nextUi = time + 250;

    this.phase = dayPhase();
    const sky = skyAt(this.phase);
    this.night = sky.night;
    const day = sky.color === 0xffffff;
    this.veil.setVisible(!day).setFillStyle(sky.color, 1);
    if (this.night <= 0.02) { for (const l of this.lights) l.img.setAlpha(0); this.halo.setAlpha(0); }

    if (this.clock) {
      const txt = `${sky.icon} ${sky.label}`;
      if (this.clock.dataset.txt !== txt) { this.clock.dataset.txt = txt; this.clock.querySelector('b').textContent = txt; }
      this.clock.title = `A völgy órája (egy nap 12 perc, mindenkinél ugyanakkor). ${untilText(this.phase)}.`
        + ' Éjjel éji vadak járnak: erősebbek, de másfélszeres zsákmányt adnak.';
    }
    this.syncMusic();
  }

  /** A völgy zenéje a napszakhoz igazodik (csak ha a völgy az aktív jelenet). */
  syncMusic(force = false) {
    if (!this.scene.scene.isActive()) return;
    const want = this.night > 0.6 ? 'night' : this.night < 0.4 ? 'valley' : this.lastMusic || 'valley';
    if (force || want !== this.lastMusic) { this.lastMusic = want; this.g.music?.play(want); }
  }
}
