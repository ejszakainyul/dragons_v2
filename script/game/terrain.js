/* =====================================================================
   Hegycsúcsok — a hegyvidék „kiemelkedik" a síkból
   ---------------------------------------------------------------------
   Árnyalt, többcsúcsú gerincek (havasak északon, izzó repedésesek a
   hamuvidéken). Minden változat EGY textúralapon van (képkockákként),
   így a Phaser egy kötegben rajzolja őket.
   ===================================================================== */
import { B, TILE } from './world.js';
import { mulberry32 } from './rules.js';

const PEAK_SIZES = [[112, 92], [150, 118], [88, 70]];
const PEAK_VARIANTS = 3;                          // méretenként ennyi különböző rajz
const PEAK_STYLE = {
  rock: { lit: ['#9aa0b4', '#6a7088'], dark: ['#4d536b', '#2b2f42'], grain: ['rgba(30,34,52,.35)', 'rgba(220,226,240,.18)'], cap: null },
  snow: { lit: ['#a3acc4', '#737d98'], dark: ['#566080', '#333a54'], grain: ['rgba(30,34,52,.3)', 'rgba(230,236,250,.2)'], cap: ['#f6f9ff', '#aebcd8'] },
  ash:  { lit: ['#5e5052', '#3a3133'], dark: ['#2e2628', '#151012'], grain: ['rgba(0,0,0,.4)', 'rgba(255,160,110,.08)'], cap: null, glow: '#ff7a3d' },
};

/**
 * Hegyvonulat-darab 1–3 csúccsal. Minden csúcsnak napos (bal) és
 * árnyékos (jobb) lapja van; rajta sziklarétegek, hó vagy izzó repedés.
 */
