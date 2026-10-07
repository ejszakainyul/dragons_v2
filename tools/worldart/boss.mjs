/* =====================================================================
   Níðhöggr részei a közös renderelővel (a régi kódrajz helyett).
   A képek mérete és az illesztési pontok ugyanazok, mint a
   script/game/boss.js PARTS táblájában — a nézet és az animáció
   változatlan. Itt minden koordináta KÉPPONT (egység = 2 px).
   ===================================================================== */
import { tube as T0, ell as E0, sheet as S0, horn as H0 } from '../dragonart/lib.mjs';
import { mulberry32 } from './rng.mjs';

export const BOSS_MATS = {
  nidHide:  { col: [86, 66, 120], bump: 'scales', amp: 0.16, spec: 0.3, shin: 34 },
  nidDark:  { col: [58, 44, 82], bump: 'scales', amp: 0.14, spec: 0.25, shin: 30 },
  nidBelly: { col: [132, 110, 82], bump: 'plates', amp: 0.25, spec: 0.2, shin: 24 },
  nidMem:   { col: [84, 62, 112], bump: 'veins', amp: 0.06, spec: 0.12, shin: 14 },
  nidMemF:  { col: [52, 40, 70], bump: 'veins', amp: 0.06, spec: 0.08, shin: 12 },
  nidBone:  { col: [232, 222, 196], tip: [120, 108, 88], bump: 'rings', amp: 0.08, spec: 0.35, shin: 36 },
  nidBoneF: { col: [150, 140, 118], tip: [80, 72, 60], bump: 'rings', amp: 0.08, spec: 0.2, shin: 30 },
  nidClaw:  { col: [40, 34, 38], tip: [16, 14, 16], spec: 0.6, shin: 60 },
  nidVein:  { col: [214, 160, 255], emis: 1, glow: [184, 116, 255], glowK: 0.9 },
  nidEye:   { col: [255, 222, 120], emis: 1, glow: [255, 200, 90], glowK: 1 },
  nidEmber: { col: [255, 150, 70], emis: 1, glow: [255, 120, 50], glowK: 0.8 },
  nidRoot:  { col: [62, 42, 40], bump: 'bark', amp: 0.4, spec: 0.06, shin: 10 },
};

/* --- képpontos segédek (px → egység) --- */
const P = ([x, y]) => [x / 2, y / 2];
const tube = (pts, r, mat, o = {}) => T0(pts.map(P), Array.isArray(r) ? r.map((v) => v / 2) : r / 2, mat, { smooth: 0, ...o });
const ell = (x, y, rx, ry, rot, mat, o = {}) => E0(x / 2, y / 2, rx / 2, ry / 2, rot, mat, { smooth: 0, ...o, ...(o.rz != null ? { rz: o.rz / 2 } : {}) });
const sheet = (poly, mat, o = {}) => S0(poly.map(P), mat, o);
const horn = (b, t, w, bend, mat = 'nidBone', o = {}) => H0(P(b), P(t), w / 2, bend, mat, o);
const bez = (p, t) => { const u = 1 - t; return [0, 1].map((j) => u * u * u * p[0][j] + 3 * u * u * t * p[1][j] + 3 * u * t * t * p[2][j] + t * t * t * p[3][j]); };
const bezPts = (p, n = 7) => Array.from({ length: n }, (_, i) => bez(p, i / (n - 1)));
const lerp = (a, b, t) => a + (b - a) * t;

/** Izzó gyökérerek: véletlen bolyongás egy ellipszisen belül, a felszín fölött. */
function veins(rng, cx, cy, rx, ry, count, z, len = 8) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let a = rng() * Math.PI * 2, x = cx + (rng() - 0.5) * rx, y = cy + (rng() - 0.5) * ry;
    const pts = [[x, y]];
    for (let k = 0; k < len; k++) {
      a += (rng() - 0.5) * 0.9;
      const nx = x + Math.cos(a) * 10, ny = y + Math.sin(a) * 10;
      if (((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 > 0.85) break;
      x = nx; y = ny; pts.push([x, y]);
    }
    if (pts.length > 2) out.push(tube(pts, [2.4, 1.4], 'nidVein', { z }));
  }
  return out;
}

