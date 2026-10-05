/* =====================================================================
   A saga vége — animált zárókép
   ---------------------------------------------------------------------
   Az epilógus után (a Völvánál) jelenik meg, a vászon és a felület fölött.

   Háttér (vásznon, folyamatosan): éjszakai ég csillagokkal és hullócsillagokkal,
   hullámzó sarki fény, telihold, a Világfa sziluettje aranyló gyökerekkel,
   három réteg hegy, felszálló parázs — és a játékos SAJÁT sárkányai repülnek
   át a hold előtt, szárnycsapásra emelkedve-süllyedve.

   Előtér (DOM, ütemezve): kirajzolódó rúnakör, betűnként felragyogó cím,
   a dal sora, felpörgő statisztikák, a csapat sárkányai, stáblista.
   Kattintásra / billentyűre a hátralévő rész azonnal megjelenik.
   ===================================================================== */
import { dragonTextures, dragonPortrait } from './art.js';
import { esc } from './hud.js';
import { mulberry32 } from './rules.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A Világfa sziluettje (egyszer rajzolva, külön vásznon). */
function drawTree(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const rng = mulberry32(2026);
  const tips = [];
  const branch = (x, y, len, ang, width, depth) => {
    if (depth === 0 || len < 4) { tips.push([x, y]); return; }
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + (rng() - 0.5) * len * 0.3, (y + y2) / 2, x2, y2);
    ctx.stroke();
    const n = depth > 5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      branch(x2, y2, len * (0.68 + rng() * 0.12), ang + (i - (n - 1) / 2) * (0.42 + rng() * 0.2), width * 0.66, depth - 1);
    }
  };
  ctx.strokeStyle = '#05040a'; ctx.lineCap = 'round';
  branch(w / 2, h, h * 0.24, -Math.PI / 2, h * 0.045, 9);
  // Lombkorona: apró levélcsomók az ágak végén
  ctx.fillStyle = '#05040a';
  for (const [x, y] of tips) {
    if (rng() < 0.35) continue;
    ctx.globalAlpha = 0.55 + rng() * 0.45;
    ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * 6, y + (rng() - 0.5) * 6, h * (0.012 + rng() * 0.02), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Hegyvonulat egy rétege (a szélessége kétszeres, hogy csúsztatható legyen). */
function ridge(w, h, top, rough, color, seed) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, h);
  const pts = [];
  for (let x = 0; x <= w; x += 24) pts.push(top + (rng() - 0.5) * rough + Math.sin(x / w * Math.PI * 4) * rough * 0.6);
  pts[pts.length - 1] = pts[0];                       // a két vég illeszkedjen: varratmentes csúsztatás
  for (let k = 0; k < 2; k++) pts.forEach((y, i) => ctx.lineTo(k * w + i * 24, y));
  ctx.lineTo(w * 2, h); ctx.closePath(); ctx.fill();
  return c;
}

/**
 * Lejátssza a zárójelenetet.
 * @returns {Promise<void>} amikor a játékos továbblép
 */
