/* =====================================================================
   A völgy — bejárható térkép
   ---------------------------------------------------------------------
   - a csapat vezérsárkánya a játékos (billentyű: WASD/nyilak; egér/
     koppintás: A* útkereséssel odamegy, és a helyszínre érve interakció)
   - felderítési köd (a mentésben bitmezőként marad meg)
   - helyszínek: hosszúház (a Völvával), Gyakorlótér, 5 barlang, 3 fészek,
     5 rúnakő, gyógyfüvek
   - a saga célja fölött aranyló jel lebeg; ha a képernyőn kívül van, a
     szélén iránytű mutat felé
   - Shift: szárnyalás (gyorsabb, a sárkány felemelkedik)
   - hangulat: szentjánosbogarak, hóesés északon, parázs a hamuveremben,
     vonuló felhőárnyékok, átrepülő hollók, csillanó víz
   ===================================================================== */
import { TILE, T, B } from './world.js';
import { findPath } from './path.js';
import { makeDragonView, dragonTextures, TILE_MARGIN, TILE_SPACING } from './art.js';
import { peakSpots } from './terrain.js';
import { fringeLayers } from './tiles.js';
import { CAVES, SKILLS, levelOf, breedCost, SLOTS, SLOT_NAMES } from './rules.js';
import { esc } from './hud.js';
import { LORE } from './lore.js';
import { Trainer } from './trainer.js';
import { Places, PLACES, wandererIndex, makeRoamer, makeGuardian, playerSeed } from './places.js';

