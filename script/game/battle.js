/* =====================================================================
   Csata — barlangban (3 hullám) vagy a Gyakorlótéren (párbaj)
   ---------------------------------------------------------------------
   - sorrend: gyorsaság szerint (kis véletlennel), minden kör elején
   - energia: támadás és védekezés +1; a fej képessége 2, a tanult
     technikák 1–3 energiába kerülnek; a kombinált képesség (a testrészek
     elemi összetételéből, rules.js: COMBOS) teli energiát (3) kér
   - állapotok: égés, méreg (kör eleji sebzés), fagyás, kábulat (kimarad),
     erősítés, pajzsfal, lassítás, rúnabélyeg, árnyéklépés — mind látszik
     is a sárkányon (lángok, buborékok, jég, csillagok, pajzsbuborék…)
   - Sárkánykórus: a csapat harci éneke ütéstől, sebtől, győzelemtől telik;
     teli énekkel minden sárkány egyszerre okád (Q)
   - Níðhöggr (boss.js: saját rajz, 2–2,5× akkora) három fázisban harcol:
     saját mozdulatok, előre jelzett Világvég-lehelet, megtörés-sáv,
     a 2. fázisban csatlós, a 3.-ban körönként két lépés
   - a végén: szilánk, tapasztalat (szintlépés), és esély a szelídítésre

   Látvány: mozis kameramozgás a nagy technikáknál, rövid „ütésmegállás"
   a nagy találatoknál, lassítás az utolsó csapásnál, utóképek a rohamnál.

   A logika async/await: minden animáció Promise, így a körök sorrendje
   olvashatóan, egymás után írható le.
   ===================================================================== */
import {
  SKILLS, CAVES, TECHNIQUES, CHORUS, ULTIMATES, RELICS, techInfo, deriveStats, rollDamage, makeWild, makeSparring,
  withTotals, levelOf, MAX_ENERGY, SKILL_COST, shardsFor, xpFor, caveBonus, TAME_CHANCE, TAME_COST, pick,
  COMBOS, COMBO_COST, ELEMENTS, BOSS, bossPhase,
} from './rules.js';
import { dragonTextures, makeDragonView, caveBackdrop, arenaBackdrop, fieldBackdrop } from './art.js';
import { makeBossView, animateBoss, bossMouth } from './boss.js';
import { esc } from './hud.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const STATUS_ICON = {
  burn: '🔥', poison: '☠', freeze: '❄', stun: '💫', atkUp: '💢', ward: '🔷', slow: '🌀', mark: '🎯', shadow: '🌑', thorns: '🌵', broken: '💥',
};
const BUFFS = ['atkUp', 'ward', 'slow', 'mark', 'thorns', 'broken'];      // a hordozó saját köre végén fogynak
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const colorOf = (d) => parseInt(String(d.szin || '#ff8a3d').slice(1), 16) || 0xff8a3d;

export class BattleScene extends Phaser.Scene {
  constructor() { super('battle'); }

  init(data) {
    this.g = data.g;
    // cave = barlang (3 hullám) · spar = Ragnhild párbaja · roam = kóborló
    // vad sárkány a völgyben · guardian = egy tanítóhely őre
    this.mode = data.mode || 'cave';
    this.spar = this.mode === 'spar';
    this.field = this.mode === 'roam' || this.mode === 'guardian';
    this.sparCfg = data.spar || { count: 1, level: 1 };
    this.foes = data.foes || null;
    this.fieldKind = data.field || 'meadow';
    this.placeId = data.placeId || null;
    this.roamId = data.roamId || null;
    this.tier = this.spar ? 0 : this.field ? (data.tier || 1) : data.tier;
    const FIELD_COL = { meadow: 0x9dffc9, forest: 0xd8ff8a, snow: 0xe8fffb, ash: 0xff8a3d, shore: 0x9fe8ff };
    this.cave = this.spar ? { name: 'Ragnhild karámja', color: 0xffb36b, waves: [this.sparCfg.count] }
      : this.field ? { name: data.title || 'Vad sárkány!', sub: data.sub, color: FIELD_COL[this.fieldKind] || 0x9dffc9, waves: [this.foes.length] }
      : CAVES[data.tier];
    this.units = [];
    this.defeated = [];
    this.fled = false;
    // A harci ének sávja akkor él, ha legalább egy ultit már elnyert a játékos
    this.ultis = (this.g.state.save.ultis || []).filter((k) => ULTIMATES[k]);
    this.chorusOn = this.ultis.length > 0;
    this.chorus = 0;
    this.relics = new Set(this.g.state.save.relics || []);
    this.pendingPhase = null;
    this.atmo = [];
  }

  async create() {
    const { hud, state } = this.g;
    hud.extraDragons = new Map();
    hud.showBattle(true);
    hud.prompt(null);
    hud.compass(null);
    // Mézsör és a skald ihletése: a következő csata erősebben indul
    const pl = state.save.places;
    const mead = !!pl.mead, inspired = !!pl.inspired;
    if (mead || inspired) { delete pl.mead; delete pl.inspired; state.touch(); }
    if (this.chorusOn && (mead || inspired)) this.chorus = CHORUS.max / 2;
    hud.setChorus(this.chorus, this.chorusOn);

    const { width: w, height: h } = this.scale;
    this.bg = this.add.image(0, 0, this.#backdrop(w, h)).setOrigin(0).setDepth(-10);
    this.#layout();
    this.#atmosphere();
    this.scale.on('resize', this.#onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.#onResize, this);
      this.tweens.timeScale = 1;
      hud.cinematic(false);
    });

    this.cameras.main.fadeIn(600, 0, 0, 0);

    // A csapat — az elájultak nem jönnek be
    const allies = state.party.filter((d) => state.hpOf(d) > 0);
    for (const [i, d] of allies.entries()) {
      const u = await this.#makeUnit(d, 'ally', i);
      u.hp = state.hpOf(d);
      u.energy = mead ? MAX_ENERGY : 2;   // a csapat felkészülten érkezik: az első körben is jöhet a képesség
      this.#updateBar(u);
    }
    this.startHp = new Map(allies.map((d) => [d.id, state.hpOf(d)]));

    await this.#banner(this.cave.name, this.spar ? 'gyakorló párbaj' : this.field ? (this.cave.sub || 'a völgyben') : `${ROMAN[this.tier]}. fokú barlang`);
    if (mead) hud.battleLog('🍺 A mézsör megtette hatását: <b>teli energia</b>, és szól a harci ének.');
    else if (inspired) hud.battleLog('🎵 Einar dala még a füledben cseng: a harci ének <b>félig telve</b>.');
    this.#run();
  }