export async function playEnding(g) {
  const { hud, state, sfx } = g;
  const shell = document.getElementById('gameShell') || document.body;
  const st = state.save.stats;
  const party = state.party;

  // A csapat képei (a repüléshez nagyobb felbontásban)
  const flyers = [];
  for (const d of party) {
    try {
      const keys = await dragonTextures(g.gfx, d, state.catalog, 160);
      flyers.push({ d, img: dragonPortrait(g.gfx, keys, 160) });
    } catch { /* kép nélkül is megy */ }
  }
  const portraits = await Promise.all(party.map((d) => Promise.resolve(hud.portrait(d)).catch(() => '')));

  const stats = [
    ['Csaták', st.battles], ['Győzelmek', st.wins], ['Szelídítve', st.tamed],
    ['Kikelt fióka', st.hatched], ['Sárkányaid', state.dragons.size],
  ];
  const title = 'A SAGA VÉGE';
  const el = document.createElement('div');
  el.className = 'end-screen';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'A saga vége');
  el.innerHTML = `
    <canvas class="es-sky" aria-hidden="true"></canvas>
    <div class="es-vignette" aria-hidden="true"></div>
    <div class="es-content">
      <svg class="es-sigil" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="es-ring es-ring-1" cx="100" cy="100" r="92"/>
        <circle class="es-ring es-ring-2" cx="100" cy="100" r="74"/>
        <circle class="es-ring es-ring-3" cx="100" cy="100" r="58"/>
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return `<line class="es-spoke" style="--i:${i}" x1="${100 + Math.cos(a) * 60}" y1="${100 + Math.sin(a) * 60}" x2="${100 + Math.cos(a) * 72}" y2="${100 + Math.sin(a) * 72}"/>`;
        }).join('')}
        <text class="es-glyph" x="100" y="100">ᛟ</text>
      </svg>
      <p class="es-kicker">ᛟ Othala — a saga teljes</p>
      <h1 class="es-title" aria-label="${title}">${[...title].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</h1>
      <p class="es-quote">„…és a sárkánylovas bezárta az öt sebet, a hollók hazatértek,<br>és a Völgy újra emlékezett."</p>
      <div class="es-stats">${stats.map(([k, v]) => `<div class="es-stat"><b data-count="${Number(v) || 0}">0</b><span>${esc(k)}</span></div>`).join('')}</div>
      <div class="es-party">${party.map((d, i) => `
        <figure class="es-dragon" style="--i:${i}; --c:${esc(d.szin || '#ffd36b')}">
          <img src="${portraits[i] || ''}" alt="">
          <figcaption><b>${esc(d.nev)}</b><small>${state.level(d)}. szint</small></figcaption>
        </figure>`).join('')}</div>
      <div class="es-credits"><div class="es-roll">
        <p class="es-cr-head">Sárkányok és Vikingek</p>
        <p><small>A Völgy dalát élte meg</small>${esc(state.player || 'a sárkánylovas')}</p>
        <p><small>Sárkánylovasok</small>${party.map((d) => esc(d.nev)).join(' · ')}</p>
        <p><small>Akik vártak rád</small>Hervor, a Völva · Ragnhild · Einar, a skald</p>
        <p><small>Hazatértek</small>Huginn és Muninn</p>
        <p><small>Mélyen alszik</small>Níðhöggr, a Gyökérrágó</p>
        <p class="es-cr-end">Köszönjük, hogy játszottál!</p>
      </div></div>
      <button class="btn btn-primary es-continue" type="button">Tovább a Völgyben</button>
    </div>
    <p class="es-skip">Kattints, ha sietsz</p>`;
  shell.appendChild(el);
  hud.dialogueOpen = true;                         // a völgy addig nem mozdul

  /* --- Háttéranimáció ------------------------------------------------- */
  const cv = el.querySelector('.es-sky');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, scene = null;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const rng = mulberry32(77);
  const layout = () => {
    W = el.clientWidth; H = el.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene = {
      stars: Array.from({ length: Math.round(W * H / 4200) }, () => ({ x: rng() * W, y: rng() * H * 0.75, r: 0.4 + rng() * 1.4, p: rng() * 6.3, s: 0.6 + rng() * 2 })),
      tree: (() => { const th = Math.round(Math.min(H * 0.62, W * 0.8)); return drawTree(Math.round(th * 1.13), th); })(),
      ridges: [
        { c: ridge(W, H, H * 0.62, H * 0.1, '#140f24', 11), v: 6 },
        { c: ridge(W, H, H * 0.72, H * 0.08, '#0c0918', 12), v: 14 },
        { c: ridge(W, H, H * 0.82, H * 0.06, '#05040b', 13), v: 26 },
      ],
      embers: Array.from({ length: 70 }, () => ({ x: rng() * W, y: H + rng() * H, v: 20 + rng() * 50, r: 0.8 + rng() * 2, p: rng() * 6 })),
      meteors: [],
    };
  };
  layout();
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  const t0 = performance.now();
  let raf = 0, last = t0;
  const frame = (now) => {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Ég
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03040c'); sky.addColorStop(0.55, '#0d0b24'); sky.addColorStop(1, '#2a1636');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Csillagok
    for (const s of scene.stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p));
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // Sarki fény: hullámzó, függőleges fénycsíkok (összeadó keveréssel)
    ctx.globalCompositeOperation = 'lighter';
    const bands = [[0x4f, 0xff, 0xb0, 0.22, 0.0], [0x4f, 0xd6, 0xff, 0.16, 1.7], [0xb1, 0x8c, 0xff, 0.12, 3.1]];
    for (const [r, gr, b, a, ph] of bands) {
      for (let x = 0; x < W; x += 3) {
        const y = H * 0.2 + Math.sin(x / W * 5 + t * 0.35 + ph) * H * 0.07 + Math.sin(x / W * 13 - t * 0.6 + ph) * H * 0.025;
        const len = H * (0.16 + 0.08 * Math.sin(x / W * 7 + t * 0.5 + ph));
        const lg = ctx.createLinearGradient(0, y, 0, y + len);
        const fade = a * (0.6 + 0.4 * Math.sin(x / W * 9 + t + ph)) * Math.min(1, t / 3);
        lg.addColorStop(0, `rgba(${r},${gr},${b},0)`); lg.addColorStop(0.35, `rgba(${r},${gr},${b},${fade})`); lg.addColorStop(1, `rgba(${r},${gr},${b},0)`);
        ctx.fillStyle = lg; ctx.fillRect(x, y, 3, len);
      }
    }
    // Hold
    const mx = W * 0.76, my = H * 0.24, mr = Math.min(W, H) * 0.075;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
    halo.addColorStop(0, 'rgba(255,240,200,.35)'); halo.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = halo; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,140,.35)';
    for (const [ox, oy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.35, 0.12]]) { ctx.beginPath(); ctx.arc(mx + ox * mr, my + oy * mr, rr * mr, 0, Math.PI * 2); ctx.fill(); }
    // Hullócsillag néha
    if (Math.random() < dt * 0.35) scene.meteors.push({ x: rng() * W * 0.8, y: rng() * H * 0.3, life: 1 });
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    scene.meteors = scene.meteors.filter((m) => (m.life -= dt * 1.4) > 0);
    for (const m of scene.meteors) {
      const p = 1 - m.life;
      ctx.globalAlpha = m.life; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x + p * 260, m.y + p * 110); ctx.lineTo(m.x + p * 260 - 90, m.y + p * 110 - 38); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // A Világfa a középső hegyen, aranyló gyökérfénnyel
    const tr = scene.tree;
    const tx = W * 0.5 - tr.width / 2, ty = H * 0.66 - tr.height;
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.66, 4, W * 0.5, H * 0.66, tr.height * 0.7);
    glow.addColorStop(0, `rgba(255,211,107,${0.28 + 0.08 * Math.sin(t * 1.3)})`); glow.addColorStop(1, 'rgba(255,211,107,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(scene.ridges[0].c, -((t * scene.ridges[0].v) % W), 0);
    ctx.drawImage(tr, tx, ty);
    // A csapat sárkányai átrepülnek a hold előtt (jobbról balra, szárnycsapásra emelkedve)
    flyers.forEach((f, i) => {
      const period = 16 + i * 3, phase = ((t + i * 5.3) % period) / period;
      const size = Math.min(W, H) * (0.12 - i * 0.015);
      const x = W + size - phase * (W + size * 2.5);
      const y = H * (0.3 + i * 0.07) + Math.sin(phase * Math.PI * 2 * 1.5) * H * 0.04;
      const flap = Math.sin(t * 7 + i);
      ctx.save();
      ctx.translate(x, y + flap * size * 0.04);
      ctx.rotate(-0.08 + flap * 0.04);
      ctx.scale(1, 1 + flap * 0.06);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(f.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    ctx.drawImage(scene.ridges[1].c, -((t * scene.ridges[1].v) % W), 0);
    ctx.drawImage(scene.ridges[2].c, -((t * scene.ridges[2].v) % W), 0);
    // Felszálló parázs
    ctx.globalCompositeOperation = 'lighter';
    for (const e of scene.embers) {
      e.y -= e.v * dt; e.x += Math.sin(t + e.p) * 12 * dt;
      if (e.y < -10) { e.y = H + 10; e.x = rng() * W; }
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + e.p);
      ctx.fillStyle = e.p > 3 ? '#ffc46b' : '#ff7a3d';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /* --- Az előtér ütemezése ------------------------------------------- */
  let skip = false;
  const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
  const show = (sel) => el.querySelector(sel)?.classList.add('is-on');
  const countUp = (b) => {
    const to = Number(b.dataset.count);
    if (skip || !to) { b.textContent = to; return; }
    const start = performance.now(), dur = 1200;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      b.textContent = Math.round(to * (1 - (1 - k) ** 3));
      if (k < 1 && !skip) requestAnimationFrame(step); else b.textContent = to;
    };
    requestAnimationFrame(step);
  };
  const run = async () => {
    requestAnimationFrame(() => el.classList.add('is-in'));
    sfx.chorus?.();
    await wait(900); show('.es-sigil');
    await wait(1600); show('.es-kicker'); show('.es-title'); sfx.victory?.();
    await wait(1700); show('.es-quote');
    await wait(1600); show('.es-stats'); el.querySelectorAll('.es-stat b').forEach(countUp);
    await wait(1500); show('.es-party'); sfx.levelUp?.();
    await wait(1600); show('.es-credits');
    await wait(1200); show('.es-continue');
    el.querySelector('.es-skip').classList.add('is-off');
  };
  const finishNow = () => {
    if (skip) return;
    skip = true;
    el.classList.add('is-skip');
    for (const s of ['.es-sigil', '.es-kicker', '.es-title', '.es-quote', '.es-stats', '.es-party', '.es-credits', '.es-continue']) show(s);
    el.querySelectorAll('.es-stat b').forEach((b) => { b.textContent = b.dataset.count; });
    el.querySelector('.es-skip').classList.add('is-off');
  };
  run();

  await new Promise((resolve) => {
    const btn = el.querySelector('.es-continue');
    const onKey = (e) => {
      if (btn.classList.contains('is-on') && skip && (e.key === 'Enter' || e.key === 'Escape')) close();
      else finishNow();
    };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      el.classList.add('is-out');
      sfx.click?.();
      setTimeout(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        el.remove();
        hud.dialogueOpen = false;
        resolve();
      }, 900);
    };
    el.addEventListener('click', (e) => {
      if (e.target === btn) { finishNow(); close(); } else finishNow();
    });
    document.addEventListener('keydown', onKey);
    // Ha végigfutott, a gomb a skip nélkül is lezár
    btn.addEventListener('transitionend', () => { skip = true; }, { once: true });
  });
}
