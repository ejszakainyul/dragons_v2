/* =====================================================================
   A viking téma viselkedése
   ---------------------------------------------------------------------
   1. Parallaxis: az egér szerint mozdulnak a háttér kis rétegei (lebegő
      tárgyak, hold, sarkfény). A ciklus csak addig fut, amíg van mit
      közelíteni — nyugalmi állapotban egyetlen képkockát sem számol.
   2. Rúnasor a címsorok fölé: a cím szövegének ifjabb futhark átírása.
   3. Kártyák 3D-s billenése a kurzor alatt.
   ===================================================================== */
(() => {
  'use strict';

  const root   = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = window.matchMedia('(pointer: fine)').matches;
  const lite   = root.classList.contains('realm-lite');

  /* ------------------------------------------------------------------ */
  /* 1. Parallaxis                                                       */
  /* ------------------------------------------------------------------ */
  const realm = document.getElementById('realm');

  if (realm && !reduce && !lite) {
    const cur = { px: 0, py: 0 };
    const tgt = { px: 0, py: 0 };
    let running = false;

    /*
     * A rétegek eltolását KÖZVETLENÜL az elemekre írjuk (translate), nem
     * CSS-változóként a közös szülőre. A szülő változója minden képkockán
     * a háttér ÖSSZES elemét újraszámoltatta (a lebegő rúnák animációi is
     * hivatkoznak változókra) — mérve 3 mp egérmozgás alatt 4,7 mp stílus-
     * újraszámolás, ~14 fps. Így csak ez a hat elem változik, és a
     * translate-et a böngésző festés nélkül, a kompozitoron mozgatja.
     *
     * A három nagy tájréteg (hegyek, part) SZÁNDÉKOSAN áll: mérve a
     * mozgatásuk egy integrált videokártyán 55-ről 36 fps-re vitte le
     * a görgetést (három közel képernyőnyi réteget kellett képkockánként
     * összeolvasztani). Állva egyszer festődnek ki, utána semmibe sem
     * kerülnek. A térhatást a lebegő tárgyak, a hold és a sarkfény adja.
     *
     *            elem          egér-x  egér-y
     */
    const LAYERS = [
      ['.realm-moon',    5,  4],
      ['.realm-aurora',  4,  0],
      ['.realm-drift',  36, 20],
    ].map(([sel, ax, ay]) => [realm.querySelector(sel), ax, ay]).filter(([el]) => el);

    const apply = () => {
      for (const [el, ax, ay] of LAYERS) {
        el.style.translate = `${(-cur.px * ax).toFixed(1)}px ${(-cur.py * ay).toFixed(1)}px`;
      }
    };

    const step = () => {
      let moving = false;
      for (const k of ['px', 'py']) {
        const d = tgt[k] - cur[k];
        if (Math.abs(d) > 0.0015) {
          cur[k] += d * 0.075;                         // lomhán kövesse az egeret
          moving = true;
        } else {
          cur[k] = tgt[k];
        }
      }
      apply();
      running = moving;
      if (moving) requestAnimationFrame(step);
    };

    const kick = () => {
      if (running) return;
      running = true;
      requestAnimationFrame(step);
    };

    if (fine) {
      window.addEventListener('pointermove', (e) => {
        tgt.px = (e.clientX / window.innerWidth) * 2 - 1;
        tgt.py = (e.clientY / window.innerHeight) * 2 - 1;
        kick();
      }, { passive: true });

      // Ha az egér elhagyja az ablakot, a táj lassan visszaáll középre
      document.addEventListener('pointerleave', () => { tgt.px = 0; tgt.py = 0; kick(); });
    }

  }

  /* ------------------------------------------------------------------ */
  /* 2. Rúnasor a címsorok fölé                                          */
  /* ------------------------------------------------------------------ */
  // Egyszerűsített átírás ifjabb/idősebb futharkra. Pontos nyelvészeti
  // átírás helyett díszítés: a hangzás nagyjából követhető marad.
  const MAP = {
    a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ',
    j: 'ᛃ', k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᚲ', r: 'ᚱ',
    s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚹ', w: 'ᚹ', x: 'ᚲᛊ', y: 'ᛁ', z: 'ᛉ',
  };

  const toRunes = (text) => {
    const t = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')      // ékezetek le (ő → o, ű → u)
      .replace(/th/g, 'ᚦ')
      .replace(/ng/g, 'ᛜ');
    let out = '';
    for (const ch of t) {
      if (MAP[ch]) out += MAP[ch];
      else if (/[ᚦᛜ]/.test(ch)) out += ch;
      else if (/\s/.test(ch) && !out.endsWith('᛫')) out += '᛫';
    }
    return out.replace(/^᛫|᛫$/g, '');
  };

  document.querySelectorAll('main h1, .section-head h2').forEach((h) => {
    if (h.dataset.norune !== undefined || h.previousElementSibling?.classList.contains('rune-line')) return;
    const runes = toRunes(h.textContent.trim());
    if (!runes) return;
    const line = document.createElement('span');
    line.className = 'rune-line';
    line.setAttribute('aria-hidden', 'true');
    line.textContent = runes;
    // A cím belépő animációját (reveal) a rúnasor is kövesse
    if (h.classList.contains('reveal')) {
      line.classList.add('reveal');
      if (h.dataset.delay) line.dataset.delay = h.dataset.delay;
      // a ui.js már elindította a figyelést — ha a cím látszik, ez is
      if (h.classList.contains('visible')) line.classList.add('visible');
      else new MutationObserver((_, obs) => {
        if (h.classList.contains('visible')) { line.classList.add('visible'); obs.disconnect(); }
      }).observe(h, { attributes: true, attributeFilter: ['class'] });
    }
    h.before(line);
  });

  /* ------------------------------------------------------------------ */
  /* 3. Kártyák 3D-s billenése                                           */
  /* ------------------------------------------------------------------ */
  if (fine && !reduce && !lite) {
    document.querySelectorAll('.card-spotlight, .card-tilt').forEach((card) => {
      let raf = 0, rx = 0, ry = 0;
      const apply = () => {
        raf = 0;
        card.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
      };
      let ex = 0, ey = 0;
      card.addEventListener('pointermove', (e) => {
        ex = e.clientX; ey = e.clientY;
        if (!raf) raf = requestAnimationFrame(() => {
          // a méretet is a képkockában olvassuk — eseményenként nem
          const r = card.getBoundingClientRect();
          ry = ((ex - r.left) / r.width - 0.5) * 9;    // legfeljebb ±4,5° — elég a térhatáshoz
          rx = -((ey - r.top) / r.height - 0.5) * 7;
          apply();
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        rx = 0; ry = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      });
    });
  }
})();