/* --- Szárny (480×410) ------------------------------------------------- */
function wing(near) {
  const rng = mulberry32(near ? 61 : 67);
  const R = [70, 360], E = [200, 170], Wr = [320, 70];
  const F = [[475, 30], [470, 170], [420, 290], [320, 360]];
  const poly = [R, E, Wr, F[0]];
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], b = F[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, pull = 0.32 + rng() * 0.1;
    const c = [mx + (Wr[0] - mx) * pull, my + (Wr[1] - my) * pull];
    for (let s = 1; s <= 4; s++) {
      const t = s / 4, u = 1 - t;
      poly.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0] + (s < 4 ? (rng() - 0.5) * 14 : 0), u * u * a[1] + 2 * u * t * c[1] + t * t * b[1] + (s < 4 ? (rng() - 0.5) * 14 : 0)]);
    }
  }
  poly.push([210, 392], [R[0] + 12, R[1] + 4]);
  const mem = near ? 'nidMem' : 'nidMemF', bone = near ? 'nidBone' : 'nidBoneF';
  const out = [sheet(poly, mem, { bulge: 2.2, fall: 14 })];
  const z = 3;
  out.push(tube([R, E], [12, 9], bone, { z }), tube([E, Wr], [9, 6], bone, { z }));
  out.push(ell(E[0], E[1], 12, 12, 0, bone, { z, rz: 10 }), ell(Wr[0], Wr[1], 9, 9, 0, bone, { z, rz: 8 }));
  for (const f of F) out.push(tube([Wr, [lerp(Wr[0], f[0], 0.5) + 6, lerp(Wr[1], f[1], 0.5) - 4], f], [4.5, 3.4, 1.6], bone, { z: z - 1 }));
  out.push(horn([Wr[0] - 4, Wr[1] - 6], [Wr[0] - 34, Wr[1] - 40], 12, -0.35, bone, { z: z + 2 }));
  if (near) out.push(...veins(rng, 270, 230, 120, 80, 5, 3.4, 8));
  // kiszakadt lyukak (a renderelés után vágjuk ki)
  const holes = [];
  for (let i = 0; i < (near ? 4 : 3); i++) {
    const hx = 230 + rng() * 180, hy = 150 + rng() * 160, r = 8 + rng() * 14, pts = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; pts.push([hx + Math.cos(a) * r * (0.6 + rng() * 0.6), hy + Math.sin(a) * r * (0.6 + rng() * 0.6)]); }
    holes.push(pts);
  }
  return { w: 480, h: 410, prims: out, holes };
}

/* --- Test + hátsó láb (440×340, talaj y=332) ------------------------- */
function body() {
  const rng = mulberry32(71);
  const out = [];
  // törzs: a mellkas balra, a csípő jobbra
  out.push(tube([[100, 185], [170, 150], [260, 150], [350, 180]], [86, 98, 92, 70], 'nidHide', { zs: 0.85 }));
  out.push(ell(140, 165, 72, 88, 0.2, 'nidHide', { rz: 70 }), ell(150, 108, 64, 44, -0.2, 'nidHide', { z: 14, rz: 50 }));
  // hasi lemezek az alsó ív mentén
  for (let i = 0; i < 9; i++) {
    const t = i / 8, [x, y] = bez([[95, 236], [150, 272], [260, 280], [340, 250]], t);
    out.push(ell(x, y, 22, 12, -0.25 + t * 0.6, 'nidBelly', { z: 26, rz: 8 }));
  }
  out.push(...veins(rng, 230, 160, 150, 80, 9, 44, 10));
  // háttüskék a gerinc mentén
  for (let i = 0; i < 9; i++) {
    const t = 0.05 + i * 0.11, [x, y] = bez([[120, 74], [190, 50], [270, 76], [395, 166]], t), s = 40 - i * 2.8;
    out.push(horn([x, y + 10], [x + s * 0.6, y - s * 1.1], s * 0.55, 0.15, 'nidBone', { z: 30 }));
  }
  // hátsó láb: comb, lábszár, talp, karmok
  out.push(tube([[335, 205], [360, 250], [345, 290], [330, 318]], [26, 18, 14, 12], 'nidDark', { z: 46 }));
  out.push(ell(335, 200, 66, 62, -0.3, 'nidHide', { z: 40, rz: 40 }));
  out.push(...veins(rng, 335, 200, 55, 50, 2, 62, 6));
  out.push(ell(322, 320, 40, 13, 0, 'nidDark', { z: 58, rz: 12 }));
  for (let k = 0; k < 3; k++) out.push(horn([298 + k * 14, 324], [268 + k * 14, 334], 11, 0.3, 'nidClaw', { z: 66 }));
  return { w: 440, h: 340, prims: out };
}

