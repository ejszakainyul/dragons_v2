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
    };
    this.dialogueOpen = false;

    this.el.mute?.addEventListener('click', () => {
      state.save.muted = !state.save.muted;
      sfx.setMuted(state.save.muted);
      this.#muteLabel();
      state.touch();
    });
    this.#muteLabel();

    // Esc bezárja a párbeszédablakot
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.modal.hidden && this.modalCloseable) this.closeModal();
    });
    this.el.modal.addEventListener('pointerdown', (e) => {
      if (e.target === this.el.modal && this.modalCloseable) this.closeModal();
    });

    state.on((what) => {
      if (what === 'party' || what === 'dragons' || what === 'state') this.renderParty();
      this.renderResources();
    });
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
  /* Kistérkép                                                           */
  /* ------------------------------------------------------------------ */
  initMinimap(world, onClick) {
    const c = this.el.minimap;
    const scale = 2;
    c.width = world.w * scale;
    c.height = world.h * scale;
    this.mm = { world, scale, base: null };

    // Az alaptérkép egyszer készül; a köd és a pozíció rajzolódik rá
    const base = document.createElement('canvas');
    base.width = c.width; base.height = c.height;
    const ctx = base.getContext('2d');
    const col = {
      [B.GRASS]: '#3f6c49', [B.WATER]: '#23537f', [B.MOUNTAIN]: '#5b6279', [B.SAND]: '#c7b385',
      [B.PATH]: '#a88a63', [B.BRIDGE]: '#8a6844', [B.ICE]: '#9ccbe4',
    };
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
      const i = y * world.w + x;
      let cc = col[world.biome[i]] || '#3f6c49';
      if (world.biome[i] === B.GRASS && world.snowy[i]) cc = '#d2ddee';
      if (world.biome[i] === B.GRASS && world.ashy[i]) cc = '#3a3134';
      if (world.biome[i] === B.MOUNTAIN && world.snowy[i]) cc = '#8e98b0';
      ctx.fillStyle = cc;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    for (const t of world.trees) { ctx.fillStyle = 'rgba(20,50,30,.8)'; ctx.fillRect(t.x * scale, t.y * scale, scale, scale); }
    this.mm.base = base;

    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      onClick(Math.floor(((e.clientX - r.left) / r.width) * world.w), Math.floor(((e.clientY - r.top) / r.height) * world.h));
    });
  }

  drawMinimap(fog, px, py, pois, cleared, target = null) {
    if (!this.mm) return;
    const { world, scale, base } = this.mm;
    const ctx = this.el.minimap.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = '#05070f';
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
      if (!fog[y * world.w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    for (const p of pois) {
      // A saga célja a ködön át is látszik — különben nem tudnád, merre indulj
      const isTarget = p.id === target;
      if (!fog[p.y * world.w + p.x] && !isTarget) continue;
      if (p.type === 'chest' && this.state.save.places[p.id]?.open) continue;
      if (p.type === 'sign') continue;
      ctx.fillStyle = p.type === 'cave' ? (cleared[p.tier] ? '#7cffb0' : '#ff5d6c')
                   : p.type === 'nest' ? '#ffd08a' : p.type === 'home' ? '#ff8a3d'
                   : p.type === 'trainer' ? '#ff9a6b'
                   : p.type === 'shrine' ? '#c28cff' : p.type === 'npc' ? '#ffe7c2'
                   : p.type === 'chest' ? '#d9b45a' : p.type === 'ruins' ? '#b8c4e0'
                   : p.type === 'wanderer' ? '#c9f0ff' : '#6fffe6';
      ctx.fillRect(p.x * scale - 2, p.y * scale - 2, 5, 5);
      if (isTarget) {
        ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x * scale + 0.5, p.y * scale + 0.5, 6, 0, 7); ctx.stroke();
      }
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px * scale + 1, py * scale + 1, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 1.5; ctx.stroke();
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
