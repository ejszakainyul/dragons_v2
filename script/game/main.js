/* =====================================================================
   A Sárkányok Völgye — indítás
   ---------------------------------------------------------------------
   1. állapot a szerverről (sárkányok, katalógus, mentés, tojások)
   2. ha még nincs sárkány: kezdő tojás a völgy szellemétől
   3. térkép generálása, grafika megrajzolása (Boot jelenet)
   4. a völgy (overworld) indul; a barlangok és a párbaj a battle jelenetben,
      a saga (story.js) párbeszédei a DOM-ban, a vászon fölött

   Gyengébb gépekre: a vászon CSS-képpontban fut (nincs HiDPI-szorzó),
   a részecskék száma korlátozott, és a Phaser magától szünetel, ha a
   lap a háttérbe kerül.
   ===================================================================== */
import { Api, GameState } from './state.js';
import { Hud, esc } from './hud.js';
import { GameSfx } from './sfx.js';
import { generateWorld } from './world.js';
import { buildTileset, buildSprites, dragonTextures, dragonPortrait } from './art.js';
import { OverworldScene } from './overworld.js';
import { BattleScene } from './battle.js';
import { Story } from './story.js';
import { layoutPlaces, playerSeed } from './places.js';
import { buildPeaks } from './terrain.js';

const CFG = window.GAME || {};
const shell = document.getElementById('gameShell');
const loading = document.getElementById('gameLoading');

function setLoading(text, pct) {
  loading.querySelector('[data-text]').textContent = text;
  loading.querySelector('[data-bar]').style.width = `${pct}%`;
}

function fatal(msg) {
  loading.classList.add('is-error');
  loading.querySelector('[data-text]').innerHTML =
    `${esc(msg)}<br><a class="btn btn-sm" href="kaland.php">Újrapróbálom</a>`;
}

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  init(data) { this.g = data.g; }

  async create() {
    const { g } = this;
    setLoading('Csempék és fák faragása…', 62);
    buildTileset(this);
    buildSprites(this);
    buildPeaks(this);

    // A textúrák a játék közös kezelőjében élnek — bármelyik jelenet eléri
    g.gfx = { textures: this.game.textures };
    g.hud.portraitMaker = async (d) => {
      const keys = await dragonTextures(g.gfx, d, g.state.catalog, 160);
      return dragonPortrait(g.gfx, keys, 72);
    };

    setLoading('A sárkányok felébrednek…', 82);
    try {
      await Promise.all(g.state.party.map((d) => dragonTextures(g.gfx, d, g.state.catalog, 160)));
    } catch (e) {
      console.warn(e);
    }

    g.hud.renderParty();
    g.hud.renderResources();
    g.story.renderTracker();
    setLoading('Indulás!', 100);
    this.scene.start('overworld', { g });
    setTimeout(() => loading.classList.add('is-done'), 350);
    setTimeout(() => loading.remove(), 1200);
  }
}

async function starter(g) {
  // Aki még egyetlen sárkányt sem nevelt: a völgy szelleme ad egy tojást
  return new Promise((resolve) => {
    const card = g.hud.openModal(`
      <p class="gm-kicker">ᚠ Fehu — minden kezdet</p>
      <h2>A völgy szelleme</h2>
      <p>A köd megmozdul, és egy halkan izzó tojás gurul a lábad elé.
         <em>„Senki nem léphet a Völgybe sárkány nélkül."</em></p>
      <div class="gm-egg"><span class="gm-egg-shell is-ready" style="--egg:#ff8a3d"></span></div>
      <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Átveszem a tojást</button></div>`,
    { closeable: false });
    card.querySelector('[data-act="ok"]').onclick = async (e) => {
      e.currentTarget.disabled = true;
      g.sfx.unlock();
      g.sfx.crack();
      try {
        const res = await g.api.post('starter', {});
        g.state.addDragon(res.dragon);
        g.sfx.levelUp();
        g.hud.closeModal();
        resolve();
      } catch (err) {
        g.hud.toast(esc(err.message), 'bad');
        e.currentTarget.disabled = false;
      }
    };
  });
}

async function boot() {
  if (!window.Phaser) return fatal('A játékmotor nem töltődött be.');

  const api = new Api(CFG.api || 'kaland_api.php', CFG.csrf || '');
  setLoading('A völgy ébredezik…', 12);

  let server;
  try {
    server = await api.get('state');
  } catch (e) {
    return fatal(`Nem sikerült betölteni a játékot: ${e.message}`);
  }

  const state = new GameState(api, server);
  const sfx = new GameSfx();
  sfx.setMuted(!!state.save.muted);
  const hud = new Hud(shell, state, sfx);
  const g = { api, state, hud, sfx };
  window.__kaland = g;               // fejlesztői fogantyú: a konzolból elérhető állapot

  // A hang csak felhasználói gesztus után indulhat
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  setLoading('A völgy térképének rajzolása…', 34);
  await new Promise((r) => setTimeout(r, 30));          // hadd rajzolódjon ki a töltőképernyő
  g.world = generateWorld();
  // Tanítók, emberek, ládák: játékosonként máshol (a névből képzett maggal)
  g.world.roamSpots = layoutPlaces(g.world, playerSeed(state.player)).roamSpots;

  if (!state.dragons.size) {
    loading.classList.add('is-done');
    await starter(g);
    loading.classList.remove('is-done');
  }

  // A saga: a mentett állásból (régi mentésnél csendben előreugrik)
  g.story = new Story(g);
  state.startAutosave();

  // A vászonnak méret kell: rejtett/0 méretű tárolóban a WebGL keretpuffer
  // nem jön létre („Incomplete Attachment"). Megvárjuk, amíg látható lesz.
  const holder = document.getElementById('gameCanvas');
  if (!holder.clientWidth || !holder.clientHeight) {
    setLoading('Várakozás a megjelenítésre…', 40);
    await new Promise((resolve) => {
      const ro = new ResizeObserver(() => {
        if (holder.clientWidth && holder.clientHeight) { ro.disconnect(); resolve(); }
      });
      ro.observe(holder);
    });
  }

  g.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'gameCanvas',
    backgroundColor: '#05070f',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    render: { antialias: true, powerPreference: 'default' },
    fps: { target: 60 },
    input: { mouse: { preventDefaultWheel: false } },
    disableContextMenu: true,
    banner: false,
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add('boot', BootScene, false);
        game.scene.add('overworld', OverworldScene, false);
        game.scene.add('battle', BattleScene, false);
        game.scene.start('boot', { g });
      },
    },
  });
}

boot();