function drawPeak(ctx, w, h, style, rng) {
  const base = h - 2;
  // Csúcsok: x és magasság (a középső a legmagasabb)
  const n = 1 + Math.floor(rng() * 3);
  const summits = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.2 + (0.6 * i) / (n - 1) + (rng() - 0.5) * 0.08;
    const main = n === 1 || i === Math.floor(n / 2);
    summits.push({ x: w * t, y: main ? 3 + rng() * 6 : h * (0.28 + rng() * 0.18) });
  }
  // Körvonal: talp → csúcsok és nyergek csipkés szakaszokkal → talp
  const pts = [[0, base]];
  const jag = (x0, y0, x1, y1, k) => {
    for (let s = 1; s < k; s++) {
      const t = s / k;
      pts.push([x0 + (x1 - x0) * t + (rng() - 0.5) * 4, y0 + (y1 - y0) * t + (rng() - 0.35) * 6]);
    }
    pts.push([x1, y1]);
  };
  let px = 0, py = base;
  summits.forEach((sm, i) => {
    jag(px, py, sm.x, sm.y, 4);
    const next = summits[i + 1];
    if (next) {
      const sx = (sm.x + next.x) / 2 + (rng() - 0.5) * 8;
      const sy = Math.max(sm.y, next.y) + h * (0.12 + rng() * 0.1);
      jag(sm.x, sm.y, sx, sy, 3);
      px = sx; py = sy;
    } else { px = sm.x; py = sm.y; }
  });
  jag(px, py, w, base, 4);
  const outline = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const grad = (stops, y0 = 0) => {
    const g = ctx.createLinearGradient(0, y0, 0, base);
    g.addColorStop(0, stops[0]); g.addColorStop(1, stops[1]);
    return g;
  };

  ctx.save();
  outline(); ctx.clip();
  // Az egész tömb árnyékban…
  ctx.fillStyle = grad(style.dark); ctx.fillRect(0, 0, w, h);
  // …a csúcsok bal (északnyugati) oldala napos: a csúcstól a talpig húzott gerinc balra
  const spines = summits.map((sm) => ({ top: sm, foot: sm.x + (rng() * 0.25 + 0.05) * w * 0.4 }));
  spines.forEach(({ top, foot }) => {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    const mid = [top.x + (foot - top.x) * 0.5 + (rng() - 0.5) * 6, top.y + (base - top.y) * 0.5];
    ctx.lineTo(mid[0], mid[1]);
    ctx.lineTo(foot, base);
    ctx.lineTo(Math.max(0, top.x - w * 0.9), base);
    ctx.lineTo(Math.max(0, top.x - w * 0.9), top.y);
    ctx.closePath();
    ctx.fillStyle = grad(style.lit, top.y);
    ctx.fill();
  });
  // Sziklaszemcse: rövid, lejtőirányú vonások és foltok
  for (let i = 0; i < w * h / 55; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.strokeStyle = style.grain[rng() < 0.6 ? 0 : 1];
    ctx.lineWidth = 0.8 + rng() * 1.2;
    const dir = rng() < 0.5 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * (3 + rng() * 6), y + 4 + rng() * 8); ctx.stroke();
  }
  // Vízmosások: a csúcsokból lefutó sötét erek
  ctx.strokeStyle = style.grain[0]; ctx.lineCap = 'round';
  spines.forEach(({ top }) => {
    for (let k = 0; k < 3; k++) {
      let x = top.x + (rng() - 0.5) * 18, y = top.y + 8 + rng() * 10;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < base - 4) { x += (rng() - 0.5) * 7; y += 5 + rng() * 6; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  // Hósapka: a csúcsok körül, csipkés alsó széllel; a napos fele fehérebb
  if (style.cap) {
    summits.forEach((sm, i) => {
      const capH = (base - sm.y) * (0.26 + rng() * 0.14);
      const left = sm.x - capH * 1.2, right = sm.x + capH * 1.25;
      const sp = spines[i].top.x + (spines[i].foot - spines[i].top.x) * 0.35;
      for (const [x0, x1, col] of [[left - 4, sp, style.cap[0]], [sp, right + 4, style.cap[1]]]) {
        ctx.beginPath();
        ctx.moveTo(sm.x, sm.y - 2);
        const steps = 5;
        for (let k = 0; k <= steps; k++) {
          const x = x0 + (x1 - x0) * (k / steps);
          const reach = 1 - Math.abs(x - sm.x) / (capH * 1.3);
          ctx.lineTo(x, sm.y + capH * Math.max(0.15, reach) + (k % 2 ? 5 + rng() * 6 : -rng() * 4));
        }
        ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
      }
    });
  }
  // Izzó repedések a hamuvidéken
  if (style.glow) {
    ctx.strokeStyle = style.glow; ctx.lineWidth = 1.6; ctx.shadowColor = style.glow; ctx.shadowBlur = 6;
    summits.forEach((sm) => {
      let x = sm.x + (rng() - 0.5) * 10, y = sm.y + (base - sm.y) * (0.3 + rng() * 0.2);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 12; y += 6 + rng() * 6; ctx.lineTo(x, Math.min(base - 2, y)); }
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }
  // Talp: lágy átmenet a talajba (a domborzati réteg folytatja)
  const fade = ctx.createLinearGradient(0, base - 14, 0, base);
  fade.addColorStop(0, 'rgba(10,14,26,0)'); fade.addColorStop(1, 'rgba(10,14,26,.35)');
  ctx.fillStyle = fade; ctx.fillRect(0, base - 14, w, 14);
  ctx.restore();

  // Halvány gerincfény a napos élen
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.2;
  spines.forEach(({ top }) => {
    ctx.beginPath(); ctx.moveTo(top.x - 1, top.y + 1); ctx.lineTo(top.x - (base - top.y) * 0.32, top.y + (base - top.y) * 0.4); ctx.stroke();
  });
}

/** A csúcs-textúrák egy lapon: három vidék × három méret × néhány változat. */
export function buildPeaks(scene) {
  if (scene.textures.exists('peaks')) return;
  const rng = mulberry32(9090);
  const kinds = Object.keys(PEAK_STYLE);
  const cellW = Math.max(...PEAK_SIZES.map(([w]) => w)) + 4, cellH = Math.max(...PEAK_SIZES.map(([, h]) => h)) + 4;
  const cols = PEAK_SIZES.length * PEAK_VARIANTS;
  const sheet = document.createElement('canvas');
  sheet.width = cols * cellW; sheet.height = kinds.length * cellH;
  const ctx = sheet.getContext('2d');
  const frames = [];
  kinds.forEach((kind, row) => PEAK_SIZES.forEach(([w, h], v) => {
    for (let k = 0; k < PEAK_VARIANTS; k++) {
      const x = (v * PEAK_VARIANTS + k) * cellW, y = row * cellH;
      ctx.save(); ctx.translate(x, y);
      drawPeak(ctx, w, h, PEAK_STYLE[kind], rng);
      ctx.restore();
      frames.push([`${kind}${v}-${k}`, x, y, w, h]);
    }
  }));
  const tex = scene.textures.addCanvas('peaks', sheet);
  for (const [name, x, y, w, h] of frames) tex.add(name, 0, x, y, w, h);
}

/**
 * Hová kerüljön csúcs: a hegyvidék belsejébe, ahol észak felé is hegy van —
 * így a csúcs sosem takar el járható csempét (és a játékost).
 */
export function peakSpots(world) {
  const { w: W, h: H, biome, height } = world;
  const rng = mulberry32(world.seed + 31);
  const mt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || biome[y * W + x] === B.MOUNTAIN;
  const nearPoi = (x, y) => world.pois.some((p) => Math.abs(p.x - x) <= 2 && y - p.y <= 1 && p.y - y <= 5);
  const out = [];
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    if (!mt(x, y) || !mt(x, y + 1) || !mt(x, y - 1) || !mt(x, y - 2) || !mt(x - 1, y) || !mt(x + 1, y)) continue;
    if (nearPoi(x, y)) continue;
    const i = y * W + x;
    const hgt = height[i];
    if (rng() > 0.26 + Math.min(0.3, (hgt - 0.9) * 0.2)) continue;
    const big = mt(x, y - 3) && hgt > 1.3 && rng() < 0.45;
    out.push({
      x: x * TILE + TILE / 2 + (rng() - 0.5) * 22,
      y: (y + 1) * TILE - 2 + (rng() - 0.5) * 10,
      kind: world.ashy[i] ? 'ash' : world.snowy[i] || hgt > 2.1 ? 'snow' : 'rock',
      v: big ? 1 : rng() < 0.4 ? 2 : 0,
      k: Math.floor(rng() * PEAK_VARIANTS),
      scale: 0.95 + rng() * 0.45,
    });
  }
  return out;
}
