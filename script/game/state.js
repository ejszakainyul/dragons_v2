/* =====================================================================
   Játékállapot + szerverkapcsolat
   ---------------------------------------------------------------------
   A mentés JSON a szerveren (sarkanyok_jatek). Automatikusan ment, ha
   változott valami, legfeljebb 15 másodpercenként — és az oldal
   elhagyásakor sendBeacon-nel, hogy semmi ne vesszen el.
   ===================================================================== */
import { deriveStats, levelOf } from './rules.js';

export class Api {
  constructor(url, csrf) { this.url = url; this.csrf = csrf; }

  async get(action) {
    const r = await fetch(`${this.url}?action=${action}`, { credentials: 'same-origin' });
    const data = await r.json().catch(() => ({ error: 'Érvénytelen válasz a szervertől.' }));
    if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  #form(action, fields) {
    const fd = new FormData();
    fd.append('_csrf', this.csrf);
    fd.append('action', action);
    const put = (k, v) => {
      if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) put(`${k}[${kk}]`, vv);
      else fd.append(k, v);
    };
    for (const [k, v] of Object.entries(fields || {})) put(k, v);
    return fd;
  }

  async post(action, fields) {
    const r = await fetch(this.url, { method: 'POST', body: this.#form(action, fields), credentials: 'same-origin' });
    const data = await r.json().catch(() => ({ error: 'Érvénytelen válasz a szervertől.' }));
    if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  beacon(action, fields) {
    return navigator.sendBeacon?.(this.url, this.#form(action, fields));
  }
}

const DEFAULT_SAVE = () => ({
  v: 1,
  pos: null,
  shards: 40,
  herbs: 2,
  party: [],
  hp: {},
  cleared: {},
  fog: '',
  herbsTaken: {},
  stones: {},
  stats: { battles: 0, wins: 0, tamed: 0, hatched: 0, spars: 0, drills: 0 },
  muted: false,
  story: null,              // a saga állása (story.js tölti ki)
  learned: {},              // sárkány-id → tanult technikák
  train: {},                // sárkány-id → edzésfokozatok {atk, def, spd, hp}
  ultis: [],                // elnyert ultik (ULTIMATES kulcsai)
  relics: [],               // megtalált ereklyék (RELICS kulcsai)
  techSrc: [],              // helyek, ahol a játékos már elsajátított technikát (hermit, dwarf…)
  places: {},               // a völgy helyeinek állapota (ládák, próbák, mellékszálak)
});

export class GameState {
  constructor(api, server) {
    this.api = api;
    this.catalog = server.catalog;
    this.tiers = server.tiers;
    this.traits = server.traits;
    this.rules = server.rules;
    this.player = server.player;
    this.eggs = server.eggs;
    this.clockOffset = server.now - Date.now() / 1000;      // a tojások visszaszámlálásához
    this.dragons = new Map(server.dragons.map((d) => [d.id, d]));
    this.save = Object.assign(DEFAULT_SAVE(), server.save || {});
    // Régi mentésekben a kulcsos mezők tömbként is érkezhettek: legyenek objektumok
    this.save.stats = Object.assign(DEFAULT_SAVE().stats, this.save.stats || {});
    for (const k of ['ultis', 'relics', 'techSrc']) if (!Array.isArray(this.save[k])) this.save[k] = [];
    for (const k of ['hp', 'cleared', 'herbsTaken', 'stones', 'learned', 'train', 'places']) {
      const v = this.save[k];
      if (Array.isArray(v)) this.save[k] = Object.fromEntries(v.map((x, i) => [i, x]).filter(([, x]) => x != null));
      else if (!v || typeof v !== 'object') this.save[k] = {};
    }
    this.dirty = false;
    this.listeners = new Set();
    this.#repairParty();
  }

  /** A szerver órája szerinti most (másodperc). */
  get now() { return Date.now() / 1000 + this.clockOffset; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what) { for (const fn of this.listeners) fn(what); }

  /* --- Sárkányok --- */
  stats(d) { return deriveStats(d, this.catalog, { train: this.trainOf(d), relics: this.save.relics }); }

  /** Ereklye, ulti, tanult hely — egyszerű listák a mentésben. */
  has(list, key) { return (this.save[list] || []).includes(key); }
  grant(list, key) {
    if (this.has(list, key)) return false;
    this.save[list] = [...(this.save[list] || []), key];
    this.touch('party');
    return true;
  }
  level(d) { return levelOf(d.xp); }

  /** A sárkány tanult technikái (a Gyakorlótéren). */
  learnedOf(d) { return this.save.learned[d.id] || []; }
  /** Edzésfokozatok — mindig teljes objektum. */
  trainOf(d) { return { atk: 0, def: 0, spd: 0, hp: 0, ...(this.save.train[d.id] || {}) }; }

  /** A törölt sárkányok kiesnek a csapatból; üres csapatba a legerősebbek kerülnek. */
  #repairParty() {
    const s = this.save;
    s.party = (s.party || []).filter((id) => this.dragons.has(id)).slice(0, 3);
    if (!s.party.length) {
      s.party = [...this.dragons.values()]
        .sort((a, b) => (b.hp + b.dmg * 3) - (a.hp + a.dmg * 3))
        .slice(0, 3).map((d) => d.id);
    }
  }

  get party() { return this.save.party.map((id) => this.dragons.get(id)).filter(Boolean); }

  hpOf(d) {
    const max = this.stats(d).maxHp;
    const v = this.save.hp[d.id];
    return v === undefined ? max : Math.max(0, Math.min(max, v));
  }
  setHp(d, hp) { this.save.hp[d.id] = Math.round(hp); this.touch('party'); }

  healAll() {
    for (const d of this.dragons.values()) delete this.save.hp[d.id];
    this.touch('party');
  }

  addDragon(d) {
    this.dragons.set(d.id, d);
    if (this.save.party.length < 3) this.save.party.push(d.id);
    this.touch('dragons');
  }

  /* --- Mentés --- */
  touch(what = 'state') { this.dirty = true; this.emit(what); }

  /** Fontos esemény (jutalom, fizetés): azonnal ment, nem vár a 15 mp-es körre —
      különben egy újratöltéssel visszajönne pl. a tojásért fizetett szilánk. */
  commit(what = 'state') { this.touch(what); return this.flush(); }

  async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await this.api.post('save', { payload: JSON.stringify(this.save) });
    } catch (e) {
      this.dirty = true;
      console.warn('[játék] mentés sikertelen:', e.message);
    }
  }

  startAutosave() {
    setInterval(() => this.flush(), 15000);
    const bye = () => { if (this.dirty) { this.api.beacon('save', { payload: JSON.stringify(this.save) }); this.dirty = false; } };
    window.addEventListener('pagehide', bye);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bye(); });
  }

  /* --- Köd: felderített csempék bitmezőként, base64-ben --- */
  loadFog(w, h) {
    const bits = new Uint8Array(w * h);
    try {
      const raw = atob(this.save.fog || '');
      for (let i = 0; i < w * h; i++) bits[i] = (raw.charCodeAt(i >> 3) >> (i & 7)) & 1;
    } catch { /* üres/hibás köd: minden felderítetlen */ }
    return bits;
  }
  storeFog(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    this.save.fog = btoa(s);
    this.dirty = true;
  }
}
