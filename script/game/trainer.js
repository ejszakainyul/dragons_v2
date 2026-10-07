/* =====================================================================
   A Gyakorlótér — Ragnhild karámja
   ---------------------------------------------------------------------
   Három fül:
     ᛚ Technikák   tanult képességek (1 hely, a 8. szinttől 2), szilánkért
     ⚔ Edzés       tartós fokozatok (erő, páncél, fürgeség, állóképesség);
                   a „Rúnaütés" ritmusjátékkal: 5 ütemből legalább 3 találat
     ᛞ Párbaj      gyakorló csata Ragnhild sárkányaival — tapasztalat,
                   kockázat nélkül (utána mindenki felépül)

   Minden a mentett állásba kerül (save.learned, save.train), a
   tapasztalat pedig a szerverre is (xp végpont), mint a csatáknál.
   ===================================================================== */
import { TECHNIQUES, TRAIN, SKILLS, COMBOS, ELEMENTS, drillCost, techSlots, levelOf, MAX_ENERGY } from './rules.js';
import { esc } from './hud.js';

/** A tanítóhelyek fejléce (a völgyben szétszórt mesterek). */
const SHRINE_HEAD = {
  hermit:  ['ᛚ Laguz — a gyógyító víz', 'Gunnhild kunyhója'],
  dwarf:   ['ᚦ Thurisaz — a kalapács', 'Brokk kovácsműhelye'],
  frost:   ['ᛁ Isa — a jég', 'A Fagyóriás trónja'],
  muspell: ['ᚲ Kenaz — a láng', 'A Muspell-oltár'],
};

const BEATS = 5;
const NEED = 3;

export class Trainer {
  /**
   * @param {object} g          közös szolgáltatások
   * @param {object} hooks      { onSpar(count, level) } — a párbaj indítása
   */
  constructor(g, hooks) {
    this.g = g;
    this.hooks = hooks;
    this.tab = 'tech';
    this.sel = null;
    this.shrine = null;          // { keys, place } — ha egy tanítóhelyen tanul
  }

  /** Technikák tanítása egy tanítóhelyen (csak az ott tanított technikák). */
  teachAt(keys, place) {
    this.shrine = { keys, place };
    this.tab = 'tech';
    if (!this.sel || !this.g.state.dragons.has(this.sel)) this.sel = this.dragons[0]?.id ?? null;
    this.#render();
    this.g.hud.onModalClose = () => { this.shrine = null; };
  }

  /** Elérhető-e a technika Ragnhildnál: a sajátja, vagy már valahol elsajátította a játékos. */
  #available(t) { return t.src === 'ragnhild' || this.g.state.has('techSrc', t.src); }

  get dragons() {
    const { state } = this.g;
    const party = state.party;
    const rest = [...state.dragons.values()].filter((d) => !party.includes(d)).sort((a, b) => b.xp - a.xp);
    return [...party, ...rest];
  }

  open(tab) {
    this.shrine = null;
    if (tab) this.tab = tab;
    if (!this.sel || !this.g.state.dragons.has(this.sel)) this.sel = this.dragons[0]?.id ?? null;
    this.#render();
  }

  #render() {
    const { hud, state } = this.g;
    const d = state.dragons.get(this.sel);
    const tabs = this.shrine ? [] : [['tech', 'ᛚ', 'Technikák'], ['drill', '⚔', 'Edzés'], ['spar', 'ᛞ', 'Párbaj']];
    const head = this.shrine ? SHRINE_HEAD[this.shrine.place.place] || ['ᛚ', this.shrine.place.name] : ['ᛏ Tiwaz — a harcos rúnája', 'A Gyakorlótér'];
    const keepClose = hud.onModalClose;
    const card = hud.openModal(`
      <p class="gm-kicker">${esc(head[0])}</p>
      <h2>${esc(head[1])}</h2>
      <div class="tr-tabs" role="tablist">
        ${tabs.map(([k, r, n]) => `<button type="button" role="tab" data-tab="${k}" class="${this.tab === k ? 'on' : ''}" aria-selected="${this.tab === k}"><i>${r}</i> ${n}</button>`).join('')}
        ${this.shrine ? '<span class="tr-shrine-note">Itt a mester maga tanít — <b>20%-kal olcsóbban</b>.</span>' : ''}
        <span class="tr-purse">Van: <b>${state.save.shards} ᚱ</b></span>
      </div>
      ${this.tab !== 'spar' ? `<div class="tr-dragons">${this.dragons.map((x) => `
        <button type="button" class="tr-chip${x.id === this.sel ? ' on' : ''}" data-id="${x.id}">
          <img data-portrait="${x.id}" alt=""><span><b>${esc(x.nev)}</b><small>${levelOf(x.xp)}. szint</small></span>
        </button>`).join('')}</div>` : ''}
      <div class="tr-pane">${this.tab === 'tech' ? this.#techPane(d) : this.tab === 'drill' ? this.#drillPane(d) : this.#sparPane()}</div>`,
    { wide: true });
    if (this.shrine) hud.onModalClose = keepClose;

