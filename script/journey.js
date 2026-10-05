/* =====================================================================
   A JÓSLAT — 3D-s utazás
   ---------------------------------------------------------------------
   A kamera egy elágazó útvonalon halad végig egy északi völgyön.
   Checkpointoknál megáll, ott jelenik meg a kérdés; a válasz kapui
   térben, a saját helyükön lebegnek — amelyiket választod, azon repül
   át a kamera, és az határozza meg a következő szakasz irányát.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js';

import {
  makeNoise, terrainHeight, buildTerrain, buildWater, buildStars,
  buildAurora, buildMoon, buildMotes, buildMistBands,
} from './journey/world.js';

import {
  buildMonolith, buildGate, scatterProps, buildLavaCracks,
  buildEyes, buildSilhouette, buildSkullArch, buildShockwave, buildAura,
  disposeGate,
} from './journey/props.js';
import { LightPool, VirtualLight } from './journey/lightpool.js';

import { ACTS, ACT_LENGTH, FINALE_MOOD, TWIST_TEXT } from './journey/acts.js';
import { Sfx } from './journey/sfx.js';

const CFG = window.QUIZ || {};
const PARTS = CFG.partsDir || 'dragons/';
const PART_EXT = CFG.partsExt || 'png';

/** Egy testrészkép URL-je. */
const partUrl = (slot, id) => `${PARTS}${slot}[${id}].${PART_EXT}`;

/* =====================================================================
   Segédek
   ===================================================================== */
const clamp  = (v, a, b) => Math.min(b, Math.max(a, v));

/** Milyen messze álljanak a kapuk a checkpointtól. */
const GATE_DISTANCE = 58;

/** A finálé „színpadának" z koordinátái. */
const FINALE_STAGE_Z = -70 - 5 * 168;    // ide nyílik a szempár, itt jelenik meg a sárkány
const FINALE_STOP_Z  = FINALE_STAGE_Z + 74;
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Egyszerű, időalapú tween-gyűjtő. */
class Tweens {
  constructor() { this.list = []; }

  add(duration, onUpdate, onDone, ease = easeIO) {
    const tw = { t: 0, duration, onUpdate, onDone, ease };
    this.list.push(tw);
    return tw;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = clamp(tw.t / tw.duration, 0, 1);
      tw.onUpdate(tw.ease(k), k);
      if (k >= 1) {
        this.list.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  }
}

/* =====================================================================
   Sárkány-textúra: a négy pixelgrafikát egy vászonra rakjuk és színezzük
   ===================================================================== */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

class DragonCanvas {
  constructor() {
    // 1024, nem 512: a finálében a sárkány szinte kitölti a képernyőt,
    // 512-ről nagyítva elmosódott volt. A forrás SVG, tehát van miből.
    this.size = 1024;
    this.base = document.createElement('canvas');
    this.out  = document.createElement('canvas');
    this.base.width = this.base.height = this.size;
    this.out.width  = this.out.height  = this.size;
    this.texture = new THREE.CanvasTexture(this.out);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.ready = false;
  }

  async load(parts) {
    const order = ['body', 'legs', 'head', 'wings'];
    const imgs = await Promise.all(order.map((k) => loadImage(partUrl(k, parts[k]))));

    const ctx = this.base.getContext('2d');
    ctx.clearRect(0, 0, this.size, this.size);
    // A rajzok már nagy felbontásúak, ezért sima skálázás kell —
    // a kikapcsolt simítás itt visszablokkosítaná az éleket.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    imgs.forEach((img) => ctx.drawImage(img, 0, 0, this.size, this.size));

    this.ready = true;
    this.tint('#ff8a3d');
  }

  /**
   * Színezés a luminancia megtartásával:
   * 1) alapkép, 2) multiply a színnel, 3) az eredeti alfa visszaállítása.
   */
  tint(hex) {
    if (!this.ready) return;
    const ctx = this.out.getContext('2d');

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.base, 0, 0);

    const c = new THREE.Color(hex);
    // Kicsit felhúzzuk, hogy a sötét pixelek se tűnjenek el
    const r = Math.round(Math.min(1, c.r * 1.35) * 255);
    const g = Math.round(Math.min(1, c.g * 1.35) * 255);
    const b = Math.round(Math.min(1, c.b * 1.35) * 255);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, this.size, this.size);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.base, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    this.texture.needsUpdate = true;
  }
}

/* =====================================================================
   A fő osztály
   ===================================================================== */
class Journey {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#journeyCanvas');
    this.ui = root.querySelector('.j-ui');

    this.noise  = makeNoise(Math.floor(Math.random() * 1e9));
    this.tweens = new Tweens();
    this.sfx    = new Sfx();
    this.clock  = new THREE.Clock();

    this.state = 'boot';
    this.actIndex = 0;
    this.answers = [];

    // Útvonal
    this.nodes = [];
    this.curve = null;
    this.s = 0;                 // pozíció node-egységben
    this.checkpointS = [];      // az egyes felvonások checkpointjainak s értéke

    this.shake = { amount: 0, decay: 2.4 };
    this.gates = [];
    this.moodCurrent = null;

    // Finálé: a kamera ilyenkor NEM a pálya érintőjét követi, hanem a
    // sárkányra áll rá. (Enélkül az utolsó pályapont érintője szerint
    // nézett, és a sárkány a képmezőn kívülre került — mértem: NDC x ≈ −2.)
    this.finaleAim   = 0;     // 0 = pálya szerint, 1 = a sárkányra
    this.finaleDolly = 0;     // ennyivel közelít rá a kamera

    // Felbontás-szabályozó: folyamatosan méri a képkockaidőt, és ahhoz
    // igazítja a renderelési felbontást (lásd #govern()). A korábbi
    // megoldás egyszer mért 3 mp-ig, és csak lefelé lépett.
    const dpr   = window.devicePixelRatio || 1;
    const cores = navigator.hardwareConcurrency || 4;
    const mem   = navigator.deviceMemory || 4;           // GB; nem minden böngésző adja
    const weak  = cores < 4 || mem < 4 || /Mobi|Android/i.test(navigator.userAgent);
    this.gov = {
      max:   Math.min(dpr, 1.25),
      min:   0.5,
      ratio: Math.min(dpr, weak ? 0.75 : 1.0),     // óvatos indulás, fölfelé lép, ha bírja
      avg:   16.7,        // simított képkockaidő (ms)
      last:  0,
      next:  0,           // legközelebbi döntés ideje
      hold:  0,           // eddig tilos emelni (visszaesés után)
      holdLen: 6000,      // minden visszaesés után duplázódik -> nem ingázik
      tier:  weak ? 1 : 2,   // 2 = teljes, 1 = kevesebb köd/parázs, 0 = bloom nélkül
    };
    this.weakDevice = weak;

