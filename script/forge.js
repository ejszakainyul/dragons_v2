/* =====================================================================
   Kovácsolt gombok — kattintásra „kalapácsütés"
   ---------------------------------------------------------------------
   - A fő (parázs) gombból szikrák és parázs pattan szét, rámutatáskor
     parázs száll fel a tetejéről.
   - A többi gombból jégszilánkok repülnek, a veszélyes gombból vörös szikra.
   - A gomb maga összerándul és túllendül (CSS: .is-struck).

   Minden részecske egy kis, rögzített elem, amit csak transform/opacity
   animál — a böngésző festés nélkül mozgatja. Egyszerre legfeljebb
   MAX_ALIVE él; gyenge gépen (html.realm-lite) feleannyi keletkezik.
   ===================================================================== */
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lite = document.documentElement.classList.contains('realm-lite');
  const MAX_ALIVE = lite ? 24 : 60;
  let alive = 0;

  const layer = document.createElement('div');
  layer.className = 'forge-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const rand = (a, b) => a + Math.random() * (b - a);

  /** A gomb „anyaga" határozza meg a szikrák fajtáját. */
  const materialOf = (btn) => {
    if (btn.classList.contains('btn-primary')) return 'ember';
    if (btn.classList.contains('btn-danger'))  return 'blood';
    return 'frost';
  };

  const PALETTE = {
    ember: ['#fff3c4', '#ffd08a', '#ffb050', '#ff8a3d', '#ff6a1f'],
    frost: ['#ffffff', '#d9f7ff', '#9fe8ff', '#7ce7ff', '#4fd6ff'],
    blood: ['#fff0f2', '#ffb3bb', '#ff7a88', '#ff5d6c'],
  };
  const RING = { ember: '#ffb050', frost: '#7ce7ff', blood: '#ff7a88' };

  /** Egy elem, ami az animációja végén eltávolítja magát. */
  const spawn = (cls, x, y, vars) => {
    if (alive >= MAX_ALIVE) return;
    const el = document.createElement('i');
    el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    for (const k in vars) el.style.setProperty(k, vars[k]);
    alive++;
    el.addEventListener('animationend', () => { el.remove(); alive--; }, { once: true });
    layer.appendChild(el);
  };

  /** Kalapácsütés a (x, y) pontban. */
  const strike = (btn, x, y) => {
    const mat = materialOf(btn);
    const colors = PALETTE[mat];
    const r = btn.getBoundingClientRect();

    // Lökéshullám — a gomb méretéhez igazítva
    spawn('forge-ring', x, y, { '--c': RING[mat], '--s': String(Math.max(4, r.width / 14)) });

    const n = lite ? 7 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      // Felfelé kicsit erősebben pattanjanak, mint lefelé
      const d = rand(30, 90) * (Math.sin(a) < 0 ? 1.15 : 0.8);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const c = colors[(Math.random() * colors.length) | 0];

      if (mat === 'frost') {
        const w = rand(3, 5);
        spawn('forge-spark shard', x, y, {
          '--c': c, '--dx': `${dx}px`, '--dy': `${dy}px`, '--fall': `${rand(6, 22)}px`,
          '--w': `${w}px`, '--h': `${w * rand(2.2, 3.4)}px`,
          '--r': `${(a * 180) / Math.PI + 90}deg`, '--t': `${rand(0.5, 0.8)}s`,
        });
      } else {
        const s = rand(2.5, 5);
        spawn('forge-spark', x, y, {
          '--c': c, '--dx': `${dx}px`, '--dy': `${dy}px`, '--fall': `${rand(14, 40)}px`,
          '--w': `${s}px`, '--h': `${s}px`, '--t': `${rand(0.55, 0.95)}s`,
        });
      }
    }
  };

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled || e.button > 0) return;

    btn.classList.remove('is-struck');
    void btn.offsetWidth;                // az animáció újraindítása
    btn.classList.add('is-struck');
    strike(btn, e.clientX, e.clientY);
  }, { passive: true });

  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'forgeStrike') e.target.classList.remove('is-struck');
  });

  // Billentyűzettel (Enter/Szóköz) is legyen ütés, a gomb közepén
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = document.activeElement;
    if (!btn || !btn.classList || !btn.classList.contains('btn')) return;
    const r = btn.getBoundingClientRect();
    strike(btn, r.left + r.width / 2, r.top + r.height / 2);
  });

  /* --- Rámutatáskor parázs száll fel a fő gombokról --------------- */
  if (lite) return;

  let hovered = null;
  let timer = 0;

  const emit = () => {
    if (!hovered || !hovered.isConnected) { stop(); return; }
    const r = hovered.getBoundingClientRect();
    spawn('forge-ember', rand(r.left + 8, r.right - 8), r.top + 2, {
      '--dx': `${rand(-14, 14)}px`, '--dy': `${-rand(26, 58)}px`, '--t': `${rand(0.8, 1.4)}s`,
    });
  };
  const stop = () => { clearInterval(timer); timer = 0; hovered = null; };

  document.addEventListener('pointerover', (e) => {
    const btn = e.target.closest('.btn-primary');
    if (btn === hovered) return;
    stop();
    if (btn && e.pointerType === 'mouse') {
      hovered = btn;
      emit();
      timer = setInterval(emit, 130);
    }
  });
  document.addEventListener('pointerout', (e) => {
    if (hovered && !hovered.contains(e.relatedTarget)) stop();
  });
})();
