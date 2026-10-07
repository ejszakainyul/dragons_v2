/* =====================================================================
   Felület (DOM) — a Phaser vászon fölött
   ---------------------------------------------------------------------
   A szöveges felület szándékosan HTML: éles minden felbontáson,
   akadálymentes (valódi gombok, fókusz, Esc), és ugyanazt a stílust
   kapja, mint az oldal többi része (kovácsolt gombok, rúnák).
   ===================================================================== */
import {
  SKILLS, SLOTS, SLOT_NAMES, TECHNIQUES, TRAIN, CHORUS, ULTIMATES, RELICS, levelOf, xpForLevel, MAX_ENERGY, SKILL_COST,
  COMBOS, COMBO_COST, ELEMENTS,
} from './rules.js';
import { dragonLook } from './skins.js';
import { B } from './world.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

export class Hud {
  constructor(root, state, sfx) {
    this.root = root;
    this.state = state;
    this.sfx = sfx;
    this.portraits = new Map();          // sárkány-id → dataURL
    this.portraitMaker = null;           // a main.js adja (textúrákból rajzol)
    const $ = (sel) => root.querySelector(sel);
    this.el = {
      party:   $('#hudParty'),
      shards:  $('#hudShards'),
      herbs:   $('#hudHerbs'),
      prompt:  $('#hudPrompt'),
      toasts:  $('#hudToasts'),
      minimap: $('#hudMinimap'),
      modal:   $('#gameModal'),
      card:    $('#gameModalCard'),
      battle:  $('#battlePanel'),
      mute:    $('#hudMute'),
      area:    $('#hudArea'),
      quest:   $('#hudQuest'),
      compass: $('#hudCompass'),
      book:    $('#hudBook'),
      menu:    $('#hudMenu'),
    };
    this.dialogueOpen = false;

    this.el.mute?.addEventListener('click', () => {
      state.save.muted = !state.save.muted;
      sfx.setMuted(state.save.muted);
      this.#muteLabel();
      state.touch();
    });
    this.#muteLabel();

    // Esc: a nyitott ablakot bezárja, különben a játékmenüt nyitja (harcban
    // a célválasztás és a párbeszéd a saját Esc-jét kapja, ott nem nyílik)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!this.el.modal.hidden) { if (this.modalCloseable) this.closeModal(); return; }
      if (!this.dialogueOpen && !this.root.classList.contains('in-battle') && !document.querySelector('.end-screen')) this.openMenu();
    });
    this.el.menu?.addEventListener('click', () => { if (this.el.modal.hidden) { this.sfx.click?.(); this.openMenu(); } });
    this.el.modal.addEventListener('pointerdown', (e) => {
      if (e.target === this.el.modal && this.modalCloseable) this.closeModal();
    });

    state.on((what) => {
      if (what === 'party' || what === 'dragons' || what === 'state') this.renderParty();
      this.renderResources();
    });
  }

  /** A zene kapcsolója (a main.js köti be, ha kész a zenemotor). */
  attachMusic(music) {
    this.music = music;
    const btn = this.root.querySelector('#hudMusic');
    if (!btn) return;
    const label = () => {
      btn.classList.toggle('is-off', !music.enabled);
      btn.setAttribute('aria-label', music.enabled ? 'Zene ki' : 'Zene be');
    };
    btn.addEventListener('click', () => { music.setEnabled(!music.enabled); label(); });
    label();
  }

  #muteLabel() {
    if (!this.el.mute) return;
    const m = this.state.save.muted;
    this.el.mute.textContent = m ? '🔇' : '🔊';
    this.el.mute.setAttribute('aria-label', m ? 'Hang be' : 'Hang ki');
  }

  /* ------------------------------------------------------------------ */
  /* Portrék                                                             */
  /* ------------------------------------------------------------------ */
  async portrait(d) {
    const key = `${d.id}:${d.szin}`;
    if (!this.portraits.has(key) && this.portraitMaker) {
      this.portraits.set(key, this.portraitMaker(d).then((c) => c.toDataURL()));
    }
    return this.portraits.get(key);
  }

  /** Portrék aszinkron betöltése a [data-portrait] képekbe. */
  async fillPortraits(scope) {
    for (const img of scope.querySelectorAll('img[data-portrait]')) {
      const d = this.state.dragons.get(Number(img.dataset.portrait)) || this.extraDragons?.get(img.dataset.portrait);
      if (!d) continue;
      const url = await this.portrait(d);
      if (url) img.src = url;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Állandó felület                                                     */
  /* ------------------------------------------------------------------ */
  renderResources() {
    this.el.shards.textContent = this.state.save.shards;
    this.el.herbs.textContent = this.state.save.herbs;
  }

  renderParty() {
    const st = this.state;
    const party = st.party;
    if (!party.length) {
      this.el.party.innerHTML = '<p class="hud-empty">Nincs sárkány a csapatodban.</p>';
      return;
    }
    this.el.party.innerHTML = party.map((d) => {
      const s = st.stats(d);
      const hp = st.hpOf(d);
      const lvl = levelOf(d.xp);
      const cur = xpForLevel(lvl), next = xpForLevel(lvl + 1);
      const xpPct = Math.round(((d.xp - cur) / Math.max(1, next - cur)) * 100);
      const hpPct = Math.round((hp / s.maxHp) * 100);
      return `
        <div class="hud-dragon${hp <= 0 ? ' is-down' : ''}" title="${esc(d.nev)} — ${esc(SKILLS[s.skill].name)}${s.combo ? ` · ${esc(COMBOS[s.combo.key].name)}` : ''}">
          <img data-portrait="${d.id}" alt="">
          <div class="hud-dragon-body">
            <div class="hud-dragon-name"><b>${esc(d.nev)}</b><span>${lvl}. szint</span></div>
            <div class="bar bar-hp"><i style="width:${hpPct}%"></i><em>${hp} / ${s.maxHp}</em></div>
            <div class="bar bar-xp"><i style="width:${xpPct}%"></i></div>
          </div>
        </div>`;
    }).join('');
    this.fillPortraits(this.el.party);
  }

  setArea(name) {
    if (!this.el.area || this.el.area.dataset.name === name) return;
    this.el.area.dataset.name = name;
    this.el.area.textContent = name;
    this.el.area.classList.remove('is-in');
    void this.el.area.offsetWidth;
    this.el.area.classList.add('is-in');
  }

  /** Alsó felszólítás („E — belépés") gombbal; null = elrejt. */
  prompt(text, onAct) {
    const p = this.el.prompt;
    if (!text) { p.hidden = true; p.dataset.key = ''; return; }
    if (p.dataset.key === text && !p.hidden) return;
    p.dataset.key = text;
    p.innerHTML = `<button class="btn btn-primary btn-sm" type="button"><kbd>E</kbd> ${esc(text)}</button>`;
    p.querySelector('button').onclick = () => { this.sfx.click(); onAct(); };
    p.hidden = false;
  }

  /** A saga soron lévő célja (bal oldalt, a csapat alatt). */
  setQuest({ kicker, goal, done = false }) {
    const q = this.el.quest;
    if (!q) return;
    const changed = q.dataset.goal !== goal;
    q.dataset.goal = goal;
    q.classList.toggle('is-done', done);
    q.innerHTML = `<span class="hq-rune" aria-hidden="true">${done ? 'ᛟ' : 'ᛉ'}</span>
      <div><small>${esc(kicker)}</small><b>${esc(goal)}</b></div>`;
    if (changed) { q.classList.remove('is-new'); void q.offsetWidth; q.classList.add('is-new'); }
  }

  /** Iránytű a képernyő szélén a cél felé (null = elrejt). */
  compass(pos) {
    const c = this.el.compass;
    if (!c) return;
    if (!pos) { c.hidden = true; return; }
    c.hidden = false;
    c.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.angle}rad)`;
  }

  /** Mozifilm-csíkok (különleges technikák, kórus, jelenetek). */
  cinematic(on) { this.root.classList.toggle('is-cine', !!on); }

  /** A Sárkánykórus harci éneke a harci panelen. */
  setChorus(value, unlocked) {
    const el = this.el.battle.querySelector('.bp-chorus');
    if (!el) return;
    el.hidden = !unlocked;
    if (!unlocked) return;
    const pct = Math.round((Math.min(CHORUS.max, value) / CHORUS.max) * 100);
    el.querySelector('i').style.width = `${pct}%`;
    el.querySelector('em').textContent = pct >= 100 ? 'KÉSZ — Q' : `${pct}%`;
    el.classList.toggle('is-full', pct >= 100);
  }

  toast(msg, kind = 'info', ms = 3200) {
    const t = document.createElement('div');
    t.className = `hud-toast is-${kind}`;
    t.innerHTML = msg;
    this.el.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, ms);
  }

  /* ------------------------------------------------------------------ */
  /* Kistérkép és világtérkép                                            */
  /* ------------------------------------------------------------------ */
  /**
   * A térkép egyszer, festett hatással készül (MAP_S képpont / csempe):
   * puhán összemosott vidékek, domborzati árnyék, mély és sekély víz,
   * part menti hab, utak, fák és hegycsúcsok apró jelekkel. A kistérkép
   * ebből a játékos körüli ablakot mutatja (gördül vele), a világtérkép
   * (M) az egészet, nevekkel és jelmagyarázattal.
   */
  initMinimap(world, onClick, nameOf = () => '') {
    const c = this.el.minimap;
    const S = 12;
    c.width = 440; c.height = 330;
    this.mm = { world, S, base: this.#paintMap(world, S), fog: document.createElement('canvas'), onClick, nameOf, view: null, last: null };
    this.mm.fog.width = world.w; this.mm.fog.height = world.h;

    c.addEventListener('click', (e) => {
      const v = this.mm.view;
      if (!v) return;
      const r = c.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      onClick(Math.floor(v.x + fx * v.w), Math.floor(v.y + fy * v.h));
    });
    this.root.querySelector('#hudMapBtn')?.addEventListener('click', () => this.openWorldMap());
  }

  #paintMap(world, S) {
    const { w: W, h: H, biome, height, snowy, ashy } = world;
    const out = document.createElement('canvas');
    out.width = W * S; out.height = H * S;
    const ctx = out.getContext('2d');
    const at = (x, y) => y * W + x;
    const isWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (biome[at(x, y)] === B.WATER);

    // Távolság a parttól (a víz mélysége)
    const depth = new Float32Array(W * H).fill(9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWater(x, y)) continue;
      let d = 9;
      for (let r = 1; r < 5 && d === 9; r++) {
        for (let dy = -r; dy <= r && d === 9; dy++) for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && !isWater(xx, yy)) { d = r; break; }
        }
      }
      depth[at(x, y)] = d;
    }

    // 1. Vidékszínek csempénként, majd simítva felnagyítva — festett, puha határok
    const small = document.createElement('canvas');
    small.width = W; small.height = H;
    const sc = small.getContext('2d');
    const img = sc.createImageData(W, H);
    const COL = {
      [B.GRASS]: [74, 122, 80], [B.MOUNTAIN]: [104, 108, 124], [B.SAND]: [206, 186, 134],
      [B.PATH]: [92, 128, 80], [B.BRIDGE]: [92, 128, 80], [B.ICE]: [168, 210, 232], [B.SNOW]: [222, 230, 242], [B.ASH]: [70, 58, 60],
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = at(x, y);
      let c;
      if (biome[i] === B.WATER) {
        const t = Math.min(1, (depth[i] - 1) / 3);
        c = [Math.round(70 - 40 * t), Math.round(140 - 72 * t), Math.round(176 - 66 * t)];
      } else {
        c = (COL[biome[i]] || COL[B.GRASS]).slice();
        if (snowy[i]) c = biome[i] === B.MOUNTAIN ? [150, 160, 182] : [214, 224, 238];
        if (ashy[i]) c = biome[i] === B.MOUNTAIN ? [72, 56, 56] : [74, 60, 62];
        // domborzati árnyék: a bal felső szomszédhoz képest
        const hN = height[at(Math.max(0, x - 1), Math.max(0, y - 1))];
        const sh = Math.max(-0.22, Math.min(0.22, (height[i] - hN) * 0.35));
        c = c.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + sh)))));
      }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    sc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, W * S, H * S);

    // 2. Part: hab a víz szélén
    ctx.strokeStyle = 'rgba(230,244,255,.38)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWater(x, y)) continue;
      const X = x * S, Y = y * S;
      if (!isWater(x, y - 1)) { ctx.moveTo(X, Y + 1.5); ctx.lineTo(X + S, Y + 1.5); }
      if (!isWater(x, y + 1)) { ctx.moveTo(X, Y + S - 1.5); ctx.lineTo(X + S, Y + S - 1.5); }
      if (!isWater(x - 1, y)) { ctx.moveTo(X + 1.5, Y); ctx.lineTo(X + 1.5, Y + S); }
      if (!isWater(x + 1, y)) { ctx.moveTo(X + S - 1.5, Y); ctx.lineTo(X + S - 1.5, Y + S); }
    }
    ctx.stroke();
    // hullámvonalkák a mély vízen
    ctx.strokeStyle = 'rgba(160,210,240,.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 3; x < W; x += 3) {
      if (!isWater(x, y) || depth[at(x, y)] < 3) continue;
      const X = x * S + 2, Y = y * S + S / 2;
      ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + 3, Y - 2.5, X + 6, Y); ctx.quadraticCurveTo(X + 9, Y + 2.5, X + 12, Y);
    }
    ctx.stroke();

    // 3. Utak és hidak: összefüggő, kontúros sávok
    const road = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (biome[at(x, y)] === B.PATH || biome[at(x, y)] === B.BRIDGE);
    const roadPath = () => {
      ctx.beginPath();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!road(x, y)) continue;
        const cx = x * S + S / 2, cy = y * S + S / 2;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + 0.01, cy);
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          if (!road(x + dx, y + dy)) continue;
          if (dx && dy && (road(x + dx, y) || road(x, y + dy))) continue;      // átló csak ha nincs egyenes út
          ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * S, cy + dy * S);
        }
      }
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    roadPath(); ctx.strokeStyle = 'rgba(60,40,24,.65)'; ctx.lineWidth = S * 0.62; ctx.stroke();
    roadPath(); ctx.strokeStyle = '#c4a376'; ctx.lineWidth = S * 0.42; ctx.stroke();
    // hidak deszkával
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (biome[at(x, y)] !== B.BRIDGE) continue;
      ctx.fillStyle = '#8a6844'; ctx.fillRect(x * S + 1, y * S + 2, S - 2, S - 4);
      ctx.strokeStyle = 'rgba(40,24,12,.7)'; ctx.lineWidth = 1;
      for (let k = 2; k < S - 1; k += 3) { ctx.beginPath(); ctx.moveTo(x * S + k, y * S + 2); ctx.lineTo(x * S + k, y * S + S - 2); ctx.stroke(); }
    }

    // 4. Hegycsúcsok: apró, kétoldalt árnyalt háromszögek (minden második csempén)
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (biome[i] !== B.MOUNTAIN || (x + y) % 2) continue;
      const cx = x * S + S / 2 + ((x * 7 + y * 3) % 5) - 2, by = y * S + S - 1;
      const h = S * (0.9 + Math.min(0.8, height[i] * 0.25)), hw = S * 0.7;
      const ash = ashy[i], snow = snowy[i] || height[i] > 2.1;
      ctx.fillStyle = ash ? '#5a4648' : '#8a90a6';
      ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx, by - h); ctx.lineTo(cx, by); ctx.fill();
      ctx.fillStyle = ash ? '#2e2426' : '#4e546a';
      ctx.beginPath(); ctx.moveTo(cx, by - h); ctx.lineTo(cx + hw, by); ctx.lineTo(cx, by); ctx.fill();
      if (snow) { ctx.fillStyle = '#f2f6ff'; ctx.beginPath(); ctx.moveTo(cx - hw * 0.34, by - h * 0.66); ctx.lineTo(cx, by - h); ctx.lineTo(cx + hw * 0.34, by - h * 0.66); ctx.lineTo(cx, by - h * 0.72); ctx.fill(); }
      if (ash) { ctx.strokeStyle = 'rgba(255,122,61,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, by - h * 0.6); ctx.lineTo(cx + 1.5, by - h * 0.3); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(12,14,24,.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx, by - h); ctx.lineTo(cx + hw, by); ctx.stroke();
    }

    // 5. Fák: kis koronák árnyékkal
    for (const t of world.trees) {
      const cx = t.x * S + S / 2 + (t.v - 1) * 1.5, cy = t.y * S + S / 2;
      const col = t.kind === 'dead' ? ['#3a2e2c', '#5a4a44'] : t.kind === 'pine-snow' ? ['#2e5a4a', '#dfe8f4'] : t.kind === 'birch' ? ['#5f8a3e', '#9cc86a'] : ['#1f4a2e', '#3f7a4a'];
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx + 1.5, cy + 3.5, 4.6, 2.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col[0]; ctx.beginPath(); ctx.arc(cx, cy, 4.4, 0, 7); ctx.fill();
      ctx.fillStyle = col[1]; ctx.beginPath(); ctx.arc(cx - 1.2, cy - 1.4, 2.4, 0, 7); ctx.fill();
    }

    // 6. Finom papírszemcse és sötétülő perem
    const vg = ctx.createRadialGradient(W * S / 2, H * S / 2, Math.min(W, H) * S * 0.3, W * S / 2, H * S / 2, Math.max(W, H) * S * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,8,20,.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W * S, H * S);
    return out;
  }

  /** A köd csempe-felbontású maszkja (a rajzoláskor simítva nagyítjuk: puha szél). */
  #paintFog(fog) {
    const { world, fog: fc } = this.mm;
    const ctx = fc.getContext('2d');
    const img = ctx.createImageData(world.w, world.h);
    for (let i = 0; i < world.w * world.h; i++) if (!fog[i]) img.data.set([10, 12, 22, 238], i * 4);
    ctx.putImageData(img, 0, 0);
  }

  /** Helyszín-ikon a térképen. */
  #poiIcon(ctx, p, x, y, r, cleared, target) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, r * 0.28);
    ctx.strokeStyle = '#0b0f1c';
    const fillStroke = (col) => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
    switch (p.type) {
      case 'cave':
        ctx.beginPath(); ctx.moveTo(-r, r * 0.7); ctx.quadraticCurveTo(-r, -r, 0, -r); ctx.quadraticCurveTo(r, -r, r, r * 0.7); ctx.closePath();
        fillStroke(cleared[p.tier] ? '#5ed49a' : p.tier === 5 ? '#ffd36b' : '#ff5d6c');
        ctx.fillStyle = '#0b0f1c'; ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.7); ctx.quadraticCurveTo(-r * 0.5, -r * 0.3, 0, -r * 0.35); ctx.quadraticCurveTo(r * 0.5, -r * 0.3, r * 0.5, r * 0.7); ctx.fill();
        break;
      case 'home':
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.1); ctx.lineTo(0, -r * 1.1); ctx.lineTo(r, -r * 0.1); ctx.lineTo(r * 0.75, -r * 0.1); ctx.lineTo(r * 0.75, r * 0.8); ctx.lineTo(-r * 0.75, r * 0.8); ctx.lineTo(-r * 0.75, -r * 0.1); ctx.closePath();
        fillStroke('#ff8a3d');
        break;
      case 'nest':
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 0.95, 0, 0, 7); fillStroke('#ffe0a8');
        break;
      case 'shrine':
        ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r * 1.1); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); fillStroke('#c28cff');
        break;
      case 'trainer':
        ctx.lineWidth = r * 0.5; ctx.strokeStyle = '#0b0f1c';
        ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
        ctx.lineWidth = r * 0.26; ctx.strokeStyle = '#ffb07a'; ctx.stroke();
        break;
      case 'chest':
        ctx.beginPath(); ctx.rect(-r * 0.85, -r * 0.6, r * 1.7, r * 1.2); fillStroke('#e0b84a');
        break;
      case 'stone':
        ctx.beginPath(); ctx.roundRect(-r * 0.45, -r, r * 0.9, r * 1.9, r * 0.4); fillStroke('#6fffe6');
        break;
      case 'ruins':
        for (const dx of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.rect(dx * r - r * 0.18, -r * (dx ? 0.6 : 0.9), r * 0.36, r * (dx ? 1.4 : 1.8)); fillStroke('#c8d2ea'); }
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); fillStroke(p.type === 'npc' ? '#ffe7c2' : '#c9f0ff');
    }
    if (target) {
      ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,208,138,.4)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.5, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  #playerArrow(ctx, x, y, r, heading) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(heading + Math.PI / 2);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
    g.addColorStop(0, 'rgba(255,200,120,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.85, r * 0.9); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * 0.85, r * 0.9); ctx.closePath();
    ctx.fillStyle = '#fff4e0'; ctx.fill(); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  /** Látható-e a helyszín a térképen. */
  #poiShown(p, fog, target) {
    const { world } = this.mm;
    if (p.type === 'sign') return false;
    if (p.type === 'chest' && this.state.save.places[p.id]?.open) return false;
    return !!fog[p.y * world.w + p.x] || p.id === target;
  }

  /**
   * Kistérkép: a játékos körüli ablak (tört csempekoordinátával, így
   * simán gördül). $heading: a haladási irány radiánban.
   */
  drawMinimap(fog, px, py, pois, cleared, target = null, heading = -Math.PI / 2) {
    if (!this.mm) return;
    const { world, S, base } = this.mm;
    const c = this.el.minimap;
    const ctx = c.getContext('2d');
    const VW = 26, VH = VW * c.height / c.width;
    const vx = Math.max(0, Math.min(world.w - VW, px + 0.5 - VW / 2));
    const vy = Math.max(0, Math.min(world.h - VH, py + 0.5 - VH / 2));
    this.mm.view = { x: vx, y: vy, w: VW, h: VH };
    const k = c.width / VW;                                 // képpont / csempe a kistérképen
    if (this.mm.lastFog !== fog || this.mm.fogDirty) { this.#paintFog(fog); this.mm.lastFog = fog; this.mm.fogDirty = false; }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, vx * S, vy * S, VW * S, VH * S, 0, 0, c.width, c.height);
    ctx.drawImage(this.mm.fog, vx, vy, VW, VH, 0, 0, c.width, c.height);
    for (const p of pois) {
      if (!this.#poiShown(p, fog, target)) continue;
      const x = (p.x + 0.5 - vx) * k, y = (p.y + 0.5 - vy) * k;
      const isT = p.id === target;
      if (x < -20 || y < -20 || x > c.width + 20 || y > c.height + 20) {
        if (!isT) continue;
        // a cél a kistérképen kívül: nyíl a peremen
        const ang = Math.atan2(y - c.height / 2, x - c.width / 2);
        const ex = c.width / 2 + Math.cos(ang) * (c.width / 2 - 16), ey = c.height / 2 + Math.sin(ang) * (c.height / 2 - 16);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.fillStyle = '#ffd08a'; ctx.strokeStyle = '#0b0f1c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        continue;
      }
      this.#poiIcon(ctx, p, x, y, 11, cleared, isT);
    }
    this.#playerArrow(ctx, (px + 0.5 - vx) * k, (py + 0.5 - vy) * k, 12, heading);
  }

  /** A köd megváltozott (új csempe felderítve) — a következő rajzolás újrafesti. */
  fogChanged() { if (this.mm) this.mm.fogDirty = true; }

  /** Teljes világtérkép (M): az egész völgy, nevekkel, jelmagyarázattal; kattintásra odaindulsz. */
  openWorldMap() {
    if (!this.mm || (!this.el.modal.hidden && !this.worldMapOpen)) return;
    const st = this.mapState?.();
    if (!st) return;
    const { world, S, base, nameOf } = this.mm;
    this.#paintFog(st.fog);
    const card = this.openModal(`
      <p class="gm-kicker">ᚱ Raidho — az út</p>
      <h2>A Sárkányok Völgye</h2>
      <div class="wm-wrap"><canvas class="wm-canvas" width="${world.w * S}" height="${world.h * S}"></canvas></div>
      <div class="wm-legend">
        <span><i class="lg-cave"></i>Barlang</span><span><i class="lg-cave is-done"></i>Bejárt barlang</span><span><i class="lg-home"></i>Hosszúház</span>
        <span><i class="lg-shrine"></i>Szentély</span><span><i class="lg-nest"></i>Fészek</span><span><i class="lg-stone"></i>Rúnakő</span>
        <span><i class="lg-npc"></i>Ember</span><span><i class="lg-target"></i>A saga célja</span>
      </div>
      <p class="muted wm-hint">Kattints a térképre, és a sárkányod odaindul. (Bezárás: M vagy Esc)</p>`, { wide: true });
    this.worldMapOpen = true;
    this.onModalClose = () => { this.worldMapOpen = false; };
    const cv = card.querySelector('.wm-canvas');
    const ctx = cv.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mm.fog, 0, 0, world.w * S, world.h * S);
    ctx.font = '700 15px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    for (const p of world.pois) {
      if (!this.#poiShown(p, st.fog, st.target)) continue;
      const x = (p.x + 0.5) * S, y = (p.y + 0.5) * S;
      this.#poiIcon(ctx, p, x, y, 9, st.cleared, p.id === st.target);
      const name = p.type === 'chest' || p.type === 'stone' ? '' : nameOf(p);
      if (!name) continue;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,10,20,.85)'; ctx.strokeText(name, x, y - 16);
      ctx.fillStyle = p.id === st.target ? '#ffd08a' : '#f2e8d4'; ctx.fillText(name, x, y - 16);
    }
    this.#playerArrow(ctx, (st.px + 0.5) * S, (st.py + 0.5) * S, 11, st.heading);
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const tx = Math.floor(((e.clientX - r.left) / r.width) * world.w), ty = Math.floor(((e.clientY - r.top) / r.height) * world.h);
      this.closeModal();
      this.mm.onClick(tx, ty);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Párbeszédablak                                                      */
  /* ------------------------------------------------------------------ */
  openModal(html, { closeable = true, wide = false } = {}) {
    this.modalCloseable = closeable;
    this.el.card.className = `game-modal-card${wide ? ' is-wide' : ''}`;
    this.el.card.innerHTML = (closeable ? '<button class="gm-close" type="button" aria-label="Bezárás">×</button>' : '') + html;
    this.el.modal.hidden = false;
    requestAnimationFrame(() => this.el.modal.classList.add('is-in'));
    this.el.card.querySelector('.gm-close')?.addEventListener('click', () => this.closeModal());
    this.fillPortraits(this.el.card);
    setTimeout(() => this.el.card.querySelector('[autofocus], .btn-primary, button:not(.gm-close)')?.focus(), 60);
    return this.el.card;
  }

  closeModal() {
    this.el.modal.classList.remove('is-in');
    this.el.modal.hidden = true;
    this.el.card.innerHTML = '';
    this.onModalClose?.();
    this.onModalClose = null;
  }

  /** Párbeszédablak VAGY saga-párbeszéd van nyitva: a völgy ilyenkor nem mozdul. */
  get modalOpen() { return !this.el.modal.hidden || this.dialogueOpen; }

  /**
   * Játékmenü: folytatás, krónika, térkép, hang és zene, gyűjtemény, kilépés.
   * A krónikát a völgy köti be (menuBook); harc közben csak a hang állítható.
   */
  openMenu() {
    if (!this.el.modal.hidden) return;
    const battle = this.root.classList.contains('in-battle');
    const music = this.music, muted = !!this.state.save.muted;
    const item = (m, rune, title, sub, key = '', off = false) =>
      `<button class="gmenu-item" type="button" data-m="${m}"${off ? ' disabled' : ''}><i class="gmenu-rune">${rune}</i><span><b>${title}</b><small>${sub}</small></span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    const card = this.openModal(`
      <p class="gm-kicker">ᛟ Othala — a ház</p>
      <h2>Menü</h2>
      <div class="gmenu">
        ${item('resume', 'ᚱ', 'Folytatás', battle ? 'vissza a harcba' : 'vissza a völgybe', 'Esc')}
        ${item('book', 'ᛉ', 'Krónika', 'a saga és a mellékszálak', '', battle || !this.menuBook)}
        ${item('map', 'ᛜ', 'Világtérkép', 'a bejárt völgy, kattintással úti cél', 'M', battle || !this.mm)}
        ${item('music', '♫', `Zene: ${music?.enabled ? 'be' : 'ki'}`, 'saját dallamok napszak és harc szerint', '', !music)}
        ${item('sound', muted ? '🔇' : '🔊', `Hangok: ${muted ? 'ki' : 'be'}`, 'csapások, varázslatok, lépések')}
        <a class="gmenu-item" href="user.php"><i class="gmenu-rune">ᛗ</i><span><b>Gyűjtemény</b><small>a sárkányaid a profilodon</small></span></a>
        <a class="gmenu-item is-exit" href="index.php" data-m="exit"><i class="gmenu-rune">ᛞ</i><span><b>Kilépés</b><small>a játék magától ment — bármikor folytathatod</small></span></a>
      </div>
      <div class="gmenu-keys">
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / nyilak — mozgás</span>
        <span><kbd>Shift</kbd> — szárnyalás</span>
        <span><kbd>E</kbd> / <kbd>Space</kbd> — beszéd, belépés</span>
        <span><kbd>M</kbd> — térkép</span>
        <span>kattintás — oda megy</span>
      </div>`);
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b || b.disabled) return;
      const m = b.dataset.m;
      if (m === 'exit') { this.state.flush?.(); return; }          // a link viszi tovább
      this.sfx.click?.();
      if (m === 'resume') this.closeModal();
      else if (m === 'book') { this.closeModal(); this.menuBook?.(); }
      else if (m === 'map') { this.closeModal(); this.openWorldMap(); }
      else if (m === 'music' || m === 'sound') {
        if (m === 'music') { music.setEnabled(!music.enabled); this.root.querySelector('#hudMusic')?.classList.toggle('is-off', !music.enabled); }
        else this.el.mute?.click();
        this.closeModal(); this.openMenu();
        this.el.card.querySelector(`[data-m="${m}"]`)?.focus();
      }
    });
    return card;
  }

  /** Sárkány-kártya a párbeszédablakokba. */
  dragonCard(d, { selectable = false, selected = false, extra = '' } = {}) {
    const st = this.state;
    const s = st.stats(d);
    const hp = st.dragons.has(d.id) ? st.hpOf(d) : s.maxHp;
    const skill = SKILLS[s.skill];
    const traits = (d.traits || []).map((t) => `<span class="trait" title="${esc(st.traits[t]?.[1])}">${esc(st.traits[t]?.[0] || t)}</span>`).join('');
    const techs = st.dragons.has(d.id) ? st.learnedOf(d).map((k) => TECHNIQUES[k]).filter(Boolean) : [];
    const tr = st.dragons.has(d.id) ? st.trainOf(d) : {};
    const ranks = Object.entries(TRAIN).filter(([k]) => tr[k]).map(([k, t]) => `<span title="${esc(t.name)}">${t.icon}${tr[k]}</span>`).join('');
    const tag = selectable ? 'button type="button"' : 'div';
    const close = selectable ? 'button' : 'div';
    return `
      <${tag} class="gd-card${selected ? ' is-selected' : ''}${hp <= 0 ? ' is-down' : ''}" data-id="${esc(d.id)}">
        <img data-portrait="${esc(d.id)}" alt="">
        <div class="gd-info">
          <b>${esc(d.nev)}</b>
          <small>${s.level}. szint${d.gen ? ` · ${d.gen}. nemzedék` : ''}</small>
          <small class="gd-species">${esc(dragonLook(d, st.catalog).species)}</small>
          <div class="gd-stats">
            <span title="Életerő">❤ ${hp}/${s.maxHp}</span>
            <span title="Sebzés">⚔ ${s.atk}</span>
            <span title="Páncél">🛡 ${s.def}</span>
            <span title="Gyorsaság">➶ ${s.spd}</span>
          </div>
          <div class="gd-skill" title="${esc(skill.desc)}"><i>${skill.rune}</i> ${esc(skill.name)}</div>
          ${comboLine(s.combo)}
          ${techs.map((t) => `<div class="gd-skill gd-tech" title="${esc(t.desc)}"><i>${t.rune}</i> ${esc(t.name)}</div>`).join('')}
          ${ranks ? `<div class="gd-ranks" title="Edzésfokozatok">${ranks}</div>` : ''}
          ${traits ? `<div class="gd-traits">${traits}</div>` : ''}
          ${extra}
        </div>
      </${close}>`;
  }

  /**
   * Ulti kiválasztása (ha több is van). A harci panel fölött jelenik meg.
   * @returns {Promise<string|null>} az ulti kulcsa, vagy null (Vissza)
   */
  chooseUlti(keys) {
    const panel = this.el.battle;
    const box = document.createElement('div');
    box.className = 'bp-ultis';
    box.innerHTML = `<p>ᛟ Melyik ultit hívod?</p>
      <div class="bp-ultis-row">${keys.map((k, i) => {
        const u = ULTIMATES[k];
        return `<button type="button" class="bp-ulti" data-u="${k}" style="--c:#${u.color.toString(16).padStart(6, '0')}">
          <kbd>${i + 1}</kbd><i>${u.rune}</i><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></button>`;
      }).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-u="">Vissza <kbd>Esc</kbd></button>`;
    panel.prepend(box);
    return new Promise((resolve) => {
      const done = (k) => { this.sfx.click(); document.removeEventListener('keydown', onKey, true); box.remove(); resolve(k || null); };
      const onKey = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= keys.length) { e.stopPropagation(); done(keys[n - 1]); }
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      };
      document.addEventListener('keydown', onKey, true);
      box.querySelectorAll('[data-u]').forEach((b) => b.onclick = () => done(b.dataset.u));
    });
  }

  /** Testrész-sor (név + forma) egy sárkányhoz. */
  partLine(d, slot) {
    const p = d[slot] ? this.state.catalog[slot]?.[d[slot]] : null;
    return p ? esc(p.nev) : '<em>nincs</em>';
  }

  /* ------------------------------------------------------------------ */
  /* Harci panel                                                         */
  /* ------------------------------------------------------------------ */
  showBattle(show) {
    this.el.battle.hidden = !show;
    this.root.classList.toggle('in-battle', show);
    if (show) this.el.battle.querySelector('.bp-log').innerHTML = '';
  }

  battleLog(msg) {
    const log = this.el.battle.querySelector('.bp-log');
    const p = document.createElement('p');
    p.innerHTML = msg;
    log.prepend(p);
    while (log.children.length > 4) log.lastChild.remove();
  }

  battleHint(text) {
    const h = this.el.battle.querySelector('.bp-hint');
    h.hidden = !text;
    h.innerHTML = text ? `${esc(text)} <button class="btn btn-sm btn-ghost" type="button" data-act="back">Vissza</button>` : '';
  }

  /** A sorrend-sáv: ki jön most, és utána kik. */
  turnOrder(units, current) {
    const el = this.el.battle.querySelector('.bp-order');
    el.innerHTML = units.map((u) => `
      <span class="bp-chip ${u.side}${u === current ? ' is-now' : ''}${u.hp <= 0 ? ' is-down' : ''}" title="${esc(u.d.nev)}">
        <img data-portrait="${esc(u.d.id)}" alt="">
      </span>`).join('');
    this.fillPortraits(el);
  }

  /**
   * A játékos választ egy cselekvést a soron lévő sárkányának.
   * @returns {Promise<{type:string}>}
   */
  chooseAction(unit, { canFlee, herbs, techs = [], combo = null, chorus = null, fleeLabel = 'Menekülés' }) {
    const s = unit.stats;
    const skill = SKILLS[s.skill];
    const pips = Array.from({ length: MAX_ENERGY }, (_, i) => `<i class="${i < unit.energy ? 'on' : ''}"></i>`).join('');
    const cost = (n) => `<span class="bp-cost" aria-label="${n} energia">${'◆'.repeat(n)}</span>`;

    // A gombok sorrendje adja a gyorsbillentyűt (1, 2, 3…); a kórus a Q
    const acts = [
      { act: 'attack', cls: 'btn-primary', label: 'Támadás', title: 'Alaptámadás, +1 energia' },
      { act: 'skill', label: `<span class="bp-rune">${skill.rune}</span> ${esc(skill.name)} ${cost(SKILL_COST)}`,
        off: unit.energy < SKILL_COST, title: `${skill.desc} — ${SKILL_COST} energia` },
      ...(combo ? [(() => {
        const c = COMBOS[combo.key];
        return {
          act: 'combo', cls: 'bp-tech bp-combo', style: `--c:${hexCol(c.color)}`,
          label: `<span class="bp-els">${comboIcons(combo)}</span> ${esc(c.name)} ${cost(COMBO_COST)}`,
          off: unit.energy < COMBO_COST, title: `${c.desc}${resonanceNote(combo)} — teli energia (${COMBO_COST})`,
        };
      })()] : []),
      ...techs.map((t) => ({
        act: `tech:${t.key}`, cls: 'bp-tech', style: `--c:#${t.color.toString(16).padStart(6, '0')}`,
        label: `<span class="bp-rune">${t.rune}</span> ${esc(t.name)} ${cost(t.cost)}`,
        off: unit.energy < t.cost, title: `${t.desc} — ${t.cost} energia`,
      })),
      { act: 'defend', label: 'Védekezés', title: 'Felére csökkenti a kapott sebzést, +1 energia' },
      { act: 'herb', label: `Gyógyfű (${herbs})`, off: !herbs, title: 'A legsebesültebb társ 40%-ot gyógyul' },
      { act: 'flee', cls: 'btn-ghost', label: fleeLabel, off: !canFlee },
    ];
    const keys = {};
    acts.forEach((a, i) => { a.key = String(i + 1); keys[a.key] = a.act; });

    const box = this.el.battle.querySelector('.bp-actions');
    box.innerHTML = `
      <div class="bp-actor">
        <img data-portrait="${esc(unit.d.id)}" alt="">
        <div><b>${esc(unit.d.nev)}</b><span class="bp-energy" title="Energia: a támadás és a védekezés tölti">${pips}</span></div>
      </div>
      <div class="bp-buttons">
        ${acts.map((a) => `<button class="btn ${a.cls || ''}" data-act="${a.act}" type="button" ${a.off ? 'disabled' : ''}
            ${a.title ? `title="${esc(a.title)}"` : ''} ${a.style ? `style="${a.style}"` : ''}><kbd>${a.key}</kbd> ${a.label}</button>`).join('')}
      </div>`;
    // A kórus gombja a harci ének sávja mellé kerül (felül), így az alsó sor rövid marad
    const meter = this.el.battle.querySelector('.bp-chorus');
    meter.querySelector('.bp-chorus-btn')?.remove();
    if (chorus) {
      keys.q = keys.Q = 'chorus';
      meter.insertAdjacentHTML('beforeend', `<button class="btn btn-sm bp-chorus-btn" data-act="chorus" type="button" ${chorus.ready ? '' : 'disabled'}
        title="Ha a harci ének megtelt"><kbd>Q</kbd> <span class="bp-rune">${chorus.rune || CHORUS.rune}</span> ${esc(chorus.label || CHORUS.name)}</button>`);
    }
    this.fillPortraits(box);
    box.hidden = false;

    return new Promise((resolve) => {
      const scope = this.el.battle;
      const done = (act) => {
        const b = scope.querySelector(`[data-act="${act}"]`);
        if (!b || b.disabled || this.dialogueOpen) return;
        this.sfx.click();
        document.removeEventListener('keydown', onKey);
        box.hidden = true;
        meter.querySelector('.bp-chorus-btn')?.remove();
        const [type, key] = act.split(':');
        resolve({ type, key });
      };
      const onKey = (e) => { if (keys[e.key]) done(keys[e.key]); };
      document.addEventListener('keydown', onKey);
      scope.querySelectorAll('.bp-actions [data-act], .bp-chorus [data-act]').forEach((b) => b.addEventListener('click', () => done(b.dataset.act)));
    });
  }
}

