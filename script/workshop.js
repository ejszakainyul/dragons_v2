/* =====================================================================
   A műhely: testrészek húzása / kattintása, élő statisztika, mentés.
   ===================================================================== */
(() => {
  'use strict';

  const CFG = window.WORKSHOP;
  if (!CFG) return;

  const SLOTS = ['head', 'body', 'legs', 'wings'];
  const LABELS = { head: 'Fej', body: 'Test', legs: 'Láb', wings: 'Szárny' };

  // Viszonyítási alap a statisztika-sávokhoz: a legerősebb keverhető
  // kombináció. A `php tools/build_svg.php` kiírja az aktuális értéket.
  const MAX_HP  = 243;
  const MAX_DMG = 86;

  const area      = document.getElementById('dragonArea');
  const hint      = document.getElementById('areaHint');
  const chipsEl   = document.getElementById('placedChips');
  const hpEl      = document.getElementById('totalHP');
  const dmgEl     = document.getElementById('totalDMG');
  const barHP     = document.getElementById('barHP');
  const barDMG    = document.getElementById('barDMG');
  const colorEl   = document.getElementById('colorPicker');
  const matrixEl  = document.querySelector('#workshopTint feColorMatrix');
  const form      = document.getElementById('saveForm');
  const nameEl    = document.getElementById('dragonName');
  const saveBtn   = document.getElementById('saveDragonBtn');
  const resetBtn  = document.getElementById('resetBtn');
  const msgEl     = document.getElementById('workshopMsg');

  const imgFor = (slot) => document.getElementById(`slot-${slot}`);

  /** A felhelyezett részek: slot -> {id, hp, dmg, elemId, name} */
  const placed = Object.create(null);

  /* ------------------------------------------------------------------ */
  function message(text, kind = 'error') {
    if (!text) { msgEl.hidden = true; return; }
    msgEl.textContent = text;
    msgEl.className = `workshop-msg is-${kind}`;
    msgEl.hidden = false;
  }

  function place(slot, data) {
    // Ha volt már ilyen slotban valami, visszatesszük a listába
    if (placed[slot]) unplace(slot, false);

    const img = imgFor(slot);
    img.src = `${CFG.partsDir}${slot}[${data.id}].${CFG.partsExt || 'png'}`;
    img.hidden = false;
    // A saját színű réteg (szarv, karom, szem…) — csak a festett PNG-készletben van
    const fx = document.getElementById(`slot-${slot}-fx`);
    if (fx && (CFG.partsExt || 'png') === 'png') {
      fx.onerror = () => { fx.hidden = true; };
      fx.src = `${CFG.partsDir}${slot}[${data.id}]-fx.png`;
      fx.hidden = false;
    }

    const listItem = document.getElementById(data.elemId);
    if (listItem) listItem.classList.add('used');

    placed[slot] = data;
    refresh();
  }

  function unplace(slot, doRefresh = true) {
    const data = placed[slot];
    if (!data) return;

    const listItem = document.getElementById(data.elemId);
    if (listItem) listItem.classList.remove('used');

    const img = imgFor(slot);
    img.removeAttribute('src');
    img.hidden = true;
    const fx = document.getElementById(`slot-${slot}-fx`);
    if (fx) { fx.removeAttribute('src'); fx.hidden = true; }

    delete placed[slot];
    if (doRefresh) refresh();
  }

  function refresh() {
    let hp = 0, dmg = 0;
    const active = SLOTS.filter((s) => placed[s]);

    active.forEach((s) => { hp += placed[s].hp; dmg += placed[s].dmg; });

    hpEl.textContent  = hp;
    dmgEl.textContent = dmg;
    barHP.style.width  = `${Math.min(100, (hp  / MAX_HP)  * 100)}%`;
    barDMG.style.width = `${Math.min(100, (dmg / MAX_DMG) * 100)}%`;

    hint.hidden = active.length > 0;
    area.classList.toggle('has-parts', active.length > 0);

    // Eltávolító chipek
    chipsEl.innerHTML = '';
    active.forEach((slot) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'placed-chip';
      chip.innerHTML = `<span>${LABELS[slot]}: ${placed[slot].name}</span><i aria-hidden="true">✕</i>`;
      chip.title = 'Eltávolítás';
      chip.addEventListener('click', () => unplace(slot));
      chipsEl.appendChild(chip);
    });

    message('');
  }

  function dataFromItem(item) {
    return {
      id:     parseInt(item.dataset.id, 10),
      hp:     parseInt(item.dataset.hp  || '0', 10),
      dmg:    parseInt(item.dataset.dmg || '0', 10),
      elemId: item.id,
      name:   item.title || '',
    };
  }

  /* ------------------------------------------------------------------ */
  /* Húzás és kattintás                                                  */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('.part-item').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        slot: item.dataset.slot, ...dataFromItem(item),
      }));
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => item.classList.remove('dragging'));

    // Érintőképernyőn és egyszerűen: kattintás is felhelyezi
    item.addEventListener('click', () => {
      const slot = item.dataset.slot;
      if (placed[slot] && placed[slot].elemId === item.id) {
        unplace(slot);
      } else {
        place(slot, dataFromItem(item));
      }
    });
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!SLOTS.includes(data.slot)) return;
      place(data.slot, data);
    } catch {
      message('Nem sikerült feldolgozni a húzott elemet.');
    }
  });

  /* ------------------------------------------------------------------ */
  /* Színezés                                                            */
  /* ------------------------------------------------------------------ */
  function applyColor() {
    const hex = colorEl.value.replace('#', '');
    const f   = 1.3;
    const c   = (i) => Math.min(parseInt(hex.substr(i, 2), 16) / 255 * f, 1).toFixed(4);
    matrixEl.setAttribute('values', `${c(0)} 0 0 0 0  0 ${c(2)} 0 0 0  0 0 ${c(4)} 0 0  0 0 0 1 0`);
  }
  colorEl.addEventListener('input', applyColor);
  applyColor();

  /* ------------------------------------------------------------------ */
  /* Újrakezdés + mentés                                                 */
  /* ------------------------------------------------------------------ */
  resetBtn.addEventListener('click', () => {
    SLOTS.forEach((s) => unplace(s, false));
    refresh();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!SLOTS.some((s) => placed[s])) {
      message('Helyezz el legalább egy testrészt!');
      return;
    }
    const name = nameEl.value.trim();
    if (!name) {
      message('Adj nevet a sárkányodnak!');
      nameEl.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Mentés…';

    const body = new FormData();
    body.append('_csrf', CFG.csrf);
    body.append('dragonName', name);
    body.append('color', colorEl.value);
    SLOTS.forEach((s) => body.append(s, placed[s] ? placed[s].id : 0));

    fetch(CFG.saveUrl, { method: 'POST', body, credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        message('Elmentve! Átirányítás a gyűjteményedhez…', 'success');
        setTimeout(() => { window.location.href = 'user.php'; }, 900);
      })
      .catch((err) => {
        message(`Nem sikerült elmenteni: ${err.message}`);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Sárkány mentése';
      });
  });

  refresh();
})();