/* --- Farok (360×300) --------------------------------------------------- */
function tail() {
  const curve = [[20, 110], [160, 60], [290, 150], [250, 270]];
  const pts = bezPts(curve, 9);
  const out = [tube(pts, [46, 40, 33, 27, 22, 17, 13, 10, 8], 'nidHide')];
  for (let i = 1; i < 8; i++) {
    const t = i / 9 + 0.03, [x, y] = bez(curve, t), r = lerp(44, 10, t);
    const [x2, y2] = bez(curve, t + 0.01), dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
    out.push(horn([x + nx * r * 0.6, y + ny * r * 0.6], [x + nx * r * 1.55 + dx / l * r * 0.4, y + ny * r * 1.55 + dy / l * r * 0.4], r * 0.55, 0.1, 'nidBone', { z: 10 }));
  }
  const [ex, ey] = bez(curve, 1);
  out.push(horn([ex, ey], [ex - 54, ey + 6], 26, -0.35, 'nidBone', { z: 8 }), horn([ex, ey], [ex + 20, ey - 40], 18, 0.3, 'nidBone', { z: 8 }));
  out.push(...veins(mulberry32(81), 140, 100, 110, 40, 3, 34, 7));
  return { w: 360, h: 300, prims: out };
}

/* --- Mellső láb (190×250, talaj y=242) -------------------------------- */
function foreleg() {
  const out = [];
  out.push(tube([[0, 238], [60, 226], [120, 246], [190, 232]], 6, 'nidRoot', { z: 0 }));
  out.push(tube([[0, 236], [60, 224], [120, 244], [190, 230]], 1.6, 'nidVein', { z: 3.5 }));
  out.push(tube(bezPts([[120, 20], [150, 90], [80, 140], [95, 222]], 6), [36, 30, 24, 21, 20, 20], 'nidHide', { z: 4 }));
  out.push(ell(118, 40, 42, 40, 0, 'nidHide', { z: 6, rz: 34 }));
  out.push(...veins(mulberry32(91), 118, 50, 34, 34, 2, 40, 5));
  out.push(ell(92, 228, 34, 14, 0, 'nidDark', { z: 22, rz: 12 }));
  for (let k = 0; k < 4; k++) out.push(horn([70 + k * 12, 232], [34 + k * 12, 246 - (k % 2) * 4], 12, 0.35, 'nidClaw', { z: 30 }));
  return { w: 190, h: 250, prims: out };
}

/* --- Nyak (240×260; a tő jobbra lent, a fej felé balra fent) -------- */
function neck() {
  const curve = [[205, 230], [150, 235], [150, 70], [52, 52]];
  const pts = bezPts(curve, 8);
  const out = [tube(pts, [58, 55, 51, 47, 43, 39, 36, 34], 'nidHide', { fade: [128, 108] })];   // a tő a testbe olvad
  for (let i = 1; i < 8; i++) {
    const t = i / 8, [x, y] = bez(curve, t), r = lerp(58, 34, t);
    out.push(ell(x - r * 0.45, y + r * 0.5, r * 0.34, r * 0.17, -0.6, 'nidBelly', { z: r * 0.75, rz: 5 }));
    if (i % 2 === 0) out.push(horn([x + r * 0.3, y - r * 0.7], [x + r * 0.95, y - r * 1.5], r * 0.42, 0.2, 'nidBone', { z: r * 0.4 }));
  }
  out.push(...veins(mulberry32(101), 150, 150, 60, 80, 4, 44, 7));
  return { w: 240, h: 260, prims: out };
}

