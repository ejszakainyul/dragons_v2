/* =====================================================================
   Nyílt nap vezérlő — élő lista, nullázás, ki/bekapcsolás
   ===================================================================== */
(() => {
  const C = window.OD_ADMIN;
  if (!C) return;
  const grid = document.getElementById('odGrid');
  const stats = document.getElementById('odStats');
  const toast = document.getElementById('odToast');
  const steps = Object.entries(C.steps);           // [kulcs, [cím, rúna]]
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const agoText = (s) => (s == null ? 'még nem járt itt' : s < 15 ? 'most aktív' : s < 60 ? `${s} mp-e` : s < 3600 ? `${Math.floor(s / 60)} perce` : `${Math.floor(s / 3600)} órája`);

  function render(data) {
    const acc = data.accounts;
    const live = acc.filter((a) => a.ago != null && a.ago < 90).length;
    const finished = acc.filter((a) => a.done.length === steps.length).length;
    const on = acc.filter((a) => a.active).length;
    stats.innerHTML = `
      <div><b>${acc.length}</b><span>fiók</span></div>
      <div><b>${on}</b><span>bekapcsolva</span></div>
      <div class="is-live"><b>${live}</b><span>épp játszik</span></div>
      <div class="is-done"><b>${finished}</b><span>végigért</span></div>`;
    if (!acc.length) {
      grid.innerHTML = `<div class="card od-empty"><h2>Még nincsenek bemutató fiókok</h2>
        <p class="muted">Egy kattintás, és elkészül mind a 16 (ODIN, THOR, LOKI… egy-egy véletlen számjeggyel).</p>
        <button class="btn btn-primary" type="button" data-act="create">＋ 16 fiók létrehozása</button></div>`;
      return;
    }
    grid.innerHTML = acc.map((a) => {
      const pct = Math.round((a.done.length / steps.length) * 100);
      const chips = steps.map(([k, [title, rune]]) => {
        const st = a.done.includes(k) ? 'is-done' : k === a.next ? 'is-next' : '';
        return `<li class="${st}" title="${esc(title)}"><i>${a.done.includes(k) ? '✓' : rune}</i><span>${esc(title)}</span></li>`;
      }).join('');
      const where = a.next ? `Most: <b>${esc(C.steps[a.next][0])}</b>` : '<b>Végigért ✓</b>';
      return `
        <article class="od-acc ${a.active ? '' : 'is-off'} ${a.ago != null && a.ago < 90 ? 'is-live' : ''} ${a.next ? '' : 'is-finished'}" data-id="${a.id}">
          <header>
            <span class="od-acc-code">${esc(a.code)}</span>
            <span class="od-acc-name">${esc(a.name)}<small>${agoText(a.ago)}</small></span>
            <span class="od-acc-pct" style="--p:${pct / 100}">${pct}%</span>
          </header>
          <ol class="od-acc-steps">${chips}</ol>
          <p class="od-acc-meta">${where} · 🐉 ${a.dragons} · 📜 ${a.stories}${a.resets ? ` · ⟲ ${a.resets}×` : ''}</p>
          <footer>
            <button class="btn btn-sm" type="button" data-act="toggle" data-id="${a.id}">${a.active ? 'Kikapcsol' : 'Bekapcsol'}</button>
            <button class="btn btn-sm btn-primary" type="button" data-act="reset" data-id="${a.id}">⟲ Nullázás</button>
          </footer>
        </article>`;
    }).join('');
  }

  function say(msg, bad = false) {
    toast.textContent = msg;
    toast.className = `od-toast is-in${bad ? ' is-bad' : ''}`;
    clearTimeout(say.t);
    say.t = setTimeout(() => { toast.className = 'od-toast'; }, 2800);
  }

  async function post(act, id) {
    const fd = new FormData();
    fd.append('_csrf', C.csrf);
    fd.append('act', act);
    if (id) fd.append('id', id);
    const r = await fetch('nyiltnap_admin.php', { method: 'POST', body: fd, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({ error: 'Érvénytelen válasz.' }));
    if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    const card = id ? grid.querySelector(`[data-id="${id}"]`) : null;
    const who = card ? card.querySelector('.od-acc-code').textContent : '';
    if (act === 'reset_all' && !confirm('Biztosan nullázod MIND a 16 fiók haladását? A látogatók bent maradnak, de elölről kezdik.')) return;
    if (act === 'all_off' && !confirm('Kikapcsolod az összes fiókot? A kódok nem fognak működni, a bent lévők kikerülnek.')) return;
    b.disabled = true;
    try {
      const d = await post(act, id);
      render(d);
      say(who ? `${who}: ${d.msg}` : d.msg);
    } catch (err) {
      say(err.message, true);
    } finally {
      b.disabled = false;
    }
  });

  render(C.data);
  setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const r = await fetch('nyiltnap_admin.php?api=list', { credentials: 'same-origin', cache: 'no-store' });
      if (r.ok) render(await r.json());
    } catch { /* a következő körben újra */ }
  }, 5000);
})();
