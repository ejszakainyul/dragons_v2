/* =====================================================================
   Főoldal: a hero sárkány finom parallaxisa.
   (A parázs és a sarkfény a közös háttérvilágból jön: inc/realm.php.)
   ===================================================================== */
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* --- Hero parallaxis ---------------------------------------------- */
  const dragon = document.getElementById('heroDragon');
  if (dragon && window.matchMedia('(pointer: fine)').matches) {
    let raf = null;
    let tx = 0, ty = 0;

    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth  - 0.5) * 22;
      ty = (e.clientY / window.innerHeight - 0.5) * 16;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        dragon.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        raf = null;
      });
    }, { passive: true });
  }
})();