    card.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { this.g.sfx.click(); this.tab = b.dataset.tab; this.#render(); });
    card.querySelectorAll('.tr-chip').forEach((b) => b.onclick = () => {
      this.sel = Number(b.dataset.id);
      const strip = card.querySelector('.tr-dragons').scrollLeft;
      this.#render();
      hud.el.card.querySelector('.tr-dragons').scrollLeft = strip;
    });
    card.querySelectorAll('[data-learn]').forEach((b) => b.onclick = () => this.#learn(d, b.dataset.learn));
    card.querySelectorAll('[data-forget]').forEach((b) => b.onclick = () => this.#forget(d, b.dataset.forget));
    card.querySelectorAll('[data-drill]').forEach((b) => b.onclick = () => this.#drill(d, b.dataset.drill));
    card.querySelector('[data-act="spar"]')?.addEventListener('click', () => this.#spar());
  }

  /* ------------------------------------------------------------------ */
  /* Technikák                                                           */
  /* ------------------------------------------------------------------ */
  #techPane(d) {
    if (!d) return '<p>Nincs sárkányod.</p>';
    const { state } = this.g;
    const s = state.stats(d);
    const lvl = s.level;
    const known = state.learnedOf(d);
    const slots = techSlots(lvl);
    const free = !this.shrine && state.save.story?.flags?.freeLesson;
    const innate = SKILLS[s.skill];
    const pips = (n) => Array.from({ length: MAX_ENERGY }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

    const slotHtml = [0, 1].map((i) => {
      if (i >= slots) return `<div class="tr-slot is-locked"><span class="tr-rune">ᛜ</span><div><b>Zárt hely</b><small>A 8. szinten nyílik meg</small></div></div>`;
      const k = known[i];
      if (!k) return `<div class="tr-slot is-empty"><span class="tr-rune">·</span><div><b>Üres hely</b><small>Taníts meg egy technikát alább</small></div></div>`;
      const t = TECHNIQUES[k];
      return `<div class="tr-slot" style="--c:#${t.color.toString(16).padStart(6, '0')}">
        <span class="tr-rune">${t.rune}</span>
        <div><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></div>
        <button type="button" class="btn btn-ghost btn-sm" data-forget="${k}" title="Elfelejti — a helye felszabadul">Elfelejt</button>
      </div>`;
    }).join('');

    const entries = Object.entries(TECHNIQUES).filter(([k]) => !this.shrine || this.shrine.keys.includes(k));
    // Ragnhildnál előbb az elérhetők, aztán a máshol tanítottak (rejtve, hol)
    if (!this.shrine) entries.sort(([, a], [, b]) => this.#available(b) - this.#available(a));
    const list = entries.map(([k, t]) => {
      const isKnown = known.includes(k);
      const hidden = !this.shrine && !this.#available(t);
      const tooLow = lvl < t.lvl;
      const full = known.length >= slots;
      const price = this.#price(t);
      const poor = state.save.shards < price;
      const why = hidden ? 'Máshol tanítják' : isKnown ? 'Már tudja' : tooLow ? `${t.lvl}. szinttől` : full ? 'Nincs szabad hely' : poor ? 'Kevés a szilánk' : '';
      if (hidden) {
        const where = { hermit: 'egy remete a sűrű fenyvesben', dwarf: 'egy törpe a hegyek tövében', frost: 'valaki a havas északon', muspell: 'egy oltár a hamuvidéken' }[t.src];
        return `
        <div class="tr-tech is-hidden" style="--c:#5d667f">
          <span class="tr-rune">?</span>
          <div class="tr-tech-body"><b>${esc(t.name)}</b><p>${esc(t.desc)}</p><small>Ragnhild: „Ezt nem én tudom. Azt mondják, <b>${esc(where)}</b> tanítja."</small></div>
          <button type="button" class="btn btn-sm" disabled>Máshol tanítják</button>
        </div>`;
      }
      return `
        <div class="tr-tech${isKnown ? ' is-known' : ''}${tooLow ? ' is-locked' : ''}" style="--c:#${t.color.toString(16).padStart(6, '0')}">
          <span class="tr-rune">${t.rune}</span>
          <div class="tr-tech-body">
            <b>${esc(t.name)}</b> <span class="bp-energy tr-cost" title="${t.cost} energia">${pips(t.cost)}</span>
            <p>${esc(t.desc)}</p>
            <small>${t.lvl}. szinttől · ${{ enemy: 'egy ellenfél', all: 'minden ellenfél', ally: 'egy társ', party: 'az egész csapat', self: 'önmaga' }[t.target]}</small>
          </div>
          <button type="button" class="btn btn-sm${why ? '' : ' btn-primary'}" data-learn="${k}" ${why ? 'disabled' : ''}>
            ${why ? esc(why) : price ? `Megtanít · ${price} ᚱ` : 'Megtanít · ingyen'}</button>
        </div>`;
    }).join('');

    return `
      <div class="tr-known">
        <div class="tr-slot is-innate"><span class="tr-rune">${innate.rune}</span>
          <div><b>${esc(innate.name)}</b><small>A fej ereje — ${esc(innate.desc)}</small></div></div>
        ${s.combo ? (() => {
          const c = COMBOS[s.combo.key];
          const els = [s.combo.primary, s.combo.secondary].filter((e, i, a) => a.indexOf(e) === i).map((e) => `${ELEMENTS[e].icon} ${ELEMENTS[e].name}`).join(' + ');
          return `<div class="tr-slot is-innate" style="--c:#${c.color.toString(16).padStart(6, '0')}"><span class="tr-rune">${c.rune}</span>
            <div><b>${esc(c.name)}</b><small>Az összetétel ereje (${esc(els)}, rezonancia ${s.combo.resonance}/4) — ${esc(c.desc)}</small></div></div>`;
        })() : ''}
        ${slotHtml}
      </div>
      ${free ? '<p class="gm-good">Ragnhild ajándéka: az első lecke <b>ingyenes</b>.</p>' : ''}
      <div class="tr-list">${list}</div>`;
  }

  async #learn(d, key) {
    const { state, hud, sfx, story } = this.g;
    const t = TECHNIQUES[key];
    const free = !this.shrine && state.save.story?.flags?.freeLesson;
    const price = this.#price(t);
    const known = state.learnedOf(d);
    if (!this.shrine && !this.#available(t)) return;
    if (known.includes(key) || known.length >= techSlots(levelOf(d.xp)) || state.save.shards < price) return;
    state.save.shards -= price;
    state.save.learned[d.id] = [...known, key];
    if (free) state.save.story.flags.freeLesson = false;
    state.commit('party');
    sfx.buff();
    hud.toast(`${t.rune} <b>${esc(d.nev)}</b> megtanulta: <b>${esc(t.name)}</b>`, 'good', 4000);
    this.#render();
    hud.el.card.querySelector(`[data-forget="${key}"]`)?.closest('.tr-slot')?.classList.add('is-new');
    if (await story.event('learn')) this.#render();
  }

  #price(t) {
    if (!this.shrine && this.g.state.save.story?.flags?.freeLesson) return 0;
    return this.shrine ? Math.round(t.price * 0.8) : t.price;
  }

  #forget(d, key) {
    const { state, sfx } = this.g;
    state.save.learned[d.id] = state.learnedOf(d).filter((k) => k !== key);
    state.commit('party');
    sfx.click();
    this.#render();
  }

  /* ------------------------------------------------------------------ */
  /* Edzés                                                               */
  /* ------------------------------------------------------------------ */
  #drillPane(d) {
    if (!d) return '<p>Nincs sárkányod.</p>';
    const { state } = this.g;
    const tr = state.trainOf(d);
    const rows = Object.entries(TRAIN).map(([k, t]) => {
      const rank = tr[k];
      const max = rank >= t.max;
      const cost = drillCost(rank);
      const poor = state.save.shards < cost;
      return `
        <div class="tr-stat">
          <span class="tr-stat-ico">${t.icon}</span>
          <div class="tr-stat-body">
            <b>${esc(t.name)}</b>
            <span class="tr-pips" aria-label="${rank}/${t.max}">${Array.from({ length: t.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span>
            <small>${esc(t.desc)}</small>
          </div>
          <button type="button" class="btn btn-sm${max || poor ? '' : ' btn-primary'}" data-drill="${k}" ${max || poor ? 'disabled' : ''}>
            ${max ? 'Mester ✓' : poor ? `${cost} ᚱ kell` : `Edzés · ${cost} ᚱ`}</button>
        </div>`;
    }).join('');
    return `
      <p class="br-help">Ragnhild a bábu körül <b>rúnát</b> rajzol. Üss, amikor a szűkülő kör pontosan a rúnára ér
        (<kbd>Szóköz</kbd> vagy kattintás). <b>${BEATS} ütemből ${NEED}</b> találat kell a fokozathoz — ha nem sikerül,
        a díj felét visszakapod. A tökéletes ütések tapasztalatot is adnak.</p>
      <div class="tr-stats">${rows}</div>`;
  }

  async #drill(d, stat) {
    const { state, hud, sfx, api } = this.g;
    const rank = state.trainOf(d)[stat];
    const cost = drillCost(rank);
    if (state.save.shards < cost || rank >= TRAIN[stat].max) return;
    state.save.shards -= cost;
    state.commit();

    const pane = hud.el.card.querySelector('.tr-pane');
    hud.el.card.querySelector('.tr-tabs').classList.add('is-busy');
    hud.el.card.querySelector('.tr-dragons')?.classList.add('is-busy');
    // Játék közben ne lehessen véletlenül bezárni (Esc, háttér)
    hud.modalCloseable = false;
    hud.el.card.querySelector('.gm-close')?.setAttribute('hidden', '');
    const result = await rhythmGame(pane, sfx, TRAIN[stat]);
    hud.modalCloseable = true;
    hud.el.card.querySelector('.gm-close')?.removeAttribute('hidden');
    const hits = result.perfect + result.good;
    const ok = hits >= NEED;
    const lvl = levelOf(d.xp);
    const xp = Math.round((result.perfect * 2 + result.good) * (6 + lvl * 2));
    const before = lvl;
    if (xp) {
      d.xp += xp;
      api.post('xp', { payload: JSON.stringify({ [d.id]: xp }) }).catch((e) => hud.toast(esc(e.message), 'bad'));
    }
    if (ok) {
      state.save.train[d.id] = { ...state.trainOf(d), [stat]: rank + 1 };
      sfx.levelUp();
    } else {
      state.save.shards += Math.floor(cost / 2);
      sfx.defeat();
    }
    state.save.stats.drills++;
    state.commit('party');

    pane.innerHTML = `
      <div class="drill-result ${ok ? 'is-ok' : 'is-fail'}">
        <p class="drill-big">${ok ? `${TRAIN[stat].icon} ${esc(TRAIN[stat].name)}: ${rank + 1}. fokozat!` : 'Most nem sikerült.'}</p>
        <p>Tökéletes: <b>${result.perfect}</b> · Jó: <b>${result.good}</b> · Mellé: <b>${BEATS - hits}</b></p>
        ${xp ? `<p class="gm-good">${esc(d.nev)} +${xp} tapasztalat${levelOf(d.xp) > before ? ` — <b>${levelOf(d.xp)}. szint!</b>` : ''}</p>` : ''}
        ${ok ? '' : `<p class="muted">Ragnhild visszaadta a díj felét (${Math.floor(cost / 2)} ᚱ). „Még egyszer. Lazábban a csuklót."</p>`}
        <div class="gm-actions"><button class="btn btn-primary" type="button" data-act="back">Vissza a karámba</button></div>
      </div>`;
    pane.querySelector('[data-act="back"]').onclick = () => this.#render();
    pane.querySelector('[data-act="back"]').focus();
  }

  /* ------------------------------------------------------------------ */
  /* Párbaj                                                              */
  /* ------------------------------------------------------------------ */
  #sparInfo() {
    const { state } = this.g;
    const up = state.party.filter((d) => state.hpOf(d) > 0);
    const avg = up.length ? Math.round(up.reduce((s, d) => s + levelOf(d.xp), 0) / up.length) : 1;
    return { up, count: Math.max(1, Math.min(up.length, 2)), level: avg };
  }

  #sparPane() {
    const { hud } = this.g;
    const { up, count, level } = this.#sparInfo();
    return `
      <div class="tr-spar">
        <p>Ragnhild sárkányai — <b>Szélvész</b> utódai — a csapatod szintjén harcolnak. A karámban senki nem esik el igazán:
           a párbaj után <b>mindenki felépül</b>, és vereségnél sem veszítesz semmit. Szilánkot nem ad, de <b>tapasztalatot</b> igen.</p>
        <div class="gm-facts">
          <span>Ellenfelek: <b>${count}</b></span>
          <span>Szintjük: <b>~${level}.</b></span>
          <span>Jutalom: <b>tapasztalat</b></span>
        </div>
        ${up.length ? `<div class="gm-party">${up.map((d) => hud.dragonCard(d)).join('')}</div>` : '<p class="gm-warn">A csapatod kimerült — pihenj a hosszúházban.</p>'}
        <div class="gm-actions">
          <button class="btn btn-primary" type="button" data-act="spar" ${up.length ? '' : 'disabled'}>Párbaj indítása</button>
        </div>
      </div>`;
  }

  #spar() {
    const { count, level } = this.#sparInfo();
    this.g.hud.closeModal();
    this.hooks.onSpar(count, level);
  }
}

/* =====================================================================
   Rúnaütés — ritmusjáték
   A kör CSS transformmal szűkül (festés nélkül, a kompozitoron);
   az időzítést a requestAnimationFrame méri.
   @returns {Promise<{perfect:number, good:number}>}
   ===================================================================== */
function rhythmGame(host, sfx, stat) {
  const runes = ['ᛏ', 'ᚢ', 'ᛒ', 'ᚦ', 'ᛉ'];
  host.innerHTML = `
    <div class="drill">
      <p class="drill-title">${stat.icon} ${esc(stat.name)} — Rúnaütés</p>
      <div class="drill-stage" tabindex="0" aria-label="Üss, amikor a kör a rúnára ér">
        <div class="drill-target"><span class="drill-rune">${runes[0]}</span></div>
        <div class="drill-ring"></div>
        <div class="drill-pop" aria-live="polite"></div>
      </div>
      <div class="drill-beats">${Array.from({ length: BEATS }, () => '<i></i>').join('')}</div>
      <p class="drill-help"><kbd>Szóköz</kbd> / kattintás — amikor a külső kör eléri a rúnát</p>
    </div>`;
  const stage = host.querySelector('.drill-stage');
  const ring = host.querySelector('.drill-ring');
  const rune = host.querySelector('.drill-rune');
  const pop = host.querySelector('.drill-pop');
  const beats = host.querySelectorAll('.drill-beats i');
  stage.focus();

  return new Promise((resolve) => {
    const res = { perfect: 0, good: 0 };
    let beat = 0, start = 0, dur = 0, live = false, raf = 0;
    const FROM = 2.7, TO = 0.45;

    const scaleAt = (t) => FROM - (FROM - TO) * Math.max(0, Math.min(1, (t - start) / dur));
    const feedback = (kind) => {
      pop.textContent = { perfect: 'Tökéletes!', good: 'Jó!', miss: 'Mellé…' }[kind];
      pop.className = `drill-pop is-${kind}`;
      void pop.offsetWidth;
      pop.classList.add('is-in');
      beats[beat].className = `is-${kind}`;
      stage.classList.remove('is-hit-perfect', 'is-hit-good', 'is-hit-miss');
      void stage.offsetWidth;
      stage.classList.add(`is-hit-${kind}`);
      if (kind === 'perfect') { res.perfect++; sfx.hit(true); }
      else if (kind === 'good') { res.good++; sfx.hit(false); }
      else sfx.miss();
    };
    const judge = () => {
      if (!live) return;
      live = false;
      cancelAnimationFrame(raf);
      const diff = Math.abs(scaleAt(performance.now()) - 1);
      feedback(diff < 0.09 ? 'perfect' : diff < 0.22 ? 'good' : 'miss');
      nextBeat();
    };
    const frame = () => {
      const s = scaleAt(performance.now());
      ring.style.transform = `scale(${s})`;
      ring.classList.toggle('is-near', Math.abs(s - 1) < 0.22);
      if (s <= TO + 0.001) { live = false; feedback('miss'); nextBeat(); return; }
      raf = requestAnimationFrame(frame);
    };
    const nextBeat = () => {
      beat++;
      if (beat >= BEATS) { setTimeout(() => { cleanup(); resolve(res); }, 650); return; }
      setTimeout(begin, 520);
    };
    const begin = () => {
      rune.textContent = runes[beat % runes.length];
      rune.parentElement.classList.remove('is-in'); void rune.offsetWidth; rune.parentElement.classList.add('is-in');
      dur = 1250 - beat * 110 + Math.random() * 120;      // ütemről ütemre gyorsul
      start = performance.now() + Math.random() * 260;    // kis szünet: ne lehessen vakon ütni
      live = true;
      raf = requestAnimationFrame(frame);
    };
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); judge(); }
    };
    const onDown = (e) => { e.preventDefault(); judge(); };
    const cleanup = () => {
      document.removeEventListener('keydown', onKey, true);
      stage.removeEventListener('pointerdown', onDown);
    };
    document.addEventListener('keydown', onKey, true);
    stage.addEventListener('pointerdown', onDown);
    setTimeout(begin, 700);
  });
}