/* --- Fej (360×210, balra néz; nyak-illesztés 262,120) ---------------- */
function head() {
  const rng = mulberry32(111);
  const out = [];
  // szarvkorona a koponya mögött
  const crown = [[[230, 72], [352, 10], 26, 0.18], [[240, 92], [356, 70], 22, 0.12], [[215, 60], [300, 0], 22, 0.25], [[250, 112], [350, 140], 20, -0.15], [[190, 58], [228, 6], 16, 0.3]];
  for (const [b, t, w, bend] of crown) out.push(horn(b, t, w, bend, 'nidBone', { z: -4 }));
  // koponya: hosszú, keskeny pofa + domború koponyatető
  out.push(tube([[262, 100], [200, 96], [130, 98], [60, 108], [18, 113]], [36, 36, 26, 16, 9], 'nidHide'));
  out.push(ell(212, 94, 54, 38, 0.1, 'nidHide', { rz: 30 }));
  out.push(tube([[40, 106], [140, 97], [236, 110]], 3, 'nidDark', { z: 18 }));   // pofacsont-gerinc
  for (let k = 0; k < 4; k++) out.push(horn([120 + k * 22, 74 - k * 3], [140 + k * 24, 42 - k * 6], 10, 0.2, 'nidBone', { z: 14 }));
  // három pár izzó szem
  for (let k = 0; k < 3; k++) {
    const ex = 118 + k * 30, ey = 86 + k * 4, r = 7 - k;
    out.push(ell(ex, ey, r + 5, r + 2.5, -0.2, 'dark', { z: 16 + k, rz: 2 }));
    out.push(ell(ex, ey, r + 1.5, r - 1, -0.2, 'nidEye', { z: 19 + k, rz: 2 }));
    out.push(ell(ex, ey, 1.6, r - 1.5, 0, 'dark', { z: 21 + k, rz: 0.6 }));
  }
  out.push(ell(32, 106, 7, 3.5, -0.3, 'dark', { z: 9 }), ell(32, 106, 3, 1.6, -0.3, 'nidEmber', { z: 10 }));
  // felső fogsor (a pofa alól lefelé)
  for (let x = 24; x < 200; x += 11 + rng() * 5) {
    const y = 104 + (x - 14) * (28 / 190) + 12, long = x < 60 || rng() < 0.25;
    out.push(horn([x, y - 2], [x - 2, y + (long ? 24 : 14)], long ? 8 : 6, 0.1, 'tooth', { z: 4 }));
  }
  for (let k = 0; k < 3; k++) out.push(horn([238 + k * 6, 124 + k * 6], [276 + k * 18, 156 + k * 14], 14 - k * 2, -0.2, 'nidBone', { z: 2 }));
  out.push(...veins(rng, 210, 96, 44, 30, 2, 34, 5));
  return { w: 360, h: 210, prims: out };
}

/* --- Állkapocs (230×100; csukló 212,16) ------------------------------- */
function jaw() {
  const rng = mulberry32(121);
  const out = [];
  for (let x = 30; x < 196; x += 12 + rng() * 5) {
    const long = x < 56 || rng() < 0.2;
    out.push(horn([x, 26], [x + 2, long ? 0 : 8], long ? 8 : 6, -0.1, 'tooth', { z: 1 }));
  }
  out.push(tube([[30, 22], [120, 20], [210, 18]], 4, 'mouth', { z: 4 }));
  out.push(tube([[206, 32], [160, 38], [90, 38], [40, 32], [16, 28]], [18, 19, 16, 12, 8], 'nidDark', { z: 2 }));
  for (let k = 0; k < 3; k++) out.push(horn([90 + k * 36, 50], [104 + k * 36, 64], 7, -0.2, 'nidBone', { z: 10 }));
  return { w: 230, h: 100, prims: out };
}

export function bossSprites() {
  return {
    'boss-wing-far': wing(false), 'boss-wing-near': wing(true), 'boss-tail': tail(), 'boss-body': body(),
    'boss-foreleg': foreleg(), 'boss-neck': neck(), 'boss-head': head(), 'boss-jaw': jaw(),
  };
}
