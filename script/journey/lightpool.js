/* =====================================================================
   Fénykészlet — állandó számú valódi pontfény a sok „virtuális" között
   ---------------------------------------------------------------------
   Miért kell?

   1. Egy MeshStandard/Lambert anyag minden pixele MINDEN pontfényt
      kiszámol. A völgyben korábban 14 pontfény égett egyszerre (minden
      rúnakőnek saját volt), és a terep a képernyő nagy részét kitölti —
      ez volt a gyengébb gépeken az akadás fő oka.

   2. A three.js a fények SZÁMÁT beleégeti a shaderbe. Ha egy kapu
      megjelenésekor fény került a jelenetbe (vagy eltűnt), az összes
      anyag újrafordult — ez volt a kérdéseknél érezhető döccenés.

   Itt a fényforrások csak adatok (VirtualLight). A készlet N valódi
   PointLightot tart, sosem ad hozzá és sosem vesz el, hanem minden
   képkockán a kamerához legfontosabb N virtuális fényre állítja őket —
   lágy átúsztatással, hogy a váltás ne pattanjon.
   ===================================================================== */
import * as THREE from 'three';

/**
 * Egy fényforrás leírása. Object3D, így ugyanúgy hozzáadható egy
 * csoporthoz (`group.add(light)`), mint egy valódi fény — a meglévő kód
 * `userData.light.intensity = …` hívásai változatlanul működnek.
 * Rajzolni nem rajzol semmit.
 */
export class VirtualLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    super();
    this.isVirtualLight = true;
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
  }
}

const _pos = new THREE.Vector3();

export class LightPool {
  /**
   * @param {THREE.Scene} scene
   * @param {number} size  ennyi valódi fény lesz (a jelenet élete végéig)
   */
  constructor(scene, size = 3) {
    this.scene = scene;
    this.tracked = new Set();
    this.slots = [];

    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      // A fény sosem „tűnik el" a jelenetből, csak 0 fényerőre áll —
      // így a shaderek fényszáma állandó, nincs újrafordítás.
      scene.add(light);
      this.slots.push({ light, owner: null, fade: 0 });
    }
  }

  /** Egy objektum (és leszármazottai) virtuális fényeinek felvétele. */
  track(object) {
    object.traverse((o) => { if (o.isVirtualLight) this.tracked.add(o); });
  }

  /** Benne van-e még a jelenetben? (Egy kapu eltávolításakor kiesik.) */
  #attached(o) {
    let p = o;
    while (p) {
      if (p === this.scene) return true;
      p = p.parent;
    }
    return false;
  }

  /**
   * @param {THREE.Vector3} camPos
   * @param {number} dt  másodperc
   */
  update(camPos, dt) {
    /* --- Jelöltek pontozása: mennyire számít a kamera közelében --- */
    const scored = [];
    for (const v of this.tracked) {
      if (!this.#attached(v)) { this.tracked.delete(v); continue; }
      if (v.intensity <= 0.001 || !v.visible) continue;

      v.getWorldPosition(_pos);
      const d = _pos.distanceTo(camPos);
      // A hatótávon túl is lehet látható a megvilágított folt, de a köd
      // úgyis elnyeli — ezért a hatótáv kétszereséig számoljuk.
      const range = Math.max(1, v.distance || 60);
      if (d > range * 2.2 + 40) continue;

      const score = v.intensity / (1 + (d / range) * (d / range));
      scored.push({ v, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const wanted = new Set(scored.slice(0, this.slots.length).map((s) => s.v));

    /* --- A már kiosztott fények maradnak, a nem kívántak elhalványulnak --- */
    const fadeRate = Math.min(1, dt * 5);
    for (const slot of this.slots) {
      if (slot.owner && !wanted.has(slot.owner)) {
        slot.fade -= fadeRate;
        if (slot.fade <= 0) { slot.fade = 0; slot.owner = null; }
      }
    }

    /* --- Új jelöltek a szabad helyekre --- */
    for (const v of wanted) {
      if (this.slots.some((s) => s.owner === v)) continue;
      const free = this.slots.find((s) => !s.owner);
      if (!free) break;
      free.owner = v;
      free.fade = 0;
    }

    /* --- A valódi fények beállítása --- */
    for (const slot of this.slots) {
      const L = slot.owner;
      if (!L) { slot.light.intensity = 0; continue; }

      if (wanted.has(L)) slot.fade = Math.min(1, slot.fade + fadeRate);

      L.getWorldPosition(slot.light.position);
      slot.light.color.copy(L.color);
      slot.light.distance = L.distance;
      slot.light.decay = L.decay;
      slot.light.intensity = L.intensity * slot.fade;
    }
  }
}