const SPEED = 175;               // képpont / mp a világban
const SOAR = 1.65;               // szárnyalás (Shift) szorzója
const REVEAL = 6;                // felderítési sugár csempében
const HERB_RESPAWN = 600;        // mp — ennyi idő után nő vissza a gyógyfű
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export class OverworldScene extends Phaser.Scene {
  constructor() { super('overworld'); }

  init(data) {
    this.g = data.g;                       // közös szolgáltatások: state, hud, sfx, world
  }

  async create() {
    const { world, state, hud } = this.g;
    this.world = world;
    this.W = world.w; this.H = world.h;

    /* --- Talaj --- */
    const rows = [];
    for (let y = 0; y < world.h; y++) rows.push(Array.from(world.ground.subarray(y * world.w, (y + 1) * world.w)));
    const map = this.make.tilemap({ data: rows, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage('tiles', 'tiles', TILE, TILE, TILE_MARGIN, TILE_SPACING);
    this.groundLayer = map.createLayer(0, tiles, 0, 0).setDepth(0);

    /* --- Szegélyek (tiles.js): a szomszéd vidék anyaga hullámosan rálóg a
       csempére — külön, ritka csemperétegek, csak a látható cellák rajzolódnak */
    fringeLayers(world).forEach((data, i) => {
      const fm = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const ft = fm.addTilesetImage('tiles', 'tiles', TILE, TILE, TILE_MARGIN, TILE_SPACING);
      fm.createLayer(0, ft, 0, 0).setDepth(0.1 + i * 0.1);
    });

    /* --- Köd ---
       Egy csempe = egy képpont egy apró vásznon, amit lineáris szűréssel
       a térkép méretére nagyítunk: így a köd széle magától lágy, és
       frissíteni is csak 80×60 képpontot kell (nem egy csemperéteget). */
    this.fogBits = state.loadFog(world.w, world.h);
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = world.w;
    this.fogCanvas.height = world.h;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogData = this.fogCtx.createImageData(world.w, world.h);
    if (this.textures.exists('fog')) this.textures.remove('fog');
    this.fogTex = this.textures.addCanvas('fog', this.fogCanvas);
    this.fogImage = this.add.image(0, 0, 'fog').setOrigin(0).setDisplaySize(world.w * TILE, world.h * TILE).setDepth(1e6);
    this.#paintFog();

    this.pSeed = playerSeed(state.player);
    this.wandererPoi = world.pois.find((p) => p.type === 'wanderer') || null;

    /* --- Tárgyak és helyszínek --- */
    this.#placeDecor();
    this.#placePois();
    this.#placePlaces();
    this.#placeHerbs();
    this.#placeSheep();

    /* --- Játékos --- */
    const start = state.save.pos && !world.blocked[state.save.pos.y * world.w + state.save.pos.x]
      ? state.save.pos : world.start;
    this.player = this.add.container(start.x * TILE + TILE / 2, start.y * TILE + TILE - 6);
    this.playerShadow = this.add.image(0, 0, 'shadow').setDisplaySize(62, 20).setAlpha(0.8);
    this.player.add(this.playerShadow);
    await this.#buildAvatar();

    /* --- Kamera --- */
    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.w * TILE, world.h * TILE);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setRoundPixels(true);
    this.#fitZoom();
    this.scale.on('resize', () => this.#fitZoom());
    cam.fadeIn(600, 5, 7, 15);

    /* --- Bemenet --- */
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,E,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,SHIFT', false);
    kb.clearCaptures();            // a párbeszédablakok mezőibe lehessen gépelni
    kb.on('keydown', (e) => {
      if (hud.modalOpen) return;
      // A párbeszédet lezáró billentyű ne nyisson rögtön új ablakot
      if (performance.now() - (this.g.story?.dialogue.closedAt || 0) < 300) return;
      if (['e', 'E', ' ', 'Enter'].includes(e.key)) this.#interact();
    });
    this.input.on('pointerdown', (p) => {
      if (hud.modalOpen || p.button > 0) return;
      this.g.sfx.unlock();
      this.#clickTo(p.worldX, p.worldY);
    });

    /* --- Hangulat --- */
    this.#ambient();
    this.#questMarker();

    hud.initMinimap(world, (x, y) => this.#goTo(x, y));
    this.lastTile = null;
    this.path = null;
    this.pendingPoi = null;
    this.moveAnim = 0;
    this.soar = 0;                 // 0 = a földön, 1 = szárnyal (simítva)
    this.dustAt = 0;

    this.trainer = new Trainer(this.g, { onSpar: (count, level) => this.#enterSpar(count, level) });
    this.places = new Places(this.g, this.#placesHost());
    // Kóborló vad sárkányok: időnként újak bukkannak fel (legfeljebb öt)
    this.time.addEvent({ delay: 5000, loop: true, startAt: 3000, callback: () => { if (this.ready) this.#spawnRoamers(); } });
    const openBook = () => { if (!hud.modalOpen) { this.g.sfx.click(); this.g.story.openBook(); } };
    hud.el.book?.addEventListener('click', openBook);
    hud.el.quest?.addEventListener('click', openBook);

    this.events.on('wake', (_, result) => this.#onWake(result));
    this.ready = true;

    // Új játékosnak eligazítás, utána indul a saga; a visszatérő rögtön a sagát kapja
    if (!state.save.pos) this.time.delayedCall(700, () => this.#welcome());
    else this.time.delayedCall(500, () => this.g.story.start());
  }

  /* ================================================================== */
  /* Felépítés                                                           */
  /* ================================================================== */
  #fitZoom() {
    const { width, height } = this.scale;
    const z = Phaser.Math.Clamp(Math.min(width / 1100, height / 700) * 1.15, 0.8, 1.35);
    this.cameras.main.setZoom(z);
  }

  async #buildAvatar() {
    const lead = this.g.state.party[0];
    if (this.avatar) { this.avatar.destroy(); this.avatar = null; }
    if (!lead) return;
    const keys = await dragonTextures(this.g.gfx, lead, this.g.state.catalog, 160);
    const S = 92;
    this.avatar = makeDragonView(this, keys, S);
    // A konténer origója a talpnál legyen (a rajzon a láb ~58/64 magasságban)
    this.avatar.y = -0.4 * S;
    this.player.add(this.avatar);
    this.avatarParts = this.avatar.getData('parts');
    this.avatarS = S;
  }

  #placeDecor() {
    const { world } = this;
    // Hegycsúcsok a hegyvidék belsejében (egyetlen textúralapról: egy kötegben rajzolódnak)
    if (this.textures.exists('peaks')) {
      for (const pk of peakSpots(world)) {
        this.add.image(pk.x, pk.y, 'peaks', `${pk.kind}${pk.v}-${pk.k}`).setOrigin(0.5, 1).setScale(pk.scale).setDepth(pk.y);
      }
    }
    for (const t of world.trees) {
      const key = t.kind === 'pine' ? `pine${t.v}` : t.kind === 'pine-snow' ? `pine-snow${t.v}` : `${t.kind}${t.v}`;
      const x = t.x * TILE + TILE / 2 + ((t.x * 7 + t.y * 13) % 9) - 4;
      const y = t.y * TILE + TILE - 2;
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    }
    for (const b of world.boulders) {
      const y = b.y * TILE + TILE - 2;
      this.add.image(b.x * TILE + TILE / 2, y, `boulder${b.v}${b.snow ? 's' : ''}`).setOrigin(0.5, 1).setDepth(y);
    }
    // Apró díszek: bokrok, gombák, nád, kövek… (átjárhatók, de az y szerint takarnak)
    const occupied = world.occupied;
    for (const d of world.decor || []) {
      if (occupied[d.y * world.w + d.x] && !['tuft', 'pebbles'].includes(d.kind)) continue;   // azóta hely került ide
      const x = d.x * TILE + TILE / 2 + d.ox, y = d.y * TILE + TILE - 6 + d.oy;
      const flat = ['tuft', 'pebbles', 'vent', 'bones'].includes(d.kind);
      const img = this.add.image(x, y, `${d.kind}${d.v}`).setOrigin(0.5, 1).setDepth(flat ? 3 : y);
      if (d.kind === 'vent') {
        img.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: img, alpha: { from: 0.45, to: 1 }, duration: 900 + d.v * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (d.kind === 'reeds' || d.kind === 'fern') {
        this.tweens.add({ targets: img, angle: { from: -3, to: 3 }, duration: 1800 + d.v * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (d.x * 37) % 900 });
      }
    }
  }

  #placePois() {
    const { state } = this.g;
    this.poiViews = new Map();
    for (const p of this.world.pois) {
      const cx = p.x * TILE + TILE / 2;
      const bottom = p.y * TILE + TILE;
      const v = {};

      if (p.type === 'home') {
        v.sprite = this.add.image(cx, p.y * TILE + 4, 'longhouse').setOrigin(0.5, 1).setDepth(p.y * TILE);
        // Kéményfüst
        this.add.particles(cx + 6, p.y * TILE - 150, 'fx-smoke', {
          speedY: { min: -26, max: -14 }, speedX: { min: -6, max: 10 },
          scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.45, end: 0 },
          lifespan: 3200, frequency: 420,
        }).setDepth(p.y * TILE + 1);
        // A Völva az ajtó mellett; a botja kövén rúnafény pislákol
        const sx = cx + 46, sy = p.y * TILE + 2;
        v.seer = this.add.image(sx, sy, 'seer').setOrigin(0.5, 1).setDepth(sy);
        this.add.image(sx, sy, 'shadow').setDisplaySize(36, 10).setAlpha(0.6).setDepth(sy - 1);
        v.seerGlow = this.add.image(sx + 15, sy - 63, 'fx-dot').setTint(0x4fffe0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setDepth(sy + 1);
        this.tweens.add({ targets: v.seerGlow, alpha: { from: 0.35, to: 0.9 }, scale: { from: 1.1, to: 1.6 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: v.seer, scaleY: { from: 1, to: 1.02 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (p.type === 'trainer') {
        // A karám: cölöpkerítés, imbolygó szalmabábu, lobogó
        const base = bottom - 6;
        v.sprite = this.add.image(cx, base + 12, 'training').setOrigin(0.5, 1).setDepth(base - 30);
        v.dummy = this.add.image(cx + 6, base - 4, 'dummy').setOrigin(0.5, 1).setDepth(base - 4);
        this.tweens.add({ targets: v.dummy, angle: { from: -4, to: 4 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.rectangle(cx - 52, base - 46, 3, 74, 0x4a3322).setOrigin(0.5, 0.5).setDepth(base - 31);
        v.banner = this.add.image(cx - 50, base - 80, 'banner').setOrigin(0, 0).setDepth(base - 30);
        this.tweens.add({ targets: v.banner, scaleX: { from: 1, to: 0.84 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        v.sign = this.add.text(cx, base - 110, 'ᛏ Gyakorlótér', {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '16px', fontStyle: '700',
          color: '#ffd08a', stroke: '#0b0f1c', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(base + 10);
        this.#refreshTrainer(p, v);
      } else if (p.type === 'cave') {
        const cave = CAVES[p.tier];
        v.sprite = this.add.image(cx, p.y * TILE + 8, 'cave').setOrigin(0.5, 1).setDepth(p.y * TILE + 8);
        v.eyes = this.add.image(cx, p.y * TILE - 30, 'eyes').setTint(p.tier === 5 ? 0xffd36b : 0xff4d4d).setDepth(p.y * TILE + 9);
        this.tweens.add({ targets: v.eyes, alpha: { from: 0.15, to: 1 }, duration: 1600 + p.tier * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: p.tier * 300 });
        v.glow = this.add.image(cx, p.y * TILE - 26, 'fx-dot').setTint(cave.color).setScale(4).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y * TILE + 7);
        v.sign = this.add.text(cx, p.y * TILE - 128, `✦ ${ROMAN[p.tier]} ✦`, {
          fontFamily: 'Cinzel, Georgia, serif', fontSize: '20px', fontStyle: '700',
          color: '#ffe7c2', stroke: '#0b0f1c', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(p.y * TILE + 10);
        this.#refreshCave(p, v);
      } else if (p.type === 'nest') {
        v.sprite = this.add.image(cx, bottom - 4, 'nest').setOrigin(0.5, 1).setDepth(bottom - 4);
        v.egg = this.add.image(cx, bottom - 26, 'egg').setDepth(bottom - 3).setVisible(false);
        v.eggGlow = this.add.image(cx, bottom - 28, 'fx-dot').setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom - 3.5).setVisible(false);
        this.#refreshNest(p, v);
      } else if (p.type === 'stone') {
        v.glow = this.add.image(cx, bottom - 40, 'fx-dot').setTint(0x4fffe0).setScale(3).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom - 1);
        v.sprite = this.add.image(cx, bottom - 2, 'runestone').setOrigin(0.5, 1).setDepth(bottom - 2);
        this.tweens.add({ targets: v.glow, alpha: { from: 0.15, to: 0.45 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (state.save.stones[p.lore]) v.sprite.setTint(0xb8c4e0);
      }
      this.poiViews.set(p.id, v);
    }
  }

  #refreshCave(p, v = this.poiViews.get(p.id)) {
    const cleared = !!this.g.state.save.cleared[p.tier];
    v.eyes.setVisible(!cleared);
    v.sign.setColor(cleared ? '#9dffc9' : '#ffe7c2');
  }

  /* ------------------------------------------------------------------ */
  /* A völgy helyei (places.js): tanítók, emberek, ládák, kőkör, Vándor  */
  /* ------------------------------------------------------------------ */
  #placePlaces() {
    const { world } = this;
    const ADD = Phaser.BlendModes.ADD;
    const fire = (x, y, scale, depth) => this.add.particles(x, y, 'fx-dot', {
      x: { min: -6 * scale, max: 6 * scale }, speedY: { min: -70 * scale, max: -30 * scale }, speedX: { min: -8, max: 8 },
      lifespan: 620, scale: { start: 0.42 * scale, end: 0 }, tint: [0xfff3a0, 0xffb347, 0xff6a1f], blendMode: 'ADD', frequency: 45,
    }).setDepth(depth);
    const smoke = (x, y, depth) => this.add.particles(x, y, 'fx-smoke', {
      speedY: { min: -24, max: -12 }, speedX: { min: -4, max: 10 }, scale: { start: 0.3, end: 1.2 }, alpha: { start: 0.35, end: 0 },
      lifespan: 3000, frequency: 500,
    }).setDepth(depth);
    const label = (x, y, text, color) => this.add.text(x, y, text, {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '13px', fontStyle: '700', color, stroke: '#0b0f1c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9e5 - 10);

    for (const p of world.pois) {
      if (!['shrine', 'npc', 'ruins', 'chest', 'sign', 'wanderer'].includes(p.type)) continue;
      const cx = p.x * TILE + TILE / 2, base = p.y * TILE + TILE - 4;
      const v = {};
      const def = PLACES[p.place];
      switch (p.type) {
        case 'shrine': {
          v.sprite = this.add.image(cx, base + 6, def.sprite).setOrigin(0.5, 1).setDepth(base);
          const top = base + 6 - v.sprite.height;
          if (p.place === 'hermit') smoke(cx + 26, top + 14, base + 1);
          if (p.place === 'dwarf') {
            smoke(cx + 31, top + 6, base + 1);
            // Szikrák a kohóból
            this.add.particles(cx - 22, base - 22, 'fx-dot', {
              speed: { min: 30, max: 90 }, angle: { min: 220, max: 320 }, gravityY: 120, lifespan: 700,
              scale: { start: 0.16, end: 0 }, tint: [0xffd36b, 0xff8a3d], blendMode: 'ADD', frequency: 260, quantity: 3,
            }).setDepth(base + 1);
          }
          if (p.place === 'muspell') {
            v.fire = fire(cx, top + 24, 1.6, base + 1);
            v.glow = this.add.image(cx, top + 24, 'fx-dot').setTint(0xff6a1f).setBlendMode(ADD).setScale(3).setAlpha(0.4).setDepth(base - 1);
            this.tweens.add({ targets: v.glow, alpha: { from: 0.25, to: 0.55 }, duration: 180, yoyo: true, repeat: -1 });
          }
          if (p.place === 'frost') {
            this.add.particles(cx, base - 50, 'fx-star', {
              x: { min: -50, max: 50 }, y: { min: -60, max: 30 }, lifespan: 1200, scale: { start: 0, end: 0.45, ease: 'Sine.easeInOut' },
              alpha: { start: 1, end: 0 }, tint: [0xe8fffb, 0x9fe8ff], blendMode: 'ADD', frequency: 160,
            }).setDepth(base + 1);
          }
          if (p.place === 'valkyrie') {
            v.glow = this.add.image(cx, base - 60, 'fx-dot').setTint(0xfff3c4).setBlendMode(ADD).setScale(5).setAlpha(0.25).setDepth(base - 1);
            this.tweens.add({ targets: v.glow, alpha: { from: 0.12, to: 0.4 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
          v.label = label(cx, top - 8, def.name, def.color);
          break;
        }
        case 'npc': {
          if (p.place === 'fisher') {
            // A stég a halász melletti víz fölé nyúlik
            const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => world.biome[(p.y + dy) * world.w + p.x + dx] === B.WATER) || [1, 0];
            v.pier = this.add.image(cx + side[0] * 62, base - 4 + side[1] * 40, 'pier').setOrigin(0.5, 1).setDepth(base - 30).setFlipX(side[0] < 0);
          }
          if (p.place === 'merchant') {
            // A drakkar a part előtti vízen ringatózik
            let best = null;
            for (let r = 1; r <= 6 && !best; r++) {
              for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
                const x = p.x + dx, y = p.y + dy;
                if (x > 2 && y > 2 && x < world.w - 3 && y < world.h - 3 && world.biome[y * world.w + x] === B.WATER
                  && world.biome[(y + 1) * world.w + x] === B.WATER) { best = [x, y]; break; }
              }
            }
            if (best) {
              v.ship = this.add.image(best[0] * TILE + TILE / 2, best[1] * TILE + TILE + 30, 'drakkar').setOrigin(0.5, 1)
                .setDepth(best[1] * TILE + TILE).setScale(0.85).setFlipX(best[0] < p.x);
              this.tweens.add({ targets: v.ship, y: v.ship.y - 4, angle: { from: -1.2, to: 1.2 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
          }
          if (p.place === 'skald') {
            v.camp = this.add.image(cx + 40, base + 2, 'campfire').setOrigin(0.5, 1).setDepth(base);
            v.fire = fire(cx + 40, base - 16, 1, base + 1);
            v.glow = this.add.image(cx + 40, base - 14, 'fx-dot').setTint(0xffa040).setBlendMode(ADD).setScale(4).setAlpha(0.3).setDepth(base - 2);
            this.tweens.add({ targets: v.glow, alpha: { from: 0.2, to: 0.4 }, scale: { from: 3.6, to: 4.4 }, duration: 160, yoyo: true, repeat: -1 });
          }
          v.sprite = this.add.image(cx, base, def.sprite).setOrigin(0.5, 1).setDepth(base);
          this.tweens.add({ targets: v.sprite, scaleY: { from: 1, to: 1.03 }, duration: 1500 + p.x * 7, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          v.label = label(cx, base - v.sprite.height - 10, def.name, def.color);
          break;
        }
        case 'ruins': {
          // Hat menhir körben, középen a láda
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * 96, y = base + Math.sin(a) * 60;
            this.add.image(x, y, `menhir${i % 3}`).setOrigin(0.5, 1).setDepth(y);
          }
          v.sprite = this.add.image(cx, base, this.g.state.save.places.ruins?.done ? 'chest-open' : 'chest').setOrigin(0.5, 1).setDepth(base);
          v.glow = this.add.image(cx, base - 20, 'fx-dot').setTint(0xb8c4e0).setBlendMode(ADD).setScale(3).setAlpha(0.3).setDepth(base - 1);
          this.tweens.add({ targets: v.glow, alpha: { from: 0.15, to: 0.45 }, duration: 2000, yoyo: true, repeat: -1 });
          v.label = label(cx, base - 140, def.name, def.color);
          break;
        }
        case 'chest': {
          const open = !!this.g.state.save.places[p.id]?.open;
          v.sprite = this.add.image(cx, base, open ? 'chest-open' : 'chest').setOrigin(0.5, 1).setDepth(base);
          if (!open) {
            v.glow = this.add.image(cx, base - 16, 'fx-star').setTint(0xffd36b).setBlendMode(ADD).setDepth(base + 1).setScale(0.6);
            this.tweens.add({ targets: v.glow, alpha: { from: 0, to: 1 }, scale: { from: 0.3, to: 0.8 }, angle: 90, duration: 900, yoyo: true, repeat: -1, repeatDelay: 1400 });
          }
          break;
        }
        case 'sign':
          v.sprite = this.add.image(cx, base, 'sign').setOrigin(0.5, 1).setDepth(base);
          break;
        case 'wanderer': {
          const i = wandererIndex(p, this.g.state.now, this.pSeed);
          p.x = p.spots[i].x; p.y = p.spots[i].y;
          p.spot = i;
          const wx = p.x * TILE + TILE / 2, wy = p.y * TILE + TILE - 4;
          v.sprite = this.add.image(wx, wy, 'npc-wanderer').setOrigin(0.5, 1).setDepth(wy);
          v.ravens = [0, 1].map(() => this.add.image(wx, wy - 80, 'raven0').setScale(0.5).setDepth(wy + 1));
          v.t = Math.random() * 10;
          v.label = label(wx, wy - 86, 'Egy öreg vándor', '#c9f0ff');
          break;
        }
      }
      this.poiViews.set(p.id, v);
    }
  }

  /** A Vándor 8 percenként máshová áll; a hollói köröznek a feje fölött. */
  #updateWanderer(time) {
    const p = this.wandererPoi;
    const v = p && this.poiViews.get(p.id);
    if (!v) return;
    v.t += 0.016;
    v.ravens.forEach((r, i) => {
      const a = time / 900 + i * Math.PI;
      r.setPosition(v.sprite.x + Math.cos(a) * 34, v.sprite.y - 84 + Math.sin(a) * 10).setRotation(a + Math.PI);
      r.setTexture(Math.sin(time / 120 + i) > 0 ? 'raven0' : 'raven1');
    });
    if (time < (this.wanderCheck || 0)) return;
    this.wanderCheck = time + 3000;
    const i = (wandererIndex(p, this.g.state.now, this.pSeed) + (p.shift || 0)) % p.spots.length;
    if (i !== p.spot && this.nearPoi !== p) this.#moveWanderer(p, i);
  }

  #moveWanderer(p, i) {
    const v = this.poiViews.get(p.id);
    p.spot = i;
    p.x = p.spots[i].x; p.y = p.spots[i].y;
    const wx = p.x * TILE + TILE / 2, wy = p.y * TILE + TILE - 4;
    // Ködbe vész, máshol bukkan elő
    const puff = (x, y) => {
      const e = this.add.particles(x, y - 30, 'fx-smoke', { speed: { min: 20, max: 70 }, lifespan: 900, scale: { start: 0.4, end: 1.2 }, alpha: { start: 0.6, end: 0 }, emitting: false }).setDepth(9e5);
      e.explode(14);
      this.time.delayedCall(1000, () => e.destroy());
    };
    puff(v.sprite.x, v.sprite.y);
    v.sprite.setPosition(wx, wy).setDepth(wy);
    v.label.setPosition(wx, wy - 86);
    puff(wx, wy);
  }

  /** Birkák a hosszúház körül: lassan legelésznek, néha felnéznek. */
  #placeSheep() {
    const home = this.world.pois[0];
    this.sheep = [];
    for (let i = 0; i < 5; i++) {
      const x = (home.x + 5 + Math.random() * 5) * TILE, y = (home.y + 2 + Math.random() * 3) * TILE;
      const s = this.add.image(x, y, 'sheep0').setOrigin(0.5, 1).setDepth(y);
      s.setData({ tx: x, ty: y, wait: Math.random() * 3000, home: [x, y] });
      this.sheep.push(s);
    }
  }

  #updateSheep(dt) {
    for (const s of this.sheep || []) {
      const wait = s.getData('wait') - dt * 1000;
      s.setData('wait', wait);
      const tx = s.getData('tx'), ty = s.getData('ty');
      const d = Math.hypot(tx - s.x, ty - s.y);
      if (d > 2) {
        s.x += ((tx - s.x) / d) * 22 * dt; s.y += ((ty - s.y) / d) * 22 * dt;
        s.setFlipX(tx > s.x).setDepth(s.y).setTexture('sheep0');
      } else if (wait <= 0) {
        const [hx, hy] = s.getData('home');
        const nx = hx + (Math.random() - 0.5) * 140, ny = hy + (Math.random() - 0.5) * 80;
        if (!this.world.blocked[Math.floor(ny / TILE) * this.world.w + Math.floor(nx / TILE)]) s.setData({ tx: nx, ty: ny });
        s.setData('wait', 2500 + Math.random() * 5000);
      } else {
        s.setTexture(Math.sin(wait / 400) > 0.6 ? 'sheep1' : 'sheep0');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Kóborló vad sárkányok                                               */
  /* ------------------------------------------------------------------ */
  /** A vidék dönti el, milyen erős a kóborló — de sosem erősebb, mint ahová a játékos már eljutott. */
  #roamTier(x, y) {
    const i = y * this.world.w + x;
    const home = this.world.pois[0];
    const d = Math.hypot(x - home.x, y - home.y);
    let t = this.world.ashy[i] ? 4 : this.world.snowy[i] ? 3 : d < 22 ? 1 : d < 30 ? 2 : 3;
    const maxCleared = Math.max(0, ...Object.keys(this.g.state.save.cleared).filter((k) => this.g.state.save.cleared[k]).map(Number));
    return Math.max(1, Math.min(t, maxCleared + 1, 4));
  }

  async #spawnRoamers() {
    if (!this.g.story || this.g.story.s.q < 1) return;        // a prológusban még nem bántja senki
    this.roamers ||= [];
    const spots = this.world.roamSpots || [];
    while (this.roamers.length < 5 && spots.length) {
      const c = spots[Math.floor(Math.random() * spots.length)];
      if (this.roamers.some((r) => Math.hypot(r.tx - c.x, r.ty - c.y) < 8)) { if (Math.random() < 0.7) continue; }
      const px = Math.floor(this.player.x / TILE), py = Math.floor(this.player.y / TILE);
      if (Math.hypot(px - c.x, py - c.y) < 9) break;
      const tier = this.#roamTier(c.x, c.y);
      const d = makeRoamer(tier, this.g.state.tiers);
      const keys = await dragonTextures(this.g.gfx, d, this.g.state.catalog, 128);
      if (!this.scene.isActive() && !this.scene.isSleeping()) return;
      const view = makeDragonView(this, keys, 76);
      const cont = this.add.container(c.x * TILE + TILE / 2, c.y * TILE + TILE - 6);
      const shadow = this.add.image(0, 0, 'shadow').setDisplaySize(54, 16).setAlpha(0.7);
      view.y = -0.4 * 76;
      cont.add([shadow, view]);
      const parts = view.getData('parts');
      const tag = this.add.text(0, -86, `${d.nev} · ${tier}. fok`, {
        fontFamily: 'Cinzel, Georgia, serif', fontSize: '11px', fontStyle: '700', color: '#ffc2c2', stroke: '#0b0f1c', strokeThickness: 4,
      }).setOrigin(0.5);
      const alert = this.add.text(0, -104, '!', { fontFamily: 'Cinzel, serif', fontSize: '22px', fontStyle: '900', color: '#ff5d6c', stroke: '#0b0f1c', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
      cont.add([tag, alert]);
      this.roamers.push({ d, tier, cont, view, parts, alert, tx: c.x, ty: c.y, home: [c.x, c.y], goal: null, wait: 1000, calm: 0 });
    }
  }

  #updateRoamers(time, dt) {
    if (!this.roamers?.length) return;
    const { hud } = this.g;
    for (const r of this.roamers) {
      const c = r.cont;
      const dx = this.player.x - c.x, dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);
      const aggro = dist < TILE * 4.2 && time > r.calm && !hud.modalOpen && this.ready;
      r.alert.setVisible(aggro);
      let vx = 0, vy = 0, sp = 0;
      if (aggro) {
        vx = dx / dist; vy = dy / dist; sp = 120;
        if (dist < 34) { this.#enterRoam(r); return; }
      } else {
        r.wait -= dt * 1000;
        if (!r.goal && r.wait <= 0) {
          const gx = r.home[0] + Math.round((Math.random() - 0.5) * 8), gy = r.home[1] + Math.round((Math.random() - 0.5) * 6);
          if (gx > 2 && gy > 2 && gx < this.world.w - 3 && gy < this.world.h - 3 && !this.world.blocked[gy * this.world.w + gx]) r.goal = [gx * TILE + TILE / 2, gy * TILE + TILE - 6];
          r.wait = 2000 + Math.random() * 3000;
        }
        if (r.goal) {
          const gx = r.goal[0] - c.x, gy = r.goal[1] - c.y, gd = Math.hypot(gx, gy);
          if (gd < 4) r.goal = null; else { vx = gx / gd; vy = gy / gd; sp = 46; }
        }
      }
      if (sp) {
        const nx = c.x + vx * sp * dt, ny = c.y + vy * sp * dt;
        if (!this.#blockedAt(nx, ny) && !this.#blockedAt(nx, ny - 8)) { c.x = nx; c.y = ny; } else r.goal = null;
        if (Math.abs(vx) > 0.2) r.parts.inner.scaleX = vx > 0 ? -1 : 1;
      }
      c.setDepth(c.y);
      const t = time / 1000 + r.home[0];
      if (r.parts.wings) r.parts.wings.rotation = Math.sin(t * (sp ? 12 : 2.4)) * (sp ? 0.25 : 0.07);
      r.view.y = -0.4 * 76 + (sp ? -Math.abs(Math.sin(t * 7)) * 4 : Math.sin(t * 2) * 1.2);
    }
  }

  #enterRoam(r) {
    const { sfx, hud, state } = this.g;
    if (!this.ready) return;
    if (!state.party.some((d) => state.hpOf(d) > 0)) {
      r.calm = this.time.now + 6000;
      hud.toast('A vad sárkány megszagolja a kimerült csapatodat, és odébbáll. Pihenj a hosszúházban!', 'warn', 4000);
      return;
    }
    this.ready = false;
    this.path = null;
    this.pendingRoam = r;
    sfx.roar();
    hud.prompt(null);
    hud.compass(null);
    const cam = this.cameras.main;
    cam.shake(300, 0.01);
    cam.flash(200, 255, 255, 255);
    const i = Math.floor(r.cont.y / TILE) * this.world.w + Math.floor(r.cont.x / TILE);
    const field = this.world.ashy[i] ? 'ash' : this.world.snowy[i] ? 'snow' : this.world.biome[i] === B.SAND ? 'shore' : (this.world.treeAt?.[i] || r.tier >= 3) ? 'forest' : 'meadow';
    cam.zoomTo(cam.zoom * 1.4, 500, 'Cubic.easeIn');
    cam.fadeOut(600, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.sleep();
      this.scene.launch('battle', {
        g: this.g, mode: 'roam', tier: r.tier, foes: [r.d], field, roamId: r.d.id,
        title: 'Vad sárkány!', sub: `${r.d.nev} — ${r.tier}. fokú vadon`,
      });
    });
  }

  #enterGuardian(id) {
    const { sfx, hud, state } = this.g;
    const up = state.party.filter((d) => state.hpOf(d) > 0);
    if (!up.length) { hud.toast('A csapatod kimerült — pihenj a hosszúházban, mielőtt próbára teszed magad.', 'warn'); return; }
    const lvl = Math.round(up.reduce((s, d) => s + levelOf(d.xp), 0) / up.length);
    this.ready = false;
    sfx.drum();
    hud.prompt(null);
    hud.compass(null);
    const cam = this.cameras.main;
    cam.flash(300, 255, 120, 40);
    cam.zoomTo(cam.zoom * 1.5, 800, 'Cubic.easeIn');
    cam.fadeOut(800, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.sleep();
      this.scene.launch('battle', {
        g: this.g, mode: 'guardian', tier: 4, foes: makeGuardian(id, lvl, state.tiers), field: 'ash', placeId: id,
        title: 'Muspell próbája', sub: 'a láng őre',
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* A helyek kiszolgálása (places.js hívja)                             */
  /* ------------------------------------------------------------------ */
  #placesHost() {
    const dirName = (dx, dy) => {
      const names = ['kelet', 'délkelet', 'dél', 'délnyugat', 'nyugat', 'északnyugat', 'észak', 'északkelet'];
      const a = Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      return names[a];
    };
    return {
      teach: (keys, p) => this.trainer.teachAt(keys, p),
      guardian: (id) => this.#enterGuardian(id),
      refresh: (p) => this.#refreshPlace(p),
      fogAt: (x, y) => !!this.fogBits[y * this.world.w + x],
      burst: (p, color) => this.#placeBurst(p, color),
      openChest: (p) => {
        const v = this.poiViews.get(p.id);
        v?.sprite.setTexture('chest-open');
        if (v?.glow) { this.tweens.killTweensOf(v.glow); v.glow.destroy(); v.glow = null; }
        this.#placeBurst(p, 0xffd36b);
      },
      moveWanderer: (p) => {
        p.shift = (p.shift || 0) + 1 + Math.floor(Math.random() * (p.spots.length - 1));
        this.#moveWanderer(p, (wandererIndex(p, this.g.state.now, this.pSeed) + p.shift) % p.spots.length);
      },
      // Egy még fel nem fedezett hely környéke kirajzolódik (halász, kalmár)
      hintPlace: () => {
        const hidden = this.world.pois.filter((q) => ['shrine', 'ruins', 'npc'].includes(q.type) && !this.fogBits[q.y * this.world.w + q.x]);
        if (!hidden.length) return null;
        const q = hidden[Math.floor(Math.random() * hidden.length)];
        const [tx, ty] = this.#tileOf();
        this.#reveal(q.x, q.y, 4);
        this.g.hud.drawMinimap(this.fogBits, tx, ty, this.world.pois, this.g.state.save.cleared, this.g.story?.target);
        return { name: q.name, dir: dirName(q.x - tx, q.y - ty) };
      },
    };
  }

  #refreshPlace(p) {
    const v = this.poiViews.get(p.id);
    if (!v) return;
    if (p.type === 'ruins' && this.g.state.save.places.ruins?.done) v.sprite.setTexture('chest-open');
  }

  #placeBurst(p, color) {
    if (!p) return;
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE - 30;
    const e = this.add.particles(x, y, 'fx-dot', {
      speed: { min: 60, max: 240 }, lifespan: 900, scale: { start: 0.5, end: 0 },
      tint: [color, 0xffffff], blendMode: 'ADD', emitting: false,
    }).setDepth(9e5);
    e.explode(40);
    const ring = this.add.image(x, y, 'fx-ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setDepth(9e5);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.time.delayedCall(1100, () => e.destroy());
  }

  /** Amíg Ragnhild nem érkezett meg, a karám üres: nincs lobogó. */
  #refreshTrainer(p = this.world.pois.find((x) => x.type === 'trainer'), v = this.poiViews?.get(p.id)) {
    if (!v) return;
    const open = !!this.g.story?.trainerOpen;
    v.banner.setVisible(open);
    v.sign.setColor(open ? '#ffd08a' : '#8a96b8').setText(open ? 'ᛏ Gyakorlótér' : 'ᛏ Gyakorlótér (üres)');
  }

  #refreshNest(p, v = this.poiViews.get(p.id)) {
    const egg = this.g.state.eggs.find((e) => e.nest === p.nest);
    v.egg.setVisible(!!egg);
    v.eggGlow.setVisible(!!egg);
    this.tweens.killTweensOf(v.egg);
    if (!egg) return;
    v.egg.setTint(parseInt(egg.szin.slice(1), 16)).setAngle(0);
    const ready = egg.ready <= this.g.state.now;
    v.eggGlow.setTint(ready ? 0xffe08a : parseInt(egg.szin.slice(1), 16)).setAlpha(ready ? 0.7 : 0.3);
    // Kész tojás: rázkódik, mintha kopogna belülről
    this.tweens.add(ready
      ? { targets: v.egg, angle: { from: -9, to: 9 }, duration: 110, yoyo: true, repeat: -1, repeatDelay: 900 }
      : { targets: v.egg, y: v.egg.y - 2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  #placeHerbs() {
    const { state } = this.g;
    this.herbViews = new Map();
    const now = state.now;
    for (const h of this.world.herbs) {
      const taken = state.save.herbsTaken[h.key];
      if (taken && now - taken < HERB_RESPAWN) continue;
      const img = this.add.image(h.x * TILE + TILE / 2, h.y * TILE + TILE / 2, 'herb').setDepth(h.y * TILE + TILE / 2);
      this.tweens.add({ targets: img, y: img.y - 4, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (h.x * 97) % 1000 });
      this.herbViews.set(h.key, img);
    }
  }

  #ambient() {
    const cam = this.cameras.main;
    const zone = (padY = 0) => ({
      getRandomPoint: (pt) => {
        const v = cam.worldView;
        pt.x = v.x + Math.random() * v.width;
        pt.y = v.y - padY + Math.random() * (padY ? 20 : v.height);
        return pt;
      },
    });
    // Szentjánosbogarak (a zöld vidéken)
    this.fireflies = this.add.particles(0, 0, 'fx-dot', {
      emitZone: { type: 'random', source: zone() },
      lifespan: { min: 2600, max: 4600 }, speed: { min: 4, max: 16 },
      scale: { start: 0.22, end: 0.05 }, alpha: { start: 0.9, end: 0 },
      tint: [0xd8ff8a, 0xfff3a0, 0x9dffc9], blendMode: 'ADD',
      frequency: 260, maxAliveParticles: 24,
    }).setDepth(9e5);
    // Hóesés északon
    this.snowfall = this.add.particles(0, 0, 'fx-dot', {
      emitZone: { type: 'random', source: zone(40) },
      lifespan: 5200, speedY: { min: 30, max: 60 }, speedX: { min: -18, max: 10 },
      scale: { min: 0.08, max: 0.2 }, alpha: { start: 0.9, end: 0.2 },
      frequency: 90, maxAliveParticles: 45, emitting: false,
    }).setDepth(9e5);
    // Parázs a hamuveremben
    this.embers = this.add.particles(0, 0, 'fx-dot', {
      emitZone: { type: 'random', source: zone() },
      lifespan: 2600, speedY: { min: -40, max: -16 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.18, end: 0.02 }, alpha: { start: 1, end: 0 },
      tint: [0xff8a3d, 0xffc46b, 0xff5a2a], blendMode: 'ADD',
      frequency: 140, maxAliveParticles: 30, emitting: false,
    }).setDepth(9e5);

    // Csillanó víz: a látott terület vízcsempéin villan fel egy-egy fénypont
    const { world } = this;
    const waterZone = {
      getRandomPoint: (pt) => {
        const v = cam.worldView;
        for (let i = 0; i < 6; i++) {
          const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
          const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
          if (tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && world.biome[ty * world.w + tx] === B.WATER) { pt.x = x; pt.y = y; return pt; }
        }
        pt.x = -9999; pt.y = -9999;
        return pt;
      },
    };
    this.add.particles(0, 0, 'fx-star', {
      emitZone: { type: 'random', source: waterZone },
      lifespan: 900, scale: { start: 0, end: 0.5, ease: 'Sine.easeInOut' }, alpha: { start: 1, end: 0 },
      tint: [0xcfefff, 0xffffff], blendMode: 'ADD', frequency: 90, maxAliveParticles: 18,
    }).setDepth(2);

    // Felhőárnyékok: nagy, lágy foltok vonulnak át a völgyön (a köd alatt, a fák fölött)
    const W = world.w * TILE, H = world.h * TILE;
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = this.add.image(Math.random() * W, Math.random() * H, 'fx-cloud')
        .setScale(2.4 + Math.random() * 1.8).setAlpha(0.22 + Math.random() * 0.12).setDepth(8e5);
      c.setData('v', 10 + Math.random() * 12);
      this.clouds.push(c);
    }

    // Hollók: néha egy kis csapat húz át a kamera előtt
    this.time.addEvent({ delay: 16000, loop: true, startAt: 9000, callback: () => this.#ravens() });
  }

  /** Két-három holló átrepül a látott területen, és árnyékot vet. */
  #ravens() {
    if (!this.ready || this.g.hud.modalOpen) return;
    const v = this.cameras.main.worldView;
    const fromLeft = Math.random() < 0.5;
    const y0 = v.y + v.height * (0.2 + Math.random() * 0.5);
    const x0 = fromLeft ? v.x - 80 : v.right + 80, x1 = fromLeft ? v.right + 120 : v.x - 120;
    const y1 = y0 + (Math.random() - 0.5) * v.height * 0.5;
    const ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const ox = (i - n / 2) * 46, oy = i * 34 * (i % 2 ? 1 : -1);
      const bird = this.add.sprite(x0 + ox, y0 + oy, 'raven0').setRotation(ang).setScale(0.8 + Math.random() * 0.3).setDepth(9.5e5);
      const shadow = this.add.image(bird.x + 40, bird.y + 70, 'raven0').setRotation(ang).setTint(0x000000).setAlpha(0.18).setScale(bird.scale * 0.9).setDepth(8e5 + 1);
      let frame = 0;
      const flap = this.time.addEvent({ delay: 150 + i * 20, loop: true, callback: () => { frame ^= 1; bird.setTexture(`raven${frame}`); shadow.setTexture(`raven${frame}`); } });
      const dur = 7000 + Math.random() * 2000;
      this.tweens.add({
        targets: bird, x: x1 + ox, y: y1 + oy, duration: dur,
        onUpdate: () => shadow.setPosition(bird.x + 40, bird.y + 70),
        onComplete: () => { flap.remove(); bird.destroy(); shadow.destroy(); },
      });
    }
    if (Math.random() < 0.5) this.time.delayedCall(1800, () => this.g.sfx.caw());
  }

  /* ================================================================== */
  /* A saga jele és iránytűje                                            */
  /* ================================================================== */
  #questMarker() {
    this.qMark = this.add.image(0, 0, 'fx-quest').setOrigin(0.5, 1).setDepth(9.6e5).setVisible(false);
    this.qGlow = this.add.image(0, 0, 'fx-dot').setTint(0xffb347).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0.5).setDepth(9.6e5 - 1).setVisible(false);
    this.tweens.add({ targets: this.qGlow, alpha: { from: 0.25, to: 0.7 }, scale: { from: 1.8, to: 2.6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.qTarget = null;
  }

  /** A jel a célpont fölé kerül: mennyire magasra, az a helyszín rajzától függ. */
  #questPos(p) {
    const cx = p.x * TILE + TILE / 2;
    const top = { home: 175, cave: 135, trainer: 135, nest: 60, stone: 95 }[p.type] || 80;
    return { x: cx, y: p.y * TILE + (p.type === 'cave' ? 0 : TILE) - top };
  }

  #updateQuest(time) {
    const id = this.g.story?.target;
    const p = id ? this.world.pois.find((x) => x.id === id) : null;
    const { hud } = this.g;
    this.qMark.setVisible(!!p);
    this.qGlow.setVisible(!!p);
    if (!p) { hud.compass(null); return; }
    const pos = this.#questPos(p);
    const bob = Math.sin(time / 260) * 7;
    this.qMark.setPosition(pos.x, pos.y + bob).setScale(1 + Math.sin(time / 260) * 0.04, 1);
    this.qGlow.setPosition(pos.x, pos.y - 24 + bob);

    // Iránytű, ha a cél nincs a képernyőn
    const cam = this.cameras.main;
    const v = cam.worldView;
    const tx = pos.x, ty = pos.y + 30;
    if (v.contains(tx, ty) || hud.modalOpen) { hud.compass(null); return; }
    const { width: w, height: h } = this.scale;
    const sx = (tx - v.x) * cam.zoom, sy = (ty - v.y) * cam.zoom;
    const ang = Math.atan2(sy - h / 2, sx - w / 2);
    const m = 46;
    // A képernyő szélére vetítve, a kistérképet és a csapatot elkerülve
    const k = Math.min((w / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (h / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
    hud.compass({ x: w / 2 + Math.cos(ang) * k, y: h / 2 + Math.sin(ang) * k, angle: ang });
  }

  /* ================================================================== */
  /* Köd                                                                 */
  /* ================================================================== */
  #paintFog() {
    const d = this.fogData.data;
    for (let i = 0; i < this.fogBits.length; i++) {
      d[i * 4] = 5; d[i * 4 + 1] = 7; d[i * 4 + 2] = 15;
      d[i * 4 + 3] = this.fogBits[i] ? 0 : 245;
    }
    this.fogCtx.putImageData(this.fogData, 0, 0);
    this.fogTex.refresh();
  }
  #reveal(tx, ty, R = REVEAL) {
    const { w, h } = this.world;
    let changed = false;
    for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if ((x - tx) ** 2 + (y - ty) ** 2 > R * R + 1) continue;
      if (!this.fogBits[y * w + x]) { this.fogBits[y * w + x] = 1; changed = true; }
    }
    if (!changed) return;
    this.#paintFog();
    this.g.state.storeFog(this.fogBits);
  }

  /* ================================================================== */
  /* Mozgás                                                              */
  /* ================================================================== */
  #blockedAt(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) return true;
    return !!this.world.blocked[y * this.world.w + x];
  }
  /** A talp körüli kis doboz ütközik-e. */
  #collides(x, y) {
    const hw = 11, hh = 7;
    return this.#blockedAt(x - hw, y - hh) || this.#blockedAt(x + hw, y - hh)
        || this.#blockedAt(x - hw, y) || this.#blockedAt(x + hw, y);
  }

  #tileOf() { return [Math.floor(this.player.x / TILE), Math.floor((this.player.y - 4) / TILE)]; }

  #clickTo(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    // Helyszínre kattintott? Odamegy, és megérkezve interakció
    const poi = this.world.pois.find((p) => {
      const dx = tx - p.x, dy = ty - p.y;
      if (p.type === 'home') return Math.abs(dx) <= 2 && dy >= -4 && dy <= 0;
      if (p.type === 'trainer') return Math.abs(dx) <= 2 && dy >= -2 && dy <= 0;
      if (p.type === 'ruins') return Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
      if (['shrine', 'npc'].includes(p.type)) return Math.abs(dx) <= 1 && dy >= -2 && dy <= 0;
      return Math.abs(dx) <= 1 && dy >= (p.type === 'cave' ? -3 : -1) && dy <= 0;
    });
    if (poi) { this.pendingPoi = poi; this.#goTo(poi.x, poi.y + (poi.type === 'cave' ? 0 : 1)); return; }
    this.pendingPoi = null;
    this.#goTo(tx, ty);
  }

  #goTo(tx, ty) {
    const { world } = this;
    const walk = (x, y) => (world.blocked[y * world.w + x] ? Infinity : 1);
    // Járhatatlan célnál a legközelebbi járható szomszéd
    if (!(tx >= 0 && ty >= 0 && tx < world.w && ty < world.h) || world.blocked[ty * world.w + tx]) {
      let best = null;
      for (let r = 1; r <= 3 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x >= 0 && y >= 0 && x < world.w && y < world.h && !world.blocked[y * world.w + x]) { best = best || [x, y]; }
      }
      if (!best) return;
      [tx, ty] = best;
    }
    const [sx, sy] = this.#tileOf();
    const path = findPath(world.w, world.h, sx, sy, tx, ty, walk, true, 12000);
    if (!path) { this.g.hud.toast('Oda nem vezet út.', 'warn'); return; }
    this.path = path.map(([x, y]) => [x * TILE + TILE / 2, y * TILE + TILE - 8]);
    // Célzó jel a talajon
    const mark = this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'fx-ring').setScale(0.35).setTint(0xffd08a).setAlpha(0.9).setDepth(2);
    this.tweens.add({ targets: mark, scale: 0.15, alpha: 0, duration: 500, onComplete: () => mark.destroy() });
  }

  update(time, delta) {
    if (!this.ready || !this.avatar) return;
    const { hud, state } = this.g;
    const dt = Math.min(delta, 50) / 1000;

    let vx = 0, vy = 0;
    if (!hud.modalOpen) {
      const k = this.keys;
      if (k.A.isDown || k.LEFT.isDown)  vx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown)    vy -= 1;
      if (k.S.isDown || k.DOWN.isDown)  vy += 1;
      if (vx || vy) { this.path = null; this.pendingPoi = null; }
    }

    // Útvonal követése
    if (!vx && !vy && this.path?.length && !hud.modalOpen) {
      const [nx, ny] = this.path[0];
      const dx = nx - this.player.x, dy = ny - this.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 5) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          if (this.pendingPoi) { const p = this.pendingPoi; this.pendingPoi = null; this.#interact(p); }
        }
      } else { vx = dx / d; vy = dy / d; }
    }

    const moving = !!(vx || vy);
    // Szárnyalás: Shift, vagy hosszú kattintott útvonalon magától
    const soaring = moving && !hud.modalOpen && (this.keys.SHIFT.isDown || (this.path?.length || 0) > 14);
    this.soar += ((soaring ? 1 : 0) - this.soar) * Math.min(1, dt * 6);
    if (moving) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      const sp = SPEED * (1 + (SOAR - 1) * this.soar);
      const nx = this.player.x + vx * sp * dt;
      const ny = this.player.y + vy * sp * dt;
      if (!this.#collides(nx, this.player.y)) this.player.x = nx;
      if (!this.#collides(this.player.x, ny)) this.player.y = ny;
      // A rajz balra néz: jobbra haladva tükrözzük
      if (Math.abs(vx) > 0.2) this.avatarParts.inner.scaleX = vx > 0 ? -1 : 1;
      // Porfelhő a lába nyomán (földön), szélcsík a szárnya mögött (repülve)
      if (time > this.dustAt) {
        this.dustAt = time + (this.soar > 0.5 ? 70 : 140);
        this.#footstep(vx, vy);
      }
    }
    this.player.setDepth(this.player.y);
    this.#animateAvatar(time, moving);

    // Felhőárnyékok vándorlása
    const W = this.world.w * TILE;
    for (const c of this.clouds) {
      c.x += c.getData('v') * dt;
      if (c.x - c.displayWidth / 2 > W) c.x = -c.displayWidth / 2;
    }
    this.#updateQuest(time);
    this.#updateSheep(dt);
    this.#updateWanderer(time);
    this.#updateRoamers(time, dt);

    // Új csempére lépett?
    const [tx, ty] = this.#tileOf();
    const key = tx + ty * 1000;
    if (key !== this.lastTile) {
      this.lastTile = key;
      this.#reveal(tx, ty);
      state.save.pos = { x: tx, y: ty };
      state.dirty = true;
      this.#checkHerb(tx, ty);
      this.#updateArea(tx, ty);
      hud.drawMinimap(this.fogBits, tx, ty, this.world.pois, state.save.cleared, this.g.story?.target);
    }
    this.#updatePrompt(tx, ty);
  }

  #animateAvatar(time, moving) {
    const p = this.avatarParts;
    const t = time / 1000;
    const s = this.soar;
    // Szárnyalva nagyobb, gyorsabb szárnycsapások; a sárkány felemelkedik
    const flap = moving ? Math.sin(t * (14 + s * 6)) * (0.28 + s * 0.22) : Math.sin(t * 2.4) * 0.07;
    if (p.wings) p.wings.rotation = flap;
    if (p.head) p.head.rotation = moving ? Math.sin(t * 7) * 0.05 - s * 0.12 : Math.sin(t * 1.3) * 0.04;
    const hop = moving ? -Math.abs(Math.sin(t * 7)) * 6 * (1 - s) : Math.sin(t * 2) * 1.5;
    const lift = s * (26 + Math.sin(t * 5) * 4);
    this.avatar.y = -0.4 * this.avatarS + hop - lift;
    this.avatar.angle = moving ? s * (p.inner.scaleX < 0 ? 6 : -6) : 0;
    const shrink = 1 - s * 0.35;
    this.playerShadow.setScale((moving ? 0.9 + Math.abs(Math.sin(t * 7)) * -0.12 * (1 - s) : 1) * shrink, shrink).setAlpha(0.8 - s * 0.35);
  }

  /** Lábnyom-por a földön, szélcsík a levegőben — a vidékhez illő színnel. */
  #footstep(vx, vy) {
    const [tx, ty] = this.#tileOf();
    const i = ty * this.world.w + tx;
    const x = this.player.x - vx * 10, y = this.player.y - 2;
    if (this.soar > 0.5) {
      const streak = this.add.image(x - vx * 20, y - 40 - Math.random() * 20, 'fx-spark').setBlendMode(Phaser.BlendModes.ADD)
        .setRotation(Math.atan2(vy, vx)).setAlpha(0.5).setScale(1.6, 0.8).setDepth(this.player.depth + 1);
      this.tweens.add({ targets: streak, alpha: 0, scaleX: 0.4, duration: 320, onComplete: () => streak.destroy() });
      return;
    }
    const col = this.world.snowy[i] ? 0xeef4fc : this.world.ashy[i] ? 0x6b5a5e : this.world.biome[i] === B.SAND ? 0xd6c49a : 0xb9a68a;
    const puff = this.add.image(x + (Math.random() - 0.5) * 10, y, 'fx-smoke').setTint(col).setScale(0.25).setAlpha(0.55).setDepth(this.player.depth - 1);
    this.tweens.add({ targets: puff, scale: 0.6, alpha: 0, y: y - 6, x: puff.x - vx * 8, duration: 520, onComplete: () => puff.destroy() });
  }

  #updateArea(tx, ty) {
    const i = ty * this.world.w + tx;
    const home = this.world.pois[0];
    const name = Math.hypot(tx - home.x, ty - home.y) < 7 ? 'A Hosszúház tisztása'
      : this.world.ashy[i] ? 'Hamuverem — perzselt föld'
      : this.world.snowy[i] ? 'Fagyos Észak'
      : this.world.biome[i] === B.SAND ? (tx > 55 ? 'A tengerpart' : 'A tó partja')
      : 'A Sárkányok Völgye';
    this.g.hud.setArea(name);
    this.snowfall.emitting = !!this.world.snowy[i];
    this.embers.emitting = !!this.world.ashy[i];
    this.fireflies.emitting = !this.world.snowy[i] && !this.world.ashy[i];
  }

  #checkHerb(tx, ty) {
    const key = `${tx},${ty}`;
    const img = this.herbViews.get(key);
    if (!img) return;
    const { state, hud, sfx } = this.g;
    this.herbViews.delete(key);
    state.save.herbs += 1;
    state.save.herbsTaken[key] = Math.floor(state.now);
    state.touch();
    sfx.pickup();
    hud.toast('🌿 Gyógyfüvet szedtél. <small>Harcban a legsebesültebb társadat gyógyítja.</small>', 'good');
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, y: img.y - 40, alpha: 0, scale: 1.6, duration: 600, onComplete: () => img.destroy() });
  }

  /* ================================================================== */
  /* Helyszínek                                                          */
  /* ================================================================== */
  #poiNear(tx, ty) {
    for (const p of this.world.pois) {
      const dx = tx - p.x, dy = ty - p.y;
      const near = p.type === 'home' ? (Math.abs(dx) <= 2 && dy >= 0 && dy <= 1)
                 : p.type === 'trainer' ? (Math.abs(dx) <= 2 && dy >= -1 && dy <= 1)
                 : p.type === 'ruins' ? (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)
                 : p.type === 'cave' ? (Math.abs(dx) <= 1 && dy >= 0 && dy <= 1)
                 : (Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
      if (near) return p;
    }
    return null;
  }

  #poiLabel(p) {
    switch (p.type) {
      case 'home':  return 'Belépés a hosszúházba';
      case 'trainer': return this.g.story?.trainerOpen ? 'Gyakorlótér — Ragnhild' : 'Gyakorlótér';
      case 'shrine':  return PLACES[p.place].name;
      case 'npc':     return `Beszélgetés: ${PLACES[p.place].name}`;
      case 'ruins':   return PLACES.ruins.name;
      case 'chest':   return this.g.state.save.places[p.id]?.open ? 'Üres láda' : 'Láda kinyitása';
      case 'sign':    return 'Útjelző tábla';
      case 'wanderer': return 'Megszólítod a vándort';
      case 'cave':  return `${CAVES[p.tier].name} (${ROMAN[p.tier]}. fok)`;
      case 'nest':  return p.name;
      case 'stone': return 'A rúnakő felirata';
    }
    return '';
  }

  #updatePrompt(tx, ty) {
    const p = this.g.hud.modalOpen ? null : this.#poiNear(tx, ty);
    this.nearPoi = p;
    this.g.hud.prompt(p ? this.#poiLabel(p) : null, () => this.#interact(p));
  }

  #interact(p = this.nearPoi) {
    if (!p || this.g.hud.modalOpen) return;
    this.path = null;
    this.g.sfx.unlock();
    ({
      home: () => this.#openHome(), trainer: () => this.#openTrainer(), cave: () => this.#openCave(p),
      nest: () => this.#openNest(p), stone: () => this.#openStone(p),
    })[p.type]?.() ?? (['shrine', 'npc', 'ruins', 'chest', 'sign', 'wanderer'].includes(p.type) && this.places.interact(p));
  }

  #welcome() {
    const { hud } = this.g;
    hud.openModal(`
      <p class="gm-kicker">ᛟ Új saga kezdődik</p>
      <h2>A Sárkányok Völgye</h2>
      <p>A völgy barlangjaiban vad sárkányok fészkelnek, a szirteken ősi fészkek várnak tojásra.
         Járd be a vidéket, győzd le a barlangok lakóit, és <b>tenyéssz új sárkányokat</b> a sajátjaidból.</p>
      <ul class="gm-list">
        <li><b>Mozgás:</b> WASD / nyilak, vagy kattints (koppints) oda, ahová menni akarsz</li>
        <li><b>Interakció:</b> <kbd>E</kbd>, <kbd>Szóköz</kbd>, vagy kattints a helyszínre</li>
        <li><b>Barlangok</b> (I–V. fok): harc, szilánk, tapasztalat — a legyőzött sárkány néha megszelídíthető</li>
        <li><b>Fészkek:</b> két sárkányodból tojás — testrészenként dönthetsz az öröklésről</li>
        <li><b>Hosszúház:</b> pihenés (teljes gyógyulás) és a csapat összeállítása</li>
        <li><b>A völgy lakói:</b> remeték, mesterek, oltárok tanítanak technikát és <b>ultit</b> — mindenkinek máshol rejtőznek. Ládák, ereklyék, kóborló vad sárkányok várnak.</li>
        <li><b>Szárnyalás:</b> tartsd lenyomva a <kbd>Shift</kbd>-et</li>
      </ul>
      <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Induljunk</button></div>`);
    hud.el.card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
    hud.onModalClose = () => this.time.delayedCall(250, () => this.g.story.start());
  }

  /* --- Hosszúház --- */
  async #openHome() {
    const { hud, state, sfx, story } = this.g;
    // A Völva beszélni akar? Akkor most a saga jön, nem a pihenés
    if (await story.event('talk:home')) return;
    const card = hud.openModal(`
      <p class="gm-kicker">ᛟ Othala — az ősi otthon</p>
      <h2>A Hosszúház</h2>
      <p>A tűz mellett a sárkányaid kipihenik a harcot. Itt állíthatod össze a csapatot is: az első sárkány vezet a völgyben.</p>
      <div class="gm-party">${state.party.map((d) => hud.dragonCard(d)).join('')}</div>
      <div class="gm-actions">
        <button class="btn btn-primary" data-act="rest" type="button">Pihenés a tűznél</button>
        <button class="btn" data-act="party" type="button">Csapat összeállítása</button>
        <button class="btn btn-ghost" data-act="save" type="button">Mentés</button>
      </div>`, { wide: true });
    card.querySelector('[data-act="rest"]').onclick = () => {
      state.healAll();
      sfx.heal();
      hud.toast('🔥 A sárkányaid teljesen felépültek.', 'good');
      hud.closeModal();
    };
    card.querySelector('[data-act="party"]').onclick = () => this.#openParty();
    card.querySelector('[data-act="save"]').onclick = async () => { state.dirty = true; await state.flush(); hud.toast('ᛟ Mentve.', 'good'); };
  }

  #openParty() {
    const { hud, state } = this.g;
    const all = [...state.dragons.values()].sort((a, b) => b.xp - a.xp || b.id - a.id);
    let sel = [...state.save.party];
    const render = () => {
      const card = hud.openModal(`
        <p class="gm-kicker">ᛗ Mannaz — a csapat</p>
        <h2>Csapat összeállítása</h2>
        <p>Válassz legfeljebb három sárkányt. A kiválasztás sorrendje számít: az <b>első</b> vezet a völgyben.</p>
        <div class="gm-grid">${all.map((d) => hud.dragonCard(d, {
          selectable: true, selected: sel.includes(d.id),
          extra: sel.includes(d.id) ? `<span class="gd-order">${sel.indexOf(d.id) + 1}</span>` : '',
        })).join('')}</div>
        <div class="gm-actions">
          <button class="btn btn-primary" data-act="ok" type="button" ${sel.length ? '' : 'disabled'}>Kész</button>
        </div>`, { wide: true });
      card.querySelectorAll('.gd-card').forEach((b) => b.onclick = () => {
        const id = Number(b.dataset.id);
        if (sel.includes(id)) sel = sel.filter((x) => x !== id);
        else if (sel.length < 3) sel.push(id);
        else { hud.toast('Legfeljebb három sárkány lehet a csapatban.', 'warn'); return; }
        const scroll = card.querySelector('.gm-grid').scrollTop;
        render();
        hud.el.card.querySelector('.gm-grid').scrollTop = scroll;
      });
      card.querySelector('[data-act="ok"]').onclick = async () => {
        const leadChanged = sel[0] !== state.save.party[0];
        state.save.party = sel;
        state.touch('party');
        hud.closeModal();
        if (leadChanged) await this.#buildAvatar();
      };
    };
    render();
  }

  /* --- Gyakorlótér --- */
  async #openTrainer() {
    const { story } = this.g;
    if (!story.trainerOpen) { await story.say('trainerLocked'); return; }
    const talked = await story.event('talk:trainer');
    this.#refreshTrainer();
    // Az első találkozás után rögtön a technikák jönnek (az első lecke ingyenes)
    this.trainer.open(talked && story.quest?.id === 'learn' ? 'tech' : undefined);
  }

  #enterSpar(count, level) {
    const { sfx, hud } = this.g;
    sfx.drum();
    hud.prompt(null);
    hud.compass(null);
    this.ready = false;
    const cam = this.cameras.main;
    const p = this.world.pois.find((x) => x.type === 'trainer');
    cam.stopFollow();
    cam.pan(p.x * TILE + TILE / 2, p.y * TILE, 600, 'Sine.easeInOut');
    cam.zoomTo(cam.zoom * 1.5, 800, 'Cubic.easeIn');
    cam.fadeOut(800, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.sleep();
      this.scene.launch('battle', { g: this.g, mode: 'spar', spar: { count, level } });
    });
  }

  /* --- Barlang --- */
  #openCave(p) {
    const { hud, state } = this.g;
    const cave = CAVES[p.tier];
    const cleared = !!state.save.cleared[p.tier];
    const maxCleared = Math.max(0, ...Object.keys(state.save.cleared).filter((k) => state.save.cleared[k]).map(Number));
    // Níðhöggr barlangja bármikor nyitva: aki bemegy, egyből a bosszal néz szembe
    const locked = p.tier !== 5 && p.tier > maxCleared + 1;
    const partyUp = state.party.filter((d) => state.hpOf(d) > 0);
    const rec = p.tier === 5 ? 20 : 1 + (p.tier - 1) * 4;     // Níðhöggr ellen több kell (szimuláció: 17. szinten ~22% esély)
    const lore = {
      1: 'Nedves kő, zöld moha, és a sötétből halk, szuszogó morgás. Fiatal sárkányok vackolnak itt.',
      2: 'A bejárat jégcsapjai, mint egy torok fogai. Odabent a hideg minden hangot elnyel.',
      3: 'Suttogás, ami nem a széltől jön. Aki túl mélyre ment, a nevét hallotta visszhangozni.',
      4: 'A kő még meleg. A hamu alatt parázs izzik, és valami hatalmas mozdul a füstben.',
      5: 'Yggdrasil gyökere itt ér le a völgybe. Níðhöggr, a Gyökérrágó őrzi. Senki nem tért vissza tőle.',
    }[p.tier];

    const card = hud.openModal(`
      <p class="gm-kicker">${'✦'.repeat(p.tier)} ${ROMAN[p.tier]}. fokú barlang</p>
      <h2>${esc(cave.name)}</h2>
      <p class="gm-lore">${lore}</p>
      <div class="gm-facts">
        <span>Ajánlott szint: <b>${rec}+</b></span>
        <span>${p.tier === 5 ? 'Ellenfél: <b>Níðhöggr</b>' : `Hullámok: <b>${cave.waves.length}</b>`}</span>
        <span>Állapot: <b>${cleared ? 'bejárva ✓' : 'felderítetlen'}</b></span>
      </div>
      ${locked ? `<p class="gm-warn">Ez a barlang még túl veszélyes. Előbb járd be a(z) ${ROMAN[maxCleared + 1]}. fokút.</p>` : ''}
      ${!partyUp.length ? '<p class="gm-warn">A csapatod kimerült. Pihenj a hosszúházban!</p>' : ''}
      <div class="gm-actions">
        <button class="btn btn-primary" data-act="go" type="button" ${locked || !partyUp.length ? 'disabled' : ''}>Belépés a barlangba</button>
        <button class="btn btn-ghost" data-act="no" type="button">Mégsem</button>
      </div>`);
    card.querySelector('[data-act="no"]').onclick = () => hud.closeModal();
    card.querySelector('[data-act="go"]').onclick = () => { hud.closeModal(); this.#enterCave(p); };
  }

  #enterCave(p) {
    const { sfx, hud } = this.g;
    sfx.portal();
    hud.prompt(null);
    hud.compass(null);
    this.ready = false;
    const cam = this.cameras.main;
    const mx = p.x * TILE + TILE / 2, my = p.y * TILE - 26;
    // Örvény a barlang szájában: rúnakör pörög, a fény és a por beszippantódik
    const col = CAVES[p.tier].color;
    const ring = this.add.image(mx, my, 'fx-runecircle').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.05).setAlpha(0).setDepth(9.7e5);
    this.tweens.add({ targets: ring, scale: 0.5, alpha: 0.9, angle: 540, duration: 900, ease: 'Cubic.easeIn' });
    const suck = this.add.particles(mx, my, 'fx-dot', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 130), quantity: 30 },
      moveToX: mx, moveToY: my, lifespan: 600, scale: { start: 0.3, end: 0.05 },
      tint: [col, 0xffffff], blendMode: 'ADD', frequency: 20, quantity: 2,
    }).setDepth(9.7e5);
    this.tweens.add({ targets: this.avatar, scale: 0.4, alpha: 0, y: this.avatar.y - 10, duration: 800, delay: 200, ease: 'Cubic.easeIn' });
    cam.stopFollow();
    cam.pan(mx, my + 6, 700, 'Sine.easeInOut');
    cam.zoomTo(cam.zoom * 1.8, 900, 'Cubic.easeIn');
    cam.fadeOut(900, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      ring.destroy(); suck.destroy();
      this.scene.sleep();
      this.scene.launch('battle', { g: this.g, tier: p.tier });
    });
  }

  async #onWake(result) {
    const { state, hud, story } = this.g;
    const cam = this.cameras.main;
    this.#fitZoom();
    cam.startFollow(this.player, true, 0.12, 0.12);
    if (result?.defeat) {
      // Elájult csapat: a hosszúházban tér magához
      this.player.setPosition(this.world.start.x * TILE + TILE / 2, this.world.start.y * TILE + TILE - 6);
      cam.centerOn(this.player.x, this.player.y);
      for (const d of state.party) state.setHp(d, Math.round(state.stats(d).maxHp * 0.3));
      hud.toast('A csapatod elájult… a hosszúház tüzénél tértetek magatokhoz.', 'warn', 5000);
    }
    // Kóborló vad sárkány: legyőzve eltűnik (később máshol bukkan fel újabb);
    // menekülés vagy vereség után egy darabig nem támad
    const r = this.pendingRoam;
    this.pendingRoam = null;
    if (r && result?.roamId === r.d.id) {
      if (result.victory) {
        r.cont.destroy();
        this.roamers = this.roamers.filter((x) => x !== r);
      } else {
        r.calm = this.time.now + 9000;
        const dx = this.player.x - r.cont.x, dy = this.player.y - r.cont.y, d = Math.hypot(dx, dy) || 1;
        r.cont.x -= (dx / d) * TILE * 2.5; r.cont.y -= (dy / d) * TILE * 2.5;
        if (this.#blockedAt(r.cont.x, r.cont.y)) { r.cont.setPosition(r.home[0] * TILE + TILE / 2, r.home[1] * TILE + TILE - 6); }
      }
    }
    if (result?.spar) {
      // A karámban senki nem esik el igazán
      state.healAll();
      hud.toast('ᛏ Ragnhild sárkányai visszahúzódnak — a tieid kifújták magukat, és felépültek.', 'good', 4500);
    }
    cam.fadeIn(700, 0, 0, 0);
    for (const p of this.world.pois) if (p.type === 'cave') this.#refreshCave(p);
    await this.#buildAvatar();
    hud.renderParty();
    this.lastTile = null;
    this.ready = true;
    state.flush();
    // A saga: első bejárás után a hollók hírt hoznak
    if (result?.guardian && result.victory) {
      await new Promise((res) => this.time.delayedCall(700, res));
      await this.places.guardianWon(result.guardian);
    }
    if (result?.victory && result.tier) {
      await new Promise((res) => this.time.delayedCall(800, res));
      await story.event(`clear:${result.tier}`);
      this.#refreshTrainer();
    }
  }

  /* --- Rúnakő --- */
  #openStone(p) {
    const { hud, state, sfx } = this.g;
    const lore = LORE[p.lore];
    const first = !state.save.stones[p.lore];
    const card = hud.openModal(`
      <p class="gm-kicker">ᚨ Rúnakő</p>
      <h2>${esc(lore.title)}</h2>
      <div class="gm-lore gm-runetext">${lore.text}</div>
      ${first ? '<p class="gm-good">A rúnák ereje átjár: <b>+15 rúnaszilánk</b></p>' : ''}
      <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Tovább</button></div>`);
    card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
    if (first) {
      state.save.stones[p.lore] = 1;
      state.save.shards += 15;
      state.commit();
      sfx.pickup();
      this.poiViews.get(p.id).sprite.setTint(0xb8c4e0);
    }
  }

  /* --- Fészek: tenyésztés és kikelés --- */
  #openNest(p) {
    const { state } = this.g;
    const egg = state.eggs.find((e) => e.nest === p.nest);
    if (egg) this.#openEgg(p, egg);
    else this.#openBreed(p);
  }

  #openEgg(p, egg) {
    const { hud, state } = this.g;
    const card = hud.openModal(`
      <p class="gm-kicker">ᛃ Jera — a termés ideje</p>
      <h2>${esc(p.name)}</h2>
      <div class="gm-egg"><span class="gm-egg-shell" style="--egg:${esc(egg.szin)}"></span></div>
      <p class="text-center">${esc(egg.a)} és ${esc(egg.b)} tojása · ${egg.gen}. nemzedék</p>
      <p class="gm-timer text-center" data-timer></p>
      <div class="gm-hatch" hidden>
        <label for="hatchName">Mi legyen a fióka neve?</label>
        <input id="hatchName" type="text" maxlength="40" placeholder="pl. Hamvas Fénysugár" autocomplete="off">
      </div>
      <div class="gm-actions">
        <button class="btn btn-primary" data-act="hatch" type="button" disabled>Kikeltetés</button>
        <button class="btn btn-ghost" data-act="no" type="button">Később</button>
      </div>`);
    const timer = card.querySelector('[data-timer]');
    const btn = card.querySelector('[data-act="hatch"]');
    const tick = () => {
      const left = Math.ceil(egg.ready - state.now);
      if (left > 0) {
        timer.textContent = `Kikelésig: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      } else {
        timer.textContent = 'A tojás megmozdult — a fióka kopogtat!';
        btn.disabled = false;
        card.querySelector('.gm-hatch').hidden = false;
        card.querySelector('.gm-egg-shell').classList.add('is-ready');
        clearInterval(iv);
      }
    };
    const iv = setInterval(tick, 500);
    tick();
    hud.onModalClose = () => clearInterval(iv);
    card.querySelector('[data-act="no"]').onclick = () => hud.closeModal();
    btn.onclick = () => this.#hatch(p, egg, card.querySelector('#hatchName').value.trim());
  }

  async #hatch(p, egg, name) {
    const { hud, state, api, sfx } = this.g;
    try {
      sfx.crack();
      const res = await api.post('hatch', { nest: p.nest, name: name || 'Fióka' });
      state.eggs = state.eggs.filter((e) => e !== egg);
      state.addDragon(res.dragon);
      state.save.stats.hatched++;
      state.commit();
      this.#refreshNest(p);
      sfx.levelUp();
      const mut = res.mutated.map((s) => SLOT_NAMES[s]).join(', ');
      const card = hud.openModal(`
        <p class="gm-kicker">ᚠ Fehu — új élet</p>
        <h2>Kikelt: ${esc(res.dragon.nev)}!</h2>
        <div class="gm-reveal">${hud.dragonCard(res.dragon)}</div>
        ${mut ? `<p class="gm-good">✦ Mutáció! Új testrész: <b>${esc(mut)}</b></p>` : ''}
        ${res.dragon.traits.length ? `<p class="gm-good">Örökölt vonások: ${res.dragon.traits.map((t) => `<b>${esc(state.traits[t][0])}</b>`).join(', ')}</p>` : ''}
        <p class="muted">A fióka a gyűjteményedbe került — az arénában és a profilodon is megtalálod.</p>
        <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Üdv a családban!</button></div>`);
      card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
      this.#hatchBurst(p);
    } catch (e) {
      hud.toast(esc(e.message), 'bad');
    }
  }

  #hatchBurst(p) {
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE - 26;
    const burst = this.add.particles(x, y, 'fx-dot', {
      speed: { min: 60, max: 220 }, lifespan: 900, scale: { start: 0.5, end: 0 },
      tint: [0xffe08a, 0xffffff, 0xff8a3d], blendMode: 'ADD', emitting: false,
    }).setDepth(9e5);
    burst.explode(40);
    this.time.delayedCall(1200, () => burst.destroy());
  }

  #openBreed(p) {
    const { hud, state } = this.g;
    const all = [...state.dragons.values()];
    if (all.length < 2) {
      const card = hud.openModal(`
        <p class="gm-kicker">ᛃ Fészek</p><h2>${esc(p.name)}</h2>
        <p>A tenyésztéshez legalább <b>két sárkány</b> kell. Szelídíts meg egyet a barlangokban, vagy építs egyet a műhelyben.</p>
        <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Értem</button></div>`);
      card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
      return;
    }

    const pick = { fej: 'r', test: 'r', lab: 'r', szarny: 'r' };
    let A = state.party[0]?.id ?? all[0].id;
    let B2 = all.find((d) => d.id !== A).id;
    let choosing = null;               // 'a' | 'b' — éppen melyik szülőt választja

    const render = () => {
      const a = state.dragons.get(A), b = state.dragons.get(B2);
      const gen = Math.min(20, Math.max(a.gen, b.gen) + 1);
      const cost = breedCost(gen);
      const secs = Math.min(600, 60 + 30 * gen);
      const rows = SLOTS.map((s) => `
        <div class="br-row">
          <span class="br-slot">${SLOT_NAMES[s]}</span>
          <div class="br-toggle" role="radiogroup" aria-label="${SLOT_NAMES[s]} öröklése">
            <button type="button" data-slot="${s}" data-v="a" class="${pick[s] === 'a' ? 'on' : ''}">${hud.partLine(a, s)}</button>
            <button type="button" data-slot="${s}" data-v="r" class="br-fate ${pick[s] === 'r' ? 'on' : ''}" title="50–50% a két szülő között, és ${state.rules.mutationPct}% eséllyel teljesen új testrész">ᛈ Sors</button>
            <button type="button" data-slot="${s}" data-v="b" class="${pick[s] === 'b' ? 'on' : ''}">${hud.partLine(b, s)}</button>
          </div>
        </div>`).join('');

      const card = hud.openModal(`
        <p class="gm-kicker">ᛃ Jera — a fészek</p>
        <h2>${esc(p.name)}: tojásrakás</h2>
        ${choosing ? `
          <p>Válaszd ki a(z) <b>${choosing === 'a' ? 'első' : 'második'}</b> szülőt:</p>
          <div class="gm-grid">${all.map((d) => hud.dragonCard(d, { selectable: true, selected: d.id === (choosing === 'a' ? A : B2) })).join('')}</div>
        ` : `
          <div class="br-parents">
            <button type="button" class="br-parent" data-choose="a">${hud.dragonCard(a)}<span>Csere</span></button>
            <span class="br-plus">ᚷ</span>
            <button type="button" class="br-parent" data-choose="b">${hud.dragonCard(b)}<span>Csere</span></button>
          </div>
          <p class="br-help">Testrészenként döntsd el, kitől örököljön a fióka. A <b>ᛈ Sors</b> 50–50%-ban választ,
             és <b>${state.rules.mutationPct}%</b> eséllyel teljesen új testrészt hoz — csak így születhet olyan, ami egyik szülőnek sincs.</p>
          <div class="br-rows">${rows}</div>
          <div class="gm-facts">
            <span>Nemzedék: <b>${gen}.</b> <small>(+${gen * 4}% erő)</small></span>
            <span>Keltetés: <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></span>
            <span>Ár: <b>${cost} ᚱ</b> <small>(van: ${state.save.shards})</small></span>
          </div>
          <div class="gm-actions">
            <button class="btn btn-primary" data-act="lay" type="button" ${state.save.shards < cost ? 'disabled' : ''}>Tojásrakás</button>
            <button class="btn btn-ghost" data-act="no" type="button">Mégsem</button>
          </div>`}`, { wide: true });

      card.querySelectorAll('[data-choose]').forEach((b) => b.onclick = () => { choosing = b.dataset.choose; render(); });
      if (choosing) {
        card.querySelectorAll('.gd-card').forEach((b) => b.onclick = () => {
          const id = Number(b.dataset.id);
          const other = choosing === 'a' ? B2 : A;
          if (id === other) { hud.toast('Két különböző sárkány kell.', 'warn'); return; }
          if (choosing === 'a') A = id; else B2 = id;
          choosing = null;
          render();
        });
        return;
      }
      card.querySelectorAll('.br-toggle button').forEach((b) => b.onclick = () => { pick[b.dataset.slot] = b.dataset.v; render(); });
      card.querySelector('[data-act="no"]').onclick = () => hud.closeModal();
      card.querySelector('[data-act="lay"]').onclick = async (e) => {
        e.currentTarget.disabled = true;
        try {
          const res = await this.g.api.post('breed', { nest: p.nest, a: A, b: B2, pick });
          state.save.shards -= res.cost;
          state.eggs = res.eggs;
          state.clockOffset = res.now - Date.now() / 1000;
          state.commit();
          this.g.sfx.heal();
          hud.closeModal();
          hud.toast(`ᛃ Tojás került a fészekbe (${esc(p.name)}). Nézz vissza, ha kikelt!`, 'good', 4500);
          this.#refreshNest(p);
          // A tojás kikelésekor jelezzen a fészek
          const egg = state.eggs.find((x) => x.nest === p.nest);
          if (egg) this.time.delayedCall(Math.max(0, (egg.ready - state.now) * 1000) + 300, () => {
            this.#refreshNest(p);
            hud.toast(`🥚 Kikelni készül egy fióka: ${esc(p.name)}!`, 'good', 5000);
          });
        } catch (err) {
          hud.toast(esc(err.message), 'bad');
          e.currentTarget.disabled = false;
        }
      };
    };
    render();
  }
}
