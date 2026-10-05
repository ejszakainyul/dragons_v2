/* =====================================================================
   Egyedi kurzor: lángnyelv a kurzor helyén, szikrákkal.

   A régi verzió setInterval(fn, 1)-gyel futott (≈1000 újrarajzolás/mp)
   és gombonként új globális mousemove figyelőt regisztrált. Itt egyetlen
   requestAnimationFrame-ciklus és egyetlen figyelő van.
   ===================================================================== */
(() => {
  'use strict';

  // Érintőképernyőn és csökkentett mozgás mellett nem kell egyedi kurzor
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const flame = document.createElement('div');
  flame.className = 'cursor-flame';
  document.body.appendChild(flame);

  const rand = (min, max) => Math.random() * (max - min) + min;

  let x = -100, y = -100;          // cél
  let cx = -100, cy = -100;        // aktuális (késleltetve követ)
  let vx = 0;
  let lastSpark = 0;
  let visible = false;

  document.addEventListener('pointermove', (e) => {
    vx = e.clientX - x;
    x  = e.clientX;
    y  = e.clientY;

    if (!visible) { visible = true; flame.style.opacity = '1'; }
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    visible = false;
    flame.style.opacity = '0';
  });

  /** Rövid életű szikra a kurzor mögött. */
  function spark(px, py) {
    const el = document.createElement('div');
    el.className = 'cursor-spark';
    el.style.left = `${px}px`;
    el.style.top  = `${py}px`;
    el.style.setProperty('--dx', `${rand(-34, 34)}px`);
    el.style.setProperty('--dy', `${rand(6, 46)}px`);
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  let shapeTick = 0;

  function frame(now) {
    // Lágy követés
    cx += (x - cx) * 0.28;
    cy += (y - cy) * 0.28;

    flame.style.transform =
      `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -55%) rotate(${Math.max(-18, Math.min(18, vx * 0.8))}deg)`;

    // A láng alakja ~12 képkockánként változik, nem minden képkockán
    if (++shapeTick % 12 === 0) {
      flame.style.clipPath =
        `polygon(50% 0%, ${rand(62, 74)}% ${rand(16, 26)}%, ${rand(80, 90)}% ${rand(32, 46)}%, ` +
        `${rand(60, 74)}% ${rand(56, 70)}%, 50% ${rand(76, 92)}%, ${rand(26, 40)}% ${rand(56, 70)}%, ` +
        `${rand(10, 20)}% ${rand(32, 46)}%, ${rand(26, 38)}% ${rand(16, 26)}%)`;
      flame.style.height = `${rand(40, 52)}px`;
      flame.style.width  = `${rand(26, 34)}px`;
    }

    // Szikrák: legfeljebb ~14-szer másodpercenként, és csak mozgás közben
    if (visible && Math.abs(vx) > 1 && now - lastSpark > 70) {
      lastSpark = now;
      spark(cx + rand(-5, 5), cy + rand(-4, 4));
    }
    vx *= 0.85;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------------ */
  /* Gomb-kiemelés — a question.js hívja meg a válaszgombokra            */
  /* ------------------------------------------------------------------ */
  window.addCursorEvents = function addCursorEvents(button) {
    button.addEventListener('pointerenter', () => {
      flame.classList.add('on-button');
      button.classList.add('cursor-lit');
    });
    button.addEventListener('pointerleave', () => {
      flame.classList.remove('on-button');
      button.classList.remove('cursor-lit');
    });
  };
})();
