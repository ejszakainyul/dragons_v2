/* =====================================================================
   Grafika — minden kóddal rajzolva, indításkor
   ---------------------------------------------------------------------
   Nincs letöltendő sprite-lap: a csempék, fák, épületek és effektek
   vásznon készülnek, egyszer, és textúraként kerülnek a Phaserbe.

   Egységes stílus a sárkány-rajzokkal: vastag sötét körvonal (INK),
   lágy átmenetes árnyalás, bal-felső fény.

   A sárkányok a meglévő SVG testrészekből készülnek, pontosan úgy
   színezve, mint az oldal többi részén (szürkeárnyalat × szín × 1.3).
   ===================================================================== */
import { T, TILE } from './world.js';
import { mulberry32, SLOTS } from './rules.js';

const INK = '#0b0f1c';

/* =====================================================================
   Segédek
   ===================================================================== */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function speckle(ctx, x, y, w, h, colors, count, rng, rMin = 0.8, rMax = 1.8) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    ctx.beginPath();
    ctx.arc(x + rng() * w, y + rng() * h, rMin + rng() * (rMax - rMin), 0, Math.PI * 2);
    ctx.fill();
  }
}

function blades(ctx, x, y, w, h, color, count, rng, len = 5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const bx = x + rng() * w, by = y + rng() * h;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (rng() - 0.5) * 3, by - len * (0.6 + rng() * 0.6));
    ctx.stroke();
  }
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

/* =====================================================================
   Csempék
   ===================================================================== */
const COLS = 8;
/*
 * Csempék közti rés: minden csempe köré 2 képpontos, a szélső sorok
 * ismétlésével kitöltött perem kerül. Nélküle nem egész nagyításnál a
 * GPU a szomszéd csempéből is mintát vesz, és vékony rácsvonalak
 * látszanak a térképen („csempe-szivárgás").
 */
export const TILE_MARGIN = 2;
export const TILE_SPACING = 4;

export function buildTileset(scene) {
  const S = TILE;
  const rows = Math.ceil(T.COUNT / COLS);
  // Először perem nélkül rajzolunk, aztán áttesszük kiterjesztett peremmel
  const c = canvas(COLS * S, rows * S);
  const ctx = c.getContext('2d');
  const rng = mulberry32(777);

  const at = (t) => [(t % COLS) * S, Math.floor(t / COLS) * S];
  const fill = (t, color) => { const [x, y] = at(t); ctx.fillStyle = color; ctx.fillRect(x, y, S, S); return [x, y]; };

  /* --- Fű --- */
  const grass = (t, base, extra) => {
    const [x, y] = fill(t, base);
    speckle(ctx, x, y, S, S, ['#35603f', '#4b7d52', '#3a6844'], 26, rng, 1, 2.6);
    blades(ctx, x + 2, y + 6, S - 4, S - 6, '#2c5236', 16, rng, 5);
    blades(ctx, x + 2, y + 6, S - 4, S - 6, '#6ea06a', 9, rng, 4);
    if (extra) extra(x, y);
  };
  grass(T.GRASS, '#3f6c49');
  grass(T.GRASS2, '#436f4a', (x, y) => speckle(ctx, x, y, S, S, ['#557f4f'], 8, rng, 2, 4));
  grass(T.FLOWERS, '#3f6c49', (x, y) => {
    for (let i = 0; i < 6; i++) {
      const fx = x + 5 + rng() * (S - 10), fy = y + 5 + rng() * (S - 10);
      const col = ['#e8d36b', '#f2f2f2', '#b58cff', '#ff9ab0'][(rng() * 4) | 0];
      ctx.fillStyle = col;
      for (let p = 0; p < 4; p++) { ctx.beginPath(); ctx.arc(fx + Math.cos(p * 1.57) * 1.8, fy + Math.sin(p * 1.57) * 1.8, 1.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(fx, fy, 1, 0, 7); ctx.fill();
    }
  });

  /* --- Erdei avar --- */
  {
    const [x, y] = fill(T.FOREST, '#2e4e37');
    speckle(ctx, x, y, S, S, ['#26412e', '#3b5f42', '#5a4a33'], 30, rng, 1, 2.2);
    blades(ctx, x, y + 4, S, S - 4, '#223a29', 10, rng, 4);
  }

  /* --- Ösvény --- */
  const path = (t, base, dots) => {
    const [x, y] = fill(t, base);
    speckle(ctx, x, y, S, S, dots, 22, rng, 0.8, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x, y + 10 + i * 13 + rng() * 4); ctx.lineTo(x + S, y + 12 + i * 13 + rng() * 4); ctx.stroke(); }
  };
  path(T.PATH, '#8a6d4c', ['#7a5f41', '#9c7d58', '#6b5139', '#a88a63']);
  path(T.SNOWPATH, '#b9c3d6', ['#a6b1c6', '#cfd8e8', '#8f9ab2']);

  /* --- Homok --- */
  { const [x, y] = fill(T.SAND, '#c7b385'); speckle(ctx, x, y, S, S, ['#b8a376', '#d6c49a', '#a8946a'], 34, rng, 0.6, 1.6); }

  /* --- Hó --- */
  const snow = (t, base) => {
    const [x, y] = fill(t, base);
    speckle(ctx, x, y, S, S, ['#c9d6ea', '#ffffff', '#b7c6de'], 18, rng, 1.5, 4);
    ctx.fillStyle = 'rgba(150,170,210,.25)';
    ctx.beginPath(); ctx.ellipse(x + rng() * S, y + rng() * S, 10, 4, 0, 0, 7); ctx.fill();
  };
  snow(T.SNOW, '#dbe5f3');
  snow(T.SNOW2, '#d2ddee');

  /* --- Hamu --- */
  const ash = (t, base) => {
    const [x, y] = fill(t, base);
    speckle(ctx, x, y, S, S, ['#2b2528', '#4a3f42', '#3a3033'], 24, rng, 1, 3);
    speckle(ctx, x, y, S, S, ['#ff7a3d', '#ffb35a'], t === T.ASH2 ? 5 : 2, rng, 0.6, 1.2);
  };
  ash(T.ASH, '#3a3134');
  ash(T.ASH2, '#352c2f');

  /* --- Barlang előtti föld --- */
  { const [x, y] = fill(T.CAVEFLOOR, '#2a2830'); speckle(ctx, x, y, S, S, ['#1d1c22', '#3a3842', '#44424c'], 26, rng, 1, 2.6); }

  /* --- Jég --- */
  {
    const [x, y] = fill(T.ICE, '#9ccbe4');
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(x + 4, y + 6, 14, 3); ctx.fillRect(x + 22, y + 30, 18, 3);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 40); ctx.lineTo(x + 20, y + 26); ctx.lineTo(x + 34, y + 30); ctx.lineTo(x + 44, y + 14); ctx.stroke();
  }

  /* --- Hegy: tető és sziklafal (három vidékre) --- */
  const rock = (t, top, hi, lo, cap) => {
    const [x, y] = fill(t, top);
    speckle(ctx, x, y, S, S, [hi, lo], 20, rng, 1.5, 4);
    ctx.strokeStyle = lo; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const sx = x + rng() * S, sy = y + rng() * S;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 6 + rng() * 8, sy + 3 + rng() * 5); ctx.stroke();
    }
    if (cap) { ctx.fillStyle = cap; speckle(ctx, x, y, S, S, [cap], 10, rng, 2, 5); }
  };
  const cliff = (t, top, face, dark, cap) => {
    const [x, y] = fill(t, face);
    // A tető pereme felül, alatta a függőleges sziklafal repedésekkel
    ctx.fillStyle = top; ctx.fillRect(x, y, S, 14);
    ctx.fillStyle = vgrad(ctx, y + 14, y + S, [[0, face], [1, dark]]);
    ctx.fillRect(x, y + 14, S, S - 14);
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const cx = x + 4 + i * 12 + rng() * 5;
      ctx.beginPath(); ctx.moveTo(cx, y + 16); ctx.lineTo(cx + (rng() - 0.5) * 6, y + S - 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x + S, y + 14); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + S - 5, S, 5);   // talpárnyék
    if (cap) { ctx.fillStyle = cap; ctx.fillRect(x, y, S, 7); speckle(ctx, x, y + 5, S, 5, [cap], 8, rng, 1.5, 3); }
  };
  rock(T.ROCK, '#5b6279', '#6f7690', '#474d62');
  cliff(T.CLIFF, '#5b6279', '#454b60', '#2b2f40');
  rock(T.ROCK_SNOW, '#8e98b0', '#aab3c8', '#6f7892', '#e6eef9');
  cliff(T.CLIFF_SNOW, '#8e98b0', '#5d667f', '#3b4258', '#e6eef9');
  rock(T.ROCK_ASH, '#3e3538', '#54484b', '#2a2326');
  cliff(T.CLIFF_ASH, '#3e3538', '#2e2729', '#1a1517', '#ff7a3d');

  /* --- Víz partéllel (16 változat) --- */
  for (let mask = 0; mask < 16; mask++) {
    const t = T.WATER_EDGE + mask;
    const [x, y] = at(t);
    ctx.fillStyle = vgrad(ctx, y, y + S, [[0, '#23537f'], [1, '#1b456d']]);
    ctx.fillRect(x, y, S, S);
    ctx.strokeStyle = 'rgba(140,200,255,.28)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const wy = y + 10 + i * 13 + rng() * 5, wx = x + rng() * 20;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 6, wy - 3, wx + 12, wy); ctx.stroke();
    }
    // Partél: homoksáv + habcsík azon az oldalon, ahol szárazföld van
    const edge = (x0, y0, w, h, fx, fy, fw, fh) => {
      ctx.fillStyle = '#c7b385'; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(230,245,255,.75)'; ctx.fillRect(fx, fy, fw, fh);
    };
    if (mask & 1) edge(x, y, S, 5, x, y + 5, S, 2);
    if (mask & 2) edge(x + S - 5, y, 5, S, x + S - 7, y, 2, S);
    if (mask & 4) edge(x, y + S - 5, S, 5, x, y + S - 7, S, 2);
    if (mask & 8) edge(x, y, 5, S, x + 5, y, 2, S);
  }
  // A tiszta víz (5) ugyanaz, mint a 0-s maszk
  { const [x, y] = at(T.WATER); const [sx, sy] = at(T.WATER_EDGE); ctx.drawImage(c, sx, sy, S, S, x, y, S, S); }

  /* --- Hidak --- */
  const bridge = (t, horizontal) => {
    const [x, y] = at(t);
    const [wx, wy] = at(T.WATER_EDGE);
    ctx.drawImage(c, wx, wy, S, S, x, y, S, S);
    ctx.save();
    ctx.translate(x + S / 2, y + S / 2);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-S / 2, -12, S, 28);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#7a5a3a' : '#8a6844';
      ctx.fillRect(-S / 2 + i * 8, -14, 7, 28);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-S / 2 + i * 8 + 6, -14, 1, 28);
    }
    ctx.fillStyle = '#5a4028'; ctx.fillRect(-S / 2, -17, S, 4); ctx.fillRect(-S / 2, 13, S, 4);
    ctx.restore();
  };
  bridge(T.BRIDGE_H, true);
  bridge(T.BRIDGE_V, false);

  /* --- Köd --- */
  { const [x, y] = fill(T.FOG, '#070a14'); speckle(ctx, x, y, S, S, ['#0b1020', '#0e1428'], 10, rng, 3, 8); }
  {
    const [x, y] = at(T.FOG_EDGE);
    ctx.fillStyle = 'rgba(7,10,20,.6)'; ctx.fillRect(x, y, S, S);
    speckle(ctx, x, y, S, S, ['rgba(7,10,20,.5)'], 14, rng, 3, 9);
  }

  // Áttétel peremmel: a csempe szélső képpontsorai kifelé ismétlődnek
  const M = TILE_MARGIN, P = TILE_SPACING;
  const out = canvas(COLS * (S + P), rows * (S + P));
  const o = out.getContext('2d');
  for (let t = 0; t < COLS * rows; t++) {
    const [sx, sy] = at(t);
    const dx = (t % COLS) * (S + P) + M, dy = Math.floor(t / COLS) * (S + P) + M;
    o.drawImage(c, sx, sy, S, S, dx, dy, S, S);
    o.drawImage(c, sx, sy, S, 1, dx, dy - M, S, M);             // felső perem
    o.drawImage(c, sx, sy + S - 1, S, 1, dx, dy + S, S, M);     // alsó
    o.drawImage(c, sx, sy, 1, S, dx - M, dy, M, S);             // bal
    o.drawImage(c, sx + S - 1, sy, 1, S, dx + S, dy, M, S);     // jobb
    o.drawImage(c, sx, sy, 1, 1, dx - M, dy - M, M, M);         // sarkok
    o.drawImage(c, sx + S - 1, sy, 1, 1, dx + S, dy - M, M, M);
    o.drawImage(c, sx, sy + S - 1, 1, 1, dx - M, dy + S, M, M);
    o.drawImage(c, sx + S - 1, sy + S - 1, 1, 1, dx + S, dy + S, M, M);
  }
  scene.textures.addCanvas('tiles', out);
  return 'tiles';
}