  #backdrop(w, h) {
    if (this.spar) return arenaBackdrop(this, w, h);
    if (this.field) return fieldBackdrop(this, w, h, this.fieldKind);
    return caveBackdrop(this, this.tier, w, h);
  }

  /* ================================================================== */
  /* Elrendezés és hangulat                                              */
  /* ================================================================== */
  #layout() {
    const { width: w, height: h } = this.scale;
    const narrow = w < 640;
    this.narrow = narrow;
    // A harci panel ne takarja a sárkányokat (mobilon magasabb, ~250 px)
    this.floorY = Math.min(h * 0.74, h - (narrow ? 285 : 200));
    if (narrow) {
      // Keskeny kijelzőn kisebb sárkányok, mélységben szétszórt alakzatban
      this.S = Phaser.Math.Clamp(Math.min(w * 0.3, h * 0.17), 64, 130);
      const dy = [0, -this.S * 0.62, this.S * 0.55];
      this.slots = {
        ally:  [0, 1, 2].map((i) => ({ x: w * [0.2, 0.34, 0.3][i], y: this.floorY + dy[i] })),
        enemy: [0, 1, 2].map((i) => ({ x: w * [0.8, 0.66, 0.7][i], y: this.floorY + dy[i] })),
      };
    } else {
      this.S = Phaser.Math.Clamp(Math.min(w * 0.17, h * 0.3), 86, 230);
      const dy = [0, -this.S * 0.22, this.S * 0.2];
      this.slots = {
        ally:  [0, 1, 2].map((i) => ({ x: w * (0.13 + 0.13 * i) + (i === 1 ? this.S * 0.12 : 0), y: this.floorY + dy[i] })),
        enemy: [0, 1, 2].map((i) => ({ x: w * (0.87 - 0.13 * i) - (i === 1 ? this.S * 0.12 : 0), y: this.floorY + dy[i] })),
      };
    }
  }

  /** Fénysugarak, lebegő por, köd a padló fölött; a karámban fáklyafény. */
  #atmosphere() {
    for (const o of this.atmo) o.destroy();
    this.atmo = [];
    const { width: w, height: h } = this.scale;
    const col = this.cave.color;
    const keep = (o) => { this.atmo.push(o); return o; };

    keep(this.add.particles(0, 0, 'fx-dot', {
      x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 5000,
      speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -2 },
      scale: { start: 0.12, end: 0 }, alpha: { start: 0.6, end: 0 },
      tint: col, blendMode: 'ADD', frequency: 160, maxAliveParticles: 30,
    }).setDepth(-5));

    if (this.field) {
      const k = this.fieldKind;
      if (k === 'snow') keep(this.add.particles(0, -10, 'fx-dot', {
        x: { min: 0, max: w }, lifespan: 6000, speedY: { min: 40, max: 90 }, speedX: { min: -30, max: 10 },
        scale: { min: 0.06, max: 0.16 }, alpha: { start: 0.9, end: 0.3 }, frequency: 50, maxAliveParticles: 70,
      }).setDepth(9600));
      if (k === 'ash') keep(this.add.particles(0, h, 'fx-dot', {
        x: { min: 0, max: w }, lifespan: 3200, speedY: { min: -90, max: -30 }, speedX: { min: -20, max: 20 },
        scale: { start: 0.16, end: 0 }, tint: [0xff8a3d, 0xffc46b, 0xff5a2a], blendMode: 'ADD', frequency: 60, maxAliveParticles: 40,
      }).setDepth(9600));
      if (k === 'meadow' || k === 'forest') keep(this.add.particles(0, 0, 'fx-dot', {
        x: { min: 0, max: w }, y: { min: h * 0.3, max: h * 0.8 }, lifespan: { min: 2400, max: 4200 }, speed: { min: 4, max: 16 },
        scale: { start: 0.2, end: 0.04 }, alpha: { start: 0.9, end: 0 }, tint: [0xd8ff8a, 0xfff3a0, 0x9dffc9], blendMode: 'ADD',
        frequency: 160, maxAliveParticles: 26,
      }).setDepth(-4));
      for (let i = 0; i < 2; i++) {
        const fog = keep(this.add.image(Math.random() * w, this.floorY + 14 + i * 20, 'fx-smoke').setTint(col).setAlpha(0.12).setDepth(-4).setDisplaySize(w * 0.7, 90));
        this.tweens.add({ targets: fog, x: { from: -w * 0.3, to: w * 1.3 }, duration: 30000 + i * 8000, repeat: -1, delay: -i * 11000 });
      }
      return;
    }
    if (this.spar) {
      // A háttérkép fáklyái (ugyanott, ahol az arenaBackdrop rajzolja őket) pislákolnak
      const fy = h * 0.72 - 82;
      for (const fx of [0.12, 0.38, 0.62, 0.88]) {
        const glow = keep(this.add.image(w * fx, fy, 'fx-dot').setTint(0xffa040).setBlendMode('ADD').setScale(3.2).setAlpha(0.35).setDepth(-6));
        this.tweens.add({ targets: glow, alpha: { from: 0.22, to: 0.5 }, scale: { from: 2.9, to: 3.5 }, duration: 140 + Math.random() * 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      keep(this.add.particles(0, 0, 'fx-dot', {
        x: { min: 0, max: w }, y: h * 0.72 - 70, lifespan: 2200, speedY: { min: -50, max: -20 }, speedX: { min: -12, max: 12 },
        scale: { start: 0.1, end: 0 }, tint: [0xffc46b, 0xff8a3d], blendMode: 'ADD', frequency: 120, maxAliveParticles: 20,
      }).setDepth(-5));
      return;
    }

    // Fénysugarak a mennyezet repedéseiből
    for (let i = 0; i < 3; i++) {
      const shaft = keep(this.add.image(w * (0.22 + i * 0.28 + (Math.random() - 0.5) * 0.08), -10, 'fx-shaft')
        .setOrigin(0.5, 0).setTint(col).setBlendMode('ADD').setAlpha(0.1).setDepth(-6)
        .setDisplaySize(w * 0.09, h * 0.85).setRotation(0.16 - i * 0.08));
      this.tweens.add({ targets: shaft, alpha: { from: 0.05, to: 0.2 }, duration: 2600 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Lassan úszó köd a padló fölött
    for (let i = 0; i < 3; i++) {
      const fog = keep(this.add.image(Math.random() * w, this.floorY + 10 + i * 18, 'fx-smoke').setTint(col).setAlpha(0.14).setDepth(-4)
        .setDisplaySize(w * 0.6, 90));
      this.tweens.add({ targets: fog, x: { from: -w * 0.3, to: w * 1.3 }, duration: 26000 + i * 7000, repeat: -1, delay: -i * 9000 });
    }
  }

  #onResize() {
    const { width: w, height: h } = this.scale;
    this.bg.setTexture(this.#backdrop(w, h)).setDisplaySize(w, h);
    this.#layout();
    this.#atmosphere();
    for (const u of this.units) if (u.view.scene) this.#place(u);
  }

  #place(u) {
    if (u.boss) return this.#placeBoss(u);
    const s = this.#slot(u);
    u.home = { x: s.x, y: s.y - 0.4 * this.S };
    u.view.setPosition(u.home.x, u.home.y).setDepth(s.y);
    u.shadow.setPosition(s.x, s.y).setDisplaySize(this.S * 0.8, this.S * 0.22).setDepth(s.y - 1);
    u.zone.setPosition(s.x, s.y - 0.45 * this.S).setSize(this.S * 0.8, this.S * 0.8);
    u.ui.setPosition(s.x, s.y - this.S * 0.98).setDepth(9000);
    u.ring.setPosition(s.x, s.y).setDepth(s.y - 2);
  }

  /** A hely a csatatéren; a boss mellett a csatlósok előrébb (balra) állnak. */
  #slot(u) {
    const s = this.slots[u.side][u.slot];
    if (u.side !== 'enemy' || !this.units.some((x) => x.boss)) return s;
    const { width: w } = this.scale;
    return { x: w * (this.narrow ? 0.5 : 0.54) + (u.slot === 2 ? w * 0.04 : 0), y: this.floorY + (u.slot === 2 ? this.S * 0.32 : -this.S * 0.05) };
  }

  /** Níðhöggr mérete és helye: a jobb oldalt szinte egészében kitölti. */
  #bossHeight() { return this.S * (this.narrow ? 1.7 : 2.0); }
  #placeBoss(u) {
    const { width: w } = this.scale;
    const H = this.#bossHeight();
    const x = w * 0.77, y = this.floorY + this.S * 0.12;
    u.bossH = H;
    u.home = { x, y };
    u.view.setPosition(x, y).setDepth(y).setScale(H / u.bossH0);
    u.shadow.setPosition(x, y).setDisplaySize(H * 1.4, H * 0.18).setDepth(y - 1);
    u.zone.setPosition(x - H * 0.15, y - H * 0.45).setSize(H * 1.1, H * 0.85);
    u.ring.setPosition(x, y).setDepth(y - 2);
    u.ringScale = [H / 128 * 1.1, H / 128 * 0.22];
    u.ring.setScale(...u.ringScale);
    // A boss sávja a képernyő tetején, széles és vastag
    u.barW = Math.min(w * (this.narrow ? 0.8 : 0.5), 620);
    u.ui.setPosition(w / 2, this.narrow ? 46 : 58).setDepth(9000).setScrollFactor(0);
  }

  /* ================================================================== */
  /* Egységek                                                            */
  /* ================================================================== */
  async #makeUnit(d, side, slot, extra = {}) {
    const { state } = this.g;
    const train = side === 'ally' ? state.trainOf(d) : undefined;
    const stats = deriveStats(d, state.catalog, { ...extra, train, relics: side === 'ally' ? state.save.relics : [] });
    const S = this.S;

    const bossH0 = extra.boss ? this.#bossHeight() : 0;
    const view = extra.boss ? makeBossView(this, bossH0) : makeDragonView(this, await dragonTextures(this, d, state.catalog, 256), S);
    const parts = view.getData('parts');
    if (side === 'ally') parts.inner.scaleX = -1;          // a rajz balra néz — a csapat jobbra

    const u = {
      d, side, slot, stats, parts, view,
      hp: stats.maxHp, energy: 1, alive: true, defending: false,
      status: { burn: 0, poison: 0, freeze: 0, stun: 0, atkUp: 0, ward: 0, slow: 0, mark: 0, shadow: 0, thorns: 0, broken: 0 },
      techs: side === 'ally' ? state.learnedOf(d).filter((k) => TECHNIQUES[k]) : (d.tech || []),
      boss: !!extra.boss,
      fx: {},
      tint: 0xffffff,
    };
    if (u.boss) Object.assign(u, { bossH0, bossH: bossH0, phase: 1, stagger: 0, charging: false, turns: 0, lastCharge: 0, lastSummon: -9 });
    u.shadow = this.add.image(0, 0, 'shadow').setAlpha(0.9);
    u.ringScale = [S / 128 * 0.9, S / 128 * 0.26];
    u.ring = this.add.image(0, 0, 'fx-ring').setTint(side === 'ally' ? 0xffd08a : 0xff6b6b)
      .setScale(...u.ringScale).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    u.zone = this.add.zone(0, 0, S, S).setOrigin(0.5);

    // Fej fölötti felület: név, életerő, energia, állapotok
    u.ui = this.add.container(0, 0);
    const bw = Math.max(this.narrow ? 64 : 90, S * 0.8);
    u.uiName = this.add.text(0, -18, this.narrow ? `${d.nev.split(' ')[0]} · ${stats.level}` : `${d.nev} · ${stats.level}`, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: this.narrow ? '11px' : '13px', fontStyle: '700',
      color: side === 'ally' ? '#ffe7c2' : '#ffc2c2', stroke: '#05070f', strokeThickness: 4,
    }).setOrigin(0.5);
    u.bar = this.add.graphics();
    u.barW = bw;
    u.shownHp = u.hp;
    u.uiStatus = this.add.text(0, 16, '', { fontSize: '14px' }).setOrigin(0.5);
    u.ui.add([u.uiName, u.bar, u.uiStatus]);
    if (u.boss) {
      u.uiName.setText(d.nev.toUpperCase()).setFontSize(this.narrow ? 15 : 19).setFontFamily('Cinzel Decorative, Cinzel, serif').setY(-22).setColor('#e9d6ff');
      u.uiStatus.setY(30);
    }

    this.#place(u);
    this.units.push(u);
    this.#idle(u);

    if (u.boss) {
      await this.#bossEntrance(u);
    } else if (side === 'enemy') {
      this.g.hud.extraDragons.set(String(d.id), d);
      await this.#entrance(u, slot * 160);
    } else {
      // A csapat balról repül be, és porfelhőt ver, ahogy földet ér
      u.view.x -= this.scale.width * 0.25;
      u.view.y -= this.S * 0.5;
      u.view.alpha = 0;
      this.tweens.add({
        targets: u.view, x: u.home.x, y: u.home.y, alpha: 1, duration: 650, delay: 200 + slot * 140, ease: 'Cubic.easeOut',
        onComplete: () => this.#dust(u, 8),
      });
    }
    return u;
  }

  /** Az ellenfél sötét sziluettként, izzó szemmel érkezik, aztán „kigyúl". */
  #entrance(u, delay) {
    const S = this.S;
    u.view.x += this.scale.width * 0.3;
    u.view.alpha = 0;
    this.#setTint(u, 0x000000);
    const eyes = this.add.image(-0.3 * S, -0.16 * S, 'eyes').setTint(u.boss ? 0xffd36b : 0xff3d3d)
      .setBlendMode('ADD').setScale(S / 170).setAlpha(0);
    u.parts.inner.add(eyes);
    this.tweens.add({ targets: eyes, alpha: 1, duration: 300, delay });
    this.tweens.add({ targets: u.view, x: u.home.x, alpha: 1, duration: 760, ease: 'Cubic.easeOut', delay });
    return new Promise((resolve) => this.time.delayedCall(delay + 700, () => {
      if (!u.view.scene) return resolve();
      this.#dust(u, 10);
      const k = { v: 0 };
      this.tweens.add({
        targets: k, v: 255, duration: 520, ease: 'Quad.easeIn',
        onUpdate: () => { const c = Math.round(k.v); this.#setTint(u, (c << 16) | (c << 8) | c); },
        onComplete: () => { this.#setTint(u, 0xffffff); resolve(); },
      });
      this.tweens.add({ targets: eyes, alpha: 0, duration: 600, delay: 300, onComplete: () => eyes.destroy() });
    }));
  }

  #idle(u) {
    if (u.boss) { u.bossTweens = animateBoss(this, u.view); return; }
    const { wings, head, inner } = u.parts;
    const r = Math.random();
    if (wings) this.tweens.add({ targets: wings, rotation: { from: -0.1, to: 0.12 }, duration: 900 + r * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (head) this.tweens.add({ targets: head, rotation: { from: -0.04, to: 0.05 }, duration: 1500 + r * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    u.bob = this.tweens.add({ targets: inner, y: -4, duration: 1800 + r * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Lélegzés: a test alig észrevehetően tágul
    u.breath = this.tweens.add({ targets: inner, scaleY: 1.025, duration: 1300 + r * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  #updateBar(u) {
    if (!u.bar.scene) return;                        // a legyőzött ellenfél grafikája már nincs
    if (u.shownHp < u.hp) u.shownHp = u.hp;
    this.#drawBar(u);
    const st = Object.entries(u.status).filter(([, v]) => v > 0).map(([k]) => STATUS_ICON[k]).join(' ');
    u.uiStatus.setText((u.defending ? '🛡 ' : '') + (u.charging ? '⚠ ' : '') + st).setX(u.boss ? 0 : u.barW / 4);
    this.#syncFx(u);
    this.#chaseLag(u);
  }

  /** A „késő" sáv: a sebzés előbb világosan látszik, aztán lassan fogy utána. */
  #chaseLag(u) {
    if (u.lagTween || u.shownHp <= u.hp) return;
    const k = { v: u.shownHp };
    u.lagTween = this.tweens.add({
      targets: k, v: u.hp, duration: 600, delay: 260, ease: 'Quad.easeOut',
      onUpdate: () => { u.shownHp = Math.max(u.hp, k.v); this.#drawBar(u); },
      onComplete: () => { u.lagTween = null; this.#drawBar(u); this.#chaseLag(u); },
    });
  }

  #drawBar(u) {
    if (!u.bar.scene) return;
    if (u.boss) return this.#drawBossBar(u);
    const g = u.bar;
    const w = u.barW, h = 9;
    const pct = Math.max(0, u.hp / u.stats.maxHp);
    const lag = Math.max(pct, u.shownHp / u.stats.maxHp);
    g.clear();
    g.fillStyle(0x05070f, 0.85).fillRoundedRect(-w / 2 - 2, -6, w + 4, h + 4, 4);
    if (lag > pct) g.fillStyle(0xfff3d0, 0.8).fillRoundedRect(-w / 2, -4, Math.max(2, w * lag), h, 3);
    const col = pct > 0.5 ? 0x2dd4a7 : pct > 0.25 ? 0xffc857 : 0xff5d6c;
    if (pct > 0) g.fillStyle(col, 1).fillRoundedRect(-w / 2, -4, Math.max(2, w * pct), h, 3);
    g.fillStyle(0xffffff, 0.25).fillRect(-w / 2, -4, Math.max(2, w * pct), 2);
    // Energia-pöttyök
    for (let i = 0; i < MAX_ENERGY; i++) {
      g.fillStyle(i < u.energy ? 0x7ce7ff : 0x2a3350, 1).fillCircle(-w / 2 + 6 + i * 11, 11, 3.6);
    }
  }

  /** Níðhöggr sávja: életerő a fázishatárokkal, alatta a megtörés-sáv. */
  #drawBossBar(u) {
    const g = u.bar, w = u.barW, h = 14;
    const pct = Math.max(0, u.hp / u.stats.maxHp);
    const lag = Math.max(pct, u.shownHp / u.stats.maxHp);
    g.clear();
    g.fillStyle(0x05070f, 0.9).fillRoundedRect(-w / 2 - 4, -8, w + 8, h + 20, 6);
    g.lineStyle(2, 0x9d6bff, 0.8).strokeRoundedRect(-w / 2 - 4, -8, w + 8, h + 20, 6);
    if (lag > pct) g.fillStyle(0xfff3d0, 0.8).fillRect(-w / 2, -4, w * lag, h);
    const col = u.phase >= 3 ? 0xff3d5a : u.phase === 2 ? 0xc04dff : 0x8a5cff;
    if (pct > 0) g.fillStyle(col, 1).fillRect(-w / 2, -4, w * pct, h);
    g.fillStyle(0xffffff, 0.22).fillRect(-w / 2, -4, w * pct, 3);
    // fázishatárok
    for (const ph of BOSS.phases) {
      g.fillStyle(0x05070f, 1).fillRect(-w / 2 + w * ph - 1.5, -6, 3, h + 4);
      g.fillStyle(0xffd36b, 0.9).fillTriangle(-w / 2 + w * ph - 5, -9, -w / 2 + w * ph + 5, -9, -w / 2 + w * ph, -3);
    }
    // megtörés-sáv
    const st = u.status.broken > 0 ? 1 : Math.min(1, u.stagger / BOSS.staggerMax);
    g.fillStyle(0x1a1f33, 1).fillRect(-w / 2, h + 1, w, 5);
    g.fillStyle(u.status.broken > 0 ? 0xffffff : 0xffc46b, 1).fillRect(-w / 2, h + 1, w * st, 5);
  }

  /* ================================================================== */
  /* Állapot-effektek: ami a sárkányon látszik                           */
  /* ================================================================== */
  #syncFx(u) {
    if (!u.view.scene) return;
    for (const k of Object.keys(u.status)) {
      const on = u.status[k] > 0 && u.alive;
      if (on && !u.fx[k]) u.fx[k] = this.#makeFx(u, k);
      else if (!on && u.fx[k]) { this.#killFx(u.fx[k]); delete u.fx[k]; }
    }
    this.#applyTint(u);
  }

  /** Egy állapot látványa; a visszaadott lista: { kind: 'obj'|'emitter'|'tween', o }. */
  #makeFx(u, k) {
    // A boss tárolójának origója a talpán van, és jóval nagyobb: a hatások a törzsére kerülnek
    const S = u.boss ? this.S * 1.8 : this.S;
    const oy = u.boss ? -u.bossH * 0.42 / u.view.scaleY : 0;
    const objs = [];
    const inView = (o) => { o.y += oy; u.view.add(o); objs.push({ kind: 'obj', o }); return o; };
    const loop = (cfg) => { const t = this.tweens.add(cfg); objs.push({ kind: 'tween', o: t }); return t; };
    const emitter = ({ tex = 'fx-dot', ...cfg }) => {
      const e = this.add.particles(0, 0, tex, cfg).setDepth(u.view.depth + 2);
      e.startFollow(u.view, 0, oy * u.view.scaleY);
      objs.push({ kind: 'emitter', o: e });
      return e;
    };
    switch (k) {
      case 'burn':
        emitter({
          x: { min: -S * 0.25, max: S * 0.25 }, y: { min: -S * 0.1, max: S * 0.25 }, lifespan: 620,
          speedY: { min: -90, max: -40 }, speedX: { min: -10, max: 10 }, scale: { start: 0.3, end: 0 },
          tint: [0xfff3a0, 0xffb347, 0xff6a1f], blendMode: 'ADD', frequency: 60, maxAliveParticles: 16,
        });
        break;
      case 'poison':
        emitter({
          tex: 'fx-bubble', x: { min: -S * 0.22, max: S * 0.22 }, y: { min: 0, max: S * 0.25 }, lifespan: 1100,
          speedY: { min: -40, max: -20 }, scale: { start: 0.5, end: 0.9 }, alpha: { start: 0.9, end: 0 },
          tint: [0x7dff6a, 0xb18cff], frequency: 160, maxAliveParticles: 10,
        });
        break;
      case 'freeze':
        for (let i = 0; i < 4; i++) {
          const c = inView(this.add.image((i - 1.5) * S * 0.18, S * 0.34, 'fx-shard').setTint(0xcff4ff)
            .setOrigin(0.5, 1).setScale(0.6 + (i % 2) * 0.5, 1.1 + (i % 2) * 0.6).setRotation((i - 1.5) * 0.22).setAlpha(0.9).setBlendMode('ADD'));
          c.scaleY = 0.01;
          this.tweens.add({ targets: c, scaleY: 1.1 + (i % 2) * 0.6, duration: 260, delay: i * 50, ease: 'Back.easeOut' });
        }
        break;
      case 'stun': {
        const stars = [0, 1, 2].map(() => inView(this.add.image(0, 0, 'fx-star').setTint(0xffe066).setScale(0.6).setBlendMode('ADD')));
        const k2 = { a: 0 };
        loop({
          targets: k2, a: Math.PI * 2, duration: 1100, repeat: -1,
          onUpdate: () => stars.forEach((s, i) => {
            const a = k2.a + (i * Math.PI * 2) / 3;
            s.setPosition(Math.cos(a) * S * 0.22, -S * 0.42 + Math.sin(a) * S * 0.06).setScale(0.5 + (Math.sin(a) + 1) * 0.15);
          }),
        });
        break;
      }
      case 'atkUp': {
        const r = inView(this.add.image(0, S * 0.4, 'fx-ring').setTint(0xffa040).setBlendMode('ADD').setScale(S / 128 * 0.8, S / 128 * 0.24));
        loop({ targets: r, alpha: { from: 0.4, to: 1 }, duration: 500, yoyo: true, repeat: -1 });
        emitter({
          x: { min: -S * 0.3, max: S * 0.3 }, y: S * 0.38, lifespan: 700, speedY: { min: -80, max: -40 },
          scale: { start: 0.14, end: 0 }, tint: [0xffc46b, 0xff8a3d], blendMode: 'ADD', frequency: 140, maxAliveParticles: 8,
        });
        break;
      }
      case 'ward': {
        const b = inView(this.add.image(0, 0, 'fx-ward').setTint(0x7ce7ff).setBlendMode('ADD').setScale(S / 118).setAlpha(0.42));
        loop({ targets: b, alpha: { from: 0.28, to: 0.55 }, scale: { from: S / 120, to: S / 112 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'mark': {
        const t = inView(this.add.text(0, -S * 0.58, 'ᛉ', {
          fontFamily: '"Noto Sans Runic", "Segoe UI Historic", serif', fontSize: `${Math.round(S * 0.22)}px`,
          color: '#ff6b6b', stroke: '#05070f', strokeThickness: 5,
        }).setOrigin(0.5));
        loop({ targets: t, y: t.y - 6, angle: { from: -8, to: 8 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'slow': {
        // Lapított tárolóban forog, hogy a talaj síkjában pörögjön
        const flat = inView(this.add.container(0, S * 0.4).setScale(1, 0.32).setAlpha(0.7));
        const c = this.add.image(0, 0, 'fx-runecircle').setTint(0x9fd8ff).setBlendMode('ADD').setScale(S / 230);
        flat.add(c);
        loop({ targets: c, angle: 360, duration: 4000, repeat: -1 });
        break;
      }
      case 'thorns':
        // Tüskekoszorú a sárkány körül
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          inView(this.add.image(Math.cos(a) * S * 0.42, Math.sin(a) * S * 0.18 + S * 0.12, 'fx-shard').setTint(0xc9a27e)
            .setRotation(a + Math.PI / 2).setScale(0.5, 0.8).setAlpha(0.85));
        }
        break;
      case 'shadow':
        emitter({
          tex: 'fx-smoke', x: { min: -S * 0.25, max: S * 0.25 }, y: { min: -S * 0.2, max: S * 0.3 }, lifespan: 900,
          speedY: { min: -20, max: -5 }, scale: { start: 0.4, end: 1 }, alpha: { start: 0.35, end: 0 },
          tint: 0x2a1a44, frequency: 140, maxAliveParticles: 8,
        });
        break;
    }
    return objs;
  }

  #killFx(objs) {
    for (const { kind, o } of objs) {
      if (kind === 'tween') o.stop();
      else if (kind === 'emitter') { o.stop(); this.time.delayedCall(1200, () => o.destroy()); }
      else if (o.scene) this.tweens.add({ targets: o, alpha: 0, duration: 220, onComplete: () => o.destroy() });
    }
  }
  #killAllFx(u) { for (const k of Object.keys(u.fx)) this.#killFx(u.fx[k]); u.fx = {}; }

  #parts(u) { return u.boss ? u.parts.imgs : [u.parts.body, u.parts.legs, u.parts.head, u.parts.wings].filter(Boolean); }
  #setTint(u, c) { u.tint = c; this.#applyTint(u); }
  #applyTint(u) {
    const imgs = this.#parts(u);
    if (!imgs.length || u.flashing) return;
    const c = u.status.freeze > 0 ? 0xa8e6ff : u.status.shadow > 0 ? 0x9a80c8 : u.tint;
    for (const i of imgs) { if (!i.active) continue; c === 0xffffff ? i.clearTint() : i.setTint(c); }
    u.parts.inner.alpha = u.status.shadow > 0 ? 0.72 : 1;
  }

  /* ================================================================== */
  /* Menet                                                               */
  /* ================================================================== */
  alive(side) { return this.units.filter((u) => u.alive && (!side || u.side === side)); }
  get bossWave() { return this.mode === 'cave' && this.tier === 5 && this.wave === this.cave.waves.length - 1; }

  async #run() {
    const waves = this.cave.waves;
    for (let wave = 0; wave < waves.length; wave++) {
      this.wave = wave;
      await this.#spawnWave(wave, waves[wave]);
      const r = await this.#fightWave();
      if (r !== 'win') return this.#finish(r);
      if (wave < waves.length - 1) {
        // Forrás a barlang mélyén: a csapat kicsit összeszedi magát
        for (const u of this.alive('ally')) {
          const heal = Math.round(u.stats.maxHp * 0.2);
          u.hp = Math.min(u.stats.maxHp, u.hp + heal);
          this.#float(u, `+${heal}`, '#7dffb0');
          this.#updateBar(u);
        }
        this.g.hud.battleLog('Egy forrásnál megpihentek: <b>+20% életerő</b>.');
        await this.#banner('Mélyebbre…', `${wave + 2}. hullám a ${waves.length}-ből`);
      }
    }
    this.#finish('victory');
  }

  async #spawnWave(wave, count) {
    const { state, story, hud, sfx } = this.g;
    const bossWave = this.bossWave;
    const makes = [];
    for (let i = 0; i < count; i++) {
      const boss = bossWave && i === 0;
      const raw = this.spar ? makeSparring(this.sparCfg.level, state.tiers, i)
        : this.field ? this.foes[i]
        : makeWild(this.tier, wave, state.tiers, Math.random, boss);
      makes.push(this.#makeUnit(withTotals(raw, state.catalog), 'enemy', i, { boss }));
    }
    const units = await Promise.all(makes);
    for (const u of units) this.#updateBar(u);
    await this.#wait(300);
    sfx.roar();
    for (const u of units) this.tweens.add({ targets: u.parts.head, rotation: -0.3, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
    if (bossWave) {
      const boss = units[0];
      this.cameras.main.shake(700, 0.012);
      const bc = this.#center(boss);
      await this.#camTo(bc.x, bc.y, 1.12, 700);
      const lines = story?.battleLines('nidhoggr', this.tier);
      if (lines) await story.dialogue.play(lines);
      await this.#banner('NÍÐHÖGGR', 'a Gyökérrágó felébredt');
      hud.battleLog('⚠ Tanács: a találatok töltik a <b>megtörés</b>-sávot (a boss életereje alatt). Ha megtelik, Níðhöggr megtántorodik és <b>+40%</b> sebzést kap. Ha <b>mély lélegzetet vesz</b>, védekezz — vagy törd meg, mielőtt kifújja!');
      await this.#camReset(500);
    }
    hud.battleLog(bossWave ? '<b>Níðhöggr</b> kitárja a szárnyait…'
      : this.mode === 'guardian' ? `${units.map((u) => `<b>${esc(u.d.nev)}</b>`).join(', ')} útját állja a próbának!`
      : this.spar ? `Ragnhild sárkányai: ${units.map((u) => `<b>${esc(u.d.nev)}</b>`).join(', ')}. „Mutasd, mit tanultál!"`
      : `${units.map((u) => `<b>${esc(u.d.nev)}</b>`).join(', ')} támad!`);
  }

  async #fightWave() {
    for (;;) {
      const order = this.alive().map((u) => ({ u, k: u.stats.spd * (u.status.slow > 0 ? 0.7 : 1) * (0.9 + Math.random() * 0.2) }))
        .sort((a, b) => b.k - a.k).map((x) => x.u);
      for (const u of order) {
        if (!u.alive) continue;
        const end = this.#check();
        if (end) return end;
        this.g.hud.turnOrder(order.filter((x) => x.alive), u);
        await this.#turn(u);
        if (this.pendingPhase) await this.#bossPhase(this.pendingPhase);
        if (this.fled) return 'flee';
      }
      const end = this.#check();
      if (end) return end;
    }
  }

  #check() {
    if (!this.alive('ally').length) return 'defeat';
    if (!this.alive('enemy').length) return 'win';
    return null;
  }

  async #turn(u) {
    const { hud } = this.g;
    u.defending = false;

    /* --- Kör eleji hatások --- */
    if (u.stats.traits.has('regen') && u.hp < u.stats.maxHp) {
      const heal = Math.round(u.stats.maxHp * 0.04);
      u.hp = Math.min(u.stats.maxHp, u.hp + heal);
      this.#float(u, `+${heal}`, '#7dffb0');
    }
    for (const [key, pct, label] of [['burn', 0.06, 'ég'], ['poison', 0.05, 'mérgeződik']]) {
      if (u.status[key] > 0) {
        u.status[key]--;
        const dmg = Math.max(3, Math.round(u.stats.maxHp * pct * (u.boss ? 0.3 : 1)));
        hud.battleLog(`<b>${esc(u.d.nev)}</b> ${label}: −${dmg}`);
        await this.#damage(u, dmg, false, key === 'burn' ? '#ff9a3d' : '#9dff6a', { dot: true });
        if (!u.alive) return;
      }
    }
    this.#updateBar(u);
    // Níðhöggrt nem lehet egyszerűen kábítani: lerázza — de a megtörés-sávot tölti
    if (u.boss && !u.staggered && (u.status.freeze || u.status.stun)) {
      u.status.freeze = 0; u.status.stun = 0;
      hud.battleLog('<b>Níðhöggr</b> lerázza a bénítást — de megingott.');
      this.#addStagger(u, 22);
      this.#updateBar(u);
    }
    if (u.boss && u.staggered) {
      u.staggered = false;
      u.status.stun = 0;
      hud.battleLog('<b>Níðhöggr</b> megtántorodva, <b>kimarad</b>. Most üss!');
      this.#float(u, '💫', '#ffe066', 34);
      this.#tickBuffs(u);
      this.#updateBar(u);
      await this.#wait(500);
      return;
    }
    for (const [key, label] of [['freeze', 'jégbe fagyott, kimarad'], ['stun', 'elkábult, kimarad']]) {
      if (u.status[key] > 0) {
        u.status[key]--;
        hud.battleLog(`<b>${esc(u.d.nev)}</b> ${label}.`);
        this.#float(u, key === 'freeze' ? '❄' : '💫', '#cfe9ff', 30);
        if (key === 'freeze' && !u.status.freeze) this.#shatter(u);
        this.#tickBuffs(u);
        this.#updateBar(u);
        await this.#wait(650);
        return;
      }
    }

    /* --- Kiemelés --- */
    this.tweens.add({ targets: u.ring, alpha: 0.9, duration: 200 });
    const pulse = this.tweens.add({ targets: u.ring, scaleX: u.ring.scaleX * 1.12, duration: 600, yoyo: true, repeat: -1 });

    if (u.side === 'ally') await this.#playerTurn(u);
    else { await this.#wait(450); await this.#enemyTurn(u); }

    pulse.stop();
    this.#tickBuffs(u);
    if (!u.ring.scene) return;                       // közben legyőzték és eltűnt
    u.ring.setScale(...u.ringScale);                 // a lüktetés ne halmozódjon körről körre
    this.tweens.add({ targets: u.ring, alpha: 0, duration: 200 });
    this.#updateBar(u);
  }

  #tickBuffs(u) { for (const k of BUFFS) if (u.status[k] > 0) u.status[k]--; }

  async #playerTurn(u) {
    const { hud, state } = this.g;
    for (;;) {
      const techs = u.techs.map((k) => ({ key: k, ...TECHNIQUES[k] }));
      const act = await hud.chooseAction(u, {
        canFlee: !this.bossWave, herbs: state.save.herbs, techs, combo: u.stats.combo,
        chorus: this.chorusOn ? {
          ready: this.chorus >= CHORUS.max,
          rune: this.ultis.length === 1 ? ULTIMATES[this.ultis[0]].rune : 'ᛟ',
          label: this.ultis.length === 1 ? ULTIMATES[this.ultis[0]].name : `Ulti (${this.ultis.length})`,
        } : null,
        fleeLabel: this.spar ? 'Feladás' : 'Menekülés',
      });

      if (act.type === 'attack' || act.type === 'skill') {
        const skill = act.type === 'skill' ? u.stats.skill : null;
        const target = skill === 'thunder' ? null : await this.#pickTarget(u);
        if (target === undefined) continue;                        // „Vissza"
        if (skill) await this.#skill(u, skill, target);
        else await this.#attack(u, target);
        return;
      }
      if (act.type === 'combo') {
        const info = COMBOS[u.stats.combo.key];
        const target = info.target === 'enemy' ? await this.#pickTarget(u) : null;
        if (target === undefined) continue;
        await this.#combo(u, target);
        return;
      }
      if (act.type === 'tech') {
        const t = TECHNIQUES[act.key];
        const target = t.target === 'enemy' ? await this.#pickTarget(u) : null;
        if (target === undefined) continue;
        await this.#technique(u, act.key, target);
        return;
      }
      if (act.type === 'chorus') {
        const key = this.ultis.length === 1 ? this.ultis[0] : await hud.chooseUlti(this.ultis);
        if (!key) continue;
        const target = key === 'gungnir' ? await this.#pickTarget(u) : null;
        if (target === undefined) continue;
        return this.#ulti(u, key, target);
      }
      if (act.type === 'defend') return this.#defend(u);
      if (act.type === 'herb') return this.#herb(u);
      if (act.type === 'flee') {
        if (this.spar || Math.random() < 0.6) {
          this.fled = true;
          hud.battleLog(this.spar ? 'Feladtad a párbajt. Ragnhild bólint: „Holnap újra."' : 'Sikerült kereket oldani!');
          this.g.sfx.miss();
          return;
        }
        hud.battleLog('A menekülés nem sikerült!');
        await this.#wait(500);
        return;
      }
    }
  }

  /** Célpont: kattintás egy ellenfélre, vagy 1–3; egyetlen ellenfélnél automatikus. */
  #pickTarget() {
    const foes = this.alive('enemy');
    if (foes.length === 1) return Promise.resolve(foes[0]);
    const { hud } = this.g;
    return new Promise((resolve) => {
      const markers = [];
      const cleanup = (val) => {
        hud.battleHint(null);
        document.removeEventListener('keydown', onKey);
        for (const f of foes) f.zone.removeAllListeners().disableInteractive();
        for (const m of markers) m.destroy();
        resolve(val);
      };
      foes.forEach((f, i) => {
        const m = this.add.text(f.boss ? f.view.x - f.bossH * 0.2 : f.view.x, f.boss ? f.view.y - f.bossH * 0.95 : f.view.y - this.S * 0.78, `▼ ${i + 1}`, {
          fontFamily: 'Cinzel, serif', fontSize: '18px', fontStyle: '700', color: '#ffd08a', stroke: '#05070f', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(9500);
        this.tweens.add({ targets: m, y: m.y - 8, duration: 420, yoyo: true, repeat: -1 });
        markers.push(m);
        f.zone.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { this.g.sfx.click(); cleanup(f); })
          .on('pointerover', () => { if (!f.boss) f.parts.inner.setScale(f.parts.inner.scaleX > 0 ? 1.05 : -1.05, 1.05); })
          .on('pointerout', () => { if (!f.boss) f.parts.inner.setScale(f.parts.inner.scaleX > 0 ? 1 : -1, 1); });
      });
      const onKey = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= foes.length) cleanup(foes[n - 1]);
        if (e.key === 'Escape') cleanup(undefined);
      };
      document.addEventListener('keydown', onKey);
      hud.battleHint('Válassz célpontot: kattints egy ellenfélre (1–3).');
      hud.el.battle.querySelector('.bp-hint [data-act="back"]').onclick = () => cleanup(undefined);
    });
  }

  async #enemyTurn(u) {
    if (u.boss) return this.#bossTurn(u);
    const allies = this.alive('ally');
    const weakest = allies.reduce((a, b) => (a.hp / a.stats.maxHp < b.hp / b.stats.maxHp ? a : b));
    const target = Math.random() < 0.55 ? weakest : pick(allies);
    const tech = this.#aiTech(u);
    if (tech) return this.#technique(u, tech, techInfo(tech).target === 'enemy' ? target : null);
    if (this.#aiCombo(u)) return this.#combo(u, COMBOS[u.stats.combo.key].target === 'enemy' ? target : null);
    if (u.energy >= SKILL_COST && Math.random() < (u.boss ? 0.8 : 0.6)) await this.#skill(u, u.stats.skill, u.stats.skill === 'thunder' ? null : target);
    else await this.#attack(u, target);
  }

  /** A vad is használja a kombinált képességét, ha teli az energiája (a pajzsosat csak bajban). */
  #aiCombo(u) {
    const c = u.stats.combo;
    if (!c || u.energy < COMBO_COST || u.d.spar && u.stats.level < 3) return false;
    if (COMBOS[c.key].target === 'party' && !this.alive(u.side).some((f) => f.hp < f.stats.maxHp * 0.6)) return false;
    return Math.random() < (u.boss ? 0.6 : 0.5);
  }

  /** Mikor éri meg egy vadnak a technikája? Csak ha van értelme. */
  #aiTech(u) {
    const friends = this.alive(u.side);
    for (const k of u.techs) {
      const t = techInfo(k);
      if (!t || u.energy < t.cost) continue;
      if (k === 'galdr' && !friends.some((f) => f.hp < f.stats.maxHp * 0.5)) continue;
      if (k === 'warcry' && friends.some((f) => f.status.atkUp > 0)) continue;
      if (k === 'shieldwall' && friends.some((f) => f.status.ward > 0)) continue;
      if (k === 'shadow' && u.status.shadow > 0) continue;
      if (k === 'thorns' && u.status.thorns > 0) continue;
      const chance = k === 'root' ? 0.35 : u.boss ? 0.5 : 0.4;
      if (Math.random() < chance) return k;
    }
    return null;
  }

  /* ================================================================== */
  /* Cselekvések                                                         */
  /* ================================================================== */
  async #attack(u, t) {
    this.g.hud.battleLog(`<b>${esc(u.d.nev)}</b> támad → <b>${esc(t.d.nev)}</b>`);
    await this.#lunge(u, t, 0.35, 150, u.status.shadow > 0);
    await this.#strike(u, t, 1);
    u.energy = Math.min(MAX_ENERGY, u.energy + 1);
  }

  async #defend(u) {
    u.defending = true;
    u.energy = Math.min(MAX_ENERGY, u.energy + 1);
    this.g.hud.battleLog(`<b>${esc(u.d.nev)}</b> védekezik.`);
    const s = this.add.image(u.view.x, u.view.y, 'fx-ring').setTint(0x7ce7ff).setBlendMode('ADD').setScale(0.2).setDepth(9000);
    this.g.sfx.frost();
    await this.#tween({ targets: s, scale: this.S / 110, alpha: { from: 1, to: 0 }, duration: 520, ease: 'Cubic.easeOut' });
    s.destroy();
  }

  async #herb(u) {
    const { state, hud, sfx } = this.g;
    const allies = this.alive('ally');
    const t = allies.reduce((a, b) => (a.hp / a.stats.maxHp < b.hp / b.stats.maxHp ? a : b));
    const heal = Math.round(t.stats.maxHp * 0.4);
    state.save.herbs--;
    state.touch();
    t.hp = Math.min(t.stats.maxHp, t.hp + heal);
    hud.battleLog(`<b>${esc(u.d.nev)}</b> gyógyfüvet ad <b>${esc(t.d.nev)}</b> sárkánynak (+${heal}).`);
    sfx.heal();
    this.#float(t, `+${heal}`, '#7dffb0', 26);
    const p = this.add.particles(t.view.x, t.view.y, 'fx-dot', {
      speedY: { min: -120, max: -40 }, speedX: { min: -30, max: 30 }, lifespan: 900,
      scale: { start: 0.35, end: 0 }, tint: [0x7dffb0, 0xd8ff8a], blendMode: 'ADD', emitting: false,
    }).setDepth(9000);
    p.explode(24);
    this.#updateBar(t);
    await this.#wait(700);
    p.destroy();
  }

  async #skill(u, key, t) {
    const { hud, sfx } = this.g;
    const sk = SKILLS[key];
    u.energy -= SKILL_COST;
    this.#updateBar(u);
    hud.battleLog(`<b>${esc(u.d.nev)}</b>: <span class="bl-skill">${sk.rune} ${esc(sk.name)}</span>${t ? ` → <b>${esc(t.d.nev)}</b>` : '!'}`);
    await this.#skillName(u, sk);

    switch (key) {
      case 'fire': {
        sfx.fire();
        await this.#breath(u, t, [0xfff3a0, 0xffb347, 0xff6a1f, 0xd9330f]);
        const r = await this.#strike(u, t, 1.35, { fire: true, sure: true });
        if (r && t.alive && !t.stats.traits.has('fireblood')) { t.status.burn = 3; hud.battleLog(`<b>${esc(t.d.nev)}</b> lángra kapott!`); this.#updateBar(t); }
        break;
      }
      case 'frost': {
        sfx.frost();
        await this.#shards(u, t);
        const r = await this.#strike(u, t, 1.2, { sure: true });
        if (r && t.alive && !t.stats.traits.has('frostheart') && Math.random() < 0.4) {
          t.status.freeze = 1; hud.battleLog(`<b>${esc(t.d.nev)}</b> jégbe fagyott!`); this.#iceBlock(t); this.#updateBar(t);
        }
        break;
      }
      case 'venom': {
        sfx.venom();
        await this.#bubbles(u, t);
        const r = await this.#strike(u, t, 1.0, { sure: true });
        if (r && t.alive) { t.status.poison = 4; hud.battleLog(`<b>${esc(t.d.nev)}</b> megmérgeződött!`); this.#updateBar(t); }
        break;
      }
      case 'thunder': {
        sfx.thunder();
        const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
        this.cameras.main.flash(260, 200, 230, 255);
        await Promise.all(foes.map((f, i) => this.#bolt(f, i * 90)));
        for (const f of foes) if (f.alive) await this.#strike(u, f, 0.75, { quick: true });
        break;
      }
      case 'drain': {
        sfx.drain();
        await this.#lunge(u, t);
        const r = await this.#strike(u, t, 1.2, { sure: true });
        if (r) {
          await this.#orbs(t, u, 0xff5d7a);
          const heal = Math.round(r / 2);
          u.hp = Math.min(u.stats.maxHp, u.hp + heal);
          this.#float(u, `+${heal}`, '#ff9ab0', 24);
        }
        break;
      }
      case 'charge': {
        await this.#lunge(u, t, 0.85, 240, true);
        this.cameras.main.shake(260, 0.012);
        const r = await this.#strike(u, t, 1.9, { heavy: true });
        if (r) {
          const recoil = Math.round(r * 0.12);
          hud.battleLog(`<b>${esc(u.d.nev)}</b> a rohamtól megsérült (−${recoil}).`);
          await this.#damage(u, recoil, false, '#ffc46b', { dot: true });
        }
        break;
      }
      case 'crush': {
        await this.#lunge(u, t, 0.5, 200);
        this.cameras.main.shake(320, 0.014);
        const r = await this.#strike(u, t, 1.5, { heavy: true, sure: true });
        if (r && t.alive && Math.random() < 0.35) { t.status.stun = 1; hud.battleLog(`<b>${esc(t.d.nev)}</b> elkábult!`); this.#updateBar(t); }
        break;
      }
      case 'pierce': {
        await this.#streak(u, t);
        await this.#strike(u, t, 1.4, { pierce: true, sure: true });
        break;
      }
      default: {
        await this.#lunge(u, t);
        await this.#strike(u, t, 1.1);
      }
    }
  }

  /* ================================================================== */
  /* Kombinált képesség — a testrészek elemi összetételéből              */
  /* ================================================================== */
  async #combo(u, t) {
    const { hud } = this.g;
    const c = u.stats.combo;
    const info = COMBOS[c.key];
    u.energy -= COMBO_COST;
    this.#updateBar(u);
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    const friends = this.alive(u.side);
    const icons = ELEMENTS[c.primary].icon + (c.secondary !== c.primary ? ELEMENTS[c.secondary].icon : '');
    hud.battleLog(`<b>${esc(u.d.nev)}</b>: <span class="bl-tech" style="color:${hex(info.color)}">${icons} ${esc(info.name)}</span>${t ? ` → <b>${esc(t.d.nev)}</b>` : '!'}`
      + (c.resonance > 2 ? ` <small>(rezonancia ${c.resonance}/4)</small>` : ''));

    // Mozis bevezető: ráközelítés, a sárkány az elemei színében felizzik
    hud.cinematic(true);
    await this.#camTo(u.view.x, u.view.y, 1.12, 380);
    this.#glow(u, info.color, 750);
    await this.#skillName(u, info, true);
    this.#camReset(380);

    const targets = info.target === 'all' ? foes : info.target === 'enemy' && t ? [t] : [];
    await this.#comboFx(u, info, t, targets, foes, friends);
    const mult = info.mult * c.power;

    if (info.target === 'party') {
      for (const f of friends) {
        const heal = Math.round(f.stats.maxHp * info.heal);
        f.hp = Math.min(f.stats.maxHp, f.hp + heal);
        f.status.ward = Math.max(f.status.ward, info.ward);
        this.#float(f, `+${heal}`, '#7dffb0', 24);
        this.#updateBar(f);
      }
      hud.battleLog(`${u.side === 'ally' ? 'A csapatod' : 'Az ellenfelek'} kőfal mögé húzódik: <b>+${Math.round(info.heal * 100)}%</b> életerő, <b>−30%</b> sebzés 2 körig.`);
    } else if (info.chain) {
      const r = await this.#strike(u, t, mult, { sure: true });
      if (r) this.#comboEffects(u, t, info, r);
      for (const f of foes) {
        if (f === t || !f.alive) continue;
        const r2 = await this.#strike(u, f, info.chain * c.power, { quick: true });
        if (r2) this.#comboEffects(u, f, info, r2);
      }
    } else {
      for (const f of targets) {
        if (!f.alive) continue;
        const r = await this.#strike(u, f, mult, {
          sure: info.target === 'enemy', pierce: info.pierce, forceCrit: info.crit, heavy: info.heavy,
          fire: !!info.burn, quick: targets.length > 1,
        });
        if (r && info.drain) await this.#orbs(f, u, info.color);
        if (r) this.#comboEffects(u, f, info, r);
      }
    }
    hud.cinematic(false);
  }

  /** A kombinált képesség mellékhatásai egy célponton (és a visszaszívás). */
  #comboEffects(u, f, info, dealt) {
    const notes = [];
    if (f.alive) {
      const st = f.status;
      if (info.burn && !f.stats.traits.has('fireblood') && Math.random() < (info.burnChance ?? 1)) { st.burn = Math.max(st.burn, info.burn); notes.push('lángra kapott'); }
      if (info.poison) { st.poison = Math.max(st.poison, info.poison); notes.push('megmérgeződött'); }
      if (info.slow) { st.slow = Math.max(st.slow, info.slow); notes.push('lelassult'); }
      if (info.mark) { st.mark = Math.max(st.mark, info.mark); notes.push('bélyeget kapott'); }
      if (info.freeze && !f.stats.traits.has('frostheart') && Math.random() < info.freeze) {
        st.freeze = 1; this.#iceBlock(f); notes.push('jégbe fagyott');
      } else if (info.stun && Math.random() < info.stun) { st.stun = 1; notes.push('elkábult'); }
      this.#updateBar(f);
    }
    if (notes.length) this.g.hud.battleLog(`<b>${esc(f.d.nev)}</b> ${notes.join(', ')}!`);
    if (info.drain && u.alive) {
      const heal = Math.round(dealt * info.drain);
      u.hp = Math.min(u.stats.maxHp, u.hp + heal);
      this.#float(u, `+${heal}`, '#ff9ab0', 24);
      this.#updateBar(u);
    }
  }

  /** A kombinált képességek látványa (a sebzés előtt). */
  async #comboFx(u, info, t, targets, foes, friends) {
    const { sfx } = this.g;
    const col = info.color;
    const cam = this.cameras.main;
    switch (info.fx) {
      case 'erupt':
        sfx.fire(); sfx.quake();
        cam.shake(700, 0.01);
        await Promise.all(targets.map((f, i) => this.#pillar(f, col, i * 130)));
        break;
      case 'icefall':
        sfx.frost();
        await this.#iceDrop(t, col, !!info.heavy);
        break;
      case 'chain': {
        sfx.thunder();
        cam.flash(220, 210, 235, 255);
        await this.#bolt(t, 0);
        const rest = foes.filter((f) => f !== t);
        if (rest.length) { sfx.thunder(); await this.#arcs(t, rest, [0x4fd6ff, 0xcfefff, 0xffffff]); }
        break;
      }
      case 'void':
        sfx.shadow(); sfx.drain();
        await this.#vortex(t, col);
        break;
      case 'rockfall':
        sfx.quake();
        cam.shake(900, 0.014);
        await Promise.all(targets.map((f, i) => this.#rocks(f, i * 140)));
        break;
      case 'cloud':
        sfx.venom(); sfx.gale();
        await this.#miasma(targets, col);
        break;
      case 'steam':
        sfx.fire();
        await this.#breath(u, t, [0xffffff, 0xffd08a, 0xcfefff, 0x9fe8ff]);
        sfx.frost(); sfx.boom();
        await this.#nova(t, 0xffffff);
        break;
      case 'firerain': {
        const jobs = [];
        targets.forEach((f, i) => {
          const c = this.#center(f);
          for (let k = 0; k < 2; k++) {
            const x0 = c.x + (f.side === 'enemy' ? -1 : 1) * this.S * (1.2 + k * 0.6);
            jobs.push(this.#fireball(x0, -60 - k * 40, c.x + (Math.random() - 0.5) * this.S * 0.3, c.y + (Math.random() - 0.5) * this.S * 0.2, i * 150 + k * 110, col));
          }
        });
        await Promise.all(jobs);
        break;
      }
      case 'hellfire':
        sfx.fire(); sfx.shadow();
        await this.#breath(u, t, [0xf0c8ff, 0xd06bff, 0x8a2be2, 0x3a0a5a]);
        break;
      case 'blizzard':
        sfx.gale(); sfx.frost();
        await this.#snowstorm(targets, col);
        break;
      case 'volley':
        sfx.frost();
        await this.#shards(u, t, [col, 0xffffff], 11);
        break;
      case 'darkbolt':
        sfx.thunder(); sfx.shadow();
        cam.flash(240, 150, 90, 230);
        await this.#bolt(t, 0, [0x6a2bd9, 0xd9b8ff, 0xffffff]);
        break;
      case 'bolts':
        sfx.thunder();
        cam.flash(200, 255, 236, 180);
        cam.shake(500, 0.012);
        await Promise.all(targets.map((f, i) => this.#bolt(f, i * 120, [0xffa040, 0xfff3c4, 0xffffff])));
        targets.forEach((f) => this.#dust(f, 10));
        break;
      case 'rain':
        sfx.venom(); sfx.gale();
        await this.#acidRain(targets, col);
        break;
      case 'crypt':
        sfx.quake(); sfx.shield();
        cam.shake(400, 0.008);
        await Promise.all(friends.map((f, i) => this.#stoneWall(f, i * 110)));
        break;
      case 'wraith':
        sfx.shadow(); sfx.venom();
        this.#ghost(u, col, 0.6);
        await this.#lunge(u, t, 0.6, 170, true);
        this.#nova(t, col);
        break;
      case 'roots':
        sfx.root();
        await Promise.all(targets.map((f, i) => this.#roots(f, i * 110, [0x0f2a0b, 0x3d6a2a, 0x9dd86a])));
        break;
      default:
        await this.#lunge(u, t);
    }
  }

  /* --- A kombinált képességek látványelemei --------------------------- */
  /** Lángoszlop / magma tör fel a célpont alól. */
  async #pillar(f, color, delay) {
    await this.#wait(delay);
    const p = this.#feet(f), S = this.S;
    const mark = this.add.image(p.x, p.y, 'fx-ring').setTint(color).setBlendMode('ADD').setScale(S / 300, S / 900).setDepth(f.view.depth - 1);
    this.tweens.add({ targets: mark, scaleX: S / 110, scaleY: S / 330, alpha: { from: 1, to: 0 }, duration: 700, onComplete: () => mark.destroy() });
    const jet = this.add.particles(p.x, p.y, 'fx-dot', {
      x: { min: -S * 0.16, max: S * 0.16 }, speedY: { min: -S * 4.6, max: -S * 2.6 }, speedX: { min: -24, max: 24 },
      lifespan: 520, scale: { start: 0.95, end: 0.15 }, alpha: { start: 1, end: 0 },
      tint: [0xfff3a0, color, 0xff3d1f], blendMode: 'ADD', frequency: 10, quantity: 4,
    }).setDepth(f.view.depth + 1);
    this.#dust(f, 8);
    this.tweens.add({ targets: f.view, y: f.home.y - S * 0.12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    await this.#wait(560);
    jet.stop();
    this.time.delayedCall(700, () => jet.destroy());
  }

  /** Jégtömb (vagy gleccserdarab) zuhan a célpontra, és szilánkokra törik. */
  async #iceDrop(t, color, big) {
    const c = this.#center(t), S = this.S;
    const sx = (S * (big ? 0.55 : 0.36)) / 12, sy = (S * (big ? 1.05 : 0.8)) / 22;
    const glow = this.add.image(c.x, -S, 'fx-shard').setTint(0xffffff).setBlendMode('ADD').setScale(sx * 1.25, sy * 1.15).setAlpha(0.5).setDepth(9199);
    const ice = this.add.image(c.x, -S, 'fx-shard').setTint(color).setScale(sx, sy).setDepth(9200).setAlpha(0.92);
    const shadow = this.add.image(this.#feet(t).x, this.#feet(t).y, 'fx-dot').setTint(0x000000).setScale(0.5, 0.15).setAlpha(0).setDepth(t.view.depth - 1);
    this.tweens.add({ targets: shadow, scaleX: S / 22, scaleY: S / 80, alpha: 0.5, duration: 460, ease: 'Quad.easeIn' });
    await this.#tween({ targets: [ice, glow], y: c.y - S * 0.1, duration: 460, ease: 'Quad.easeIn' });
    this.g.sfx.boom();
    this.cameras.main.shake(big ? 420 : 260, big ? 0.018 : 0.011);
    ice.destroy(); glow.destroy();
    this.tweens.add({ targets: shadow, alpha: 0, duration: 500, onComplete: () => shadow.destroy() });
    this.#shatter(t);
    this.#nova(t, color);
  }

  /** Táguló fénygyűrű és szikrák (robbanás, gőz). */
  #nova(t, color) {
    const c = this.#center(t);
    for (let i = 0; i < 2; i++) {
      const r = this.add.image(c.x, c.y, 'fx-ring').setTint(i ? color : 0xffffff).setBlendMode('ADD').setScale(0.15).setDepth(9100);
      this.tweens.add({ targets: r, scale: this.S / 70 + i * 0.8, alpha: 0, duration: 520 + i * 180, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
    const puff = this.add.particles(c.x, c.y, 'fx-smoke', {
      speed: { min: 40, max: 160 }, lifespan: 900, scale: { start: 0.6, end: 1.8 }, alpha: { start: 0.55, end: 0 }, tint: [0xffffff, color], emitting: false,
    }).setDepth(9090);
    puff.explode(14);
    this.time.delayedCall(1000, () => puff.destroy());
    return this.#wait(380);
  }

  /** Villámívek egy célpontról a többire. */
  async #arcs(from, tos, cols) {
    const a = this.#center(from);
    const g = this.add.graphics().setDepth(9200).setBlendMode('ADD');
    for (const to of tos) {
      const b = this.#center(to);
      const pts = [[a.x, a.y]];
      const n = 8;
      for (let i = 1; i < n; i++) pts.push([a.x + (b.x - a.x) * (i / n) + (Math.random() - 0.5) * 30, a.y + (b.y - a.y) * (i / n) + (Math.random() - 0.5) * 40]);
      pts.push([b.x, b.y]);
      for (const [w, col, al] of [[9, cols[0], 0.35], [3.5, cols[1], 0.9], [1.4, cols[2], 1]]) {
        g.lineStyle(w, col, al).beginPath().moveTo(...pts[0]);
        for (const p of pts.slice(1)) g.lineTo(...p);
        g.strokePath();
      }
      this.#impact(to, false);
    }
    await this.#tween({ targets: g, alpha: 0, duration: 320 });
    g.destroy();
  }

  /** Sötét örvény: a fény és a por beszippantódik a célpontba. */
  async #vortex(t, color) {
    const c = this.#center(t), S = this.S;
    const dark = this.add.image(c.x, c.y, 'fx-dot').setTint(0x12051f).setScale(0.2).setAlpha(0.85).setDepth(9080);
    this.tweens.add({ targets: dark, scale: S / 18, duration: 520, yoyo: true, hold: 260, ease: 'Cubic.easeOut', onComplete: () => dark.destroy() });
    const suck = this.add.particles(c.x, c.y, 'fx-dot', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, S * 0.75), quantity: 36 },
      moveToX: c.x, moveToY: c.y, lifespan: 520, scale: { start: 0.45, end: 0.05 },
      tint: [color, 0xffffff, 0x3a0a5a], blendMode: 'ADD', frequency: 16, quantity: 3,
    }).setDepth(9090);
    const ring = this.add.image(c.x, c.y, 'fx-ring').setTint(color).setBlendMode('ADD').setScale(S / 70).setDepth(9091);
    this.tweens.add({ targets: ring, scale: 0.1, angle: 270, duration: 900, ease: 'Cubic.easeIn', onComplete: () => ring.destroy() });
    await this.#wait(900);
    suck.stop();
    this.time.delayedCall(600, () => suck.destroy());
    this.#impact(t, true);
  }

  /** Sziklák zuhannak a célpontra. */
  async #rocks(f, delay) {
    await this.#wait(delay);
    const c = this.#center(f), S = this.S;
    const jobs = [0, 1, 2].map((k) => {
      const key = `boulder${k % 2}`;
      const r = this.add.image(c.x + (k - 1) * S * 0.25, -S * (0.6 + k * 0.4), key).setScale(S / (110 + k * 30)).setDepth(9200 + k).setAngle(Math.random() * 90);
      return this.#tween({ targets: r, y: c.y + (k - 1) * S * 0.08, angle: r.angle + 200, duration: 430 + k * 90, ease: 'Quad.easeIn' }).then(() => {
        this.#dust(f, 6);
        this.cameras.main.shake(120, 0.008);
        this.tweens.add({ targets: r, alpha: 0, scale: r.scale * 0.6, duration: 260, onComplete: () => r.destroy() });
      });
    });
    await Promise.all(jobs);
  }

  /** Mérges / kénes felhő hömpölyög az ellenfelekre. */
  async #miasma(targets, color) {
    const S = this.S;
    const clouds = targets.map((f) => {
      const c = this.#center(f);
      return this.add.particles(c.x, c.y, 'fx-smoke', {
        x: { min: -S * 0.5, max: S * 0.5 }, y: { min: -S * 0.3, max: S * 0.35 }, speed: { min: 6, max: 30 },
        lifespan: 1300, scale: { start: 0.8, end: 2.6 }, alpha: { start: 0.55, end: 0 }, tint: [color, 0x4a6b2a, 0xd8ff8a],
        frequency: 40, quantity: 2,
      }).setDepth(f.view.depth + 2);
    });
    targets.forEach((f) => this.#setTintFlash(f, color));
    await this.#wait(900);
    clouds.forEach((e) => { e.stop(); this.time.delayedCall(1400, () => e.destroy()); });
  }

  /** Rövid színes felvillanás (méreg, sav). */
  #setTintFlash(f, color) {
    this.#parts(f).forEach((i) => i.setTint(color));
    this.time.delayedCall(260, () => { if (f.alive) this.#applyTint(f); });
  }

  /** Hóvihar: ferdén száguldó hópelyhek, örvény minden ellenfélen. */
  async #snowstorm(targets, color) {
    const { width: w, height: h } = this.scale;
    const snow = this.add.particles(0, 0, 'fx-dot', {
      x: { min: -w * 0.2, max: w }, y: -20, lifespan: 1400, speedX: { min: 260, max: 420 }, speedY: { min: 380, max: 560 },
      scale: { min: 0.08, max: 0.22 }, alpha: { start: 0.95, end: 0.3 }, tint: [0xffffff, color], frequency: 8, quantity: 4,
    }).setDepth(9600);
    const veil = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, color, 1).setAlpha(0).setBlendMode('ADD').setDepth(-2);
    this.tweens.add({ targets: veil, alpha: 0.14, duration: 400, yoyo: true, hold: 600, onComplete: () => veil.destroy() });
    await Promise.all(targets.map((f, i) => this.#whirl(f, color, i * 90)));
    snow.stop();
    this.time.delayedCall(1500, () => snow.destroy());
  }

  /** Savas eső a célpontok fölött, csobbanással a lábuknál. */
  async #acidRain(targets, color) {
    const S = this.S;
    const xs = targets.map((f) => this.#center(f).x);
    const x0 = Math.min(...xs) - S * 0.6, x1 = Math.max(...xs) + S * 0.6;
    const drops = this.add.particles(0, -20, 'fx-spark', {
      x: { min: x0, max: x1 }, lifespan: 700, speedY: { min: 900, max: 1200 }, speedX: -60, rotate: 95,
      scale: { min: 0.6, max: 1 }, alpha: { start: 0.9, end: 0.6 }, tint: [color, 0xe8ffb0], blendMode: 'ADD', frequency: 6, quantity: 3,
    }).setDepth(9600);
    const splashes = targets.map((f) => {
      const p = this.#feet(f);
      return this.add.particles(p.x, p.y, 'fx-dot', {
        x: { min: -S * 0.4, max: S * 0.4 }, speedY: { min: -120, max: -40 }, speedX: { min: -40, max: 40 }, gravityY: 400,
        lifespan: 400, scale: { start: 0.18, end: 0 }, tint: color, blendMode: 'ADD', frequency: 30, quantity: 2,
      }).setDepth(f.view.depth + 1);
    });
    await this.#wait(1000);
    targets.forEach((f) => this.#setTintFlash(f, color));
    drops.stop(); splashes.forEach((e) => e.stop());
    this.time.delayedCall(900, () => { drops.destroy(); splashes.forEach((e) => e.destroy()); });
  }

  /** Kőfal: kőlapok emelkednek a sárkány elé, aztán pajzsbuborék. */
  async #stoneWall(f, delay) {
    await this.#wait(delay);
    const p = this.#feet(f), S = this.S;
    const dir = f.side === 'ally' ? 1 : -1;
    const slabs = [-1, 0, 1].map((k) => this.add.image(p.x + dir * S * 0.42 + k * S * 0.05, p.y + k * S * 0.12, 'fx-shard')
      .setTint(k ? 0x8a8fa6 : 0xa8a0c8).setOrigin(0.5, 1).setScale(S / 30, 0.01).setDepth(f.view.depth + 1 + k));
    this.#dust(f, 10);
    await this.#tween({ targets: slabs, scaleY: S / 34, duration: 280, ease: 'Back.easeOut' });
    await this.#wardPop(f, 0);
    this.time.delayedCall(500, () => this.tweens.add({ targets: slabs, alpha: 0, scaleY: 0.01, duration: 400, onComplete: () => slabs.forEach((s) => s.destroy()) }));
  }

  /* ================================================================== */
  /* Tanult technikák                                                    */
  /* ================================================================== */
  async #technique(u, key, t) {
    const { hud, sfx } = this.g;
    const info = techInfo(key);
    u.energy -= info.cost;
    this.#updateBar(u);
    const foes = this.alive(u.side === 'ally' ? 'enemy' : 'ally');
    const friends = this.alive(u.side);
    hud.battleLog(`<b>${esc(u.d.nev)}</b>: <span class="bl-tech" style="color:${hex(info.color)}">${info.rune} ${esc(info.name)}</span>${t ? ` → <b>${esc(t.d.nev)}</b>` : '!'}`);

    // A nagy technikák mozis bevezetőt kapnak
    const big = info.cost >= 3 || key === 'root';
    if (big) {
      hud.cinematic(true);
      await this.#camTo(u.view.x, u.view.y, 1.14, 420);
    }
    await this.#skillName(u, info, big);
    if (big) this.#camReset(420);

    switch (key) {
      case 'galdr': {
        const ally = friends.reduce((a, b) => (a.hp / a.stats.maxHp < b.hp / b.stats.maxHp ? a : b));
        sfx.chant();
        await this.#runeCircle(ally, info.color, 1100);
        const heal = Math.round(ally.stats.maxHp * 0.3);
        ally.hp = Math.min(ally.stats.maxHp, ally.hp + heal);
        const cleansed = ally.status.burn || ally.status.poison;
        ally.status.burn = 0; ally.status.poison = 0;
        this.#float(ally, `+${heal}`, '#7dffb0', 28);
        hud.battleLog(`<b>${esc(ally.d.nev)}</b> +${heal} életerő${cleansed ? ', és megtisztult' : ''}.`);
        this.#updateBar(ally);
        break;
      }
      case 'mark': {
        sfx.mark();
        await this.#runeSlam(t, 'ᛉ', info.color);
        const r = await this.#strike(u, t, 0.6, { sure: true, quick: true });
        if (t.alive) { t.status.mark = 3; hud.battleLog(`<b>${esc(t.d.nev)}</b> rúnabélyeget kapott: <b>+30%</b> sebzés éri.`); this.#updateBar(t); }
        void r;
        break;
      }
      case 'warcry': {
        sfx.roar(); sfx.buff();
        await this.#shockwave(u, info.color);
        for (const f of friends) {
          f.status.atkUp = 3;
          this.#glow(f, info.color);
          this.#float(f, '+ERŐ', '#ffc46b', 20);
          this.#updateBar(f);
        }
        hud.battleLog(`${u.side === 'ally' ? 'A csapatod' : 'Az ellenfelek'} <b>+25% sebzést</b> okoz 3 körig.`);
        await this.#wait(400);
        break;
      }
      case 'shieldwall': {
        sfx.shield();
        await Promise.all(friends.map((f, i) => this.#wardPop(f, i * 90)));
        for (const f of friends) { f.status.ward = 2; this.#updateBar(f); }
        hud.battleLog(`${u.side === 'ally' ? 'A csapatod' : 'Az ellenfelek'} pajzsfalat emel: <b>−30%</b> sebzés.`);
        break;
      }
      case 'thorns': {
        sfx.shield();
        this.cameras.main.shake(160, 0.005);
        u.status.thorns = 3;
        this.#glow(u, info.color, 500);
        this.#updateBar(u);
        hud.battleLog(`<b>${esc(u.d.nev)}</b> pikkelyei tüskékké merednek.`);
        await this.#wait(500);
        break;
      }
      case 'shadow': {
        sfx.shadow();
        await this.#vanish(u);
        u.status.shadow = 1;
        this.#updateBar(u);
        hud.battleLog(`<b>${esc(u.d.nev)}</b> beleolvad az árnyékba.`);
        break;
      }
      case 'gale': {
        sfx.gale();
        await Promise.all(foes.map((f, i) => this.#whirl(f, info.color, i * 80)));
        for (const f of foes) {
          if (!f.alive) continue;
          await this.#strike(u, f, 0.65, { quick: true });
          if (f.alive) { f.status.slow = 2; this.#updateBar(f); }
        }
        break;
      }
      case 'quake': {
        sfx.quake();
        hud.cinematic(true);
        this.cameras.main.shake(1100, 0.016);
        await this.#cracks(u, foes);
        for (const f of foes) {
          if (!f.alive) continue;
          await this.#strike(u, f, 1.0, { quick: true, heavy: true });
          if (f.alive && Math.random() < 0.25) { f.status.stun = 1; hud.battleLog(`<b>${esc(f.d.nev)}</b> elkábult!`); this.#updateBar(f); }
        }
        hud.cinematic(false);
        break;
      }
      case 'meteor': {
        sfx.meteor();
        hud.cinematic(true);
        await this.#meteor(t, info.color);
        await this.#strike(u, t, 2.6, { sure: true, heavy: true });
        hud.cinematic(false);
        break;
      }
      case 'root': {
        sfx.root();
        hud.cinematic(true);
        await Promise.all(foes.map((f, i) => this.#roots(f, i * 110)));
        for (const f of foes) {
          if (!f.alive) continue;
          await this.#strike(u, f, 0.7, { quick: true, sure: true });
          if (f.alive) { f.status.poison = 3; this.#updateBar(f); }
        }
        hud.battleLog('A gyökerek <b>mérget</b> eresztenek.');
        hud.cinematic(false);
        break;
      }
    }
    if (big) hud.cinematic(false);
  }

  /* ================================================================== */
  /* A Sárkánykórus                                                      */
  /* ================================================================== */
  #gainChorus(n) {
    if (!this.chorusOn || n <= 0) return;
    const before = this.chorus;
    this.chorus = Math.min(CHORUS.max, this.chorus + n * (1 + (this.relics.has('gjallar') ? RELICS.gjallar.chorus : 0)));
    this.g.hud.setChorus(this.chorus, true);
    if (before < CHORUS.max && this.chorus >= CHORUS.max) {
      this.g.hud.battleLog(`<span class="bl-chorus">ᛟ A harci ének megtelt — jöhet ${this.ultis.length > 1 ? 'egy ulti' : esc(ULTIMATES[this.ultis[0]].name)}! (Q)</span>`);
      this.g.sfx.buff();
    }
  }

  async #chorus(u) {
    const { hud, sfx } = this.g;
    this.chorus = 0;
    hud.setChorus(0, true);
    hud.cinematic(true);
    hud.battleLog(`<span class="bl-chorus">ᛟ SÁRKÁNYKÓRUS!</span> <b>${esc(u.d.nev)}</b> rákezd, és a többiek vele énekelnek.`);
    const allies = this.alive('ally');
    const { width: w, height: h } = this.scale;
    sfx.chorus();

    // Sötétedő barlang, az ének fénye a sárkányokból jön
    const dim = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x000000, 1).setAlpha(0).setDepth(-3);
    this.tweens.add({ targets: dim, alpha: 0.62, duration: 600 });
    const cx = allies.reduce((s, a) => s + a.view.x, 0) / allies.length;
    const cy = allies.reduce((s, a) => s + a.view.y, 0) / allies.length;
    await this.#camTo(cx, cy, 1.12, 650);

    const circles = [];
    for (const a of allies) {
      const col = colorOf(a.d);
      circles.push(this.#groundRing(a.home.x, a.home.y + this.S * 0.4, col, this.S * 1.3, a.view.depth - 1, 2600));
      this.tweens.add({ targets: a.view, y: a.home.y - this.S * 0.16, duration: 700, ease: 'Sine.easeOut' });
      this.#glow(a, col, 1200);
    }
    await this.#wait(800);

    // A célpont: az ellenfelek fölötti pont, ahová a lehelet-nyalábok összefutnak
    const foes = this.alive('enemy');
    const px = foes.reduce((s, f) => s + f.view.x, 0) / foes.length;
    const py = Math.min(...foes.map((f) => f.view.y)) - this.S * 0.55;
    this.#camReset(500);
    const beams = allies.map((a, i) => {
      const m = this.#mouth(a);
      const b = this.add.image(m.x, m.y, 'fx-spark').setOrigin(0, 0.5).setTint(colorOf(a.d)).setBlendMode('ADD')
        .setRotation(Math.atan2(py - m.y, px - m.x)).setScale(0.1, 5).setDepth(9050);
      const dist = Phaser.Math.Distance.Between(m.x, m.y, px, py);
      this.tweens.add({ targets: b, scaleX: dist / 24, duration: 360, delay: i * 120, ease: 'Expo.easeOut' });
      this.tweens.add({ targets: b, scaleY: { from: 4, to: 7 }, duration: 120, yoyo: true, repeat: 6, delay: i * 120 });
      return b;
    });
    const orb = this.add.image(px, py, 'fx-dot').setTint(CHORUS.color).setBlendMode('ADD').setScale(0.3).setDepth(9060);
    const orbCore = this.add.image(px, py, 'fx-dot').setBlendMode('ADD').setScale(0.15).setDepth(9061);
    this.tweens.add({ targets: [orb], scale: this.S / 22, duration: 1100, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: [orbCore], scale: this.S / 45, duration: 1100, ease: 'Cubic.easeIn' });
    const swirl = this.add.particles(px, py, 'fx-dot', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, this.S * 0.9), quantity: 24 },
      moveToX: px, moveToY: py, lifespan: 500, scale: { start: 0.25, end: 0.05 },
      tint: [0xffe08a, 0xffffff, 0x9fe8ff], blendMode: 'ADD', frequency: 25, quantity: 2,
    }).setDepth(9055);
    await this.#wait(1150);

    // Becsapódás
    swirl.stop();
    beams.forEach((b) => this.tweens.add({ targets: b, alpha: 0, duration: 200, onComplete: () => b.destroy() }));
    await this.#tween({ targets: [orb, orbCore], y: (this.slots.enemy[0].y - this.S * 0.4), duration: 180, ease: 'Quad.easeIn' });
    sfx.boom();
    this.cameras.main.flash(380, 255, 240, 200);
    this.cameras.main.shake(700, 0.022);
    this.#hitStop(110);
    for (let i = 0; i < 3; i++) {
      const r = this.add.image(orb.x, orb.y, 'fx-ring').setTint(i ? 0xffe08a : 0xffffff).setBlendMode('ADD').setScale(0.2).setDepth(9100);
      this.tweens.add({ targets: r, scale: (this.S / 40) * (1 + i * 0.6), alpha: 0, duration: 700 + i * 160, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
    const burst = this.add.particles(orb.x, orb.y, 'fx-spark', {
      speed: { min: 200, max: 700 }, lifespan: 700, scale: { start: 1.6, end: 0.2 }, alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xffe08a, 0xff8a3d], blendMode: 'ADD', emitting: false,
    }).setDepth(9100);
    burst.explode(46);
    orb.destroy(); orbCore.destroy();
    this.time.delayedCall(1200, () => { burst.destroy(); swirl.destroy(); });

    const base = allies.reduce((s, a) => s + a.stats.atk * (a.status.atkUp ? 1.25 : 1), 0) * 0.75;
    for (const f of foes) {
      if (!f.alive) continue;
      const amount = Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2) * (f.status.mark ? 1.3 : 1) * (f.status.ward ? 0.7 : 1)));
      await this.#damage(f, amount, false, '#ffe08a', { quick: true, heavy: true, big: true });
    }

    // Vissza
    for (const a of allies) if (a.alive) this.tweens.add({ targets: a.view, y: a.home.y, duration: 500, ease: 'Sine.easeIn' });
    circles.forEach((c) => this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }));
    this.tweens.add({ targets: dim, alpha: 0, duration: 500, onComplete: () => dim.destroy() });
    hud.cinematic(false);
    await this.#wait(450);
  }

  /* ================================================================== */
  /* A többi ulti                                                        */
  /* ================================================================== */
  async #ulti(u, key, t) {
    if (key === 'chorus') return this.#chorus(u);
    const { hud } = this.g;
    this.chorus = 0;
    hud.setChorus(0, true);
    const info = ULTIMATES[key];
    hud.battleLog(`<span class="bl-chorus">${info.rune} ${esc(info.name.toUpperCase())}!</span> — <b>${esc(u.d.nev)}</b> hívja.`);
    const fx = await this.#ultiIntro(u, info);
    switch (key) {
      case 'muspell': await this.#muspellUlt(u, info); break;
      case 'fimbul': await this.#fimbulUlt(u, info); break;
      case 'valhalla': await this.#valhallaUlt(u, info); break;
      case 'gungnir': await this.#gungnirUlt(u, t, info); break;
    }
    this.#ultiOutro(fx);
    await this.#wait(400);
  }

  /** A csapat együttes ereje (az ultik alapja). */
  #teamAtk() { return this.alive('ally').reduce((s, a) => s + a.stats.atk * (a.status.atkUp ? 1.25 : 1), 0); }
  #ultiHit(f, base) { return Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2) * (f.status.mark ? 1.3 : 1) * (f.status.ward ? 0.7 : 1))); }

  async #ultiIntro(u, info) {
    const { hud, sfx } = this.g;
    const { width: w, height: h } = this.scale;
    hud.cinematic(true);
    sfx.chorus();
    const dim = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x000000, 1).setAlpha(0).setDepth(-3);
    this.tweens.add({ targets: dim, alpha: 0.55, duration: 500 });
    const f = this.#feet(u);
    const ring = this.#groundRing(f.x, f.y, info.color, this.S * 1.5, u.view.depth - 1, 1800);
    await this.#camTo(u.view.x, u.view.y, 1.15, 450);
    this.#glow(u, info.color, 900);
    const fs = Math.round(Math.min(64, w / 12));
    const title = this.add.text(w / 2, h * 0.3, `${info.rune}  ${info.name}`, {
      fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: `${fs}px`, fontStyle: '900',
      color: hex(info.color), stroke: '#05070f', strokeThickness: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9950).setAlpha(0).setScale(1.7);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, alpha: 0, y: title.y - 30, duration: 450, delay: 1100, onComplete: () => title.destroy() });
    await this.#wait(750);
    this.#camReset(450);
    return { dim, ring };
  }

  #ultiOutro({ dim, ring }) {
    this.tweens.add({ targets: [dim, ring], alpha: 0, duration: 500, onComplete: () => { dim.destroy(); ring.destroy(); } });
    this.g.hud.cinematic(false);
  }

  /** Muspell lángja: tűzeső minden ellenfélre, utána égés. */
  async #muspellUlt(u, info) {
    const { width: w, height: h } = this.scale;
    const sky = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0xff4a1a, 1).setAlpha(0).setDepth(-2).setBlendMode('ADD');
    this.tweens.add({ targets: sky, alpha: 0.22, duration: 400, yoyo: true, hold: 1600, onComplete: () => sky.destroy() });
    const foes = this.alive('enemy');
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      const f = pick(foes);
      const c = this.#center(f);
      const x1 = c.x + (Math.random() - 0.5) * this.S * 0.9, y1 = c.y + this.S * (0.1 + Math.random() * 0.3);
      jobs.push(this.#fireball(x1 - 220 - Math.random() * 120, -60 - Math.random() * 80, x1, y1, i * 120, info.color));
    }
    await Promise.all(jobs);
    const base = this.#teamAtk() * 0.55;
    for (const f of foes) {
      if (!f.alive) continue;
      await this.#damage(f, this.#ultiHit(f, base), false, '#ffb347', { quick: true, heavy: true, big: true });
      if (f.alive && !f.stats.traits.has('fireblood')) { f.status.burn = 3; this.#updateBar(f); }
    }
    this.g.hud.battleLog('Az ellenfeleket <b>lángba borította</b> Muspell tüze.');
  }

  #fireball(x0, y0, x1, y1, delay, color) {
    return new Promise((resolve) => this.time.delayedCall(delay, () => {
      const ball = this.add.image(x0, y0, 'fx-dot').setTint(0xfff3a0).setBlendMode('ADD').setScale(this.S / 90).setDepth(9200);
      const trail = this.add.particles(0, 0, 'fx-dot', {
        speed: { min: 10, max: 50 }, lifespan: 380, scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0xfff3a0, 0xffb347, color, 0x5a2a1a], blendMode: 'ADD', frequency: 14, quantity: 2,
      }).setDepth(9199);
      trail.startFollow(ball);
      this.g.sfx.whoosh(0.25);
      this.tweens.add({
        targets: ball, x: x1, y: y1, duration: 520, ease: 'Quad.easeIn',
        onComplete: () => {
          trail.stop();
          this.g.sfx.boom();
          this.cameras.main.shake(140, 0.008);
          const r = this.add.image(x1, y1, 'fx-ring').setTint(color).setBlendMode('ADD').setScale(0.15).setDepth(9100);
          this.tweens.add({ targets: r, scale: this.S / 110, alpha: 0, duration: 420, onComplete: () => r.destroy() });
          const sp = this.add.particles(x1, y1, 'fx-spark', {
            speed: { min: 120, max: 320 }, lifespan: 420, scale: { start: 1, end: 0.2 }, tint: [0xfff3a0, 0xff8a3d], blendMode: 'ADD', emitting: false,
          }).setDepth(9100);
          sp.explode(10);
          ball.destroy();
          this.time.delayedCall(600, () => { trail.destroy(); sp.destroy(); });
          resolve();
        },
      });
    }));
  }

  /** Fimbul-tél: hóvihar és jégtüskék, fagyás vagy lassítás. */
  async #fimbulUlt(u, info) {
    const { width: w, height: h } = this.scale;
    this.g.sfx.gale();
    const tint = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x9fe8ff, 1).setAlpha(0).setDepth(-2).setBlendMode('ADD');
    this.tweens.add({ targets: tint, alpha: 0.18, duration: 500, yoyo: true, hold: 1700, onComplete: () => tint.destroy() });
    const storm = this.add.particles(0, 0, 'fx-dot', {
      x: { min: w * 0.2, max: w * 1.3 }, y: { min: -40, max: h * 0.6 }, lifespan: 1400,
      speedX: { min: -520, max: -320 }, speedY: { min: 160, max: 280 }, scale: { min: 0.08, max: 0.22 },
      alpha: { start: 0.95, end: 0.2 }, frequency: 6, quantity: 3,
    }).setDepth(9500);
    const streaks = this.add.particles(0, 0, 'fx-spark', {
      x: { min: w * 0.3, max: w * 1.3 }, y: { min: 0, max: h * 0.8 }, lifespan: 600, speedX: { min: -900, max: -700 }, speedY: { min: 300, max: 420 },
      rotate: 150, scale: { start: 1.6, end: 0.8 }, alpha: { start: 0.6, end: 0 }, tint: 0xcff4ff, blendMode: 'ADD', frequency: 30,
    }).setDepth(9500);
    await this.#wait(900);
    const foes = this.alive('enemy');
    this.g.sfx.frost();
    // Jégtüskék törnek fel minden ellenfél alól
    for (const f of foes) {
      const ft = this.#feet(f);
      for (let i = 0; i < 6; i++) {
        const sp = this.add.image(ft.x + (i - 2.5) * this.S * 0.12, ft.y + 4, 'fx-shard').setOrigin(0.5, 1).setTint(i % 2 ? 0xe8fffb : 0x9fe8ff)
          .setBlendMode('ADD').setScale(0.9 + Math.random() * 0.6, 0.01).setRotation((i - 2.5) * 0.12).setDepth(f.view.depth + 1);
        this.tweens.add({ targets: sp, scaleY: 1.8 + Math.random() * 1.4, duration: 220, delay: i * 30, ease: 'Back.easeOut' });
        this.tweens.add({ targets: sp, alpha: 0, duration: 500, delay: 1200, onComplete: () => sp.destroy() });
      }
    }
    this.cameras.main.shake(400, 0.012);
    const base = this.#teamAtk() * 0.45;
    for (const f of foes) {
      if (!f.alive) continue;
      await this.#damage(f, this.#ultiHit(f, base), false, '#cff4ff', { quick: true, heavy: true, big: true });
      if (!f.alive) continue;
      if (!f.stats.traits.has('frostheart') && Math.random() < 0.55) { f.status.freeze = 1; this.#iceBlock(f); }
      else f.status.slow = 2;
      this.#updateBar(f);
    }
    storm.stop(); streaks.stop();
    this.time.delayedCall(1500, () => { storm.destroy(); streaks.destroy(); });
    this.g.hud.battleLog('A Fimbul-tél <b>jégbe zárta</b> a völgyet — és az ellenfeleket.');
  }

  /** Valkűrök áldása: aranyfény, hulló tollak, gyógyulás, felélesztés, pajzsfal. */
  async #valhallaUlt(u, info) {
    const { hud, sfx } = this.g;
    const { width: w } = this.scale;
    sfx.chant();
    // Szárnyak a hívó mögött
    const wings = [];
    for (const dir of [-1, 1]) for (let i = 0; i < 6; i++) {
      const fth = this.add.image(u.view.x, u.view.y - this.S * 0.1, 'fx-spark').setOrigin(0, 0.5).setTint(0xfff3c4).setBlendMode('ADD')
        .setRotation(dir < 0 ? Math.PI + 0.25 - i * 0.18 : -0.25 + i * 0.18).setScale(0.1, 2.4).setDepth(u.view.depth - 0.5);
      if (dir < 0) fth.setRotation(Math.PI + (-0.25 + i * 0.18) * -1);
      this.tweens.add({ targets: fth, scaleX: (this.S / 24) * (1 - i * 0.08), duration: 420, delay: i * 40, ease: 'Back.easeOut' });
      this.tweens.add({ targets: fth, alpha: 0, duration: 600, delay: 1700, onComplete: () => fth.destroy() });
      wings.push(fth);
    }
    const feathers = this.add.particles(0, -20, 'fx-shard', {
      x: { min: 0, max: w * 0.55 }, lifespan: 2600, speedY: { min: 60, max: 120 }, speedX: { min: -30, max: 30 },
      rotate: { start: 0, end: 360 }, scale: { min: 0.4, max: 0.8 }, tint: [0xffffff, 0xfff3c4], alpha: { start: 1, end: 0 },
      blendMode: 'ADD', frequency: 40,
    }).setDepth(9400);
    const team = this.units.filter((a) => a.side === 'ally');
    for (const a of team) {
      const f = this.#feet(a);
      const pillar = this.add.image(f.x, f.y, 'fx-shaft').setOrigin(0.5, 1).setTint(0xfff3c4).setBlendMode('ADD')
        .setDisplaySize(this.S * 0.9, f.y + 20).setAlpha(0).setDepth(a.view.depth + 1).setFlipY(true);
      this.tweens.add({ targets: pillar, alpha: 0.8, duration: 400, yoyo: true, hold: 900, onComplete: () => pillar.destroy() });
    }
    await this.#wait(800);
    for (const a of team) {
      if (!a.alive) {
        // Felállnak az elájultak
        a.alive = true;
        a.hp = Math.round(a.stats.maxHp * 0.3);
        a.parts.inner.alpha = 1;
        this.tweens.add({ targets: a.view, alpha: 1, angle: 0, y: a.home.y, duration: 600, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [a.ui, a.shadow], alpha: 1, duration: 400 });
        this.#idle(a);
        this.#float(a, 'FELÁLLT!', '#fff3c4', 24);
        hud.battleLog(`<b>${esc(a.d.nev)}</b> újra talpra áll a valkűrök fényében!`);
      } else {
        const heal = Math.round(a.stats.maxHp * 0.55);
        a.hp = Math.min(a.stats.maxHp, a.hp + heal);
        this.#float(a, `+${heal}`, '#fff3c4', 28);
      }
      for (const k of ['burn', 'poison', 'freeze', 'stun']) a.status[k] = 0;
      a.status.ward = 2;
      this.#glow(a, 0xfff3c4, 700);
      this.#updateBar(a);
    }
    sfx.heal();
    feathers.stop();
    this.time.delayedCall(2800, () => feathers.destroy());
    hud.battleLog('A csapat <b>felépült</b>, és pajzsfal védi.');
    await this.#wait(600);
  }

  /** Gungnir: Odin dárdája — hollók körözése, célzás, villám és becsapódás. */
  async #gungnirUlt(u, t, info) {
    const { sfx } = this.g;
    if (!t?.alive) t = this.alive('enemy')[0];
    if (!t) return;
    const c0 = this.#center(u);
    // Két holló köröz a hívó körül
    const ravens = [0, 1].map(() => this.add.image(c0.x, c0.y, 'raven0').setDepth(9300).setScale(0.9));
    const k = { a: 0 };
    const orbit = this.tweens.add({
      targets: k, a: Math.PI * 4, duration: 1400, ease: 'Sine.easeInOut',
      onUpdate: () => ravens.forEach((r, i) => {
        const a = k.a + i * Math.PI;
        r.setPosition(c0.x + Math.cos(a) * this.S * 0.6, c0.y - this.S * 0.3 + Math.sin(a) * this.S * 0.22).setRotation(a + Math.PI);
        r.setTexture(Math.sin(k.a * 6) > 0 ? 'raven0' : 'raven1');
      }),
    });
    sfx.caw();
    const spear = this.add.image(c0.x, c0.y - this.S * 0.9, 'fx-spear').setBlendMode('ADD').setAlpha(0).setScale(this.S / 220).setDepth(9350);
    const halo = this.add.image(spear.x, spear.y, 'fx-dot').setTint(info.color).setBlendMode('ADD').setScale(this.S / 30).setAlpha(0).setDepth(9349);
    const c1 = this.#center(t);
    const ang = Math.atan2(c1.y - spear.y, c1.x - spear.x);
    this.tweens.add({ targets: [spear, halo], alpha: 1, duration: 400 });
    await this.#tween({ targets: spear, rotation: { from: -Math.PI * 3, to: ang }, duration: 1000, ease: 'Cubic.easeOut' });
    orbit.stop();
    ravens.forEach((r) => this.tweens.add({ targets: r, x: r.x + (r.x < c0.x ? -400 : 400), y: r.y - 300, alpha: 0, duration: 700, onComplete: () => r.destroy() }));
    // Repül!
    sfx.whoosh(0.3);
    halo.destroy();
    let last = 0;
    await this.#tween({
      targets: spear, x: c1.x, y: c1.y, duration: 260, ease: 'Expo.easeIn',
      onUpdate: (tw) => {
        if (tw.elapsed - last < 18) return;
        last = tw.elapsed;
        const g = this.add.image(spear.x, spear.y, 'fx-spear').setBlendMode('ADD').setRotation(spear.rotation).setScale(spear.scale).setTint(info.color).setAlpha(0.5).setDepth(9340);
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
      },
    });
    spear.destroy();
    this.#bolt(t, 0);
    sfx.thunder();
    this.cameras.main.flash(300, 220, 240, 255);
    this.cameras.main.shake(600, 0.024);
    this.#hitStop(140);
    for (let i = 0; i < 3; i++) {
      const r = this.add.image(c1.x, c1.y, 'fx-ring').setTint(i ? info.color : 0xffffff).setBlendMode('ADD').setScale(0.2).setDepth(9100);
      this.tweens.add({ targets: r, scale: this.S / 45 + i * 0.8, alpha: 0, duration: 600 + i * 150, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
    const amount = this.#ultiHit(t, (u.stats.atk * 2.2 + this.#teamAtk() * 0.6) * 1.6);
    await this.#damage(t, amount, true, '#e8f6ff', { heavy: true, big: true });
  }

  /* ================================================================== */
  /* Níðhöggr dühe (a fele életerejénél)                                 */
  /* ================================================================== */
  /* ================================================================== */
  /* Níðhöggr — a végső ellenfél                                          */
  /* ================================================================== */
  /** A mélyből emelkedik fel: remegő föld, por, aztán üvöltés. */
  async #bossEntrance(u) {
    const { sfx } = this.g;
    const p = u.parts;
    u.bossTweens?.forEach((t) => t.pause());
    u.view.y = u.home.y + u.bossH * 0.75;
    u.view.alpha = 0;
    u.shadow.alpha = 0;
    sfx.quake();
    this.cameras.main.shake(1600, 0.012);
    const f = this.#feet(u);
    const dust = this.add.particles(f.x, f.y, 'fx-smoke', {
      x: { min: -u.bossH * 0.6, max: u.bossH * 0.5 }, speedY: { min: -120, max: -30 }, speedX: { min: -60, max: 60 },
      lifespan: 1400, scale: { start: 0.8, end: 2.4 }, alpha: { start: 0.5, end: 0 }, tint: 0x6a5a7a, frequency: 30, quantity: 3,
    }).setDepth(u.view.depth + 5);
    this.tweens.add({ targets: u.shadow, alpha: 0.9, duration: 1200 });
    await this.#tween({ targets: u.view, y: u.home.y, alpha: 1, duration: 1500, ease: 'Cubic.easeOut' });
    dust.stop();
    this.time.delayedCall(1500, () => dust.destroy());
    // Üvöltés: tágra nyílt állkapocs, felizzó szemek
    sfx.roar();
    this.cameras.main.shake(500, 0.01);
    this.tweens.add({ targets: p.eyes, alpha: 1, scale: 4.5, duration: 260, yoyo: true });
    await this.#tween({ targets: p.jaw, rotation: -0.6, duration: 260, yoyo: true, hold: 500, ease: 'Quad.easeOut' });
    u.bossTweens?.forEach((t) => t.resume());
  }

  /** Megtörés-sáv: ha megtelik, a boss megtántorodik és sebezhető lesz. */
  #addStagger(b, n) {
    if (!b.alive || b.status.broken > 0 || b.staggered) return;
    b.stagger += n;
    if (b.stagger < BOSS.staggerMax) { this.#updateBar(b); return; }
    b.stagger = 0;
    b.staggered = true;
    b.status.stun = 1;
    b.status.broken = 2;
    const { hud, sfx } = this.g;
    sfx.crack(); sfx.boom();
    this.cameras.main.shake(400, 0.016);
    const c = this.#center(b);
    const t = this.add.text(c.x, c.y - b.bossH * 0.3, 'MEGTÖRT!', {
      fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: '40px', fontStyle: '900', color: '#ffe066', stroke: '#05070f', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(9800).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1100, duration: 500, onComplete: () => t.destroy() });
    if (b.charging) {
      b.charging = false;
      this.#stopCharge(b);
      hud.battleLog('<span class="bl-crit">A Világvég-lehelet elfojtva!</span>');
    }
    // A fej a földre csapódik
    this.tweens.add({ targets: b.parts.head, rotation: -0.3, y: b.parts.head.y + 30, duration: 220, yoyo: true, hold: 500, ease: 'Quad.easeIn' });
    hud.battleLog('<span class="bl-crit">💥 Níðhöggr megtört!</span> Kimarad, és két körig <b>+40%</b> sebzést kap.');
    this.#updateBar(b);
  }

  /** Níðhöggr köre: a 3. fázisban kétszer lép; a feltöltött leheletet kifújja. */
  async #bossTurn(b) {
    b.turns++;
    const acts = b.phase >= 3 ? 2 : 1;
    for (let i = 0; i < acts; i++) {
      if (!b.alive || !this.alive('ally').length || b.staggered) return;
      if (b.charging) { await this.#bossBreath(b); continue; }
      const key = this.#bossPick(b, i);
      await this.#bossMove(b, key);
      if (key === 'charge') return;                 // a feltöltés után a csapat léphet: legyen idő védekezni
      if (i < acts - 1) await this.#wait(300);
    }
  }

  #bossPick(b, i) {
    const ph = b.phase;
    if (i === 0 && ph >= 2 && b.turns - b.lastCharge >= (ph >= 3 ? 3 : 4)) return 'charge';
    const pool = ph === 1 ? { bite: 3, tail: 2, roots: 2 }
      : ph === 2 ? { bite: 2, tail: 2, roots: 1, gale: 2, venom: 2 }
      : { bite: 2, tail: 1, gale: 1, venom: 2, quake: 2 };
    if (ph >= 2 && !this.alive('enemy').some((e) => !e.boss) && b.turns - b.lastSummon >= 4) pool.summon = 3;
    let r = Math.random() * Object.values(pool).reduce((a, x) => a + x, 0);
    for (const [k, w] of Object.entries(pool)) { r -= w; if (r <= 0) return k; }
    return 'bite';
  }

  /** A boss elemi mozdulatai közben az alap-animáció szünetel (ne harcoljanak a tweenek). */
  async #bossAct(b, fn) {
    b.bossTweens?.forEach((t) => t.pause());
    try { await fn(); } finally { if (b.alive) b.bossTweens?.forEach((t) => t.resume()); }
  }

  /** Egy mozdulat sebzése és mellékhatásai a célpontokon. */
  async #bossHit(b, targets, mv, opts = {}) {
    const { hud } = this.g;
    for (const f of targets) {
      if (!f.alive) continue;
      const r = await this.#strike(b, f, mv.mult, { quick: targets.length > 1, ...opts });
      if (!r || !f.alive) continue;
      const notes = [];
      if (mv.poison) { f.status.poison = Math.max(f.status.poison, mv.poison); notes.push('megmérgeződött'); }
      if (mv.burn && !f.stats.traits.has('fireblood')) { f.status.burn = Math.max(f.status.burn, mv.burn); notes.push('lángra kapott'); }
      if (mv.slow) { f.status.slow = Math.max(f.status.slow, mv.slow); notes.push('lelassult'); }
      if (mv.stun && Math.random() < mv.stun) { f.status.stun = 1; notes.push('elkábult'); }
      if (notes.length) hud.battleLog(`<b>${esc(f.d.nev)}</b> ${notes.join(', ')}.`);
      this.#updateBar(f);
    }
  }

  async #bossMove(b, key) {
    const { hud, sfx } = this.g;
    const allies = this.alive('ally');
    const p = b.parts;
    const mv = BOSS.moves[key];
    if (mv) {
      hud.battleLog(`<b>Níðhöggr</b>: <span class="bl-tech" style="color:#c28cff">ᚾ ${esc(mv.name)}</span>`);
      await this.#skillName(b, { rune: 'ᚾ', name: mv.name, color: 0xc28cff });
    }
    const weakest = allies.reduce((a, x) => (a.hp / a.stats.maxHp < x.hp / x.stats.maxHp ? a : x));
    const target = Math.random() < 0.55 ? weakest : pick(allies);

    switch (key) {
      case 'bite': await this.#bossAct(b, async () => {
        const k = p.k * b.view.scaleX;
        const m = this.#mouth(b), c = this.#center(target);
        const home = { x: p.head.x, y: p.head.y };
        sfx.roar();
        await this.#tween({ targets: p.jaw, rotation: -0.65, duration: 240, ease: 'Quad.easeOut' });
        await this.#tween({ targets: p.head, x: home.x + (c.x - m.x) / k * 0.75, y: home.y + (c.y - m.y) / k * 0.75, rotation: -0.15, duration: 190, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: p.jaw, rotation: 0.05, duration: 80 });
        this.cameras.main.shake(220, 0.012);
        await this.#bossHit(b, [target], mv, { heavy: true });
        await this.#tween({ targets: p.head, x: home.x, y: home.y, rotation: 0, duration: 420, ease: 'Cubic.easeOut' });
      }); break;

      case 'tail': await this.#bossAct(b, async () => {
        sfx.whoosh(0.5);
        await this.#tween({ targets: p.tail, rotation: 0.35, duration: 260, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: p.tail, rotation: -0.25, duration: 160, yoyo: true, ease: 'Quad.easeIn' });
        // lökéshullám a talajon, végig a csapaton
        const f = this.#feet(b);
        const wave = this.add.image(f.x, f.y, 'fx-ring').setTint(0xc28cff).setBlendMode('ADD').setScale(this.S / 128, this.S / 520).setDepth(9050);
        this.tweens.add({ targets: wave, x: this.scale.width * 0.05, scaleX: this.S / 50, alpha: { from: 1, to: 0 }, duration: 520, ease: 'Quad.easeOut', onComplete: () => wave.destroy() });
        sfx.boom();
        this.cameras.main.shake(360, 0.014);
        allies.forEach((a) => this.#dust(a, 8));
        await this.#bossHit(b, allies, mv, { heavy: true });
      }); break;

      case 'roots':
        sfx.root();
        await Promise.all(allies.map((f, i) => this.#roots(f, i * 110)));
        await this.#bossHit(b, allies, mv, { sure: true });
        break;

      case 'gale': await this.#bossAct(b, async () => {
        sfx.gale();
        this.tweens.add({ targets: [p.wings, p.wingFar], rotation: '-=0.35', duration: 160, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
        const { width: w, height: h } = this.scale;
        const gust = this.add.particles(w, 0, 'fx-smoke', {
          y: { min: h * 0.25, max: this.floorY + this.S * 0.4 }, speedX: { min: -900, max: -600 }, speedY: { min: -30, max: 30 },
          lifespan: 1200, scale: { start: 0.6, end: 1.6 }, alpha: { start: 0.45, end: 0 }, tint: [0x9d6bff, 0x4a2a5a], frequency: 12, quantity: 3,
        }).setDepth(9600);
        await Promise.all(allies.map((f, i) => this.#whirl(f, 0xb18cff, i * 80)));
        gust.stop();
        this.time.delayedCall(1300, () => gust.destroy());
        await this.#bossHit(b, allies, mv);
      }); break;

      case 'venom': await this.#bossAct(b, async () => {
        sfx.venom(); sfx.fire();
        this.tweens.add({ targets: p.jaw, rotation: -0.55, duration: 200, yoyo: true, hold: 600 });
        await this.#wait(150);
        await Promise.all(allies.map((f, i) => this.#wait(i * 90).then(() => this.#breath(b, f, [0xe8ffb0, 0x7dff6a, 0x9d6bff, 0x3a0a5a]))));
        await this.#bossHit(b, allies, mv, { fire: true });
      }); break;

      case 'quake': await this.#bossAct(b, async () => {
        sfx.quake();
        await this.#tween({ targets: b.view, y: b.home.y - b.bossH * 0.08, duration: 300, ease: 'Quad.easeOut' });
        await this.#tween({ targets: b.view, y: b.home.y, duration: 140, ease: 'Quad.easeIn' });
        this.cameras.main.shake(900, 0.018);
        await this.#cracks(b, allies);
        await Promise.all(allies.map((f, i) => this.#rocks(f, i * 120)));
        await this.#bossHit(b, allies, mv, { heavy: true });
      }); break;

      case 'charge': {
        b.charging = true;
        b.lastCharge = b.turns;
        hud.battleLog('<span class="bl-crit">⚠ Níðhöggr mély lélegzetet vesz…</span> A következő lépése a <b>Világvég-lehelet</b>: <b>védekezz</b>, vagy <b>törd meg</b>!');
        sfx.portal();
        p.maw.setAlpha(0.2);
        b.chargeTween = this.tweens.add({ targets: p.maw, alpha: { from: 0.4, to: 1 }, scaleX: { from: 2.2, to: 3.4 }, duration: 500, yoyo: true, repeat: -1 });
        const m = this.#mouth(b);
        b.chargeFx = this.add.particles(m.x, m.y, 'fx-dot', {
          emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, b.bossH * 0.35), quantity: 30 },
          moveToX: m.x, moveToY: m.y, lifespan: 600, scale: { start: 0.4, end: 0.05 },
          tint: [0xffb347, 0xff6a1f, 0xc28cff], blendMode: 'ADD', frequency: 30, quantity: 2,
        }).setDepth(9100);
        this.#updateBar(b);
        await this.#banner('⚠ MÉLY LÉLEGZET', 'védekezz — vagy törd meg, mielőtt kifújja');
        break;
      }

      case 'summon': {
        b.lastSummon = b.turns;
        sfx.root();
        hud.battleLog('<b>Níðhöggr</b> a gyökerekhez szól…');
        await this.#bossSummon(b);
        break;
      }
    }
  }

  #stopCharge(b) {
    b.chargeTween?.stop();
    b.chargeFx?.stop();
    const fx = b.chargeFx;
    if (fx) this.time.delayedCall(700, () => fx.destroy());
    b.chargeTween = b.chargeFx = null;
    this.tweens.add({ targets: b.parts.maw, alpha: 0, duration: 300 });
    this.#updateBar(b);
  }

  /** A Világvég-lehelet: tűzfolyam söpör végig a csapaton. */
  async #bossBreath(b) {
    const { hud, sfx } = this.g;
    const mv = BOSS.moves.breath;
    b.charging = false;
    this.#stopCharge(b);
    const allies = this.alive('ally');
    hud.battleLog(`<b>Níðhöggr</b>: <span class="bl-crit">ᚲ ${esc(mv.name)}!</span>`);
    hud.cinematic(true);
    await this.#bossAct(b, async () => {
      const p = b.parts;
      sfx.roar();
      await this.#tween({ targets: p.jaw, rotation: -0.8, duration: 300, ease: 'Quad.easeOut' });
      sfx.fire(); sfx.meteor();
      this.cameras.main.flash(300, 255, 170, 80);
      this.cameras.main.shake(1300, 0.014);
      // Két hullámban söpör végig: minden sárkányra külön lángcsóva
      const tints = [0xfff3a0, 0xffb347, 0xff6a1f, 0xc04dff];
      for (let wave = 0; wave < 2; wave++) {
        await Promise.all(allies.map((f, i) => this.#wait(i * 120).then(() => this.#breath(b, f, tints))));
      }
      this.tweens.add({ targets: p.jaw, rotation: 0, duration: 400 });
      // A lehelet az életerő arányában éget: védekezve 30%, anélkül 90% (a pajzsfal ebből is levesz)
      const defended = allies.filter((f) => f.defending).length;
      if (defended) hud.battleLog(`🛡 ${defended === allies.length ? 'Mindenki' : `${defended} sárkány`} védekezett: csak <b>${Math.round(mv.guarded * 100)}%</b> sebzés.`);
      for (const f of allies) {
        if (!f.alive) continue;
        const dmg = Math.round(f.stats.maxHp * (f.defending ? mv.guarded : mv.hit) * (f.status.ward > 0 ? 0.7 : 1));
        await this.#damage(f, dmg, false, '#ffb347', { heavy: true, quick: true, big: true });
        if (f.alive && !f.stats.traits.has('fireblood')) { f.status.burn = Math.max(f.status.burn, mv.burn); this.#updateBar(f); }
      }
    });
    hud.cinematic(false);
  }

  /** Csatlós a szabad helyre (a boss mellett, előtte). */
  async #bossSummon(b) {
    const { hud, state } = this.g;
    const used = new Set(this.alive('enemy').map((e) => e.slot));
    const slot = [1, 2].find((i) => !used.has(i));
    if (slot === undefined) return;
    const raw = makeWild(4, 2, state.tiers);
    Object.assign(raw, { nev: 'Gyökérfattyú', szin: '#5a3a6b', tech: [], minion: true });
    const m = await this.#makeUnit(withTotals(raw, state.catalog), 'enemy', slot);
    this.#updateBar(m);
    hud.battleLog('A gyökerek közül egy <b>Gyökérfattyú</b> mászik elő!');
  }

  /** Fázisváltás (66% és 33%): mozis jelenet, a barlang átváltozik, a boss erősödik. */
  async #bossPhase(b) {
    this.pendingPhase = null;
    if (!b.alive) return;
    const target = bossPhase(b.hp, b.stats.maxHp);
    const { hud, sfx, story } = this.g;
    const { width: w, height: h } = this.scale;
    while (b.phase < target && b.alive) {
      b.phase++;
      hud.cinematic(true);
      const c = this.#center(b);
      await this.#camTo(c.x, c.y, 1.12, 500);
      sfx.roar();
      this.cameras.main.shake(900, 0.018);
      const lines = story?.battleLines(b.phase === 2 ? 'nidhoggrRage' : 'nidhoggrWrath', this.tier);
      if (lines) await story.dialogue.play(lines);
      b.stats.atk = Math.round(b.stats.atk * 1.1);
      this.#glow(b, b.phase === 2 ? 0x9d6bff : 0xff3d5a, 1400);

      if (b.phase === 2) {
        // A barlang lila fénybe borul, a peremen gyökerek kúsznak elő
        this.rageTint = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x3a1060, 1).setAlpha(0).setDepth(-3).setBlendMode('MULTIPLY');
        this.tweens.add({ targets: this.rageTint, alpha: 0.55, duration: 900 });
        const edge = this.add.graphics().setDepth(-2).setAlpha(0);
        for (let i = 0; i < 9; i++) {
          const fromLeft = i % 2 === 0;
          const x0 = fromLeft ? -10 : w + 10, y0 = h * (0.15 + Math.random() * 0.8);
          const x1 = fromLeft ? w * (0.08 + Math.random() * 0.1) : w * (0.82 + Math.random() * 0.1), y1 = y0 + (Math.random() - 0.5) * 160;
          edge.lineStyle(14, 0x1a0b22, 1).beginPath().moveTo(x0, y0).lineTo((x0 + x1) / 2, y0 - 40).lineTo(x1, y1).strokePath();
          edge.lineStyle(3, 0x9d6bff, 0.6).beginPath().moveTo(x0, y0).lineTo((x0 + x1) / 2, y0 - 40).lineTo(x1, y1).strokePath();
        }
        this.tweens.add({ targets: edge, alpha: 1, duration: 1200 });
        await this.#banner('II. — A GYÖKÉR DÜHE', 'Níðhöggr csatlóst hív, és szárnyra kap');
        await this.#camReset(400);
        b.lastSummon = b.turns;
        await this.#bossSummon(b);
      } else {
        // Világvég: vörös ég, hulló kövek, a boss körönként kétszer lép
        this.wrathTint = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x5a0a14, 1).setAlpha(0).setDepth(-3).setBlendMode('MULTIPLY');
        this.tweens.add({ targets: this.wrathTint, alpha: 0.6, duration: 900 });
        this.atmo.push(this.add.particles(0, -20, 'fx-shard', {
          x: { min: 0, max: w }, lifespan: 1800, speedY: { min: 260, max: 520 }, rotate: { min: 0, max: 360 },
          scale: { min: 0.5, max: 1.2 }, tint: [0x4a3a3a, 0x6a5040, 0xff7a3d], frequency: 120, quantity: 1,
        }).setDepth(9500));
        this.atmo.push(this.add.particles(0, h, 'fx-dot', {
          x: { min: 0, max: w }, lifespan: 2600, speedY: { min: -120, max: -40 }, speedX: { min: -20, max: 20 },
          scale: { start: 0.2, end: 0 }, tint: [0xff6a1f, 0xffc46b], blendMode: 'ADD', frequency: 50, quantity: 1,
        }).setDepth(9500));
        await this.#banner('III. — VILÁGVÉG', 'Níðhöggr minden körben kétszer lép');
        await this.#camReset(400);
        b.lastCharge = b.turns - 2;                     // hamarosan újra lélegzetet vesz
      }
      hud.cinematic(false);
      this.#updateBar(b);
    }
  }

  /** A halál: a gyökérerek kigyúlnak, fény tör ki belőle, aztán a mélybe süllyed. */
  async #bossDeath(t) {
    const { sfx, hud } = this.g;
    // A csatlósok vele pusztulnak: a gyökér elengedi őket
    for (const m of this.alive('enemy')) {
      m.alive = false; m.hp = 0;
      this.defeated.push(m);
      m.bob?.stop(); m.breath?.stop();
      for (const k of Object.keys(m.status)) m.status[k] = 0;
      this.#killAllFx(m);
      m.zone.disableInteractive();
      hud.battleLog(`<b>${esc(m.d.nev)}</b> porrá omlik.`);
      this.#parts(m).forEach((i) => i.setTintFill(0x9d6bff));
      this.tweens.add({ targets: [m.view, m.ui, m.shadow], alpha: 0, duration: 900, onComplete: () => {
        m.view.destroy(); m.ui.destroy(); m.shadow.destroy(); m.ring.destroy(); m.zone.destroy();
        this.units = this.units.filter((x) => x !== m);
      } });
    }
    this.#stopCharge(t);
    const c = this.#center(t);
    this.g.hud.cinematic(true);
    this.#camTo(c.x, c.y, 1.15, 500);
    sfx.roar();
    this.tweens.add({ targets: t.parts.jaw, rotation: -0.9, duration: 500 });
    this.tweens.add({ targets: t.parts.head, rotation: 0.35, duration: 900, ease: 'Quad.easeOut' });
    this.cameras.main.shake(2200, 0.014);
    const rays = [];
    for (let i = 0; i < 7; i++) {
      const r = this.add.image(c.x, c.y, 'fx-shaft').setOrigin(0.5, 1).setTint(i % 2 ? 0xffd36b : 0xc28cff).setBlendMode('ADD')
        .setDisplaySize(t.bossH * 0.12, t.bossH * 1.4).setRotation((i / 7) * Math.PI * 2).setAlpha(0).setDepth(9300);
      this.tweens.add({ targets: r, alpha: 0.75, duration: 300, delay: i * 120 });
      rays.push(r);
    }
    this.tweens.add({ targets: rays, angle: '+=40', duration: 2000 });
    await this.#wait(1500);
    sfx.boom();
    this.cameras.main.flash(600, 255, 240, 220);
    this.tweens.add({ targets: rays, alpha: 0, duration: 700, onComplete: () => rays.forEach((r) => r.destroy()) });
    this.g.hud.cinematic(false);
  }

  /**
   * A találat kiszámítása és megjelenítése.
   * @returns {Promise<number>} a kiosztott sebzés (0 = kitért)
   */
  async #strike(u, t, mult, opts = {}) {
    if (!t.alive) return 0;
    const r = rollDamage(u, t, mult, opts);
    if (u.status.shadow > 0 && !r.miss) { u.status.shadow = 0; this.#updateBar(u); }
    if (r.miss) {
      this.#float(t, 'KITÉR', '#cfe9ff', 20);
      this.g.sfx.miss();
      this.#ghost(t, 0x9fe8ff, 0.5);
      this.tweens.add({ targets: t.view, x: t.home.x + (t.side === 'ally' ? -34 : 34), duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      await this.#wait(opts.quick ? 150 : 350);
      return 0;
    }
    if (u.side === 'ally') this.#gainChorus(CHORUS.gain.hit + (r.crit ? CHORUS.gain.crit : 0));
    else this.#gainChorus(CHORUS.gain.hurt);
    if (t.boss && u.side !== t.side) this.#addStagger(t, (opts.quick ? 5 : 9) + (r.crit ? 7 : 0) + (opts.heavy ? 6 : 0));
    await this.#damage(t, r.amount, r.crit, null, opts);
    // Tüskepáncél: a támadó visszakapja a sebzés egy részét
    if (t.status.thorns > 0 && u.alive && u.side !== t.side) {
      const back = Math.max(1, Math.round(r.amount * 0.35));
      this.#impact(u, false);
      this.g.hud.battleLog(`<b>${esc(u.d.nev)}</b> a tüskékbe harapott (−${back}).`);
      await this.#damage(u, back, false, '#c9a27e', { dot: true, quick: true });
    }
    return r.amount;
  }

  async #damage(t, amount, crit, color = null, opts = {}) {
    const { sfx, hud } = this.g;
    t.hp = Math.max(0, t.hp - amount);
    sfx.hit(crit);
    this.#flash(t);
    this.#impact(t, crit || opts.heavy);
    this.#float(t, crit ? `${amount}!` : `${amount}`, color || (crit ? '#ffe066' : '#ffffff'), crit || opts.big ? 36 : opts.dot ? 20 : 26, crit);
    if (crit) { hud.battleLog('<span class="bl-crit">Kritikus találat!</span>'); this.cameras.main.shake(200, 0.009); }
    if ((crit || opts.heavy) && !opts.dot) this.#hitStop(crit ? 85 : 60);
    // Hátralökés: a nagyobb ütés messzebbre visz
    const push = (t.side === 'ally' ? -1 : 1) * (opts.heavy || crit ? 26 : 12);
    this.tweens.add({ targets: t.view, x: t.home.x + push, duration: 70, yoyo: true, repeat: opts.heavy ? 0 : 1, ease: 'Quad.easeOut' });
    this.#updateBar(t);
    if (t.boss && t.hp > 0 && bossPhase(t.hp, t.stats.maxHp) > t.phase) this.pendingPhase = t;
    await this.#wait(opts.quick ? 180 : 420);
    if (t.hp <= 0 && t.alive) await this.#faint(t);
  }

  async #faint(t) {
    const { sfx, hud } = this.g;
    t.alive = false;
    sfx.faint();
    hud.battleLog(`<b>${esc(t.d.nev)}</b> ${t.side === 'ally' ? 'elájult' : 'legyőzve'}!`);
    if (t.side === 'enemy') { this.defeated.push(t); this.#gainChorus(CHORUS.gain.ko); }
    t.bob?.stop(); t.breath?.stop();
    t.bossTweens?.forEach((tw) => tw.stop());
    if (t.boss) await this.#bossDeath(t);
    this.tweens.killTweensOf([t.parts.wings, t.parts.head].filter(Boolean));
    t.zone.disableInteractive();
    for (const k of Object.keys(t.status)) t.status[k] = 0;
    this.#killAllFx(t);
    this.#applyTint(t);
    this.#updateBar(t);

    // Az utolsó ellenfél utolsó csapása: lassítás és ráközelítés
    const finale = t.side === 'enemy' && !this.alive('enemy').length && this.wave === this.cave.waves.length - 1;
    if (finale) {
      this.tweens.timeScale = 0.35;
      this.time.timeScale = 0.35;
      this.#camTo(t.view.x, t.view.y, 1.16, 300);
    }

    if (t.side === 'enemy') {
      // Szétporlik: a saját színében szikrázó por száll fel belőle
      const col = colorOf(t.d);
      const dust = this.add.particles(t.view.x, t.view.y, 'fx-dot', {
        x: { min: -this.S * 0.3, max: this.S * 0.3 }, y: { min: -this.S * 0.25, max: this.S * 0.3 },
        speedY: { min: -140, max: -40 }, speedX: { min: -40, max: 40 }, lifespan: 1100,
        scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, tint: [col, 0xffffff], blendMode: 'ADD', emitting: false,
      }).setDepth(9050);
      dust.explode(46);
      this.time.delayedCall(1400, () => dust.destroy());
      this.#parts(t).forEach((i) => i.setTintFill(0xffffff));
      t.flashing = true;
    }
    await this.#tween(t.boss
      ? { targets: t.view, y: t.home.y + t.bossH * 0.45, alpha: 0, duration: 1600, ease: 'Cubic.easeIn' }
      : { targets: t.view, y: t.home.y + this.S * 0.25, alpha: 0, angle: t.side === 'ally' ? -24 : 24, duration: 700, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: [t.ui, t.shadow], alpha: 0, duration: 300 });
    if (finale) {
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      this.#camReset(400);
    }
    if (t.side === 'enemy') {
      t.view.destroy(); t.ui.destroy(); t.shadow.destroy(); t.ring.destroy(); t.zone.destroy();
      this.units = this.units.filter((x) => x !== t);
    }
  }

  /* ================================================================== */
  /* Kamera és időzítés                                                  */
  /* ================================================================== */
  #wait(ms) { return new Promise((r) => this.time.delayedCall(ms, r)); }
  #tween(cfg) { return new Promise((r) => this.tweens.add({ ...cfg, onComplete: r })); }

  /** Ráközelítés egy pontra — a háttérkép széle sosem látszik ki. */
  #camTo(x, y, zoom, dur) {
    const cam = this.cameras.main;
    const { width: w, height: h } = this.scale;
    const hx = w / (2 * zoom), hy = h / (2 * zoom);
    const cx = Phaser.Math.Clamp(x, hx, w - hx), cy = Phaser.Math.Clamp(y, hy, h - hy);
    this.tweens.killTweensOf(cam);
    return this.#tween({ targets: cam, zoom, scrollX: cx - w / 2, scrollY: cy - h / 2, duration: dur, ease: 'Cubic.easeInOut' });
  }
  #camReset(dur) {
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    return this.#tween({ targets: cam, zoom: 1, scrollX: 0, scrollY: 0, duration: dur, ease: 'Cubic.easeInOut' });
  }

  /** Ütésmegállás: a mozgás egy pillanatra megdermed — ettől „csattan" a találat. */
  #hitStop(ms) {
    if (this.tweens.timeScale < 1) return;
    this.tweens.timeScale = 0.06;
    setTimeout(() => { if (this.tweens.timeScale === 0.06) this.tweens.timeScale = 1; }, ms);
  }

  /* ================================================================== */
  /* Látvány                                                             */
  /* ================================================================== */
  /** A száj helye a világban (a rajzon kb. 8,30 a 64-es rácson). */
  #mouth(u) {
    if (u.boss) return bossMouth(u.view);
    const S = this.S;
    const flip = u.parts.inner.scaleX < 0 ? -1 : 1;
    return { x: u.view.x + (8 / 64 - 0.5) * S * flip, y: u.view.y + (30 / 64 - 0.5) * S + u.parts.inner.y };
  }
  #center(u) { return u.boss ? { x: u.view.x - u.bossH * 0.12, y: u.view.y - u.bossH * 0.42 } : { x: u.view.x, y: u.view.y + this.S * 0.05 }; }
  #feet(u) { return u.boss ? { x: u.view.x - u.bossH * 0.1, y: u.view.y } : { x: u.view.x, y: u.view.y + this.S * 0.4 }; }

  /** Utókép: a sárkány áttetsző, színes másolata, ami elhalványul. */
  #ghost(u, tint = 0xffffff, alpha = 0.45) {
    if (!u.view.scene || u.boss) return;
    const p = u.parts;
    const c = this.add.container(u.view.x, u.view.y).setDepth(u.view.depth - 0.5);
    const inner = this.add.container(p.inner.x, p.inner.y).setScale(p.inner.scaleX, p.inner.scaleY);
    c.add(inner);
    for (const part of this.#parts(u)) {
      inner.add(this.add.image(part.x, part.y, part.texture.key).setOrigin(part.originX, part.originY)
        .setScale(part.scaleX, part.scaleY).setRotation(part.rotation).setTintFill(tint).setBlendMode('ADD'));
    }
    c.setAlpha(alpha).setAngle(u.view.angle);
    this.tweens.add({ targets: c, alpha: 0, duration: 380, onComplete: () => c.destroy() });
  }

  async #lunge(u, t, reach = 0.35, dur = 150, trail = false) {
    const dx = (t.home.x - u.home.x) * reach * (u.boss ? 0.3 : 1);
    if (u.parts.head && !u.boss) this.tweens.add({ targets: u.parts.head, rotation: -0.35, duration: dur, yoyo: true });
    let last = 0;
    const col = colorOf(u.d);
    await this.#tween({
      targets: u.view, x: u.home.x + dx, duration: dur, ease: 'Quad.easeIn',
      onUpdate: trail ? (tw) => { const now = tw.elapsed; if (now - last > 30) { last = now; this.#ghost(u, col, 0.4); } } : undefined,
    });
    this.tweens.add({ targets: u.view, x: u.home.x, duration: dur * 1.6, ease: 'Quad.easeOut' });
  }

  #flash(t) {
    const imgs = this.#parts(t);
    t.flashing = true;
    imgs.forEach((i) => i.setTintFill(0xffffff));
    this.time.delayedCall(90, () => { t.flashing = false; if (t.alive) this.#applyTint(t); });
  }

  #impact(t, big) {
    const c = this.#center(t);
    const ring = this.add.image(c.x, c.y, 'fx-ring').setBlendMode('ADD').setScale(0.1).setDepth(9100).setTint(big ? 0xffd08a : 0xffffff);
    this.tweens.add({ targets: ring, scale: big ? 1.4 : 0.8, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const p = this.add.particles(c.x, c.y, 'fx-spark', {
      speed: { min: 120, max: big ? 420 : 280 }, lifespan: 380,
      scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffe08a], blendMode: 'ADD', emitting: false,
    }).setDepth(9100);
    p.explode(big ? 18 : 10);
    this.time.delayedCall(500, () => p.destroy());
  }

  #dust(u, n = 8) {
    const f = this.#feet(u);
    const p = this.add.particles(f.x, f.y, 'fx-smoke', {
      speedX: { min: -90, max: 90 }, speedY: { min: -30, max: -5 }, lifespan: 700,
      scale: { start: 0.4, end: 1.1 }, alpha: { start: 0.5, end: 0 }, tint: 0xb9a68a, emitting: false,
    }).setDepth(u.view.depth + 1);
    p.explode(n);
    this.time.delayedCall(900, () => p.destroy());
  }

  /** Sebzésszám: kipattan, ívben felszáll, a kritikus remeg és nagyobb. */
  #float(u, text, color, size = 24, shake = false) {
    const c = this.#center(u);
    const x0 = c.x + (Math.random() - 0.5) * 30;
    const t = this.add.text(x0, c.y - this.S * 0.3, text, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: `${size}px`, fontStyle: '900',
      color, stroke: '#05070f', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(9800).setScale(0.3);
    this.tweens.add({ targets: t, scale: shake ? 1.25 : 1, duration: 170, ease: 'Back.easeOut' });
    if (shake) this.tweens.add({ targets: t, angle: { from: -6, to: 6 }, duration: 50, yoyo: true, repeat: 3 });
    const drift = (u.side === 'ally' ? -1 : 1) * (14 + Math.random() * 20);
    this.tweens.add({ targets: t, x: x0 + drift, duration: 1100, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 56, duration: 520, delay: 120, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 500, delay: 700, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
  }

  async #skillName(u, sk, big = false) {
    const c = this.#center(u);
    const t = this.add.text(c.x, c.y - this.S * 0.72, `${sk.rune}  ${sk.name}`, {
      fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: big ? '28px' : '22px', fontStyle: '900',
      color: hex(sk.color), stroke: '#05070f', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(9700).setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, duration: 400, delay: 900, onComplete: () => t.destroy() });
    // rúnafény a használó körül
    const glow = this.add.image(c.x, c.y, 'fx-dot').setTint(sk.color).setBlendMode('ADD').setScale(0.5).setAlpha(0.9).setDepth(u.view.depth - 1);
    this.tweens.add({ targets: glow, scale: this.S / 12, alpha: 0, duration: 650, onComplete: () => glow.destroy() });
    await this.#wait(380);
  }

  /** Színes felizzás (erősítés, kórus, düh): a sárkány színes mása rajta, ami elhalványul — vele mozog. */
  #glow(u, color, dur = 500) {
    if (!u.view.scene) return;
    if (u.boss) {
      // A boss rétegzett: másolat helyett színes felvillanás és fénykör
      const c = this.#center(u);
      this.#parts(u).forEach((i) => i.setTint(color));
      this.time.delayedCall(dur * 0.6, () => { if (u.alive) this.#applyTint(u); });
      const halo = this.add.image(c.x, c.y, 'fx-dot').setTint(color).setBlendMode('ADD').setScale(u.bossH / 18).setAlpha(0.6).setDepth(u.view.depth - 1);
      this.tweens.add({ targets: halo, scale: u.bossH / 9, alpha: 0, duration: dur, onComplete: () => halo.destroy() });
      return;
    }
    const p = u.parts;
    const over = this.add.container(p.inner.x, p.inner.y).setScale(p.inner.scaleX, p.inner.scaleY);
    for (const part of this.#parts(u)) {
      over.add(this.add.image(part.x, part.y, part.texture.key).setOrigin(part.originX, part.originY)
        .setScale(part.scaleX, part.scaleY).setRotation(part.rotation).setTintFill(color).setBlendMode('ADD'));
    }
    u.view.add(over);
    this.tweens.add({ targets: over, alpha: { from: 0.95, to: 0 }, duration: dur, ease: 'Quad.easeIn', onComplete: () => over.destroy() });
    const halo = this.add.image(0, 0, 'fx-dot').setTint(color).setBlendMode('ADD').setScale(this.S / 20).setAlpha(0.7);
    u.view.addAt(halo, 0);
    this.tweens.add({ targets: halo, scale: this.S / 10, alpha: 0, duration: dur, onComplete: () => halo.destroy() });
  }

  /** Tűzokádás: részecskefolyam a szájból a célpont felé. */
  async #breath(u, t, tints) {
    const m = this.#mouth(u), c = this.#center(t);
    const ang = Phaser.Math.RadToDeg(Math.atan2(c.y - m.y, c.x - m.x));
    const dist = Phaser.Math.Distance.Between(m.x, m.y, c.x, c.y);
    const p = this.add.particles(m.x, m.y, 'fx-dot', {
      angle: { min: ang - 9, max: ang + 9 }, speed: { min: dist * 1.6, max: dist * 2.1 },
      lifespan: 520, scale: { start: 0.35, end: 1.5 }, alpha: { start: 1, end: 0 },
      tint: tints, blendMode: 'ADD', frequency: 12, quantity: 3,
    }).setDepth(9050);
    // Hőfény a célponton
    const heat = this.add.image(c.x, c.y, 'fx-dot').setTint(0xff6a1f).setBlendMode('ADD').setScale(1).setAlpha(0).setDepth(9040);
    this.tweens.add({ targets: heat, alpha: 0.6, scale: this.S / 30, duration: 300, yoyo: true, hold: 200, onComplete: () => heat.destroy() });
    await this.#wait(520);
    p.stop();
    this.time.delayedCall(700, () => p.destroy());
  }

  async #shards(u, t, tints = [0x9fe8ff, 0xffffff], n = 7) {
    const m = this.#mouth(u), c = this.#center(t);
    const ang = Math.atan2(c.y - m.y, c.x - m.x);
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const s = this.add.image(m.x, m.y, 'fx-shard').setTint(tints[i % 2]).setBlendMode('ADD')
        .setRotation(ang + Math.PI / 2).setScale(1.2).setDepth(9050);
      jobs.push(this.#tween({
        targets: s, x: c.x + (Math.random() - 0.5) * 40, y: c.y + (Math.random() - 0.5) * 40,
        duration: 260, delay: i * 45, ease: 'Quad.easeIn',
      }).then(() => s.destroy()));
    }
    await Promise.all(jobs);
  }

  #iceBlock(t) {
    const c = this.#center(t);
    const ice = this.add.image(c.x, c.y, 'fx-dot').setTint(0x9fe8ff).setBlendMode('ADD').setScale(this.S / 14).setAlpha(0.6).setDepth(9060);
    this.tweens.add({ targets: ice, alpha: 0, duration: 900, onComplete: () => ice.destroy() });
  }

  /** A jég szilánkokra törik, ahogy a fagyás felenged. */
  #shatter(t) {
    const c = this.#center(t);
    const p = this.add.particles(c.x, c.y + this.S * 0.2, 'fx-shard', {
      speed: { min: 120, max: 300 }, angle: { min: 200, max: 340 }, gravityY: 700, lifespan: 800,
      rotate: { min: 0, max: 360 }, scale: { start: 0.9, end: 0.4 }, tint: [0xcff4ff, 0x9fe8ff, 0xffffff], emitting: false,
    }).setDepth(9050);
    p.explode(14);
    this.g.sfx.frost();
    this.time.delayedCall(1000, () => p.destroy());
  }

  async #bubbles(u, t) {
    const m = this.#mouth(u), c = this.#center(t);
    const jobs = [];
    for (let i = 0; i < 8; i++) {
      const b = this.add.image(m.x, m.y, i % 3 ? 'fx-bubble' : 'fx-dot').setTint(i % 2 ? 0x7dff6a : 0xb18cff).setScale(0.8).setDepth(9050);
      const lift = 60 + Math.random() * 80;
      const o = { k: 0 };
      jobs.push(this.#tween({
        targets: o, k: 1, duration: 520, delay: i * 50,
        onUpdate: () => { b.x = m.x + (c.x - m.x) * o.k; b.y = m.y + (c.y - m.y) * o.k - Math.sin(o.k * Math.PI) * lift; },
      }).then(() => b.destroy()));
    }
    await Promise.all(jobs);
  }

  /** Villám felülről a célpontra — elágazásokkal. */
  async #bolt(t, delay, cols = [0x4fd6ff, 0xcfefff, 0xffffff]) {
    await this.#wait(delay);
    const c = this.#center(t);
    const g = this.add.graphics().setDepth(9200).setBlendMode('ADD');
    const pts = [];
    let x = c.x + (Math.random() - 0.5) * 80, y = -10;
    while (y < c.y) { pts.push([x, y]); y += 24 + Math.random() * 24; x += (Math.random() - 0.5) * 50; }
    pts.push([c.x, c.y]);
    const branches = [];
    for (let i = 2; i < pts.length - 2; i += 2) {
      if (Math.random() < 0.5) continue;
      const b = [pts[i]];
      let [bx, by] = pts[i];
      for (let k = 0; k < 3; k++) { bx += (Math.random() - 0.5) * 60 + (bx < c.x ? -14 : 14); by += 18 + Math.random() * 16; b.push([bx, by]); }
      branches.push(b);
    }
    const stroke = (line, w, col, a) => {
      g.lineStyle(w, col, a).beginPath().moveTo(line[0][0], line[0][1]);
      for (const [px, py] of line.slice(1)) g.lineTo(px, py);
      g.strokePath();
    };
    for (const [w, col, a] of [[10, cols[0], 0.35], [4, cols[1], 0.9], [1.6, cols[2], 1]]) {
      stroke(pts, w, col, a);
      for (const b of branches) stroke(b, w * 0.5, col, a * 0.8);
    }
    this.#impact(t, true);
    await this.#tween({ targets: g, alpha: 0, duration: 260 });
    g.destroy();
  }

  async #orbs(from, to, tint) {
    const a = this.#center(from), b = this.#center(to);
    const jobs = [];
    for (let i = 0; i < 6; i++) {
      const o = this.add.image(a.x, a.y, 'fx-dot').setTint(tint).setBlendMode('ADD').setScale(0.7).setDepth(9050);
      jobs.push(this.#tween({ targets: o, x: b.x + (Math.random() - 0.5) * 20, y: b.y + (Math.random() - 0.5) * 20, duration: 520, delay: i * 60, ease: 'Sine.easeInOut' }).then(() => o.destroy()));
    }
    await Promise.all(jobs);
  }

  async #streak(u, t) {
    const a = this.#center(u), b = this.#center(t);
    const s = this.add.image(a.x, a.y, 'fx-spark').setBlendMode('ADD').setOrigin(0, 0.5).setDepth(9050)
      .setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setScale(0.1, 3);
    let last = 0;
    this.tweens.add({
      targets: u.view, x: u.home.x + (t.home.x - u.home.x) * 0.55, duration: 120, yoyo: true, hold: 60,
      onUpdate: (tw) => { if (tw.elapsed - last > 25) { last = tw.elapsed; this.#ghost(u, 0xe8f1ff, 0.45); } },
    });
    await this.#tween({ targets: s, scaleX: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 24, duration: 140, ease: 'Expo.easeOut' });
    this.tweens.add({ targets: s, alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }

  /* --- A technikák látványa ------------------------------------------- */
  /**
   * Rúnakör a talajon. A kép egy lapított tárolóban forog — így a talaj
   * síkjában pörög, nem billeg ide-oda, mint egy elforgatott ellipszis.
   * @returns a tároló (ezt kell elhalványítani / megszüntetni)
   */
  #groundRing(x, y, color, size, depth, spin = 3000) {
    const cont = this.add.container(x, y).setDepth(depth).setScale(1, 0.32).setAlpha(0);
    const img = this.add.image(0, 0, 'fx-runecircle').setTint(color).setBlendMode('ADD').setScale(0.05);
    cont.add(img);
    this.tweens.add({ targets: cont, alpha: 1, duration: 300 });
    this.tweens.add({ targets: img, scale: size / 192, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: img, angle: 360, duration: spin, repeat: -1 });
    return cont;
  }

  async #runeCircle(u, color, dur) {
    const f = this.#feet(u);
    const c = this.#groundRing(f.x, f.y, color, this.S * 1.2, u.view.depth - 1, dur + 1200);
    const glyphs = ['ᛚ', 'ᛟ', 'ᚨ', 'ᛒ', 'ᛁ'];
    for (let i = 0; i < 7; i++) {
      const g = this.add.text(f.x + (Math.random() - 0.5) * this.S * 0.7, f.y - 10, glyphs[i % glyphs.length], {
        fontFamily: '"Noto Sans Runic", "Segoe UI Historic", serif', fontSize: '22px', color: hex(color), stroke: '#05070f', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9060).setAlpha(0);
      this.tweens.add({ targets: g, y: g.y - this.S * (0.6 + Math.random() * 0.4), alpha: { from: 1, to: 0 }, duration: 1000, delay: i * 110, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    }
    const p = this.add.particles(f.x, f.y, 'fx-dot', {
      x: { min: -this.S * 0.35, max: this.S * 0.35 }, speedY: { min: -140, max: -60 }, lifespan: 800,
      scale: { start: 0.3, end: 0 }, tint: [color, 0xffffff], blendMode: 'ADD', frequency: 40, quantity: 2,
    }).setDepth(9055);
    await this.#wait(dur);
    p.stop();
    this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    this.time.delayedCall(900, () => p.destroy());
  }

  async #runeSlam(t, rune, color) {
    const c = this.#center(t);
    const r = this.add.text(c.x, c.y, rune, {
      fontFamily: '"Noto Sans Runic", "Segoe UI Historic", serif', fontSize: `${Math.round(this.S * 0.6)}px`,
      color: hex(color), stroke: '#05070f', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(9300).setScale(3).setAlpha(0);
    await this.#tween({ targets: r, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeIn' });
    this.cameras.main.shake(140, 0.008);
    this.#impact(t, true);
    this.tweens.add({ targets: r, scale: 0.4, y: c.y - this.S * 0.55, alpha: 0, duration: 450, delay: 160, ease: 'Cubic.easeIn', onComplete: () => r.destroy() });
  }

  async #shockwave(u, color) {
    const m = this.#mouth(u);
    for (let i = 0; i < 3; i++) {
      const r = this.add.image(m.x, m.y, 'fx-ring').setTint(color).setBlendMode('ADD').setScale(0.15).setDepth(9100);
      this.tweens.add({ targets: r, scale: this.S / 45 + i * 0.6, alpha: { from: 0.9, to: 0 }, duration: 600, delay: i * 130, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
    this.cameras.main.shake(300, 0.006);
    if (u.parts.head) this.tweens.add({ targets: u.parts.head, rotation: -0.45, duration: 180, yoyo: true, hold: 300 });
    await this.#wait(520);
  }

  async #wardPop(u, delay) {
    await this.#wait(delay);
    const b = this.add.image(u.view.x, u.view.y, 'fx-ward').setTint(0xbff4ff).setBlendMode('ADD').setScale(0.05).setDepth(9100);
    await this.#tween({ targets: b, scale: this.S / 100, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: b, alpha: 0, scale: this.S / 90, duration: 380, onComplete: () => b.destroy() });
  }

  async #vanish(u) {
    const f = this.#center(u);
    const p = this.add.particles(f.x, f.y, 'fx-smoke', {
      speed: { min: 30, max: 120 }, lifespan: 800, scale: { start: 0.5, end: 1.4 }, alpha: { start: 0.7, end: 0 }, tint: 0x2a1a44, emitting: false,
    }).setDepth(u.view.depth + 1);
    p.explode(16);
    this.time.delayedCall(1000, () => p.destroy());
    await this.#tween({ targets: u.view, alpha: 0, duration: 160 });
    const side = u.side === 'ally' ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      u.view.x = u.home.x + side * (30 - i * 8);
      u.view.alpha = 0.6;
      this.#ghost(u, 0xb18cff, 0.5);
      await this.#wait(50);
    }
    u.view.x = u.home.x;
    await this.#tween({ targets: u.view, alpha: 1, duration: 160 });
  }

  async #whirl(t, color, delay) {
    await this.#wait(delay);
    const c = this.#center(t);
    const streaks = [];
    for (let i = 0; i < 9; i++) streaks.push(this.add.image(c.x, c.y, 'fx-spark').setTint(i % 2 ? 0xffffff : color).setBlendMode('ADD').setDepth(9100).setScale(1.4, 1.2));
    const k = { a: 0 };
    await this.#tween({
      targets: k, a: 1, duration: 700, ease: 'Sine.easeInOut',
      onUpdate: () => streaks.forEach((s, i) => {
        const ang = k.a * Math.PI * 4 + (i / streaks.length) * Math.PI * 2;
        const r = this.S * (0.55 - k.a * 0.25);
        s.setPosition(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r * 0.45).setRotation(ang + Math.PI / 2).setAlpha(1 - k.a * 0.5);
      }),
    });
    streaks.forEach((s) => s.destroy());
    this.tweens.add({ targets: t.view, x: t.home.x + (t.side === 'ally' ? -40 : 40), duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  async #cracks(u, foes) {
    const from = this.#feet(u);
    const g = this.add.graphics().setDepth(5).setBlendMode('ADD');
    const dark = this.add.graphics().setDepth(4);
    for (const f of foes) {
      const to = this.#feet(f);
      const pts = [[from.x, from.y]];
      const n = 9;
      for (let i = 1; i <= n; i++) pts.push([from.x + (to.x - from.x) * (i / n) + (Math.random() - 0.5) * 18, from.y + (to.y - from.y) * (i / n) + (Math.random() - 0.5) * 14]);
      dark.lineStyle(7, 0x000000, 0.75).beginPath().moveTo(...pts[0]); pts.slice(1).forEach((p) => dark.lineTo(...p)); dark.strokePath();
      g.lineStyle(2.5, 0xffb35a, 0.95).beginPath().moveTo(...pts[0]); pts.slice(1).forEach((p) => g.lineTo(...p)); g.strokePath();
      // Kőzápor a célpont alól
      const rocks = this.add.particles(to.x, to.y, 'fx-shard', {
        speed: { min: 180, max: 380 }, angle: { min: 235, max: 305 }, gravityY: 1000, lifespan: 900,
        rotate: { min: 0, max: 360 }, scale: { start: 1.2, end: 0.6 }, tint: [0x8a6d4c, 0x5a4430, 0xc9a27e], emitting: false,
      }).setDepth(f.view.depth + 1);
      this.time.delayedCall(200, () => rocks.explode(12));
      this.time.delayedCall(1300, () => rocks.destroy());
      this.#dust(f, 12);
      this.tweens.add({ targets: f.view, y: f.home.y - this.S * 0.18, duration: 160, yoyo: true, delay: 200, ease: 'Quad.easeOut' });
    }
    g.alpha = 0; dark.alpha = 0;
    this.tweens.add({ targets: [g, dark], alpha: 1, duration: 200 });
    this.tweens.add({ targets: [g, dark], alpha: 0, duration: 900, delay: 900, onComplete: () => { g.destroy(); dark.destroy(); } });
    await this.#wait(500);
  }

  async #meteor(t, color) {
    const c = this.#center(t);
    const sx = c.x + (t.side === 'enemy' ? -1 : 1) * this.scale.width * 0.25, sy = -80;
    const rock = this.add.image(sx, sy, 'fx-dot').setTint(0xfff3a0).setBlendMode('ADD').setScale(this.S / 55).setDepth(9200);
    const shell = this.add.image(sx, sy, 'fx-dot').setTint(color).setBlendMode('ADD').setScale(this.S / 32).setAlpha(0.7).setDepth(9199);
    const trail = this.add.particles(0, 0, 'fx-dot', {
      speed: { min: 10, max: 60 }, lifespan: 500, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0xfff3a0, 0xffb347, 0xff6a1f, 0x5a2a1a], blendMode: 'ADD', frequency: 10, quantity: 2,
    }).setDepth(9198);
    trail.startFollow(rock);
    // A célpont alatt egyre fényesebb jel: ide fog csapódni
    const f = this.#feet(t);
    const warn = this.add.image(f.x, f.y, 'fx-ring').setTint(0xff6a1f).setBlendMode('ADD').setScale(this.S / 128, this.S / 420).setAlpha(0).setDepth(t.view.depth - 1);
    this.tweens.add({ targets: warn, alpha: 1, duration: 600 });
    await this.#tween({ targets: [rock, shell], x: c.x, y: c.y, duration: 700, ease: 'Quad.easeIn' });
    trail.stop();
    this.g.sfx.boom();
    this.cameras.main.flash(260, 255, 180, 90);
    this.cameras.main.shake(500, 0.02);
    for (let i = 0; i < 2; i++) {
      const r = this.add.image(c.x, c.y, 'fx-ring').setTint(i ? color : 0xffffff).setBlendMode('ADD').setScale(0.2).setDepth(9100);
      this.tweens.add({ targets: r, scale: this.S / 50 + i, alpha: 0, duration: 600 + i * 200, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    }
    const debris = this.add.particles(c.x, c.y, 'fx-spark', {
      speed: { min: 200, max: 520 }, lifespan: 600, scale: { start: 1.4, end: 0.2 }, tint: [0xfff3a0, 0xff8a3d], blendMode: 'ADD', emitting: false,
    }).setDepth(9100);
    debris.explode(30);
    // Megperzselt föld
    const scorch = this.add.image(f.x, f.y, 'fx-dot').setTint(0x000000).setScale(this.S / 22, this.S / 70).setAlpha(0.7).setDepth(t.view.depth - 2);
    this.tweens.add({ targets: scorch, alpha: 0, duration: 2600, delay: 600, onComplete: () => scorch.destroy() });
    rock.destroy(); shell.destroy(); warn.destroy();
    this.time.delayedCall(800, () => { trail.destroy(); debris.destroy(); });
  }

  /** Gyökerek törnek fel a célpont alól, aztán visszahúzódnak. */
  async #roots(t, delay, cols = [0x1a0b22, 0x4a2a5a, 0x9d6bff]) {
    await this.#wait(delay);
    const f = this.#feet(t);
    const g = this.add.graphics().setDepth(t.view.depth + 1);
    const curves = [0, 1, 2].map((i) => {
      const x0 = f.x + (i - 1) * this.S * 0.28, y0 = f.y + 6;
      return new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(x0, y0),
        new Phaser.Math.Vector2(x0 + (i - 1) * 50, y0 - this.S * 0.4),
        new Phaser.Math.Vector2(x0 - (i - 1) * 30, y0 - this.S * 0.75),
        new Phaser.Math.Vector2(f.x + (i - 1) * 12, y0 - this.S * (0.9 + i * 0.08)),
      );
    });
    const k = { p: 0 };
    const draw = () => {
      g.clear();
      for (const c of curves) {
        const pts = c.getPoints(18).slice(0, Math.max(2, Math.round(18 * k.p)));
        g.lineStyle(13, cols[0], 1).strokePoints(pts);
        g.lineStyle(7, cols[1], 1).strokePoints(pts);
        g.lineStyle(2, cols[2], 0.8).strokePoints(pts);
      }
    };
    this.#dust(t, 8);
    await this.#tween({ targets: k, p: 1, duration: 360, ease: 'Back.easeOut', onUpdate: draw });
    this.tweens.add({ targets: t.view, y: t.home.y - 10, duration: 90, yoyo: true });
    this.time.delayedCall(450, () => this.tweens.add({ targets: k, p: 0, duration: 400, ease: 'Quad.easeIn', onUpdate: draw, onComplete: () => g.destroy() }));
  }

  async #banner(title, sub) {
    const { width: w, height: h } = this.scale;
    const c = this.add.container(w / 2, h * 0.3).setDepth(9900).setAlpha(0).setScrollFactor(0);
    const fs = Math.round(Math.min(56, w / 14));
    const t1 = this.add.text(0, 0, title, {
      fontFamily: 'Cinzel Decorative, Cinzel, serif', fontSize: `${fs}px`, fontStyle: '900',
      color: '#ffe7c2', stroke: '#05070f', strokeThickness: 9,
    }).setOrigin(0.5);
    const t2 = this.add.text(0, fs * 0.8, sub, {
      fontFamily: 'Cinzel, serif', fontSize: '18px', color: '#9fe8ff', stroke: '#05070f', strokeThickness: 5,
    }).setOrigin(0.5);
    // Rúnavonal a cím alatt: középről kifelé húzódik
    const line = this.add.graphics();
    line.lineStyle(2, 0xffd08a, 0.8).lineBetween(-1, 0, 1, 0);
    line.y = fs * 0.45;
    c.add([line, t1, t2]);
    t1.setLetterSpacing?.(12);
    this.tweens.add({ targets: line, scaleX: Math.min(w * 0.35, 320), duration: 600, ease: 'Cubic.easeOut' });
    const ls = { v: 12 };
    this.tweens.add({ targets: ls, v: 2, duration: 600, ease: 'Cubic.easeOut', onUpdate: () => t1.setLetterSpacing?.(ls.v) });
    await this.#tween({ targets: c, alpha: 1, y: h * 0.28, duration: 450, ease: 'Cubic.easeOut' });
    await this.#wait(900);
    await this.#tween({ targets: c, alpha: 0, y: h * 0.25, duration: 400 });
    c.destroy();
  }

  /** Győzelmi tánc: szökdelés, rúnaeső, és fényoszlop a szintet lépőkön. */
  async #celebrate(leveled) {
    const { width: w } = this.scale;
    const allies = this.units.filter((u) => u.side === 'ally' && u.alive);
    allies.forEach((a, i) => this.tweens.add({ targets: a.view, y: a.home.y - this.S * 0.12, duration: 220, yoyo: true, repeat: 2, delay: i * 90, ease: 'Quad.easeOut' }));
    const rain = this.add.particles(0, -20, 'fx-shard', {
      x: { min: 0, max: w }, speedY: { min: 120, max: 260 }, speedX: { min: -40, max: 40 }, lifespan: 2400,
      rotate: { start: 0, end: 360 }, scale: { min: 0.4, max: 0.9 }, tint: [0xffd08a, 0x4fffe0, 0xffffff, 0xff8a3d],
      blendMode: 'ADD', frequency: 30, quantity: 2,
    }).setDepth(9400);
    this.time.delayedCall(900, () => rain.stop());
    this.time.delayedCall(3400, () => rain.destroy());
    for (const a of allies.filter((x) => leveled.has(x.d.id))) {
      const f = this.#feet(a);
      const pillar = this.add.image(f.x, f.y, 'fx-shaft').setOrigin(0.5, 1).setTint(0xffe08a).setBlendMode('ADD')
        .setDisplaySize(this.S * 0.7, f.y + 20).setAlpha(0).setDepth(a.view.depth + 1).setFlipY(true);
      this.tweens.add({ targets: pillar, alpha: 0.85, duration: 300, yoyo: true, hold: 700, onComplete: () => pillar.destroy() });
      const c = this.#groundRing(f.x, f.y, 0xffe08a, this.S * 1.1, a.view.depth - 1, 2000);
      this.tweens.add({ targets: c, alpha: 0, duration: 500, delay: 900, onComplete: () => c.destroy() });
      this.#float(a, 'SZINTLÉPÉS!', '#ffe066', 22);
    }
    await this.#wait(leveled.size ? 1300 : 900);
  }

  /* ================================================================== */
  /* Vége                                                                */
  /* ================================================================== */
  async #finish(result) {
    const { state, hud, sfx, api, story } = this.g;
    hud.battleHint(null);
    hud.el.battle.querySelector('.bp-actions').hidden = true;
    hud.cinematic(false);
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    // Barlangban a csapat életereje megmarad a völgyben is; a karámban mindenki felépül
    if (!this.spar) for (const u of this.units.filter((x) => x.side === 'ally')) state.setHp(u.d, u.alive ? u.hp : 0);
    state.save.stats.battles++;

    if (result === 'flee') return this.#leave({ fled: true, roamId: this.roamId });

    if (result === 'defeat') {
      sfx.defeat();
      const card = hud.openModal(this.spar ? `
        <p class="gm-kicker">ᛏ Tiwaz — a tanulság</p>
        <h2>Ragnhild nyert</h2>
        <p>Szélvész utódai most erősebbnek bizonyultak. Ragnhild felsegíti a sárkányaidat:
           <em>„A vereség is lecke. Gyere vissza, ha a technikád is megerősödött."</em></p>
        <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Vissza a karámba</button></div>` : `
        <p class="gm-kicker">ᚺ Hagalaz — a jégeső</p>
        <h2>Vereség</h2>
        <p>A barlang sötétje elnyelte a csapatodat. A sárkányaid a hosszúház tüzénél térnek magukhoz.</p>
        <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Vissza a völgybe</button></div>`, { closeable: false });
      card.querySelector('[data-act="ok"]').onclick = () => { hud.closeModal(); this.#leave(this.spar ? { spar: true } : { defeat: true, roamId: this.roamId }); };
      return;
    }

    /* --- Győzelem: jutalmak --- */
    sfx.victory();
    this.cameras.main.flash(400, 255, 220, 150);
    const cave = this.mode === 'cave';
    const firstClear = cave && !state.save.cleared[this.tier];
    const bonus = cave ? (firstClear ? caveBonus(this.tier) : Math.round(caveBonus(this.tier) / 4)) : 0;
    const base = this.spar || this.mode === 'guardian' ? 0 : this.defeated.reduce((s, u) => s + shardsFor(u.stats.level), 0) + bonus;
    const shards = Math.round(base * (this.relics.has('draupnir') ? 1 + RELICS.draupnir.shards : 1));
    const xpTotal = this.defeated.reduce((s, u) => s + xpFor(u.stats.level), 0) * (this.spar ? 0.5 : this.mode === 'guardian' ? 0.8 : 1);
    state.save.shards += shards;
    if (this.spar) state.save.stats.spars++;
    else if (cave) { state.save.cleared[this.tier] = true; state.save.stats.wins++; }
    else if (this.mode === 'roam') { state.save.stats.wins++; state.save.stats.roams = (state.save.stats.roams || 0) + 1; }

    const allies = this.units.filter((u) => u.side === 'ally');
    const gains = {};
    const leveled = new Set();
    const lines = allies.map((u) => {
      const gain = Math.round(xpTotal * (u.alive ? 0.6 : 0.3));
      const before = levelOf(u.d.xp);
      u.d.xp += gain;
      gains[u.d.id] = gain;
      const after = levelOf(u.d.xp);
      if (after > before) leveled.add(u.d.id);
      return `<li><img data-portrait="${u.d.id}" alt=""> <b>${esc(u.d.nev)}</b> +${gain} tapasztalat
              ${after > before ? `<span class="gm-lvl">ᛏ ${after}. szint!</span>` : ''}</li>`;
    });
    if (leveled.size) this.time.delayedCall(500, () => sfx.levelUp());
    api.post('xp', { payload: JSON.stringify(gains) }).catch((e) => hud.toast(esc(e.message), 'bad'));
    state.commit('party');

    await this.#celebrate(leveled);

    // A saga jelenetei a barlang mélyén
    const sceneKey = !cave ? null : this.tier === 3 ? 'whisper' : this.tier === 5 ? 'nidhoggrFall' : null;
    const sl = sceneKey && story?.battleLines(sceneKey, this.tier);
    if (sl) { await story.dialogue.play(sl); state.commit(); }

    // Szelídítés: a legyőzöttek egyike néha meghajol
    const candidates = this.spar || this.mode === 'guardian' ? [] : this.defeated.filter((u) => !u.boss && !u.d.minion);
    const offer = this.tier <= 4 && candidates.length && Math.random() < (this.mode === 'roam' ? TAME_CHANCE + 0.15 : TAME_CHANCE) ? pick(candidates) : null;
    if (offer) hud.extraDragons.set(String(offer.d.id), offer.d);

    const card = hud.openModal(`
      <p class="gm-kicker">${this.spar ? 'ᛏ Tiwaz — a harcos rúnája' : 'ᛊ Sowilo — a győzelem napja'}</p>
      <h2>${this.spar ? 'A párbaj a tiéd!' : this.mode === 'guardian' ? 'A próba teljesítve!' : cave && this.tier === 5 ? 'Níðhöggr elesett!' : 'Győzelem!'}</h2>
      ${cave && this.tier === 5 ? '<p class="gm-good">A neved felkerül az ötödik rúnakőre. A Völgy dalnokai rólad énekelnek.</p>' : ''}
      ${this.spar ? '<p>Ragnhild elégedetten bólint: <em>„Ezt már nevezhetjük harcnak."</em> A sárkányaid kifújják magukat, és teljesen felépülnek.</p>' : ''}
      <div class="gm-facts">
        ${shards ? `<span>Rúnaszilánk: <b>+${shards} ᚱ</b>${firstClear ? ' <small>(első bejárás bónusz)</small>' : ''}${this.relics.has('draupnir') ? ' <small>(Draupnir +25%)</small>' : ''}</span>` : ''}
        <span>Legyőzött sárkány: <b>${this.defeated.length}</b></span>
      </div>
      <ul class="gm-xp">${lines.join('')}</ul>
      ${offer ? `
        <div class="gm-tame">
          <p><b>${esc(offer.d.nev)}</b> a porba hajtja a fejét — a suttogás elhagyta. Megszelídíted?</p>
          ${hud.dragonCard(offer.d)}
          <div class="gm-actions">
            <button class="btn btn-primary" data-act="tame" type="button" ${state.save.shards < TAME_COST ? 'disabled' : ''}>Megszelídítem (${TAME_COST} ᚱ)</button>
            <button class="btn btn-ghost" data-act="skip" type="button">Hadd menjen</button>
          </div>
        </div>` : ''}
      <div class="gm-actions" data-leave ${offer ? 'hidden' : ''}>
        <button class="btn btn-primary" data-act="ok" type="button">${this.spar ? 'Vissza a karámba' : this.mode === 'cave' ? 'Vissza a völgybe' : 'Tovább'}</button>
      </div>`, { closeable: false, wide: !!offer });

    const leave = card.querySelector('[data-leave]');
    const leaveWith = this.spar ? { spar: true, victory: true }
      : this.mode === 'guardian' ? { guardian: this.placeId, victory: true }
      : this.mode === 'roam' ? { roamId: this.roamId, victory: true }
      : { victory: true, tier: this.tier, firstClear };
    card.querySelector('[data-act="ok"]').onclick = () => { hud.closeModal(); this.#leave(leaveWith); };
    if (offer) {
      const showLeave = () => { card.querySelector('.gm-tame').remove(); leave.hidden = false; leave.querySelector('button').focus(); };
      card.querySelector('[data-act="skip"]').onclick = showLeave;
      card.querySelector('[data-act="tame"]').onclick = async (e) => {
        e.currentTarget.disabled = true;
        try {
          const d = offer.d;
          // A szerver a MENTETT állásból ellenőrzi, melyik barlangot jártad már be
          state.dirty = true;
          await state.flush();
          const res = await api.post('tame', {
            tier: this.tier, fej: d.fej, test: d.test, lab: d.lab, szarny: d.szarny, szin: d.szin, name: d.nev,
          });
          state.save.shards -= TAME_COST;
          state.save.stats.tamed++;
          state.addDragon(res.dragon);
          state.commit();
          sfx.levelUp();
          hud.toast(`ᚠ <b>${esc(res.dragon.nev)}</b> csatlakozott hozzád!${res.dragon.traits.length ? ` Vonás: ${esc(state.traits[res.dragon.traits[0]][0])}` : ''}`, 'good', 5000);
          showLeave();
        } catch (err) {
          hud.toast(esc(err.message), 'bad');
          e.currentTarget.disabled = false;
        }
      };
    }
  }

  #leave(result) {
    const { hud, state } = this.g;
    state.touch('party');
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      hud.showBattle(false);
      this.scene.wake('overworld', result);
      this.scene.stop();
    });
  }
}
