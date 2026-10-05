/* =====================================================================
   Közös felületi viselkedés: navigáció, görgetésre megjelenő elemek,
   kártya-fényfolt, számlálók.
   ===================================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Mobil menü --------------------------------------------------- */
  const burger = document.getElementById('navBurger');
  const links  = document.getElementById('navLinks');

  if (burger && links) {
    const setOpen = (open) => {
      burger.classList.toggle('open', open);
      links.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    };

    burger.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* --- Fejléc árnyék görgetéskor ------------------------------------ */
  const nav = document.getElementById('siteNav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Görgetésre felúszó elemek ------------------------------------ */
  const revealables = document.querySelectorAll('.reveal');
  if (revealables.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealables.forEach((el) => el.classList.add('visible'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // Egymás utáni elemek lépcsőzetes megjelenése
          const delay = Number(entry.target.dataset.delay || 0);
          setTimeout(() => entry.target.classList.add('visible'), delay);
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

      revealables.forEach((el) => io.observe(el));
    }
  }

  /* --- Kártya fényfolt a kurzor alatt ------------------------------- */
  if (!reduceMotion) {
    // Képkockánként legfeljebb egyszer: az egér másodpercenként akár
    // 100+ eseményt is küld, és mindegyik méretolvasás + stílusírás volt
    document.querySelectorAll('.card-spotlight').forEach((card) => {
      let raf = 0, x = 0, y = 0;
      card.addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${x - r.left}px`);
          card.style.setProperty('--my', `${y - r.top}px`);
        });
      }, { passive: true });
    });
  }

  /* --- Számláló animáció (data-count-to) ---------------------------- */
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length) {
    const run = (el) => {
      const target = Number(el.dataset.countTo) || 0;
      if (reduceMotion) { el.textContent = String(target); return; }

      const duration = 1100;
      const start    = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run(entry.target);
          io.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      counters.forEach((el) => io.observe(el));
    } else {
      counters.forEach(run);
    }
  }

  /* --- Statisztika-sávok feltöltése --------------------------------- */
  const bars = document.querySelectorAll('.stat-bar > span[data-fill]');
  if (bars.length) {
    requestAnimationFrame(() => {
      bars.forEach((bar) => { bar.style.width = `${bar.dataset.fill}%`; });
    });
  }
})();