/* =====================================================================
   Tárgyak: fák, sziklák, épületek, helyszínek
   ===================================================================== */
export function buildSprites(scene) {
  const add = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const c = canvas(w, h);
    draw(c.getContext('2d'), w, h);
    scene.textures.addCanvas(key, c);
  };
  const rng = mulberry32(4242);

  /* --- Fenyő (3 változat + havas) --- */
  const pine = (ctx, w, h, snow, v) => {
    const cx = w / 2;
    ctx.fillStyle = '#4a3322'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillRect(cx - 4, h - 16, 8, 14); ctx.strokeRect(cx - 4, h - 16, 8, 14);
    const tiers = 3 + (v % 2);
    for (let i = 0; i < tiers; i++) {
      const top = 6 + i * ((h - 34) / tiers);
      const bot = top + (h - 30) / tiers + 14;
      const half = 9 + i * (w * 0.38 - 9) / (tiers - 1 || 1);
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx + half, bot);
      ctx.quadraticCurveTo(cx, bot - 6, cx - half, bot);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, top, bot, [[0, '#3f7a4c'], [1, '#1f4a2e']]);
      ctx.fill(); ctx.stroke();
      // bal oldali fény
      ctx.strokeStyle = 'rgba(160,220,150,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 2, top + 5); ctx.lineTo(cx - half + 5, bot - 3); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      if (snow) {
        ctx.fillStyle = '#eef4fc';
        ctx.beginPath();
        ctx.moveTo(cx, top + 1);
        ctx.lineTo(cx + half * 0.55, top + (bot - top) * 0.55);
        ctx.quadraticCurveTo(cx, top + (bot - top) * 0.42, cx - half * 0.55, top + (bot - top) * 0.55);
        ctx.closePath(); ctx.fill();
      }
    }
  };
  for (let v = 0; v < 3; v++) {
    add(`pine${v}`, 56, 84 + v * 8, (ctx, w, h) => pine(ctx, w, h, false, v));
    add(`pine-snow${v}`, 56, 84 + v * 8, (ctx, w, h) => pine(ctx, w, h, true, v));
  }

  /* --- Nyírfa --- */
  for (let v = 0; v < 3; v++) add(`birch${v}`, 56, 88, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(w / 2 - 4, 36, 8, h - 38); ctx.strokeRect(w / 2 - 4, 36, 8, h - 38);
    ctx.fillStyle = INK; for (let i = 0; i < 5; i++) ctx.fillRect(w / 2 - 4 + (i % 2) * 4, 44 + i * 8, 4, 2);
    ctx.fillStyle = vgrad(ctx, 4, 50, [[0, '#b7cf6a'], [1, '#5f8a3a']]);
    for (const [ox, oy, r] of [[0, 22, 20], [-10, 30, 14], [10, 30, 14], [0, 12, 12]]) {
      ctx.beginPath(); ctx.arc(w / 2 + ox, oy, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    speckle(ctx, 8, 6, w - 16, 36, ['#d8e88a', '#7fa34a'], 16, rng, 1, 2.4);
  });

  /* --- Holt fa (hamuverem) --- */
  for (let v = 0; v < 3; v++) add(`dead${v}`, 56, 80, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const branch = (x, y, len, ang, width) => {
      if (len < 6) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = width + 2; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.lineWidth = width; ctx.strokeStyle = '#3a3033';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      branch(x2, y2, len * 0.66, ang - 0.5 - rng() * 0.3, width * 0.7);
      branch(x2, y2, len * 0.6, ang + 0.45 + rng() * 0.3, width * 0.7);
    };
    branch(w / 2, h - 2, 30, -Math.PI / 2 + (rng() - 0.5) * 0.2, 6);
    ctx.fillStyle = '#ff7a3d'; ctx.globalAlpha = 0.6;
    speckle(ctx, w / 2 - 6, h - 20, 12, 16, ['#ff7a3d'], 3, rng, 0.8, 1.4);
    ctx.globalAlpha = 1;
  });

  /* --- Sziklák --- */
  for (let v = 0; v < 2; v++) for (const snow of [false, true]) add(`boulder${v}${snow ? 's' : ''}`, 52, 44, (ctx, w, h) => {
    ctx.beginPath();
    const pts = 9;
    for (let i = 0; i <= pts; i++) {
      const a = Math.PI + (Math.PI * i) / pts;
      const r = (w / 2 - 4) * (0.8 + rng() * 0.25);
      const x = w / 2 + Math.cos(a) * r, y = h - 6 + Math.sin(a) * r * (0.75 + v * 0.1);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 4, h, [[0, '#8a90a6'], [1, '#474c60']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(12, h - 16); ctx.lineTo(20, 12); ctx.stroke();
    if (snow) { ctx.fillStyle = '#eef4fc'; ctx.beginPath(); ctx.ellipse(w / 2 - 2, 12, 14, 5, 0, 0, 7); ctx.fill(); }
  });

  /* --- Árnyék-ellipszis --- */
  add('shadow', 64, 24, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.scale(1, h / w); ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, 7); ctx.fill();
  });

  /* --- Hosszúház --- */
  add('longhouse', 260, 190, (ctx, w, h) => {
    const base = h - 18;
    // Tűzfény udvar
    const glow = ctx.createRadialGradient(w / 2, base, 10, w / 2, base, 120);
    glow.addColorStop(0, 'rgba(255,160,70,.35)'); glow.addColorStop(1, 'rgba(255,160,70,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    // Kőalap
    ctx.fillStyle = '#4b4f5e'; ctx.beginPath(); ctx.roundRect(22, base - 10, w - 44, 16, 4); ctx.fill(); ctx.stroke();
    // Deszkafal
    ctx.fillStyle = vgrad(ctx, base - 70, base, [[0, '#7a5534'], [1, '#553a22']]);
    ctx.beginPath(); ctx.moveTo(30, base - 8); ctx.lineTo(34, base - 70); ctx.lineTo(w - 34, base - 70); ctx.lineTo(w - 30, base - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    for (let x = 42; x < w - 36; x += 11) { ctx.beginPath(); ctx.moveTo(x, base - 68); ctx.lineTo(x, base - 9); ctx.stroke(); }
    // Pajzsok a falon
    for (const [sx, col] of [[62, '#b8392f'], [96, '#d9c7a1'], [w - 96, '#b8392f'], [w - 62, '#2f6fb8']]) {
      ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, base - 40, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9d3ea'; ctx.beginPath(); ctx.arc(sx, base - 40, 3.5, 0, 7); ctx.fill();
    }
    // Ajtó, izzó belsővel
    const door = ctx.createLinearGradient(0, base - 52, 0, base);
    door.addColorStop(0, '#ffd08a'); door.addColorStop(1, '#ff7a2c');
    ctx.fillStyle = door; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(w / 2 - 15, base - 8); ctx.lineTo(w / 2 - 15, base - 42); ctx.quadraticCurveTo(w / 2, base - 56, w / 2 + 15, base - 42); ctx.lineTo(w / 2 + 15, base - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Tető: zsindely, ívelt gerinc
    ctx.fillStyle = vgrad(ctx, 22, base - 60, [[0, '#3a3a52'], [1, '#22233a']]);
    ctx.beginPath(); ctx.moveTo(14, base - 60); ctx.quadraticCurveTo(w / 2, 20, w - 14, base - 60); ctx.quadraticCurveTo(w / 2, base - 78, 14, base - 60); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,170,210,.25)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const yy = base - 60 - i * 12;
      ctx.beginPath(); ctx.moveTo(26 + i * 12, yy + 8); ctx.quadraticCurveTo(w / 2, yy - 18 + i * 2, w - 26 - i * 12, yy + 8); ctx.stroke();
    }
    // Keresztezett sárkányfejes oromdíszek a két végén
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const [x, dir] of [[26, -1], [w - 26, 1]]) {
      ctx.beginPath(); ctx.moveTo(x - dir * 4, base - 58); ctx.quadraticCurveTo(x + dir * 12, base - 96, x + dir * 2, base - 110); ctx.stroke();
      ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - dir * 4, base - 58); ctx.quadraticCurveTo(x + dir * 12, base - 96, x + dir * 2, base - 110); ctx.stroke();
      ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + dir * 6, base - 112, 7, 4, dir * 0.4, 0, 7); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 6;
    }
  });

  /* --- Barlang: sziklaszáj, agyarszerű kövekkel --- */
  add('cave', 150, 128, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    // Keret-szikla
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#6a7088'], [1, '#3a3f52']]);
    ctx.beginPath();
    ctx.moveTo(4, h); ctx.lineTo(10, 60); ctx.lineTo(30, 26); ctx.lineTo(62, 8); ctx.lineTo(96, 10);
    ctx.lineTo(126, 30); ctx.lineTo(144, 64); ctx.lineTo(w - 2, h); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Száj
    const mouth = ctx.createRadialGradient(w / 2, h - 10, 4, w / 2, h - 30, 70);
    mouth.addColorStop(0, '#000'); mouth.addColorStop(0.7, '#07060c'); mouth.addColorStop(1, '#1a1826');
    ctx.fillStyle = mouth;
    ctx.beginPath(); ctx.moveTo(30, h); ctx.quadraticCurveTo(28, 44, w / 2, 38); ctx.quadraticCurveTo(w - 28, 44, w - 30, h); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Agyarak felül és alul
    ctx.fillStyle = '#c9cfdf';
    for (const [x, len] of [[48, 16], [62, 11], [w / 2, 20], [w - 62, 12], [w - 48, 15]]) {
      ctx.beginPath(); ctx.moveTo(x - 6, 46 + (x === w / 2 ? -6 : 0)); ctx.lineTo(x, 46 + len); ctx.lineTo(x + 6, 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const [x, len] of [[40, 14], [w - 40, 14]]) {
      ctx.beginPath(); ctx.moveTo(x - 6, h); ctx.lineTo(x, h - len); ctx.lineTo(x + 6, h); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Repedések a sziklán
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const x = 14 + rng() * (w - 28), y = 14 + rng() * 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 10); ctx.stroke(); }
  });

  /* --- Szemek a barlang mélyén (tintázható) --- */
  add('eyes', 40, 12, (ctx) => {
    for (const x of [8, 32]) {
      const g = ctx.createRadialGradient(x, 6, 0, x, 6, 6);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 6, 6, 3.5, 0, 0, 7); ctx.fill();
    }
  });

  /* --- Fészek --- */
  add('nest', 96, 60, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 10, 44, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8dcc4'; ctx.beginPath(); ctx.ellipse(w / 2, h - 22, 30, 10, 0, 0, 7); ctx.fill();   // pehely belül
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, r = 30 + rng() * 12;
      const x = w / 2 + Math.cos(a) * r, y = h - 20 + Math.sin(a) * r * 0.36;
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
      const dx = Math.cos(a + 1.57) * (8 + rng() * 8), dy = Math.sin(a + 1.57) * 3;
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.strokeStyle = ['#7a5534', '#9a7048', '#5a3d24'][(rng() * 3) | 0]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    }
  });

  /* --- Tojás (fehér — a Phaser tintázza a szülők színére) --- */
  add('egg', 30, 38, (ctx, w, h) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#ffffff'], [1, '#b9bccb']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 2, w / 2 - 3, h / 2 - 3, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(8 + rng() * 14, 10 + rng() * 20, 2.5, 1.6, rng(), 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(10, 12, 3, 6, -0.4, 0, 7); ctx.fill();
  });

  /* --- Rúnakő --- */
  add('runestone', 44, 78, (ctx, w, h) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#7d869f'], [1, '#3f4559']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(6, h - 2); ctx.lineTo(4, 22); ctx.quadraticCurveTo(w / 2, -4, w - 4, 22); ctx.lineTo(w - 6, h - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['f', 'u', 'th', 'a', 'r'], w / 2 - 4, 20, 9, 13, '#6fffe6');
  });

  /* --- Gyógyfű --- */
  add('herb', 30, 30, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, 15);
    g.addColorStop(0, 'rgba(160,255,200,.45)'); g.addColorStop(1, 'rgba(160,255,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2;
    for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.quadraticCurveTo(w / 2 + a * 10, h / 2, w / 2 + a * 14, 9); ctx.stroke(); }
    for (const [x, y] of [[w / 2 - 7, 9], [w / 2, 7], [w / 2 + 7, 9]]) {
      ctx.fillStyle = '#b58cff'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill();
    }
  });

  /* --- Effekt-textúrák --- */
  add('fx-dot', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  });
  add('fx-spark', 24, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 24, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(12, 3, 12, 3, 0, 0, 7); ctx.fill();
  });
  add('fx-shard', 12, 22, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, 11); ctx.lineTo(6, 22); ctx.lineTo(0, 11); ctx.closePath(); ctx.fill();
  });
  add('fx-ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(64, 64, 54, 0, 7); ctx.stroke();
  });
  add('fx-smoke', 48, 48, (ctx) => {
    const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, 'rgba(200,205,220,.55)'); g.addColorStop(1, 'rgba(200,205,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 48, 48);
  });
  add('fx-bubble', 20, 20, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, 10, 7, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(7, 7, 2, 0, 7); ctx.fill();
  });
  // Gungnir: rúnás nyél, izzó dárdahegy (jobbra mutat)
  add('fx-spear', 220, 30, (ctx, w, h) => {
    ctx.shadowColor = '#c9f0ff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(8, h / 2 - 2.5, w - 52, 5);
    ctx.beginPath(); ctx.moveTo(w - 46, h / 2 - 9); ctx.lineTo(w - 2, h / 2); ctx.lineTo(w - 46, h / 2 + 9); ctx.lineTo(w - 40, h / 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ce7ff';
    for (let x = 30; x < w - 60; x += 18) { ctx.fillRect(x, h / 2 - 4, 2, 8); ctx.fillRect(x + 4, h / 2 - 1, 6, 2); }
    ctx.fillStyle = '#d9b45a'; ctx.fillRect(w - 52, h / 2 - 5, 6, 10);
  });
  // Négyágú csillag (kábulat, varázsfény)
  add('fx-star', 24, 24, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 3 : 11, a = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  });
  // Hatszöges pajzsbuborék (Pajzsfal)
  add('fx-ward', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,.6)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 62, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(64, 64, 61, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    const r = 11, hw = r * Math.sqrt(3);
    for (let row = -1; row < 9; row++) for (let col = -1; col < 8; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(64, 64, 61, 0, 7); ctx.stroke();
  });
  // Rúnakör (technikák, kórus, szintlépés) — a rúnák vonalakból, mint a köveken
  add('fx-runecircle', 192, 192, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(96, 96, 88, 0, 7); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(96, 96, 70, 0, 7); ctx.stroke();
    ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.arc(96, 96, 52, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const keys = Object.keys(RUNE_LINES);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(96 + Math.cos(a) * 79, 96 + Math.sin(a) * 79);
      ctx.rotate(a + Math.PI / 2);
      ctx.lineWidth = 1.8;
      for (const poly of RUNE_LINES[keys[i % keys.length]]) {
        ctx.beginPath();
        poly.forEach(([px, py], j) => (j ? ctx.lineTo(px - 3, py - 5) : ctx.moveTo(px - 3, py - 5)));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Hatágú csillag középen
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 - Math.PI / 2; ctx.lineTo(96 + Math.cos(a) * 50, 96 + Math.sin(a) * 50); }
    ctx.stroke();
  });
  // Fénysugár (a barlang mennyezetéről, a kórusnál)
  add('fx-shaft', 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
  // Felhőárnyék a völgy fölött
  add('fx-cloud', 256, 160, (ctx, w, h) => {
    for (const [x, y, r] of [[80, 86, 62], [140, 70, 70], [190, 92, 52], [120, 104, 56]]) {
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(8,12,30,.55)'); g.addColorStop(1, 'rgba(8,12,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  });
  // Küldetésjel: aranyló rúnapajzs felkiáltójellel
  add('fx-quest', 40, 52, (ctx, w) => {
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 10;
    ctx.fillStyle = vgrad(ctx, 2, 46, [[0, '#fff1b8'], [1, '#ff9a3d']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w - 4, 14); ctx.lineTo(w - 7, 32); ctx.lineTo(w / 2, 48); ctx.lineTo(7, 32); ctx.lineTo(4, 14); ctx.closePath();
    ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(w / 2 - 3, 11, 6, 19, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, 37, 3.6, 0, 7); ctx.fill();
  });

  /* --- Gyakorlótér: cölöpkerítés, fegyverállvány, célkorong --- */
  add('training', 176, 120, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Döngölt föld a karámban
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 22, 84, 26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6d4c'; ctx.beginPath(); ctx.ellipse(w / 2, h - 26, 78, 22, 0, 0, 7); ctx.fill();
    speckle(ctx, w / 2 - 70, h - 44, 140, 34, ['#7a5f41', '#9c7d58'], 40, rng, 0.8, 2);
    // Hátsó cölöpsor (félkör)
    const stake = (x, y, hh) => {
      ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#9a7048'], [1, '#5a3d24']]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 5, y - hh + 6); ctx.lineTo(x, y - hh); ctx.lineTo(x + 5, y - hh + 6); ctx.lineTo(x + 5, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      stake(w / 2 + Math.cos(a) * 80, h - 30 + Math.sin(a) * 26, 30 + (i % 2) * 6);
    }
    // Keresztgerenda
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(w / 2, h - 44, 80, 26, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
    // Fegyverállvány bal oldalt
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(18, h - 62, 34, 6); ctx.strokeRect(18, h - 62, 34, 6);
    ctx.fillRect(20, h - 62, 5, 36); ctx.strokeRect(20, h - 62, 5, 36);
    ctx.fillRect(45, h - 62, 5, 36); ctx.strokeRect(45, h - 62, 5, 36);
    for (const [x, kind] of [[28, 'spear'], [36, 'axe'], [43, 'sword']]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.lineTo(x, h - 84); ctx.stroke();
      ctx.strokeStyle = '#a07850'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.lineTo(x, h - 84); ctx.stroke();
      ctx.fillStyle = '#c9d3ea'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (kind === 'spear') { ctx.moveTo(x - 3, h - 84); ctx.lineTo(x, h - 96); ctx.lineTo(x + 3, h - 84); }
      else if (kind === 'axe') { ctx.moveTo(x, h - 82); ctx.quadraticCurveTo(x + 10, h - 86, x + 9, h - 74); ctx.lineTo(x, h - 76); }
      else { ctx.moveTo(x - 2, h - 84); ctx.lineTo(x, h - 98); ctx.lineTo(x + 2, h - 84); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Célkorong jobb oldalt
    const tx = w - 30, ty = h - 62;
    ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 10, h - 26); ctx.lineTo(tx, ty); ctx.lineTo(tx + 10, h - 26); ctx.stroke();
    for (const [r, c] of [[15, '#e8dcc4'], [11, '#b8392f'], [7, '#e8dcc4'], [3.5, '#b8392f']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.fill(); if (r === 15) ctx.stroke();
    }
    ctx.strokeStyle = '#4a3322'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx - 4, ty - 2); ctx.lineTo(tx + 14, ty - 10); ctx.stroke();
  });
  // Szalmabábu-sárkány (külön kép: imbolyog)
  add('dummy', 64, 76, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(w / 2 - 3, 34, 6, h - 36); ctx.strokeRect(w / 2 - 3, 34, 6, h - 36);
    // Test: szalmabála
    ctx.fillStyle = vgrad(ctx, 20, 52, [[0, '#e8cf7a'], [1, '#b8953f']]);
    ctx.beginPath(); ctx.ellipse(w / 2, 38, 20, 13, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,20,.6)'; ctx.lineWidth = 1;
    for (let i = -14; i <= 14; i += 5) { ctx.beginPath(); ctx.moveTo(w / 2 + i, 28); ctx.lineTo(w / 2 + i * 1.1, 49); ctx.stroke(); }
    // Fej: zsák, festett szemek
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillStyle = vgrad(ctx, 6, 28, [[0, '#d9c7a1'], [1, '#a8946a']]);
    ctx.beginPath(); ctx.moveTo(w / 2 - 6, 30); ctx.quadraticCurveTo(w / 2 - 22, 22, w / 2 - 24, 14); ctx.quadraticCurveTo(w / 2 - 8, 4, w / 2 + 6, 14); ctx.quadraticCurveTo(w / 2 + 8, 24, w / 2 + 2, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8392f'; ctx.beginPath(); ctx.arc(w / 2 - 10, 14, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b8392f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(w / 2 - 20, 18); ctx.lineTo(w / 2 - 12, 20); ctx.stroke();
    // Szarvak: két ág
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w / 2 - 2, 10); ctx.lineTo(w / 2 + 6, 1); ctx.moveTo(w / 2 + 3, 13); ctx.lineTo(w / 2 + 12, 6); ctx.stroke();
    // Kötél
    ctx.strokeStyle = '#7a5534'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2 - 18, 36); ctx.quadraticCurveTo(w / 2, 42, w / 2 + 18, 36); ctx.stroke();
  });
  // Lobogó a karám fölött (a Phaser lengeti)
  add('banner', 34, 46, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 46, [[0, '#c0392b'], [1, '#7a1f17']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(32, 2); ctx.lineTo(32, 44); ctx.lineTo(16, 34); ctx.lineTo(1, 44); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['t'], 13, 9, 14, 0, '#ffd08a');
  });

  /* --- A Völva: csuklyás alak bottal, a hosszúház ajtaja mellett --- */
  add('seer', 44, 72, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    // Bot, izzó kővel
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(34, h - 2); ctx.lineTo(37, 10); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(34, h - 2); ctx.lineTo(37, 10); ctx.stroke();
    const g = ctx.createRadialGradient(37, 9, 0, 37, 9, 9);
    g.addColorStop(0, '#e8fffb'); g.addColorStop(0.4, '#4fffe0'); g.addColorStop(1, 'rgba(79,255,224,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(37, 9, 9, 0, 7); ctx.fill();
    // Köpeny
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = vgrad(ctx, 14, h, [[0, '#2f3f78'], [1, '#18204a']]);
    ctx.beginPath(); ctx.moveTo(19, 12); ctx.quadraticCurveTo(6, 26, 5, h - 2); ctx.lineTo(33, h - 2); ctx.quadraticCurveTo(32, 26, 25, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Csuklya
    ctx.fillStyle = '#26336a';
    ctx.beginPath(); ctx.moveTo(22, 2); ctx.quadraticCurveTo(10, 6, 11, 22); ctx.lineTo(31, 22); ctx.quadraticCurveTo(33, 6, 22, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#05070f'; ctx.beginPath(); ctx.ellipse(21.5, 15, 6, 6.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9ffcf0'; ctx.fillRect(18, 14, 2, 2); ctx.fillRect(23, 14, 2, 2);
    // Arany rúnaszegély
    ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(8, h - 8); ctx.lineTo(32, h - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, 24); ctx.lineTo(20, h - 9); ctx.stroke();
    // Kéz a boton
    ctx.fillStyle = '#c9a27e'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(35, 36, 3, 0, 7); ctx.fill(); ctx.stroke();
  });

  /* --- Holló (a völgy fölött átrepülő Huginn) — szárny fel/le, két képkocka --- */
  for (const [key, up] of [['raven0', true], ['raven1', false]]) add(key, 56, 36, (ctx, w, h) => {
    ctx.fillStyle = '#0d1020'; ctx.strokeStyle = '#2a3150'; ctx.lineWidth = 1.2;
    const wy = up ? 2 : h - 4;
    // Szárnyak
    for (const dir of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2);
      ctx.quadraticCurveTo(w / 2 + dir * 12, up ? 6 : h - 6, w / 2 + dir * 27, wy);
      ctx.lineTo(w / 2 + dir * 20, h / 2 + (up ? -2 : 4));
      ctx.lineTo(w / 2 + dir * 24, h / 2 + (up ? 2 : 8) - (up ? 0 : 2));
      ctx.quadraticCurveTo(w / 2 + dir * 10, h / 2 + 4, w / 2, h / 2 + 3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Test, fej, csőr
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 2, 5, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, h / 2 - 7, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.moveTo(w / 2 - 1.5, h / 2 - 10); ctx.lineTo(w / 2, h / 2 - 16); ctx.lineTo(w / 2 + 1.5, h / 2 - 10); ctx.fill();
    ctx.fillStyle = '#0d1020'; ctx.beginPath(); ctx.moveTo(w / 2 - 4, h / 2 + 9); ctx.lineTo(w / 2, h / 2 + 16); ctx.lineTo(w / 2 + 4, h / 2 + 9); ctx.fill();
  });

  buildDecorSprites(add, rng);
  buildPlaceSprites(add, rng);
}

/* =====================================================================
   Apró díszek a völgyben (átjárhatók)
   ===================================================================== */
function buildDecorSprites(add, rng) {
  // Bokor (és havas változat)
  for (let v = 0; v < 3; v++) for (const snow of [false, true]) add(`bush${snow ? '-snow' : ''}${v}`, 44, 34, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const blobs = [[w / 2, h - 13, 13], [w / 2 - 11, h - 10, 9], [w / 2 + 11, h - 10, 9], [w / 2 + (v - 1) * 4, h - 20, 8]];
    for (const [x, y, r] of blobs) {
      ctx.fillStyle = vgrad(ctx, y - r, y + r, snow ? [[0, '#5f8a6a'], [1, '#2f4a3a']] : [[0, ['#5f9a4a', '#6aa35a', '#4f8a5a'][v]], [1, '#2a4a2a']]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    if (snow) { ctx.fillStyle = '#eef4fc'; for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.ellipse(x - 1, y - r + 3, r * 0.7, 3, 0, 0, 7); ctx.fill(); } }
    else if (v === 2) { for (let i = 0; i < 5; i++) { ctx.fillStyle = '#e04a4a'; ctx.beginPath(); ctx.arc(8 + rng() * (w - 16), h - 22 + rng() * 14, 2, 0, 7); ctx.fill(); } }
    else speckle(ctx, 6, h - 28, w - 12, 20, ['rgba(200,255,170,.35)'], 6, rng, 1, 2);
  });
  // Fűcsomó
  for (let v = 0; v < 3; v++) add(`tuft${v}`, 28, 20, (ctx, w, h) => {
    blades(ctx, 4, h - 2, w - 8, 2, '#2c5236', 9, rng, 12);
    blades(ctx, 6, h - 2, w - 12, 2, ['#7fb06a', '#8fbf6a', '#6aa35a'][v], 6, rng, 10);
  });
  // Páfrány
  for (let v = 0; v < 3; v++) add(`fern${v}`, 40, 30, (ctx, w, h) => {
    ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let f = -2; f <= 2; f++) {
      const a = -Math.PI / 2 + f * 0.45;
      const ex = w / 2 + Math.cos(a) * 18, ey = h - 2 + Math.sin(a) * 22;
      ctx.beginPath(); ctx.moveTo(w / 2, h - 2); ctx.quadraticCurveTo(w / 2 + f * 3, h - 14, ex, ey); ctx.stroke();
      ctx.strokeStyle = '#4f9a4a'; ctx.lineWidth = 1.2;
      for (let k = 0.3; k < 1; k += 0.15) {
        const px = w / 2 + (ex - w / 2) * k, py = h - 2 + (ey - h + 2) * k;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 4, py - 2); ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 2); ctx.stroke();
      }
      ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2;
    }
  });
  // Galóca-csoport
  for (let v = 0; v < 3; v++) add(`mushroom${v}`, 32, 26, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    const caps = [[w / 2 - 6, h - 4, 7], [w / 2 + 6, h - 3, 5], [w / 2 + 1, h - 2, 4]].slice(0, 2 + (v % 2));
    for (const [x, y, r] of caps) {
      ctx.fillStyle = '#e8dcc4'; ctx.fillRect(x - 1.5, y - r - 2, 3, r + 2); ctx.strokeRect(x - 1.5, y - r - 2, 3, r + 2);
      ctx.fillStyle = v === 2 ? '#c9a24a' : '#d23a2a';
      ctx.beginPath(); ctx.ellipse(x, y - r - 2, r, r * 0.65, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - r * 0.5 + i * r * 0.5, y - r - 4 - (i % 2), 1.1, 0, 7); ctx.fill(); }
    }
  });
  // Nád a vízparton
  for (let v = 0; v < 3; v++) add(`reeds${v}`, 30, 40, (ctx, w, h) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 4 + rng() * 2, top = 8 + rng() * 12;
      ctx.strokeStyle = '#3f6c3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, h - 2); ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, (h + top) / 2, x + (rng() - 0.5) * 4, top); ctx.stroke();
      if (i % 2 === v % 2) { ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.ellipse(x, top + 4, 2, 5, 0, 0, 7); ctx.fill(); }
    }
  });
  // Tönk
  for (let v = 0; v < 3; v++) add(`stump${v}`, 34, 28, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = vgrad(ctx, 8, h, [[0, '#7a5534'], [1, '#4a3322']]);
    ctx.beginPath(); ctx.moveTo(6, h - 3); ctx.lineTo(8, 10); ctx.lineTo(w - 8, 10); ctx.lineTo(w - 6, h - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a27e'; ctx.beginPath(); ctx.ellipse(w / 2, 10, w / 2 - 8, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 1;
    for (const r of [2, 5, 8]) { ctx.beginPath(); ctx.ellipse(w / 2, 10, r, r * 0.4, 0, 0, 7); ctx.stroke(); }
    if (v === 1) { ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.ellipse(w - 8, h - 8, 4, 2.5, 0, Math.PI, 0); ctx.fill(); }
    if (v === 2) { ctx.fillStyle = '#4f8a5a'; speckle(ctx, 8, 12, w - 16, 8, ['#4f8a5a', '#6aa35a'], 8, rng, 1, 2); }
  });
  // Kavicsok
  for (let v = 0; v < 3; v++) add(`pebbles${v}`, 30, 16, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3 + v; i++) {
      const x = 5 + rng() * (w - 10), y = h - 4 - rng() * 6, r = 2 + rng() * 3;
      ctx.fillStyle = ['#8a90a6', '#6f7690', '#a0a6ba'][i % 3];
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
  });
  // Csontok a hamuban
  for (let v = 0; v < 3; v++) add(`bones${v}`, 44, 26, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillStyle = '#d9d0bd';
    if (v === 0) {
      // Bordakosár
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(12 + i * 7, h - 6, 3, 9, 0, Math.PI, 0); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#d9d0bd'; ctx.stroke(); }
      ctx.fillRect(8, h - 7, 30, 3);
    } else {
      // Koponya
      ctx.beginPath(); ctx.ellipse(w / 2, h - 10, 11, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 + 6, h - 6); ctx.lineTo(w / 2 + 18, h - 4); ctx.lineTo(w / 2 + 6, h - 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2326'; ctx.beginPath(); ctx.arc(w / 2 + 2, h - 12, 2.5, 0, 7); ctx.fill();
      if (v === 2) { ctx.strokeStyle = '#d9d0bd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2 - 8, h - 16); ctx.quadraticCurveTo(w / 2 - 14, h - 26, w / 2 - 4, h - 24); ctx.stroke(); }
    }
  });
  // Izzó repedés (lávanyílás) — a völgy pulzáló fényt tesz rá
  for (let v = 0; v < 3; v++) add(`vent${v}`, 40, 22, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,140,60,.55)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffb35a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, h / 2 + 2);
    for (let i = 1; i <= 5; i++) ctx.lineTo(6 + i * (w - 12) / 5, h / 2 + (rng() - 0.5) * 8);
    ctx.stroke();
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 0.8; ctx.stroke();
  });
  // Jégkristály
  for (let v = 0; v < 3; v++) add(`crystal${v}`, 30, 40, (ctx, w, h) => {
    ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 1.5;
    const spikes = [[w / 2, h - 2, 7, 30], [w / 2 - 8, h - 2, 5, 18], [w / 2 + 8, h - 2, 5, 22]];
    for (const [x, y, hw, hh] of spikes) {
      ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#e8fffb'], [1, '#6fb8e0']]);
      ctx.beginPath(); ctx.moveTo(x - hw, y); ctx.lineTo(x - hw * 0.6, y - hh * 0.7); ctx.lineTo(x, y - hh); ctx.lineTo(x + hw * 0.6, y - hh * 0.7); ctx.lineTo(x + hw, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(x - 1, y - 3); ctx.lineTo(x - 1, y - hh + 4); ctx.stroke(); ctx.strokeStyle = '#3a5a7a';
    }
  });
}