/* --- Kombinált képesség (elemi összetétel) a kártyákon és a harci panelen --- */
const hexCol = (n) => `#${n.toString(16).padStart(6, '0')}`;
const comboIcons = (c) => ELEMENTS[c.primary].icon + (c.secondary !== c.primary ? ELEMENTS[c.secondary].icon : '');
const resonanceNote = (c) => (c.resonance > 2 ? ` · rezonancia ${c.resonance}/4: +${Math.round((c.power - 1) * 100)}%` : '');

/** A kártya sora: a kombinált képesség, alatta a testrészek elemei. */
export function comboLine(c) {
  if (!c) return '';
  const info = COMBOS[c.key];
  const parts = SLOTS.filter((s) => c.parts[s]).map((s) => {
    const e = ELEMENTS[c.parts[s]];
    const on = c.parts[s] === c.primary || c.parts[s] === c.secondary;
    return `<span class="${on ? 'on' : ''}" title="${esc(SLOT_NAMES[s])}: ${esc(e.name)}">${e.icon}</span>`;
  }).join('');
  return `<div class="gd-skill gd-combo" style="--c:${hexCol(info.color)}" title="${esc(info.desc)}${esc(resonanceNote(c))} — teli energia">
      <i>${comboIcons(c)}</i> ${esc(info.name)}<span class="gd-els" aria-label="Elemi összetétel">${parts}</span></div>`;
}

export { SLOTS, SLOT_NAMES };