    this.#initRenderer();
    this.#initScene();
    this.#initPath();
    this.#initUI();

    window.addEventListener('resize', () => this.#resize());
    this.#resize();
    this.#prewarm();

    this.#loop();

    // Fejlesztői fogantyú (konzolból: __journey.camera.position)
    window.__journey = this;
  }

  /* ------------------------------------------------------------------ */
  #initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      // Élsimítás KI: a jelenet az utófeldolgozás saját célpontjába
      // renderelődik, a vászon MSAA-ja így csak memóriát és sávszélt evett.
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.gov.ratio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Gyenge gépen a fényudvar nélkül indulunk
    this.useBloom = !this.weakDevice;
  }

  #initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;

    scene.fog = new THREE.FogExp2(new THREE.Color('#0b1a33'), 0.0062);
    scene.background = new THREE.Color('#05070f');

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 2200);
    scene.add(this.camera);

    /* --- Fények --- */
    this.ambient = new THREE.AmbientLight('#33507f', 0.55);
    scene.add(this.ambient);

    this.keyLight = new THREE.DirectionalLight('#9fc6ff', 1.25);
    this.keyLight.position.set(120, 180, -60);
    scene.add(this.keyLight);

    // A kamerát kísérő meleg fény, hogy a közeli terep ne legyen koromsötét
    this.travelLight = new THREE.PointLight('#8fb6ff', 18, 130, 2);
    scene.add(this.travelLight);

    // A többi pontfény (rúnakövek, kapuk, szempár, koponyaív, sárkány)
    // virtuális: ez a 3 valódi fény szolgálja ki mindet, a kamerához
    // legközelebbieket. Korábban 14 valódi fény égett egyszerre.
    this.lights = new LightPool(scene, 3);

    this.flashLight = new THREE.AmbientLight('#ffffff', 0);
    scene.add(this.flashLight);

    /* --- Világ --- */
    this.terrain = buildTerrain(this.noise);
    scene.add(this.terrain);

    this.water = buildWater();
    scene.add(this.water);

    this.stars = buildStars(this.noise);
    scene.add(this.stars);

    this.aurora = buildAurora();
    scene.add(this.aurora);

    this.moon = buildMoon();
    scene.add(this.moon);

    this.motes = buildMotes();
    scene.add(this.motes);

    this.mist = buildMistBands(10);
    scene.add(this.mist);

    scene.add(scatterProps(this.noise, 460));

    /* --- Felvonás-specifikus kellékek --- */
    const act3Z = -60 - 2 * ACT_LENGTH;
    this.lava = buildLavaCracks(this.noise, act3Z + 40, act3Z - ACT_LENGTH * 1.4, 26);
    scene.add(this.lava);

    this.silhouette = buildSilhouette(partUrl);
    scene.add(this.silhouette);

    this.skullArch = buildSkullArch(partUrl);
    scene.add(this.skullArch);
    this.lights.track(this.skullArch);

    this.shockwave = buildShockwave();
    scene.add(this.shockwave);

    this.eyes = buildEyes();
    this.eyes.visible = false;
    scene.add(this.eyes);
    this.lights.track(this.eyes);

    /* --- Finálé sárkány --- */
    this.aura = buildAura();
    scene.add(this.aura);

    this.dragonCanvas = new DragonCanvas();
    this.dragonBillboard = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 52),
      new THREE.MeshBasicMaterial({
        map: this.dragonCanvas.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // A ködbe is beleolvad, különben kivágott matricaként ül a völgyben
        fog: true,
      })
    );
    this.dragonBillboard.visible = false;
    // A fénykorona után, de a részecskék előtt
    this.dragonBillboard.renderOrder = 5;
    this.aura.renderOrder = 4;
    scene.add(this.dragonBillboard);

    // Meleg fény a sárkány helyén: ettől kapcsolódik a terephez
    this.dragonLight = new VirtualLight('#ffb066', 0, 220, 2);
    scene.add(this.dragonLight);
    this.lights.track(this.dragonLight);

    /* --- Utófeldolgozás --- */
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));

    // A bloom mindig létrejön (hogy később le lehessen kapcsolni), de
    // ha ki van kapcsolva, a kompozitort teljesen megkerüljük — lásd
    // #render(). Így nincs fölösleges teljes képernyős másolás sem.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.62, 0.58);
    this.bloom.enabled = this.useBloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(this.gov.ratio);
  }

  /* ------------------------------------------------------------------ */
  /* Útvonal                                                             */
  /* ------------------------------------------------------------------ */

  /** Egy pályapont a terep fölött. */
  #node(x, z, height = 7.5) {
    return new THREE.Vector3(x, terrainHeight(this.noise, x, z) + height, z);
  }

  /** Egy felvonás checkpointjának z koordinátája. */
  #checkpointZ(actIndex) {
    return -70 - actIndex * ACT_LENGTH;
  }

  #initPath() {
    // Indulás: a kamera hátrébbról érkezik, és az 1. checkpointnál áll meg
    this.nodes = [
      this.#node(0, 90, 9),
      this.#node(0, 40, 8.4),
      this.#node(0, -6, 8),
      this.#node(0, this.#checkpointZ(0), 7.5),
    ];
    this.checkpointS = [3];
    this.#rebuildCurve();
    this.s = 0;

    // Minden checkpointhoz rúnakő-pár, előre lehelyezve
    ACTS.forEach((_, i) => this.#placeMonolith(i));
  }

  #rebuildCurve() {
    this.curve = new THREE.CatmullRomCurve3(this.nodes, false, 'centripetal', 0.5);
  }

  /** node-egység → görbeparaméter */
  #toT(s) {
    return clamp(s / (this.nodes.length - 1), 0, 1);
  }

  #pointAt(s) {
    return this.curve.getPoint(this.#toT(s));
  }

  /**
   * Hová nézzen a kamera. A pálya végén nincs mit „előre" mintavételezni,
   * ezért ott a görbe érintője mentén extrapolálunk — különben a lookAt
   * önmagára mutatna és elfordulna a kép.
   */
  #lookPoint(s) {
    const maxS  = this.nodes.length - 1;
    const ahead = s + 0.85;

    if (ahead <= maxS) return this.#pointAt(ahead);

    const end = this.#pointAt(maxS);
    const dir = this.curve.getTangent(1).normalize().multiplyScalar(34);
    return end.add(dir);
  }

  #placeMonolith(actIndex) {
    const act = ACTS[actIndex];
    const z = this.#checkpointZ(actIndex);
    // Az út két oldalán, elég távol ahhoz, hogy ne takarják ki a kilátást
    for (const sx of [-17, 17]) {
      const mono = buildMonolith(act.options[0].color);
      mono.position.set(sx, terrainHeight(this.noise, sx, z), z);
      mono.rotation.y = (Math.random() - 0.5) * 0.6;
      mono.scale.setScalar(1.35);
      this.scene.add(mono);
      this.lights.track(mono);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Kapuk                                                               */
  /* ------------------------------------------------------------------ */
  #spawnGates(actIndex) {
    const act = ACTS[actIndex];
    const baseZ = this.#checkpointZ(actIndex) - GATE_DISTANCE;

    this.gates = act.options.map((opt, i) => {
      const gate = buildGate(opt.color);
      const y = terrainHeight(this.noise, opt.offset, baseZ);
      gate.position.set(opt.offset, y, baseZ);
      gate.lookAt(opt.offset * 0.4, y + 7, baseZ + 40);
      gate.scale.setScalar(0.01);
      this.scene.add(gate);
      this.lights.track(gate);

      gate.userData.baseY = y;
      gate.userData.yaw0  = gate.rotation.y;

      // Felemelkedés: a kapuk egymás után nyílnak ki, nem egyszerre,
      // és a méret enyhén túlszalad, mielőtt beáll. A régi lineáris
      // easeOut-os skálázás pattanásnak látszott.
      const delay = i * 0.18;
      this.tweens.add(1.5 + delay, (k) => {
        const u = clamp((k * (1.5 + delay) - delay) / 1.5, 0, 1);
        const e = easeOut(u);
        // lágy túllövés: 1.0 fölé megy, majd visszasimul
        const overshoot = 1 + Math.sin(u * Math.PI) * 0.09 * (1 - u);
        gate.scale.setScalar(Math.max(0.01, e * overshoot));
        gate.position.y = y - (1 - e) * 9;
        gate.rotation.y = gate.userData.yaw0 + (1 - e) * 0.26;
      });

      return { gate, opt };
    });
  }

  #clearGates(chosenIndex) {
    this.gates.forEach(({ gate }, i) => {
      if (i === chosenIndex) {
        // A választott kapu felizzik, és csak utána halványul el,
        // miközben a kamera áthalad rajta
        const y1 = gate.position.y;
        this.tweens.add(0.9, (k) => {
          const e = easeOut(k);
          gate.userData.portalUniforms.uPower.value = e;
          gate.userData.light.intensity = gate.userData.baseIntensity * (1 + e * 4);
          // Enyhén tágul, mintha beszívná a kamerát
          gate.scale.setScalar(1 + e * 0.12);
          gate.position.y = y1 + e * 0.8;
        }, () => {
          this.tweens.add(4.5, (k) => {
            gate.userData.portalUniforms.uPower.value = 1 - k * k;
            gate.userData.light.intensity = gate.userData.baseIntensity * 5 * (1 - k);
          }, () => { this.scene.remove(gate); disposeGate(gate); });
        });
      } else {
        // A többi elsüllyed — lágy gyorsulással, nem egyenletesen
        const y0 = gate.position.y;
        const yaw0 = gate.rotation.y;
        this.tweens.add(1.6, (k) => {
          const e = k * k;                       // lassan indul, majd elnyeli a föld
          gate.position.y = y0 - e * 18;
          gate.rotation.y = yaw0 + e * 0.5;
          gate.userData.light.intensity = gate.userData.baseIntensity * (1 - e);
          gate.scale.setScalar(1 - e * 0.35);
          gate.userData.portalUniforms.uPower.value = -0.2 * e;
        }, () => { this.scene.remove(gate); disposeGate(gate); });
      }
    });
    this.gates = [];
  }

  /* ------------------------------------------------------------------ */
  /* Hangulat                                                            */
  /* ------------------------------------------------------------------ */
  #applyMood(mood, duration = 2.6) {
    const from = this.moodCurrent || {
      fog: this.scene.fog.color.getHexString(),
      fogDensity: this.scene.fog.density,
      ambient: this.ambient.color.getHexString(),
      ambientIntensity: this.ambient.intensity,
      key: this.keyLight.color.getHexString(),
      keyIntensity: this.keyLight.intensity,
      mote: this.motes.userData.uniforms.uColor.value.getHexString(),
      moteRise: this.motes.userData.uniforms.uRise.value,
      moteSize: this.motes.userData.uniforms.uSize.value,
      water: this.water.position.y,
      aurora: this.aurora.userData.uniforms.uPower.value,
      mist: this.mist.userData.uniforms.uOpacity.value,
      lava: this.lava.userData.uniforms.uPower.value,
    };

    const cFog = new THREE.Color(`#${from.fog}`.replace('##', '#'));
    const cAmb = new THREE.Color(`#${from.ambient}`.replace('##', '#'));
    const cKey = new THREE.Color(`#${from.key}`.replace('##', '#'));
    const cMot = new THREE.Color(`#${from.mote}`.replace('##', '#'));

    const tFog = new THREE.Color(mood.fog);
    const tAmb = new THREE.Color(mood.ambient);
    const tKey = new THREE.Color(mood.key);
    const tMot = new THREE.Color(mood.mote);

    const startWater = this.water.position.y;
    const startDens  = this.scene.fog.density;
    const startAmbI  = this.ambient.intensity;
    const startKeyI  = this.keyLight.intensity;
    const startAur   = this.aurora.userData.uniforms.uPower.value;
    const startMist  = this.mist.userData.uniforms.uOpacity.value;
    const startSize  = this.motes.userData.uniforms.uSize.value;
    const startLava  = this.lava.userData.uniforms.uPower.value;

    this.tweens.add(duration, (k) => {
      this.scene.fog.color.copy(cFog).lerp(tFog, k);
      this.scene.background.copy(this.scene.fog.color).multiplyScalar(0.55);
      this.scene.fog.density = THREE.MathUtils.lerp(startDens, mood.fogDensity, k);

      this.ambient.color.copy(cAmb).lerp(tAmb, k);
      this.ambient.intensity = THREE.MathUtils.lerp(startAmbI, mood.ambientIntensity, k);

      this.keyLight.color.copy(cKey).lerp(tKey, k);
      this.keyLight.intensity = THREE.MathUtils.lerp(startKeyI, mood.keyIntensity, k);

      this.travelLight.color.copy(this.keyLight.color);

      const mu = this.motes.userData.uniforms;
      mu.uColor.value.copy(cMot).lerp(tMot, k);
      mu.uSize.value = THREE.MathUtils.lerp(startSize, mood.moteSize, k);
      mu.uRise.value = mood.moteRise;

      this.water.position.y = THREE.MathUtils.lerp(startWater, mood.water, k);
      this.aurora.userData.uniforms.uPower.value = THREE.MathUtils.lerp(startAur, mood.aurora, k);
      this.mist.userData.uniforms.uOpacity.value = THREE.MathUtils.lerp(startMist, mood.mist, k);

      if (mood.lava !== undefined) {
        this.lava.userData.uniforms.uPower.value = THREE.MathUtils.lerp(startLava, mood.lava, k);
      }
    });

    this.moodCurrent = { ...mood };
  }

  /* ------------------------------------------------------------------ */
  /* Felület                                                             */
  /* ------------------------------------------------------------------ */
  #initUI() {
    this.ui.innerHTML = `
      <div class="j-progress"><span id="jProgress"></span></div>

      <div class="j-intro" id="jIntro">
        <p class="j-kicker">Öt ének · egy jóslat</p>
        <h1>A köd kapujában</h1>
        <p class="j-intro-text">
          Végigutazol egy északi völgyön. Öt helyen áll meg az út — ott dől el,
          merre visz tovább. Amit választasz, arra fordul a kamera, és azt
          írja tovább a sorsod.
        </p>
        <div class="j-intro-actions">
          <button type="button" class="btn btn-primary" data-sound="1">🔊 Hanggal indítok</button>
          <button type="button" class="btn" data-sound="0">Némán indítok</button>
        </div>
        <p class="j-hint">Tipp: egérrel/ujjal körbenézhetsz menet közben.</p>
      </div>

      <div class="j-chapter" id="jChapter" hidden>
        <span class="j-chapter-kicker"></span>
        <h2 class="j-chapter-title"></h2>
      </div>

      <div class="j-question" id="jQuestion" hidden></div>

      <div class="j-gate-labels" id="jGateLabels"></div>

      <div class="j-twist" id="jTwist" hidden></div>

      <div class="j-echo" id="jEcho" hidden></div>

      <div class="j-finale" id="jFinale" hidden>
        <p class="j-kicker">A köd szétnyílt</p>
        <h2>Ez a te sárkányod</h2>
        <div class="j-finale-form">
          <div class="field">
            <label for="jName">Hogy hívják?</label>
            <input type="text" id="jName" maxlength="60" placeholder="pl. Zafír" autocomplete="off">
          </div>
          <div class="field">
            <label for="jColor">Milyen színű?</label>
            <input type="color" id="jColor" value="#ff8a3d">
          </div>
          <button type="button" class="btn btn-primary" id="jSave">Befogadom</button>
          <p class="j-error" id="jError" hidden></p>
        </div>
      </div>

      <div class="j-corner">
        <button type="button" class="j-skip" id="jSkip" title="Kihagyom a látványt">Egyszerű nézet</button>
        <a class="j-exit" href="index.php">Kilépés</a>
      </div>
    `;

    this.el = {
      progress: this.ui.querySelector('#jProgress'),
      intro:    this.ui.querySelector('#jIntro'),
      chapter:  this.ui.querySelector('#jChapter'),
      question: this.ui.querySelector('#jQuestion'),
      labels:   this.ui.querySelector('#jGateLabels'),
      twist:    this.ui.querySelector('#jTwist'),
      echo:     this.ui.querySelector('#jEcho'),
      finale:   this.ui.querySelector('#jFinale'),
      skip:     this.ui.querySelector('#jSkip'),
    };

    this.el.intro.querySelectorAll('[data-sound]').forEach((btn) => {
      btn.addEventListener('click', () => this.#begin(btn.dataset.sound === '1'));
    });

    this.el.skip.addEventListener('click', () => {
      window.sessionStorage.setItem('quizClassic', '1');
      window.location.reload();
    });

    // Enyhe körbenézés egérrel
    this.look = { x: 0, y: 0, tx: 0, ty: 0 };
    this.root.addEventListener('pointermove', (e) => {
      const r = this.root.getBoundingClientRect();
      this.look.tx = clamp(((e.clientX - r.left) / r.width  - 0.5) * 2, -1, 1);
      this.look.ty = clamp(((e.clientY - r.top)  / r.height - 0.5) * 2, -1, 1);
    });
  }

  #setProgress(k) {
    this.el.progress.style.width = `${clamp(k, 0, 1) * 100}%`;
  }

  /** Szavanként megjelenő szöveg. */
  #typeWords(el, text) {
    el.innerHTML = '';
    el.hidden = false;
    text.split(' ').forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'j-word';
      span.textContent = word;
      span.style.animationDelay = `${i * 45}ms`;
      el.appendChild(span);
      el.appendChild(document.createTextNode(' '));
    });
  }

  #showChapter(act) {
    const el = this.el.chapter;
    el.querySelector('.j-chapter-kicker').textContent = act.chapter;
    el.querySelector('.j-chapter-title').textContent = act.title;
    el.hidden = false;
    el.classList.remove('is-out');
    el.classList.add('is-in');

    setTimeout(() => {
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(() => { el.hidden = true; }, 900);
    }, 2400);
  }

  #showTwist(key) {
    const text = TWIST_TEXT[key];
    if (!text) return;
    const el = this.el.twist;
    el.textContent = text;
    el.hidden = false;
    el.classList.add('is-in');
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => { el.hidden = true; }, 800);
    }, 2600);
  }

  #showEcho(text) {
    const el = this.el.echo;
    el.textContent = text;
    el.hidden = false;
    el.classList.add('is-in');
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => { el.hidden = true; }, 700);
    }, 2200);
  }

  /* ------------------------------------------------------------------ */
  /* Folyamat                                                            */
  /* ------------------------------------------------------------------ */
  #begin(withSound) {
    this.sfx.start(withSound);
    this.el.intro.classList.add('is-gone');
    setTimeout(() => { this.el.intro.hidden = true; }, 700);

    this.state = 'travel';
    this.#applyMood(ACTS[0].mood, 3.2);
    this.#showChapter(ACTS[0]);
    this.#travelTo(this.checkpointS[0], 7.5, () => this.#arriveAtCheckpoint());
  }

  /** A kamera elindul a megadott node-pozícióra. */
  #travelTo(targetS, duration, onDone) {
    const startS = this.s;
    this.state = 'travel';
    this.tweens.add(duration, (k) => {
      this.s = THREE.MathUtils.lerp(startS, targetS, k);
    }, onDone);
  }

  #arriveAtCheckpoint() {
    const act = ACTS[this.actIndex];
    this.state = 'question';

    this.sfx.chime(520 + this.actIndex * 70);
    this.#spawnGates(this.actIndex);
    this.#typeWords(this.el.question, act.question);
    this.#buildGateLabels(act);
    this.#setProgress(this.actIndex / ACTS.length);
  }

  #buildGateLabels(act) {
    this.el.labels.innerHTML = '';
    this.labelEls = act.options.map((opt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'j-gate-label';
      btn.style.setProperty('--gate-color', opt.color);
      btn.innerHTML = `<span class="j-gate-rune">◈</span><span>${opt.label}</span>`;
      btn.style.animationDelay = `${900 + i * 160}ms`;
      btn.addEventListener('click', () => this.#choose(i));
      btn.addEventListener('pointerenter', () => {
        const g = this.gates[i];
        if (g) g.gate.userData.hover = true;
      });
      btn.addEventListener('pointerleave', () => {
        const g = this.gates[i];
        if (g) g.gate.userData.hover = false;
      });
      this.el.labels.appendChild(btn);
      return btn;
    });
  }

  #choose(optionIndex) {
    if (this.state !== 'question') return;

    const act = ACTS[this.actIndex];
    const opt = act.options[optionIndex];

    this.answers.push(optionIndex + 1);
    this.state = 'transition';

    this.sfx.chime(760);
    this.el.question.hidden = true;
    this.el.labels.innerHTML = '';
    this.#showEcho(opt.line);
    this.#clearGates(optionIndex);

    // Az útvonal folytatása: a választott kapun át
    const gateZ = this.#checkpointZ(this.actIndex) - GATE_DISTANCE;
    const nextZ = this.#checkpointZ(this.actIndex + 1);

    const isLast = this.actIndex >= ACTS.length - 1;

    this.nodes.push(this.#node(opt.offset, gateZ, 7.8));

    if (!isLast) {
      this.nodes.push(this.#node(opt.offset * 0.45, (gateZ + nextZ) / 2, 8.6));
      this.nodes.push(this.#node(0, nextZ, 7.5));
    } else {
      // Finálé: a szempár ELŐTT állunk meg. Fontos, hogy a pontok
      // végig egy irányba haladjanak — különben a görbe visszafordul,
      // és a kamera hátat fordít a sárkánynak.
      this.nodes.push(this.#node(opt.offset * 0.35, gateZ - 22, 8.4));
      this.nodes.push(this.#node(6, FINALE_STOP_Z, 9.5));
    }

    this.#rebuildCurve();
    const targetS = this.nodes.length - 1;

    // A kapun áthaladva jön a csavar, aztán a következő felvonás
    this.#playTwist(act.twist, () => {
      if (isLast) {
        this.#travelTo(targetS, 9, () => this.#finale());
      } else {
        this.actIndex++;
        this.#applyMood(ACTS[this.actIndex].mood, 5);
        this.#travelTo(targetS, 10, () => {
          this.#showChapter(ACTS[this.actIndex]);
          setTimeout(() => this.#arriveAtCheckpoint(), 1400);
        });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Csavarok                                                            */
  /* ------------------------------------------------------------------ */
  #playTwist(key, onDone) {
    this.state = 'twist';
    const camZ = this.#pointAt(this.s).z;

    switch (key) {

      /* --- A tenger visszahúzódik --------------------------------- */
      case 'seaRecoil': {
        this.#showTwist(key);
        this.sfx.boom(0.55);

        const y0 = this.water.position.y;
        this.tweens.add(2.2, (k) => {
          this.water.position.y = y0 - k * 16;
        }, () => {
          this.tweens.add(2.4, (k) => {
            this.water.position.y = (y0 - 16) + k * 20;
            this.shake.amount = Math.max(this.shake.amount, 0.5 * (1 - k));
          });
        });

        // Sötét alak a víz alatt
        const sil = this.silhouette;
        sil.visible = true;
        sil.scale.setScalar(1.6);
        sil.position.set(-40, y0 - 9, camZ - 130);
        sil.rotation.z = Math.PI * 0.5;
        this.tweens.add(4.2, (k) => {
          sil.material.opacity = Math.sin(k * Math.PI) * 0.55;
          sil.position.x = -40 + k * 90;
        }, () => { sil.visible = false; sil.rotation.z = 0; });

        setTimeout(onDone, 2600);
        break;
      }

      /* --- Átrepülő sárkány --------------------------------------- */
      case 'flyby': {
        this.#showTwist(key);
        this.sfx.whoosh();

        const sil = this.silhouette;
        sil.visible = true;
        sil.scale.setScalar(2.4);
        sil.rotation.z = 0.25;

        const startX = 220, endX = -260;
        const y = 95;
        this.tweens.add(3.0, (k) => {
          sil.position.set(
            THREE.MathUtils.lerp(startX, endX, k),
            y + Math.sin(k * Math.PI) * 26,
            camZ - 210
          );
          sil.material.opacity = Math.sin(clamp(k * 1.25, 0, 1) * Math.PI) * 0.95;
          sil.rotation.z = 0.25 - k * 0.5;

          // A hold glóriája elsötétül, ahogy elé ér
          const eclipse = 1 - Math.exp(-Math.pow((k - 0.5) * 4, 2)) * 0.9;
          this.moon.userData.halo.value = eclipse;
          this.shake.amount = Math.max(this.shake.amount, Math.exp(-Math.pow((k - 0.5) * 5, 2)) * 0.9);
        }, () => {
          sil.visible = false;
          this.moon.userData.halo.value = 1;
        }, (t) => t);

        setTimeout(onDone, 2400);
        break;
      }

      /* --- Kitörés ------------------------------------------------ */
      case 'eruption': {
        this.#showTwist(key);
        this.sfx.boom(1.0);

        this.tweens.add(2.6, (k) => {
          this.lava.userData.uniforms.uPower.value = k;
        });

        const sw = this.shockwave;
        sw.visible = true;
        const p = this.#pointAt(this.s);
        sw.position.set(p.x, terrainHeight(this.noise, p.x, p.z - 120) + 1.5, p.z - 120);
        this.tweens.add(2.8, (k) => {
          sw.scale.setScalar(1 + k * 130);
          sw.userData.uniforms.uProgress.value = k;
          this.shake.amount = Math.max(this.shake.amount, (1 - k) * 1.5);
        }, () => { sw.visible = false; }, easeOut);

        // Fényvillanás alulról
        this.tweens.add(1.4, (k) => {
          this.flashLight.intensity = Math.sin(k * Math.PI) * 1.4;
          this.flashLight.color.setHex(0xff7a2c);
        }, () => { this.flashLight.intensity = 0; });

        setTimeout(onDone, 2800);
        break;
      }

      /* --- Villám + koponyakapu ----------------------------------- */
      case 'lightning': {
        this.#showTwist(key);
        this.sfx.thunder();

        // Kettős villanás
        this.tweens.add(0.28, (k) => {
          this.flashLight.color.setHex(0xdce9ff);
          this.flashLight.intensity = (1 - k) * 4.2;
        }, () => {
          this.tweens.add(0.55, (k) => {
            this.flashLight.intensity = Math.sin(k * Math.PI) * 2.4;
          }, () => { this.flashLight.intensity = 0; });
        }, (t) => t);

        this.shake.amount = 1.3;

        // A koponyaív megjelenik az út következő szakaszán
        const arch = this.skullArch;
        const archZ = this.#checkpointZ(this.actIndex + 1) + 62;
        arch.position.set(0, terrainHeight(this.noise, 0, archZ), archZ);
        arch.visible = true;
        arch.userData.light.intensity = 0;
        this.tweens.add(3.0, (k) => {
          arch.userData.light.intensity = k * 60;
          arch.children[0].material.opacity = k * 0.94;
        });

        setTimeout(onDone, 2200);
        break;
      }

      /* --- A szempár kinyílik ------------------------------------- */
      case 'reveal': {
        this.#showTwist(key);

        const z = FINALE_STAGE_Z;
        this.eyes.position.set(0, terrainHeight(this.noise, 0, z) + 20, z);
        this.eyes.visible = true;

        this.tweens.add(3.4, (k) => {
          this.eyes.userData.uniforms.uOpen.value = k;
          this.eyes.userData.light.intensity = k * 120;
        });

        this.sfx.boom(0.5);
        setTimeout(onDone, 1600);
        break;
      }

      default:
        onDone();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Finálé                                                              */
  /* ------------------------------------------------------------------ */
  async #finale() {
    this.state = 'finale';
    this.#setProgress(1);
    this.#applyMood(FINALE_MOOD, 4);

    // Ugyanaz a válogatás, mint az egyszerű kérdőívben: kevert sárkány,
    // nem egy kész szett (lásd script/pick_parts.js)
    this.parts = window.pickParts
      ? window.pickParts(this.answers)
      : { body: 1, head: 1, legs: 1, wings: 1 };

    await this.dragonCanvas.load(this.parts);

    // A sárkány pontosan ott jelenik meg, ahol a szempár nyílt
    const bz = FINALE_STAGE_Z;
    // +22, nem +17: a rajz alsó széle alatt van még ~4 egység üres hely,
    // ezért alacsonyabban a sárkány lábai a terepbe süllyedtek.
    const by = terrainHeight(this.noise, 0, bz) + 22;
    this.dragonBillboard.position.set(0, by, bz);
    this.dragonBillboard.visible = true;
    this.dragonBaseY = by;

    this.aura.position.set(0, by - 2, bz - 6);
    this.aura.visible = true;
    this.dragonLight.position.set(0, by - 6, bz + 10);

    // A koponyaív már mögöttünk van, nincs rá szükség
    this.skullArch.visible = false;

    this.sfx.roar();
    this.shake.amount = 1.1;

    this.tweens.add(2.6, (k) => {
      this.dragonBillboard.material.opacity = k;
      this.aura.userData.uniforms.uPower.value = k * 0.85;
      this.dragonLight.intensity = k * 70;
      this.eyes.userData.uniforms.uOpen.value = 1 - k;
      this.eyes.userData.light.intensity = (1 - k) * 120;
    }, () => { this.eyes.visible = false; });

    // A kamera ráfordul a sárkányra. A korábbi `this.s += 0.28` semmit
    // nem csinált: a #toT() 1-re vágja a paramétert, tehát a pálya végén
    // a kamera már nem mozdult. Helyette valódi ráközelítés + célzás.
    this.tweens.add(2.2, (k) => { this.finaleAim = easeOut(k); });
    this.tweens.add(7.0, (k) => { this.finaleDolly = easeOut(k) * 16; });

    setTimeout(() => this.#showFinaleForm(), 2600);
  }

  #showFinaleForm() {
    const el = this.el.finale;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-in'));

    const nameEl  = el.querySelector('#jName');
    const colorEl = el.querySelector('#jColor');
    const saveBtn = el.querySelector('#jSave');
    const errEl   = el.querySelector('#jError');

    colorEl.addEventListener('input', () => this.dragonCanvas.tint(colorEl.value));

    saveBtn.addEventListener('click', () => {
      const name = nameEl.value.trim();
      if (!name) {
        errEl.textContent = 'Adj nevet a sárkányodnak!';
        errEl.hidden = false;
        nameEl.focus();
        return;
      }

      errEl.hidden = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Mentés…';

      const body = new FormData();
      body.append('_csrf', CFG.csrf || '');
      body.append('dragonName', name);
      body.append('color', colorEl.value);
      body.append('body',  this.parts.body);
      body.append('head',  this.parts.head);
      body.append('legs',  this.parts.legs);
      body.append('wings', this.parts.wings);

      fetch(CFG.saveUrl || 'save_dragon.php', { method: 'POST', body, credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          this.sfx.chime(880);
          window.location.href = 'user.php';
        })
        .catch((err) => {
          errEl.textContent = `Nem sikerült elmenteni: ${err.message}`;
          errEl.hidden = false;
          saveBtn.disabled = false;
          saveBtn.textContent = 'Befogadom';
        });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Képkocka                                                            */
  /* ------------------------------------------------------------------ */
  #resize() {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    if (!w || !h) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);

    // A bloom fél felbontáson fut (a TÉNYLEGES renderelési felbontás
    // felén). Alacsony frekvenciás effekt, a különbség nem látszik.
    const r = this.gov.ratio;
    this.bloom.setSize(Math.max(2, Math.round(w * r / 2)), Math.max(2, Math.round(h * r / 2)));
  }

  /**
   * Felbontás-szabályozó. Minden képkockán méri a VALÓS eltelt időt, és
   * másodpercenként legfeljebb egyszer dönt:
   *
   *   - ha lassú (> 20 ms, azaz 50 fps alatt): lejjebb veszi a felbontást;
   *     ha már a minimumon van, a látványból is visszavesz (köd, parázs,
   *     végül a fényudvar)
   *   - ha hozza a 60 fps-t: óvatosan feljebb lép
   *
   * Ha egy emelés után visszaesik, az emelés egyre hosszabb ideig tiltott —
   * így nem ingázik két felbontás között (ami maga is akadást okozna, mert
   * minden váltás újrafoglalja a renderelési célpontokat).
   */
  #govern() {
    const g = this.gov;
    const now = performance.now();
    const ms = g.last ? now - g.last : 16.7;
    g.last = now;

    // Fülváltás, betöltés, szünet: ezekből nem szabad következtetni
    if (ms > 250 || this.state === 'boot' || this.state === 'intro') { g.next = now + 1500; return; }

    g.avg += (ms - g.avg) * 0.08;
    if (now < g.next) return;
    g.next = now + 1000;

    if (g.avg > 20) {
      if (g.ratio > g.min + 0.001) {
        this.#setRatio(Math.max(g.min, g.ratio - (g.avg > 30 ? 0.2 : 0.1)));
        // Ha épp emelés után esett vissza, sokáig ne próbálkozzon újra
        g.hold = now + g.holdLen;
        g.holdLen = Math.min(60000, g.holdLen * 2);
      } else if (g.avg > 24 && g.tier > 0) {
        this.#setTier(g.tier - 1);
      }
      g.next = now + 1400;          // a váltás után hagyjuk beállni
    } else if (g.avg < 17.8 && now > g.hold && g.ratio < g.max - 0.001) {
      this.#setRatio(Math.min(g.max, g.ratio + 0.1));
      g.next = now + 1400;
    }
  }

  #setRatio(r) {
    this.gov.ratio = Math.round(r * 100) / 100;
    this.renderer.setPixelRatio(this.gov.ratio);
    // A kompozitornak KÜLÖN kell szólni: a renderelő felbontását nem
    // követi. (A régi visszavétel emiatt hatástalan volt: a drága
    // utófeldolgozás maradt teljes felbontáson.)
    this.composer.setPixelRatio(this.gov.ratio);
    this.#resize();
  }

  #setTier(t) {
    this.gov.tier = t;
    if (t <= 1) {
      // Az átfedő ködsávok fele és a parázs fele
      this.mist.children.forEach((band, i) => { if (i % 2) band.visible = false; });
      const geo = this.motes.geometry;
      geo.setDrawRange(0, Math.floor(geo.attributes.position.count / 2));
    }
    if (t <= 0) {
      this.bloom.enabled = false;
      const geo = this.motes.geometry;
      geo.setDrawRange(0, Math.floor(geo.attributes.position.count / 4));
    }
  }

  /** Bloommal a kompozitoron át, nélküle közvetlenül — egy teljes képernyős menet kevesebb. */
  #render() {
    if (this.bloom.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /**
   * Shaderek előfordítása a bevezető képernyő alatt.
   *
   * A rejtett elemek (szempár, koponyaív, fénykorona, kapuk) shadere
   * különben az első megjelenéskor fordulna le — épp a látványos
   * pillanatokban akadna meg a kép. A compileAsync a böngésző
   * párhuzamos fordítását használja, ha van ilyen.
   */
  #prewarm() {
    const probe = buildGate('#ffffff');
    probe.position.set(0, -600, 0);
    this.scene.add(probe);

    const hidden = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });

    // A shader-változat függ attól, HOVA renderelünk: a kompozitor
    // célpontjába (bloommal) lineáris színtérben, tónusleképezés nélkül,
    // a képernyőre sRGB-ben. Rossz célponttal fordítva az első valódi
    // megjelenéskor mégis újrafordulna. Bloommal mindkettőt fordítjuk,
    // hogy egy későbbi visszavétel (bloom ki) se akasszon.
    const targets = this.bloom.enabled ? [this.composer.renderTarget1, null] : [null];
    const jobs = [];
    for (const t of targets) {
      this.renderer.setRenderTarget(t);
      try {
        jobs.push(this.renderer.compileAsync
          ? this.renderer.compileAsync(this.scene, this.camera)
          : (this.renderer.compile(this.scene, this.camera), Promise.resolve()));
      } catch (e) { /* nem kritikus: legfeljebb később fordul */ }
    }
    this.renderer.setRenderTarget(null);
    const done = Promise.all(jobs);

    // Azonnal visszaállítjuk: a fordítás már elindult, a következő
    // képkocka nem rajzolhatja ki a rejtett elemeket
    hidden.forEach((o) => { o.visible = false; });

    // A mintakaput NEM dobjuk el, csak kivesszük a jelenetből: a three.js
    // felszabadítja a shader-programot, ha az utolsó anyag, ami használja,
    // eldobásra kerül — és a valódi kapuk anyagát a választás után
    // eldobjuk. Ez a példány tartja életben a portál programját, különben
    // minden kérdésnél újrafordulna.
    this.portalKeeper = probe;
    Promise.resolve(done).catch(() => {}).finally(() => {
      this.scene.remove(probe);
    });
  }

  #updateCamera(dt, time) {
    const pos  = this.#pointAt(this.s);
    const look = this.#lookPoint(this.s);

    // A terep hullámzása miatt a következő pályapont sokszor jóval lejjebb
    // van — ha egy az egyben oda néznénk, a kamera folyton a földre bökne.
    // Ezért a nézőpont magasságát a kamera saját magassága felé húzzuk.
    look.y = THREE.MathUtils.lerp(pos.y, look.y, 0.3);

    // Finálé: a pálya érintője helyett a sárkányra célzunk. Az `aimShift`
    // jobbra tolja a nézőpontot, így a sárkány a kép BAL felébe kerül —
    // a jobb oldalt a névadó kártya foglalja el. Keskeny kijelzőn a
    // kártya alul van, ott nem kell eltolni.
    if (this.finaleAim > 0) {
      const bb = this.dragonBillboard.position;
      const aimShift = this.camera.aspect > 1.25 ? 19 : 0;
      const aim = new THREE.Vector3(bb.x + aimShift, bb.y - 0.5, bb.z);
      look.lerp(aim, this.finaleAim);

      if (this.finaleDolly > 0) {
        const toward = aim.clone().sub(pos).normalize();
        pos.addScaledVector(toward, this.finaleDolly);
      }
    }

    this.camera.position.copy(pos);

    // Finom, „kézben tartott" lebegés
    const bobY = Math.sin(time * 0.9) * 0.55 + Math.sin(time * 2.3) * 0.18;
    const bobX = Math.cos(time * 0.7) * 0.45;
    this.camera.position.y += bobY;
    this.camera.position.x += bobX;

    // Először a pálya irányába nézünk…
    this.camera.lookAt(look);

    // …majd az egér pozíciója szerint finoman elfordítjuk.
    // Szögben számolunk, nem világegységben — így a kilengés akkor sem nő
    // meg, ha a következő pályapont közel van.
    this.look.x += (this.look.tx - this.look.x) * Math.min(1, dt * 2.4);
    this.look.y += (this.look.ty - this.look.y) * Math.min(1, dt * 2.4);

    this.camera.rotateY(-this.look.x * 0.085);  // ±4.9°
    this.camera.rotateX(-this.look.y * 0.055);  // ±3.2°
    this.camera.rotation.z += this.look.x * 0.018;

    // Rázkódás
    if (this.shake.amount > 0.001) {
      const a = this.shake.amount;
      this.camera.position.x += (Math.random() - 0.5) * a * 1.6;
      this.camera.position.y += (Math.random() - 0.5) * a * 1.6;
      this.camera.rotation.z += (Math.random() - 0.5) * a * 0.035;
      this.shake.amount = Math.max(0, a - dt * this.shake.decay);
    }

    this.travelLight.position.copy(this.camera.position);
    this.travelLight.position.y += 6;
  }

  /** A kapufeliratok a kapuk 3D-s helyére vetítve. */
  #updateGateLabels() {
    if (!this.gates.length || !this.labelEls) return;

    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const v = new THREE.Vector3();

    this.gates.forEach(({ gate }, i) => {
      const label = this.labelEls[i];
      if (!label) return;

      v.copy(gate.position);
      v.y += 13;                      // világ szerinti „fölé", nem a kapu dőlt tengelye mentén
      v.project(this.camera);

      const visible = v.z < 1;
      label.style.display = visible ? '' : 'none';
      if (!visible) return;

      label.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      label.style.top  = `${(-v.y * 0.5 + 0.5) * h}px`;
    });
  }

  #loop = () => {
    requestAnimationFrame(this.#loop);

    const dt   = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    this.#govern();

    this.tweens.update(dt);

    /* --- Shaderek ideje --- */
    this.water.userData.uniforms.uTime.value = time;
    this.aurora.userData.uniforms.uTime.value = time;
    this.stars.material.uniforms.uTime.value = time;
    this.motes.userData.uniforms.uTime.value = time;
    this.mist.userData.uniforms.uTime.value = time;
    this.lava.userData.uniforms.uTime.value = time;
    this.eyes.userData.uniforms.uTime.value = time;

    /* --- Kapuk --- */
    this.gates.forEach(({ gate }) => {
      const ud = gate.userData;
      ud.portalUniforms.uTime.value = time;

      // Üresjárati lebegés: minden kapu a saját fázisán, hogy ne
      // mozogjanak egyszerre. Ez teszi „élővé" az álló jelenetet.
      if (ud.baseY !== undefined && this.state === 'question') {
        gate.position.y = ud.baseY + Math.sin(time * 0.55 + ud.phase) * 0.55;
        gate.rotation.y = ud.yaw0 + Math.sin(time * 0.33 + ud.phase) * 0.035;
        // A hártya lassan pördül a saját síkjában
        ud.portal.rotation.z = Math.sin(time * 0.18 + ud.phase) * 0.26;
      }

      const want = ud.hover ? 0.55 : 0.0;
      const u = ud.portalUniforms.uPower;
      if (this.state === 'question') {
        // Lassabb követés + a fény késik a hártya mögött: így a rámutatás
        // nem kapcsolóként, hanem felizzásként hat.
        u.value += (want - u.value) * Math.min(1, dt * 3.2);
        const target = ud.baseIntensity * (1 + u.value * 2.4);
        ud.light.intensity += (target - ud.light.intensity) * Math.min(1, dt * 2.2);
      }
    });

    /* --- Részecskék és köd a kamerával utaznak --- */
    this.motes.position.z = this.camera.position.z;
    this.motes.position.x = this.camera.position.x;

    this.mist.children.forEach((band) => {
      band.position.x = band.userData.baseX + Math.sin(time * 0.12 + band.userData.driftSeed) * 12;
      band.lookAt(this.camera.position.x, band.position.y, this.camera.position.z);
    });

    /* --- Billboardok mindig a kamerára néznek --- */
    if (this.dragonBillboard.visible) {
      // CSAK függőleges tengely körül fordul. A teljes lookAt() hátradöntötte
      // a sárkányt (a kamera lejjebb van), ezért ferdén, „ledőlve" állt.
      const yaw = Math.atan2(
        this.camera.position.x - this.dragonBillboard.position.x,
        this.camera.position.z - this.dragonBillboard.position.z
      );
      this.dragonBillboard.rotation.set(0, yaw, 0);
      this.aura.rotation.set(0, yaw, 0);

      // Lebegés az alaphelyzethez képest. Korábban `+=` volt: az minden
      // képkockán hozzáadott, tehát képfrissítés-függően elúszott.
      this.dragonBillboard.position.y = this.dragonBaseY + Math.sin(time * 0.85) * 0.9;
      this.aura.position.y = this.dragonBaseY - 2 + Math.sin(time * 0.85) * 0.5;
      this.aura.userData.uniforms.uTime.value = time;
    }
    if (this.eyes.visible) this.eyes.lookAt(this.camera.position);
    if (this.silhouette.visible) {
      this.silhouette.lookAt(this.camera.position.x, this.silhouette.position.y, this.camera.position.z);
    }
    if (this.skullArch.visible) {
      this.skullArch.children[0].lookAt(
        this.camera.position.x, this.skullArch.position.y + 34, this.camera.position.z
      );
    }

    this.#updateCamera(dt, time);
    this.lights.update(this.camera.position, dt);
    this.#updateGateLabels();

    // Az út közben a haladást is mutatjuk
    if (this.state === 'travel' || this.state === 'transition') {
      const total = ACTS.length;
      const done  = this.actIndex + (this.state === 'transition' ? 0.5 : 0);
      this.#setProgress(done / total);
    }

    this.#render();
  };
}

/* =====================================================================
   Indítás
   ===================================================================== */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const root = document.getElementById('journeyRoot');

if (root && webglAvailable()) {
  document.body.classList.add('journey-active');
  new Journey(root);
} else if (root) {
  root.dispatchEvent(new CustomEvent('journey:unavailable', { bubbles: true }));
}