/* =====================================================================
   A völgy helyei: tanítók, emberek, ládák, kőkör, hajó
   ===================================================================== */
/** Egész alakos emberke (40×64): köpeny, fej, fejfedő, kellék. */
function figure(ctx, w, h, o) {
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  const cx = w / 2;
  // Köpeny
  ctx.fillStyle = vgrad(ctx, 22, h, [[0, o.robe], [1, o.robe2 || o.robe]]);
  ctx.beginPath(); ctx.moveTo(cx - 6, 24); ctx.quadraticCurveTo(cx - 15, 40, cx - 14, h - 2); ctx.lineTo(cx + 14, h - 2); ctx.quadraticCurveTo(cx + 15, 40, cx + 6, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (o.belt) { ctx.fillStyle = o.belt; ctx.fillRect(cx - 12, 42, 24, 3); }
  // Fej
  ctx.fillStyle = o.skin || '#d9a37e';
  ctx.beginPath(); ctx.arc(cx, 17, 8, 0, 7); ctx.fill(); ctx.stroke();
  if (o.beard) { ctx.fillStyle = o.beard; ctx.beginPath(); ctx.moveTo(cx - 7, 18); ctx.quadraticCurveTo(cx, 34 + (o.beardLen || 0), cx + 7, 18); ctx.quadraticCurveTo(cx, 23, cx - 7, 18); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.fillRect(cx - 4, 16, 2, 2); ctx.fillRect(cx + 2, 16, 2, 2);
  if (o.patch) { ctx.fillStyle = INK; ctx.fillRect(cx + 1, 14, 5, 4); }
  // Fejfedő
  ctx.fillStyle = o.hatColor || '#3a3f55';
  switch (o.hat) {
    case 'hood': ctx.beginPath(); ctx.moveTo(cx, 4); ctx.quadraticCurveTo(cx - 13, 8, cx - 10, 26); ctx.lineTo(cx - 6, 24); ctx.quadraticCurveTo(cx - 7, 12, cx, 10); ctx.quadraticCurveTo(cx + 7, 12, cx + 6, 24); ctx.lineTo(cx + 10, 26); ctx.quadraticCurveTo(cx + 13, 8, cx, 4); ctx.fill(); ctx.stroke(); break;
    case 'helmet': ctx.beginPath(); ctx.arc(cx, 15, 9, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(cx - 1, 14, 2, 6); break;
    case 'wide': ctx.beginPath(); ctx.ellipse(cx, 11, 15, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 7, 10); ctx.quadraticCurveTo(cx - 4, -2, cx + 4, 1); ctx.quadraticCurveTo(cx + 8, 4, cx + 7, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'beanie': ctx.beginPath(); ctx.arc(cx, 14, 8.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'scarf': ctx.beginPath(); ctx.arc(cx, 16, 10, Math.PI * 1.05, -0.05); ctx.quadraticCurveTo(cx + 9, 24, cx + 6, 26); ctx.lineTo(cx - 6, 26); ctx.quadraticCurveTo(cx - 9, 24, cx - 10, 15); ctx.fill(); ctx.stroke(); break;
    default: ctx.fillStyle = o.hair || '#d9a03a'; ctx.beginPath(); ctx.arc(cx, 14, 8.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  o.extra?.(ctx, cx, h);
}

function buildPlaceSprites(add, rng) {
  // --- Emberek ---
  add('npc-fisher', 48, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#3a5a7a', robe2: '#22344a', beard: '#6b4a2e', hat: 'beanie', hatColor: '#b8392f', belt: '#6b4a2e',
    extra: (c) => { c.strokeStyle = '#6b4a2e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(w / 2 + 8, 40); c.lineTo(w - 2, 4); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(w - 2, 4); c.lineTo(w - 1, 30); c.stroke(); },
  }));
  add('npc-merchant', 44, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#6a2a5a', robe2: '#3a1430', hat: 'scarf', hatColor: '#2f6fb8', belt: '#ffd36b', skin: '#e6b48f',
    extra: (c) => { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(w / 2 + 12, 44, 5, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); },
  }));
  add('npc-skald', 44, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#5a3a8a', robe2: '#2e1f4a', hat: 'none', hair: '#d9a03a', beard: '#d9a03a', beardLen: -8,
    extra: (c) => { c.strokeStyle = '#d9b45a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 - 14, 46); c.quadraticCurveTo(w / 2 - 18, 32, w / 2 - 10, 30); c.moveTo(w / 2 - 6, 46); c.quadraticCurveTo(w / 2 - 2, 32, w / 2 - 10, 30); c.stroke(); },
  }));
  add('npc-wanderer', 48, 70, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#3a4560', robe2: '#1c2236', hat: 'wide', hatColor: '#2a2f45', beard: '#c9ccd6', beardLen: 8, patch: true, skin: '#c9a284',
    extra: (c) => {
      c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2 + 13, h - 2); c.lineTo(w / 2 + 16, 2); c.stroke();
      c.strokeStyle = '#8a6844'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#c9d3ea'; c.beginPath(); c.moveTo(w / 2 + 14, 4); c.lineTo(w / 2 + 16, -6); c.lineTo(w / 2 + 18, 4); c.fill();
    },
  }));

  // --- Gunnhild kunyhója: gyeptetős föld-ház, füstölgő kémény, gombák ---
  add('hut', 120, 104, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = vgrad(ctx, 40, h - 8, [[0, '#6b4a2e'], [1, '#3a2716']]);
    ctx.beginPath(); ctx.moveTo(16, h - 8); ctx.lineTo(18, 48); ctx.lineTo(w - 18, 48); ctx.lineTo(w - 16, h - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    for (let y = 56; y < h - 10; y += 9) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(w - 18, y); ctx.stroke(); }
    // Gyeptető
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillStyle = vgrad(ctx, 10, 54, [[0, '#6aa35a'], [1, '#2f5a2a']]);
    ctx.beginPath(); ctx.moveTo(6, 54); ctx.quadraticCurveTo(w / 2, -6, w - 6, 54); ctx.quadraticCurveTo(w / 2, 44, 6, 54); ctx.fill(); ctx.stroke();
    blades(ctx, 14, 20, w - 28, 30, '#8fbf6a', 22, rng, 6);
    // Ajtó és ablak, meleg fénnyel
    ctx.fillStyle = vgrad(ctx, 62, h - 8, [[0, '#ffd08a'], [1, '#ff8a3d']]);
    ctx.beginPath(); ctx.roundRect(w / 2 - 11, 64, 22, h - 72, [10, 10, 0, 0]); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(w - 40, 58, 14, 12, 3); ctx.fill(); ctx.stroke();
    // Kémény
    ctx.fillStyle = '#5b6279'; ctx.fillRect(w - 38, 12, 12, 22); ctx.strokeRect(w - 38, 12, 12, 22);
    // Gyógynövény-csokrok az eresz alatt
    for (const x of [26, 36, w - 50]) {
      ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 60); ctx.stroke();
      ctx.fillStyle = '#b58cff'; ctx.beginPath(); ctx.arc(x, 61, 3, 0, 7); ctx.fill();
    }
    // Gombák a fal tövében
    for (const [x, r] of [[12, 5], [w - 12, 4], [w - 20, 3]]) {
      ctx.fillStyle = '#e8dcc4'; ctx.fillRect(x - 1, h - 10, 2, 6);
      ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.ellipse(x, h - 10, r, r * 0.7, 0, Math.PI, 0); ctx.fill();
    }
  });

  // --- Brokk kovácsműhelye: kőépület, üllő, izzó kohó ---
  add('forge', 128, 108, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    // Kőfal
    ctx.fillStyle = vgrad(ctx, 30, h - 6, [[0, '#7d869f'], [1, '#474d62']]);
    ctx.beginPath(); ctx.roundRect(14, 40, w - 28, h - 46, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5;
    for (let y = 50; y < h - 8; y += 12) for (let x = 18 + ((y / 12) % 2) * 10; x < w - 20; x += 20) ctx.strokeRect(x, y, 18, 10);
    // Pala tető
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillStyle = vgrad(ctx, 8, 46, [[0, '#3a3a52'], [1, '#22233a']]);
    ctx.beginPath(); ctx.moveTo(6, 46); ctx.lineTo(w / 2, 10); ctx.lineTo(w - 6, 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Kémény
    ctx.fillStyle = '#5b6279'; ctx.fillRect(w - 40, 4, 14, 28); ctx.strokeRect(w - 40, 4, 14, 28);
    // Kohó szája
    const g = ctx.createRadialGradient(42, h - 26, 2, 42, h - 26, 18);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, '#ff8a3d'); g.addColorStop(1, '#5a1a0a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(42, h - 24, 14, Math.PI, 0); ctx.lineTo(56, h - 8); ctx.lineTo(28, h - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Üllő
    ctx.fillStyle = '#3a3f55';
    ctx.beginPath(); ctx.moveTo(w - 60, h - 30); ctx.lineTo(w - 22, h - 30); ctx.lineTo(w - 30, h - 22); ctx.lineTo(w - 36, h - 22); ctx.lineTo(w - 34, h - 8); ctx.lineTo(w - 50, h - 8); ctx.lineTo(w - 48, h - 22); ctx.lineTo(w - 54, h - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w - 58, h - 29); ctx.lineTo(w - 24, h - 29); ctx.stroke();
    // Kalapács az üllőn
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w - 44, h - 31); ctx.lineTo(w - 30, h - 44); ctx.stroke();
    ctx.fillStyle = '#7d869f'; ctx.fillRect(w - 34, h - 50, 10, 7); ctx.strokeRect(w - 34, h - 50, 10, 7);
    // Rúna a szemöldökfán
    drawRunes(ctx, ['th'], w / 2 - 3, 18, 12, 0, '#ffb35a');
  });

  // --- A Fagyóriás trónja: jégből faragott szék, kristályokkal ---
  add('throne', 120, 128, (ctx, w, h) => {
    ctx.strokeStyle = '#2a4a6a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    const ice = (y0, y1) => vgrad(ctx, y0, y1, [[0, '#e8fffb'], [0.5, '#9fd8f0'], [1, '#4a8ab8']]);
    // Háttámla: magas, csipkés
    ctx.fillStyle = ice(4, h - 30);
    ctx.beginPath(); ctx.moveTo(26, h - 30);
    const tips = [[28, 30], [38, 10], [50, 22], [60, 2], [70, 22], [82, 10], [92, 30]];
    for (const [x, y] of tips) ctx.lineTo(x, y);
    ctx.lineTo(94, h - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Ülés és karfák
    ctx.fillStyle = ice(h - 46, h - 4);
    ctx.beginPath(); ctx.roundRect(16, h - 46, w - 32, 18, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(22, h - 30, w - 44, 26, 3); ctx.fill(); ctx.stroke();
    for (const x of [10, w - 26]) { ctx.beginPath(); ctx.roundRect(x, h - 62, 16, 40, 4); ctx.fill(); ctx.stroke(); }
    // Fény-élek
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    for (const [x, y] of tips) { ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 26); ctx.stroke(); }
    // Rúna a támlán
    drawRunes(ctx, ['th'], w / 2 - 3, 46, 20, 0, '#9fe8ff');
    // Hótakaró a lábánál
    ctx.fillStyle = '#eef4fc'; ctx.beginPath(); ctx.ellipse(w / 2, h - 4, w / 2 - 6, 6, 0, 0, 7); ctx.fill();
  });

  // --- Muspell-oltár: fekete kő, izzó rúnák (a lángot a Phaser adja) ---
  add('altar', 104, 84, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    const glow = ctx.createRadialGradient(w / 2, h - 30, 4, w / 2, h - 30, 60);
    glow.addColorStop(0, 'rgba(255,120,40,.45)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    // Lépcső
    ctx.fillStyle = '#2a2326'; ctx.beginPath(); ctx.roundRect(8, h - 16, w - 16, 12, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a3033'; ctx.beginPath(); ctx.roundRect(16, h - 26, w - 32, 12, 3); ctx.fill(); ctx.stroke();
    // Oltárkő
    ctx.fillStyle = vgrad(ctx, 26, h - 26, [[0, '#4a3f42'], [1, '#1a1517']]);
    ctx.beginPath(); ctx.moveTo(24, h - 26); ctx.lineTo(28, 34); ctx.lineTo(w - 28, 34); ctx.lineTo(w - 24, h - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a4a4d'; ctx.beginPath(); ctx.roundRect(20, 26, w - 40, 10, 3); ctx.fill(); ctx.stroke();
    // Izzó rúnák és repedések
    drawRunes(ctx, ['k'], w / 2 - 3, 42, 16, 0, '#ff6a1f');
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(32, 44); ctx.lineTo(38, 52); ctx.lineTo(34, 60); ctx.moveTo(w - 32, 40); ctx.lineTo(w - 38, 50); ctx.stroke();
    // Parázstál a tetején
    ctx.fillStyle = '#1a1517'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w / 2, 26, 18, 6, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb35a'; ctx.beginPath(); ctx.ellipse(w / 2, 25, 14, 3.5, 0, 0, 7); ctx.fill();
  });

  // --- A Valkűr-kő: magas faragott kő, szárnyakkal ---
  add('valkstone', 96, 120, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    const glow = ctx.createRadialGradient(w / 2, 50, 4, w / 2, 50, 56);
    glow.addColorStop(0, 'rgba(255,243,196,.35)'); glow.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    // Kőtömb
    ctx.fillStyle = vgrad(ctx, 8, h, [[0, '#a8b0c4'], [1, '#4f566e']]);
    ctx.beginPath(); ctx.moveTo(w / 2 - 18, h - 4); ctx.lineTo(w / 2 - 20, 30); ctx.quadraticCurveTo(w / 2, 2, w / 2 + 20, 30); ctx.lineTo(w / 2 + 18, h - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Faragott szárnyak a kő két oldalán
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#e6edf8';
      ctx.beginPath(); ctx.moveTo(w / 2 + dir * 16, 44);
      for (let i = 0; i < 5; i++) ctx.lineTo(w / 2 + dir * (26 + i * 5), 24 + i * 9);
      ctx.lineTo(w / 2 + dir * 18, 80); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,90,120,.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + dir * 18, 50 + i * 7); ctx.lineTo(w / 2 + dir * (28 + i * 5), 32 + i * 9); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    }
    // Valkűr-sisak domborműve és rúnák
    ctx.fillStyle = '#d9b45a';
    ctx.beginPath(); ctx.arc(w / 2, 46, 8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['t', 'a'], w / 2 - 3, 62, 10, 14, '#fff3c4');
  });

  // --- Menhir a Kőkörhöz (3 változat) ---
  for (let v = 0; v < 3; v++) add(`menhir${v}`, 34, 62, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#8e98b0'], [1, '#474d62']]);
    ctx.beginPath(); ctx.moveTo(6, h - 2); ctx.lineTo(5 + v * 2, 14); ctx.quadraticCurveTo(w / 2, -2 + v * 3, w - 6 - v, 12); ctx.lineTo(w - 6, h - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4f8a5a'; speckle(ctx, 6, h - 18, w - 12, 14, ['#4f8a5a', '#6aa35a'], 8, rng, 1, 2.5);
  });

  // --- Láda (zárt / nyitott) ---
  for (const open of [false, true]) add(open ? 'chest-open' : 'chest', 40, 36, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.fillStyle = vgrad(ctx, 14, h - 2, [[0, '#9a7048'], [1, '#5a3d24']]);
    ctx.beginPath(); ctx.roundRect(4, 16, w - 8, h - 18, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9b45a';
    ctx.fillRect(4, 22, w - 8, 3); ctx.fillRect(w / 2 - 3, 18, 6, 10);
    if (open) {
      ctx.fillStyle = '#3a2716'; ctx.beginPath(); ctx.moveTo(4, 16); ctx.lineTo(8, 2); ctx.lineTo(w - 8, 2); ctx.lineTo(w - 4, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(w / 2, 17, w / 2 - 8, 3, 0, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = vgrad(ctx, 4, 18, [[0, '#b8875a'], [1, '#7a5534']]);
      ctx.beginPath(); ctx.moveTo(4, 18); ctx.quadraticCurveTo(w / 2, 0, w - 4, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9b45a'; ctx.fillRect(w / 2 - 3, 8, 6, 10); ctx.strokeRect(w / 2 - 3, 8, 6, 10);
    }
  });

  // --- Útjelző tábla ---
  add('sign', 44, 56, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(w / 2 - 3, 10, 6, h - 12); ctx.strokeRect(w / 2 - 3, 10, 6, h - 12);
    for (const [y, dir] of [[10, 1], [24, -1]]) {
      ctx.fillStyle = vgrad(ctx, y, y + 11, [[0, '#b8875a'], [1, '#8a6844']]);
      ctx.beginPath();
      if (dir > 0) { ctx.moveTo(4, y); ctx.lineTo(w - 8, y); ctx.lineTo(w - 2, y + 5.5); ctx.lineTo(w - 8, y + 11); ctx.lineTo(4, y + 11); }
      else { ctx.moveTo(w - 4, y); ctx.lineTo(8, y); ctx.lineTo(2, y + 5.5); ctx.lineTo(8, y + 11); ctx.lineTo(w - 4, y + 11); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,25,10,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, y + 5.5); ctx.lineTo(w - 12, y + 5.5); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
    }
  });

  // --- Drakkar (a kalmár hajója) ---
  add('drakkar', 220, 150, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Vitorla
    ctx.fillStyle = '#e8dcc4';
    ctx.beginPath(); ctx.moveTo(w / 2 - 50, 22); ctx.lineTo(w / 2 + 50, 22); ctx.quadraticCurveTo(w / 2 + 56, 64, w / 2 + 46, 92); ctx.lineTo(w / 2 - 46, 92); ctx.quadraticCurveTo(w / 2 - 56, 64, w / 2 - 50, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8392f';
    for (let i = 0; i < 5; i += 2) { ctx.beginPath(); ctx.moveTo(w / 2 - 50 + i * 20, 22); ctx.lineTo(w / 2 - 30 + i * 20, 22); ctx.lineTo(w / 2 - 28 + i * 18.4, 92); ctx.lineTo(w / 2 - 46 + i * 18.4, 92); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.strokeRect(w / 2 - 54, 18, 108, 4);
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(w / 2 - 3, 10, 6, 100); ctx.strokeRect(w / 2 - 3, 10, 6, 100);
    // Hajótest, sárkányfejes orral
    ctx.fillStyle = vgrad(ctx, 96, h - 10, [[0, '#8a6844'], [1, '#4a3322']]);
    ctx.beginPath();
    ctx.moveTo(14, 60); ctx.quadraticCurveTo(24, 96, 40, 104);
    ctx.lineTo(w - 40, 104); ctx.quadraticCurveTo(w - 24, 96, w - 14, 60);
    ctx.quadraticCurveTo(w - 30, 130, w / 2, 132); ctx.quadraticCurveTo(30, 130, 14, 60);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    for (const y of [112, 120]) { ctx.beginPath(); ctx.moveTo(34, y); ctx.quadraticCurveTo(w / 2, y + 12, w - 34, y); ctx.stroke(); }
    // Pajzsok a hajó oldalán
    const cols = ['#b8392f', '#d9c7a1', '#2f6fb8', '#d9b45a'];
    for (let i = 0; i < 7; i++) {
      const x = 52 + i * 19;
      ctx.fillStyle = cols[i % 4]; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, 106, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9d3ea'; ctx.beginPath(); ctx.arc(x, 106, 2.5, 0, 7); ctx.fill();
    }
    // Sárkányfej és farok
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(18, 64); ctx.quadraticCurveTo(4, 30, 20, 18); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#8a6844'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(26, 18, 10, 6, 0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(28, 16, 1.6, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(w - 18, 64); ctx.quadraticCurveTo(w - 2, 40, w - 14, 26); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 4; ctx.stroke();
    // Vízvonal
    ctx.fillStyle = 'rgba(20,50,90,.55)'; ctx.fillRect(0, 124, w, h - 124);
    ctx.strokeStyle = 'rgba(230,245,255,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 125); for (let x = 20; x < w - 20; x += 16) ctx.quadraticCurveTo(x + 8, 121, x + 16, 125); ctx.stroke();
  });

  // --- Stég (a halásznál) ---
  add('pier', 120, 40, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const x of [12, 52, 92]) { ctx.fillStyle = '#4a3322'; ctx.fillRect(x, 14, 6, h - 14); ctx.strokeRect(x, 14, 6, h - 14); }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#8a6844' : '#7a5a3a';
      ctx.fillRect(4 + i * 9.5, 8, 9, 14); ctx.strokeRect(4 + i * 9.5, 8, 9, 14);
    }
    ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.ellipse(w - 14, 8, 6, 4, 0, 0, 7); ctx.fill(); ctx.stroke();  // vödör
  });

  // --- Tábortűz farakással (a lángot a Phaser adja) ---
  add('campfire', 52, 34, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#5b6279';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(w / 2 + Math.cos(a) * 18, h - 10 + Math.sin(a) * 7, 5, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#6b4a2e';
    ctx.save(); ctx.translate(w / 2, h - 12);
    for (const r of [-0.5, 0.5, 0]) { ctx.save(); ctx.rotate(r); ctx.fillRect(-14, -3, 28, 6); ctx.strokeRect(-14, -3, 28, 6); ctx.restore(); }
    ctx.restore();
    ctx.fillStyle = '#ffb35a'; ctx.beginPath(); ctx.ellipse(w / 2, h - 13, 8, 3, 0, 0, 7); ctx.fill();
  });

  // --- Birka (két képkocka: legel / felnéz) ---
  for (const [key, up] of [['sheep0', false], ['sheep1', true]]) add(key, 40, 30, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#3a3033';
    for (const x of [12, 17, 25, 30]) ctx.fillRect(x, h - 9, 3, 8);
    ctx.fillStyle = '#f2ece2';
    for (const [x, y, r] of [[14, h - 14, 7], [21, h - 17, 8], [28, h - 14, 7], [21, h - 11, 7]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(21, h - 14, 14, 9, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#3a3033';
    ctx.beginPath(); ctx.ellipse(6, up ? h - 20 : h - 9, 5, 4, up ? -0.3 : 0.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(4, up ? h - 22 : h - 11, 1.5, 1.5);
  });
}

/* =====================================================================
   Rúnák vonalakból (a realm-grafikával azonos jelkészlet)
   ===================================================================== */
const RUNE_LINES = {
  f: [[[2, 0], [2, 10]], [[2, 3], [5, 0]], [[2, 6], [5, 3]]],
  u: [[[1, 10], [1, 0], [5, 3], [5, 10]]],
  th: [[[2, 0], [2, 10]], [[2, 3], [5, 5], [2, 7]]],
  a: [[[2, 0], [2, 10]], [[2, 0], [5, 3]], [[2, 3], [5, 6]]],
  r: [[[1, 10], [1, 0], [5, 2.5], [1, 5], [5, 10]]],
  k: [[[4.5, 1.5], [1.5, 5], [4.5, 8.5]]],
  o: [[[1, 10], [5, 3.5], [3, 0], [1, 3.5], [5, 10]]],
  t: [[[3, 0], [3, 10]], [[0.5, 3], [3, 0], [5.5, 3]]],
};
export function drawRunes(ctx, keys, x, y, h, step, color) {
  const s = h / 10;
  const stroke = (lw, col, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    keys.forEach((k, i) => {
      for (const poly of RUNE_LINES[k] || []) {
        ctx.beginPath();
        poly.forEach(([px, py], j) => { const X = x + px * s, Y = y + i * step + py * s; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke();
      }
    });
    ctx.restore();
  };
  stroke(4, color, 0.35);
  stroke(1.6, '#e8fffb', 1);
}

/* =====================================================================
   Sárkányok — tintázott testrész-textúrák
   ===================================================================== */
const imageCache = new Map();
function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Nem tölthető be: ${url}`));
      img.src = url;
    }));
  }
  return imageCache.get(url);
}

/** Az oldal színezésével azonos: szürkeárnyalat × min(szín × 1.3, 1). */
function tintRGB(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0xff8a3d;
  const f = (v) => Math.round(Math.min(1, (v / 255) * 1.3) * 255);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/**
 * A sárkány négy testrészének textúrái (a kulcsokat adja vissza).
 * Minden rész ugyanarra a 64-es rácsra rajzolt kép, ezért egymásra
 * téve pontosan összeillenek — és külön mozgathatók (szárnycsapás,
 * fejmozdulat) a rögzített csatlakozási pontok körül.
 */
export async function dragonTextures(scene, dragon, catalog, size = 256) {
  const keys = {};
  await Promise.all(SLOTS.map(async (slot) => {
    const id = dragon[slot];
    const part = id ? catalog[slot]?.[id] : null;
    if (!part) return;
    const key = `dp:${slot}:${id}:${dragon.szin}:${size}`;
    keys[slot] = key;
    if (scene.textures.exists(key)) return;

    const img = await loadImage(part.img);
    const c = canvas(size, size);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tintRGB(dragon.szin);
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0, size, size);
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  }));
  return keys;
}

/** Kis portré a felülethez (a már elkészült textúrákból). */
export function dragonPortrait(scene, keys, size = 72) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  for (const slot of ['test', 'lab', 'fej', 'szarny']) {
    if (!keys[slot]) continue;
    const src = scene.textures.get(keys[slot]).getSourceImage();
    ctx.drawImage(src, 0, 0, size, size);
  }
  return c;
}

/**
 * Sárkány a jelenetben: konténer, benne a négy rész. A szárny és a fej
 * saját csatlakozási pontja körül forgatható (ugyanazok a pontok, amikre
 * a rajzok készültek: nyaktő 26,20 — szárnytő 36,27 a 64-es rácson).
 */
export function makeDragonView(scene, keys, displaySize) {
  const cont = scene.add.container(0, 0);
  const inner = scene.add.container(0, 0);        // ezt tükrözzük irány szerint
  cont.add(inner);
  const S = displaySize;
  const part = (slot, ox, oy) => {
    if (!keys[slot]) return null;
    const img = scene.add.image((ox - 0.5) * S, (oy - 0.5) * S, keys[slot]).setOrigin(ox, oy).setDisplaySize(S, S);
    inner.add(img);
    return img;
  };
  const body  = part('test', 0.5, 0.5);
  const legs  = part('lab', 0.5, 0.5);
  const head  = part('fej', 26 / 64, 20 / 64);
  const wings = part('szarny', 36 / 64, 27 / 64);
  cont.setData('parts', { body, legs, head, wings, inner });
  return cont;
}

/* =====================================================================
   Barlangi háttér a csatához
   ===================================================================== */
const CAVE_LOOK = {
  1: { wall: ['#16241c', '#0b120e'], rock: '#2c4436', crystal: '#7bffb0', mist: 'rgba(120,255,170,.06)' },
  2: { wall: ['#122238', '#070d18'], rock: '#2e4a6a', crystal: '#9fe8ff', mist: 'rgba(160,220,255,.07)' },
  3: { wall: ['#1c1430', '#0a0714'], rock: '#3a2c5a', crystal: '#c9a0ff', mist: 'rgba(190,150,255,.07)' },
  4: { wall: ['#2a1210', '#120606'], rock: '#4a2620', crystal: '#ff8a3d', mist: 'rgba(255,120,60,.08)' },
  5: { wall: ['#0e0b14', '#040306'], rock: '#241c30', crystal: '#ffd36b', mist: 'rgba(255,210,120,.05)' },
};

export function caveBackdrop(scene, tier, w, h) {
  const key = `cavebg:${tier}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const look = CAVE_LOOK[tier] || CAVE_LOOK[1];
  const rng = mulberry32(tier * 999);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = vgrad(ctx, 0, h, [[0, look.wall[1]], [0.55, look.wall[0]], [1, look.wall[1]]]);
  ctx.fillRect(0, 0, w, h);

  // Hátsó sziklafal tömbök
  for (let i = 0; i < 26; i++) {
    const x = rng() * w, y = h * 0.1 + rng() * h * 0.5, r = 40 + rng() * 120;
    ctx.fillStyle = `rgba(0,0,0,${0.15 + rng() * 0.25})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, rng(), 0, 7); ctx.fill();
  }

  // Kristályfény foltok
  for (let i = 0; i < 7; i++) {
    const x = rng() * w, y = h * 0.2 + rng() * h * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, hexA(look.crystal, 0.22)); g.addColorStop(1, hexA(look.crystal, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 90, y - 90, 180, 180);
    // maga a kristály
    ctx.fillStyle = hexA(look.crystal, 0.85); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const cs = 8 + rng() * 14;
    ctx.beginPath(); ctx.moveTo(x, y - cs * 2); ctx.lineTo(x + cs * 0.6, y); ctx.lineTo(x, y + cs * 0.4); ctx.lineTo(x - cs * 0.6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Cseppkövek felül
  for (let x = -10; x < w + 10; x += 18 + rng() * 30) {
    const len = 30 + rng() * h * 0.2, wid = 14 + rng() * 26;
    ctx.fillStyle = vgrad(ctx, 0, len, [[0, look.rock], [1, look.wall[1]]]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - wid / 2, -2); ctx.quadraticCurveTo(x - wid * 0.1, len * 0.6, x, len); ctx.quadraticCurveTo(x + wid * 0.1, len * 0.6, x + wid / 2, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Talaj: egyenetlen kőpadló, a sárkányok ezen állnak
  const floorY = h * 0.72;
  ctx.fillStyle = vgrad(ctx, floorY - 20, h, [[0, look.rock], [1, '#050507']]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 14 + Math.sin(x / 90) * 10 + rng() * 8);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.stroke();

  // Cseppkövek alul, a két szélén (keretezés)
  for (const side of [0, 1]) for (let i = 0; i < 4; i++) {
    const x = side ? w - 20 - i * 40 - rng() * 20 : 20 + i * 40 + rng() * 20;
    const hh = 40 + rng() * 90 - i * 12;
    ctx.fillStyle = look.rock; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 16, h); ctx.lineTo(x, h - hh); ctx.lineTo(x + 16, h); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Köd a padló fölött
  ctx.fillStyle = look.mist;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(rng() * w, floorY + rng() * 40, 200, 30, 0, 0, 7); ctx.fill(); }

  // Vignetta
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.2, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   A Gyakorlótér a párbajhoz: alkonyi égbolt, sarkfény, cölöpkerítés
   ===================================================================== */
export function arenaBackdrop(scene, w, h) {
  const key = `arenabg:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const rng = mulberry32(2026);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const floorY = h * 0.72;

  // Ég: mély kék → alkonyi narancs a látóhatáron
  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, '#070b1e'], [0.55, '#1a2350'], [0.85, '#5a3a52'], [1, '#c4683a']]);
  ctx.fillRect(0, 0, w, floorY);
  // Csillagok
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.6})`;
    ctx.fillRect(rng() * w, rng() * floorY * 0.55, 1.5, 1.5);
  }
  // Sarkfény-szalagok
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    const y0 = h * (0.12 + b * 0.07);
    ctx.moveTo(0, y0);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 140 + b * 2) * 30 + Math.sin(x / 47) * 8);
    ctx.lineTo(w, y0 + 90); ctx.lineTo(0, y0 + 90); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 90);
    g.addColorStop(0, `rgba(${b === 1 ? '157,123,255' : '79,255,190'},.22)`); g.addColorStop(1, 'rgba(79,255,190,0)');
    ctx.fillStyle = g; ctx.fill();
  }
  // Távoli hegyek két rétegben
  for (const [col, base, amp, seed] of [['#1a1f3c', floorY - 70, 90, 1], ['#10142a', floorY - 30, 60, 2]]) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, floorY);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, base - Math.abs(Math.sin(x / 170 + seed)) * amp - rng() * 14);
    ctx.lineTo(w, floorY); ctx.closePath(); ctx.fill();
  }
  // Talaj: döngölt föld
  ctx.fillStyle = vgrad(ctx, floorY - 10, h, [[0, '#5a4430'], [1, '#1a120b']]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 120) * 5);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  speckle(ctx, 0, floorY, w, h - floorY, ['rgba(0,0,0,.25)', 'rgba(255,220,170,.08)'], 160, rng, 1, 3);
  // Cölöpkerítés a háttérben
  for (let x = -6; x < w + 10; x += 22) {
    const hh = 64 + rng() * 22, y = floorY - 8;
    ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#6b4a2e'], [1, '#2e1f12']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 9, y - hh + 10); ctx.lineTo(x, y - hh); ctx.lineTo(x + 9, y - hh + 10); ctx.lineTo(x + 9, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#3a2716'; ctx.fillRect(0, floorY - 52, w, 7);
  // Fáklyák a kerítésen
  for (const fx of [w * 0.12, w * 0.38, w * 0.62, w * 0.88]) {
    const fy = floorY - 78;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 110);
    g.addColorStop(0, 'rgba(255,170,80,.45)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - 110, fy - 110, 220, 220);
    ctx.fillStyle = '#3a2716'; ctx.fillRect(fx - 3, fy, 6, 30);
    ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.ellipse(fx, fy - 4, 5, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(fx, fy - 1, 2.5, 5, 0, 0, 7); ctx.fill();
  }
  // Lobogók
  for (const bx of [w * 0.25, w * 0.75]) {
    ctx.fillStyle = '#7a1f17'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 18, floorY - 150); ctx.lineTo(bx + 18, floorY - 150); ctx.lineTo(bx + 18, floorY - 90); ctx.lineTo(bx, floorY - 104); ctx.lineTo(bx - 18, floorY - 90); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['t'], bx - 4, floorY - 142, 22, 0, '#ffd08a');
    ctx.fillStyle = '#3a2716'; ctx.fillRect(bx - 22, floorY - 154, 44, 5);
  }
  // Vignetta
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   Szabadtéri csatahátterek (kóborló sárkányok, őr-csaták)
   ===================================================================== */
const FIELD = {
  meadow: { sky: ['#0a1430', '#24386a', '#4a5a8a'], hills: ['#1c2a3a', '#14202c'], ground: ['#2f5a3a', '#0e1a12'], trees: '#0f1c16', accent: '#9dffc9', moon: true },
  forest: { sky: ['#06100c', '#12301f', '#22503a'], hills: ['#0f2016', '#0a160f'], ground: ['#24402a', '#08120a'], trees: '#06100a', accent: '#d8ff8a', dense: true },
  snow:   { sky: ['#0a1428', '#28406a', '#7a90b8'], hills: ['#5d667f', '#3b4258'], ground: ['#c9d6ea', '#5a6a88'], trees: '#1a2a3a', accent: '#e8fffb', snow: true, moon: true },
  ash:    { sky: ['#120404', '#3a0e08', '#8a2a10'], hills: ['#2a1210', '#1a0806'], ground: ['#3a2a2a', '#0a0505'], trees: '#120808', accent: '#ff8a3d', dead: true },
  shore:  { sky: ['#081430', '#1d3a6a', '#c4683a'], hills: ['#1a2a4a', '#10182c'], ground: ['#a8946a', '#2a2418'], trees: '#0f1a24', accent: '#9fe8ff', sea: true },
};

export function fieldBackdrop(scene, w, h, kind = 'meadow') {
  const key = `fieldbg:${kind}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const L = FIELD[kind] || FIELD.meadow;
  const rng = mulberry32(kind.length * 7919);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const floorY = h * 0.72;

  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, L.sky[0]], [0.6, L.sky[1]], [1, L.sky[2]]]);
  ctx.fillRect(0, 0, w, floorY);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`; ctx.fillRect(rng() * w, rng() * floorY * 0.5, 1.4, 1.4); }
  if (L.moon) {
    const mx = w * 0.78, my = h * 0.16;
    const g = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
    g.addColorStop(0, 'rgba(230,240,255,.35)'); g.addColorStop(1, 'rgba(230,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - 120, my - 120, 240, 240);
    ctx.fillStyle = '#eef4fc'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(160,170,200,.35)'; ctx.beginPath(); ctx.arc(mx - 8, my - 5, 6, 0, 7); ctx.arc(mx + 9, my + 7, 4, 0, 7); ctx.fill();
  }
  if (kind === 'ash') {
    // Izzó felhők
    for (let i = 0; i < 8; i++) {
      const x = rng() * w, y = h * (0.1 + rng() * 0.3);
      const g = ctx.createRadialGradient(x, y, 4, x, y, 160);
      g.addColorStop(0, 'rgba(255,90,30,.18)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320);
    }
  }
  // Hegyek két rétegben
  L.hills.forEach((col, li) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, floorY);
    for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 60 - li * -30 - Math.abs(Math.sin(x / (160 - li * 40) + li)) * (110 - li * 40) - rng() * 12);
    ctx.lineTo(w, floorY); ctx.closePath(); ctx.fill();
    if (L.snow && li === 0) {
      ctx.fillStyle = 'rgba(238,244,252,.5)';
      for (let x = 20; x < w; x += 90) { ctx.beginPath(); ctx.ellipse(x + rng() * 40, floorY - 120 - rng() * 30, 30, 8, 0, 0, 7); ctx.fill(); }
    }
  });
  if (L.sea) {
    ctx.fillStyle = vgrad(ctx, floorY - 40, floorY, [[0, '#23537f'], [1, '#14304d']]);
    ctx.fillRect(0, floorY - 40, w, 40);
    ctx.strokeStyle = 'rgba(200,230,255,.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const x = rng() * w, y = floorY - 36 + rng() * 32; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 3, x + 20, y); ctx.stroke(); }
  }
  // Fasor sziluettje
  const treeLine = (y0, scale, col, count) => {
    ctx.fillStyle = col;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * w + rng() * 30, hh = (50 + rng() * 60) * scale;
      if (L.dead) {
        ctx.strokeStyle = col; ctx.lineWidth = 3 * scale; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - hh); ctx.moveTo(x, y0 - hh * 0.6); ctx.lineTo(x + 14 * scale, y0 - hh * 0.85); ctx.moveTo(x, y0 - hh * 0.45); ctx.lineTo(x - 12 * scale, y0 - hh * 0.7); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x, y0 - hh); ctx.lineTo(x + 16 * scale, y0); ctx.lineTo(x - 16 * scale, y0); ctx.closePath(); ctx.fill();
        if (L.snow) { ctx.fillStyle = 'rgba(238,244,252,.6)'; ctx.beginPath(); ctx.moveTo(x, y0 - hh); ctx.lineTo(x + 6 * scale, y0 - hh * 0.6); ctx.lineTo(x - 6 * scale, y0 - hh * 0.6); ctx.fill(); ctx.fillStyle = col; }
      }
    }
  };
  if (!L.sea) treeLine(floorY - 6, 0.7, L.hills[1], L.dense ? 40 : 18);
  // Talaj
  ctx.fillStyle = vgrad(ctx, floorY - 14, h, [[0, L.ground[0]], [1, L.ground[1]]]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 110) * 6);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  speckle(ctx, 0, floorY, w, h - floorY, ['rgba(0,0,0,.22)', 'rgba(255,255,255,.06)'], 160, rng, 1, 3);
  if (kind === 'ash') {
    ctx.strokeStyle = 'rgba(255,140,60,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { let x = rng() * w, y = floorY + rng() * (h - floorY) * 0.6; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 14 + rng() * 14; y += (rng() - 0.5) * 10; ctx.lineTo(x, y); } ctx.stroke(); }
  }
  // Előtér: fák/kövek a két szélén (keretezés)
  for (const side of [0, 1]) for (let i = 0; i < 3; i++) {
    const x = side ? w - 14 - i * 46 - rng() * 20 : 14 + i * 46 + rng() * 20;
    const hh = (h * 0.42) - i * 40;
    ctx.fillStyle = L.trees; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    if (L.dead || L.sea) {
      ctx.beginPath(); ctx.moveTo(x - 24, h); ctx.lineTo(x - 10, h - hh * 0.4); ctx.lineTo(x + 12, h - hh * 0.3); ctx.lineTo(x + 26, h); ctx.closePath(); ctx.fill();
    } else {
      for (let t = 0; t < 3; t++) {
        const top = h - hh + t * hh * 0.25, half = 18 + t * 10;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + half, top + hh * 0.36); ctx.lineTo(x - half, top + hh * 0.36); ctx.closePath(); ctx.fill();
      }
    }
  }
  // Köd, vignetta
  ctx.fillStyle = hexA(L.accent, 0.05);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(rng() * w, floorY + rng() * 40, 220, 30, 0, 0, 7); ctx.fill(); }
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
