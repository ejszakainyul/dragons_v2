/* =====================================================================
   Nyílt nap — a nyitott oldal figyeli a fiókot
   ---------------------------------------------------------------------
   Ha a segítő a vezérlőből nullázza a fiókot, a látogató oldala pár
   másodpercen belül magától visszaugrik a túra elejére (kilépés nélkül).
   Közben a túrasáv is frissül: ha az állomás teljesült, megjelenik a
   „Következő" gomb.
   ===================================================================== */
(() => {
  const OD = window.OPENDAY;
  if (!OD) return;
  const keys = Object.keys(OD.steps);
  const hereKey = keys.find((k) => OD.steps[k][1] === OD.here) || null;

  function paint(done) {
    const bar = document.getElementById('odBar');
    if (!bar) return;
    const next = keys.find((k) => !done.includes(k)) || null;
    for (const li of bar.querySelectorAll('[data-step]')) {
      const k = li.dataset.step;
      li.classList.toggle('is-done', done.includes(k));
      li.classList.toggle('is-next', k === next);
    }
    const btn = document.getElementById('odBarNext');
    if (!btn) return;
    if (hereKey && done.includes(hereKey)) {
      btn.hidden = false;
      if (next) { btn.href = OD.steps[next][1]; btn.textContent = `Következő: ${OD.steps[next][0]} →`; }
      else { btn.href = 'nyiltnap.php'; btn.textContent = 'Kész a túra! →'; }
      if (!btn.dataset.shown) { btn.dataset.shown = '1'; btn.classList.add('is-pop'); }
    } else btn.hidden = true;
  }
  paint(OD.done || []);

  let busy = false;
  async function ping() {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const r = await fetch('nyiltnap.php?api=ping', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json();
      if (!d.demo || d.epoch !== OD.epoch) { location.replace('nyiltnap.php'); return; }
      paint(d.done || []);
    } catch { /* hálózati hiba: a következő körben újra */ }
    busy = false;
  }
  setInterval(ping, 5000);
  document.addEventListener('visibilitychange', ping);
})();
