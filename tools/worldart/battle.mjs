/* =====================================================================
   A csatahátterek darabjai — ugyanazzal a fénymodellel, mint a sárkányok
   és a völgy tárgyai. A játék (script/game/backdrops.js) a képernyő
   méretéhez igazítva rakja össze őket: sziklakulisszák, cseppkövek,
   kristályok, fák, hegyláncok, kerítés, fáklyák.
   Egység = 2 képpont (a nagyított fák/kövek: 2 × k).
   ===================================================================== */
import { tube, ell, sheet, prism, shard, shift } from '../dragonart/lib.mjs';
import { mulberry32 } from './rng.mjs';
import { natureSprites } from './nature.mjs';
import { peak } from './peaks.mjs';

const U = 2;

/* Barlang-témák: a kőzet színe és a témához tartozó díszanyag. */
export const CAVE_THEMES = ['moss', 'ice', 'amethyst', 'lava', 'roots'];
export const BMATS = {
  caveMoss:  { col: [78, 98, 84], bump: 'rock', amp: 0.8, spec: 0.12, shin: 18 },
  caveIce:   { col: [98, 128, 162], bump: 'rock', amp: 0.7, spec: 0.3, shin: 30 },
  caveAmy:   { col: [84, 72, 112], bump: 'rock', amp: 0.8, spec: 0.16, shin: 22 },
  caveLava:  { col: [70, 52, 50], bump: 'rock', amp: 0.8, spec: 0.18, shin: 24 },
  caveRoot:  { col: [92, 80, 76], bump: 'rock', amp: 0.8, spec: 0.1, shin: 16 },
  mossG:     { col: [84, 150, 92], bump: 'leaves', amp: 0.5, spec: 0.05, shin: 8 },
  shroom:    { col: [150, 255, 205], spec: 0.5, shin: 40, glow: [120, 255, 190], glowK: 0.7 },
  dropG:     { col: [170, 255, 215], emis: 1, glow: [120, 255, 190], glowK: 0.9 },
  amy:       { col: [186, 132, 250], spec: 1.0, shin: 90, facet: true, glow: [190, 140, 255], glowK: 0.4 },
  iceC:      { col: [196, 236, 255], spec: 1.0, shin: 90, facet: true, glow: [160, 225, 255], glowK: 0.3 },
  runeV:     { col: [236, 210, 255], emis: 1, glow: [190, 140, 255], glowK: 1 },
  lavaW:     { col: [255, 150, 50], emis: 1, glow: [255, 110, 30], glowK: 0.9 },
  sap:       { col: [255, 216, 110], emis: 1, glow: [255, 200, 90], glowK: 0.7 },
  root:      { col: [92, 68, 54], bump: 'bark', amp: 0.4, spec: 0.06, shin: 10 },
  moon:      { col: [236, 240, 250], bump: 'noise', amp: 0.2, spec: 0.05, shin: 10 },
  moonDark:  { col: [176, 184, 204], bump: 'noise', amp: 0.2, spec: 0.05, shin: 10 },
  flame:     { col: [255, 214, 120], emis: 1, glow: [255, 160, 60], glowK: 1 },
};
const ROCK = { moss: 'caveMoss', ice: 'caveIce', amethyst: 'caveAmy', lava: 'caveLava', roots: 'caveRoot' };

/** Szabálytalan sokszög egy ellipszis mentén. */
function blob(cx, cy, rx, ry, n, rng, j = 0.25, W = 1e9, H = 1e9) {
  const pts = [];
  const a0 = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.4, k = 1 - j + rng() * j * 2;
    pts.push([Math.min(W - 0.5, Math.max(0.5, cx + Math.cos(a) * rx * k)), Math.min(H - 0.5, Math.max(0.5, cy + Math.sin(a) * ry * k))]);
  }
  return pts;
}

/** Sziklatömb: egymásra torlódó, csiszolt lapú kőhasábok (a barlangfalak építőköve). */
function rockChunk(W, H, mat, rng, extra = []) {
  const out = [ell(W / 2, H * 0.55, W * 0.4, H * 0.36, (rng() - 0.5) * 0.3, mat, { rz: Math.min(W, H) * 0.22, smooth: 0 })];
  const n = 8 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const rw = W * (0.14 + rng() * 0.16), rh = H * (0.14 + rng() * 0.2);
    const bx = rw + rng() * (W - 2 * rw), by = rh + rng() * (H - 2 * rh);
    const poly = blob(bx, by, rw, rh, 6 + Math.floor(rng() * 3), rng, 0.22, W, H);
    const a = rng() * Math.PI * 2, l = Math.min(rw, rh) * 0.5;
    out.push(prism(poly, [[bx - Math.cos(a) * l, by - Math.sin(a) * l], [bx + Math.cos(a) * l, by + Math.sin(a) * l]], mat,
      { z: 2 + rng() * 6 + (by / H) * 3, h: Math.min(rw, rh) * (0.6 + rng() * 0.4), smooth: 0, scale: 0.7 }));
  }
  return [...out, ...extra];
}

/** Lefelé lógó cseppkő / jégcsap / gyökérszál. */
function hanging(theme, v) {
  const rng = mulberry32(400 + v * 17 + theme.length * 3);
  const W = 26, H = 80, cx = W / 2, L = 46 + v * 12 + rng() * 10, mat = ROCK[theme];
  const out = [];
  if (theme === 'ice') {
    const icicle = (x, w, l, z) => { const tx = x + (rng() - 0.5) * 2; return prism([[x - w / 2, -1], [x + w / 2, -1], [x + w * 0.22, l * 0.45], [tx, l], [x - w * 0.22, l * 0.5]], [[x - w * 0.1, -1], [tx, l]], 'iceC', { z, h: w * 0.45, smooth: 0 }); };
    out.push(icicle(cx, 10, L, 0), icicle(cx - 6, 6, L * 0.5, 1), icicle(cx + 6, 5, L * 0.38, 1));
  } else if (theme === 'roots') {
    const k = [[cx, 0], [cx + 4, L * 0.3], [cx - 3, L * 0.65], [cx + 2, L]];
    out.push(tube(k, [3.2, 2.2, 1.2, 0.3], 'root', { smooth: 0 }));
    out.push(tube([[cx + 2, L * 0.35], [cx + 8, L * 0.5], [cx + 9, L * 0.7]], [1.1, 0.6, 0.15], 'root', { smooth: 0, z: 1 }));
    out.push(tube([[cx + 1, 2], [cx + 4, L * 0.3], [cx - 2, L * 0.62]], [0.35, 0.3, 0.1], 'sap', { z: 2.8 }));
  } else {
    out.push(tube([[cx, -2], [cx + (rng() - 0.5) * 3, L * 0.5], [cx + (rng() - 0.5) * 2, L]], [6.5, 3.4, 0.35], mat, { smooth: 0, bump: 'rings', amp: 0.25 }));
    out.push(tube([[cx - 6, -1], [cx - 7, L * 0.35]], [3, 0.4], mat, { smooth: 0, z: -1 }));
    if (theme === 'moss') {
      out.push(sheet([[cx - 8, -1], [cx + 8, -1], [cx + 6, 8], [cx + 2, 6], [cx - 1, 12], [cx - 4, 7], [cx - 7, 9]], 'mossG', { z: 4.5, bulge: 1.4, fall: 2 }));
      out.push(ell(cx + (rng() - 0.5) * 2, L + 1.4, 1.3, 1.8, 0, 'dropG', { z: 1 }));
      out.push(tube([[cx + 4, 6], [cx + 6, L * 0.5], [cx + 5, L * 0.8]], [0.3, 0.25, 0.15], 'mossG', { z: 3.5 }), ell(cx + 5, L * 0.8 + 1, 0.9, 1.1, 0, 'dropG', { z: 3 }));
    }
    if (theme === 'lava') out.push(tube([[cx, 4], [cx + 1, L * 0.35], [cx - 0.5, L * 0.7]], [0.45, 0.35, 0.1], 'lavaW', { z: 6 }));
    if (theme === 'amethyst') out.push(shard([cx + 3, L * 0.3], [cx + 9, L * 0.48], 3, 'amy', { z: 3.4 }));
  }
  return { w: W * U, h: Math.ceil(H) * U, prims: out };
}

/** Felfelé álló cseppkő (padló). */
function standing(theme, v) {
  const rng = mulberry32(500 + v * 13 + theme.length);
  const W = 30, H = 56, G = H - 1, cx = W / 2, L = 30 + v * 14 + rng() * 6, mat = ROCK[theme];
  const out = [];
  if (theme === 'ice') out.push(shard([cx, G], [cx + (rng() - 0.5) * 3, G - L], 11, 'iceC', { h: 5 }), shard([cx - 6, G], [cx - 9, G - L * 0.5], 6, 'iceC', { z: 1.5, h: 3 }));
  else if (theme === 'amethyst') {
    out.push(ell(cx, G - 3, 11, 4, 0, mat, { rz: 4, smooth: 0 }));
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.32; out.push(shard([cx + (i - 2) * 2.4, G - 3], [cx + Math.cos(a) * L * (i === 2 ? 1 : 0.6), G - 3 + Math.sin(a) * L * (i === 2 ? 1 : 0.6)], i === 2 ? 8 : 5, 'amy', { z: 2 + (i % 2) * 2 })); }
  } else {
    out.push(tube([[cx, G + 1], [cx + (rng() - 0.5) * 2, G - L * 0.5], [cx + (rng() - 0.5) * 2, G - L]], [8, 4, 0.5], mat, { smooth: 0, bump: 'rings', amp: 0.25 }));
    out.push(tube([[cx - 8, G + 1], [cx - 9, G - L * 0.4]], [4, 0.5], mat, { smooth: 0, z: 1.5 }));
    if (theme === 'moss') out.push(sheet([[cx - 12, G], [cx - 6, G - 6], [cx + 1, G - 4], [cx + 7, G - 7], [cx + 12, G]], 'mossG', { z: 6, bulge: 1.5, fall: 2 }));
    if (theme === 'lava') out.push(tube([[cx - 1, G], [cx + 1, G - L * 0.4], [cx, G - L * 0.75]], [0.6, 0.4, 0.1], 'lavaW', { z: 7.5 }));
  }
  return { w: W * U, h: H * U, prims: out, shadow: [cx + 2, G - 0.5, 12, 2.2, 0.5] };
}

/** A témák saját díszei a csarnokban. */
function deco(theme, v) {
  const rng = mulberry32(600 + v * 31 + theme.length * 7), mat = ROCK[theme];
  if (theme === 'moss') {
    // világító gombacsokor mohás kövön
    const W = 56, H = 34, G = H - 1, out = [ell(W / 2, G - 4, 20, 6, 0, mat, { rz: 5, smooth: 0 }), sheet(blob(W / 2, G - 7, 18, 4, 9, rng, 0.2), 'mossG', { z: 4.6, bulge: 1, fall: 2 })];
    const caps = [[-10, 14, 5], [-3, 20, 6.5], [6, 16, 5], [13, 10, 3.5], [-15, 8, 3], [2, 9, 3]];
    caps.forEach(([dx, h, r], i) => {
      const x = W / 2 + dx;
      out.push(tube([[x, G - 4], [x + (rng() - 0.5) * 2, G - 4 - h]], [r * 0.24, r * 0.18], 'stem', { z: 5 + i * 0.2, smooth: 0 }));
      out.push(ell(x, G - 4 - h - r * 0.1, r, r * 0.5, 0, 'shroom', { z: 5.5 + i * 0.2, rz: r * 0.6 }));
    });
    return { w: W * U, h: H * U, prims: out, shadow: [W / 2 + 2, G - 0.5, 22, 2.5, 0.4] };
  }
  if (theme === 'ice' || theme === 'amethyst') {
    // kristályfürt
    const W = 60, H = 64, G = H - 1, cx = W / 2, cm = theme === 'ice' ? 'iceC' : 'amy';
    const out = [ell(cx, G - 4, 22, 6, 0, mat, { rz: 6, smooth: 0 })];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.27 + (rng() - 0.5) * 0.12, L = (i === 4 ? 52 : 18 + rng() * 28) * (1 - Math.abs(i - 4) * 0.06);
      const b = [cx + (i - 4) * 3.2, G - 4];
      out.push(shard(b, [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L], i === 4 ? 12 : 6 + rng() * 4, cm, { z: 3 + (i % 3) * 1.5, h: 3 + rng() * 2 }));
    }
    return { w: W * U, h: H * U, prims: out, shadow: [cx + 2, G - 0.5, 24, 2.5, 0.5] };
  }
  if (theme === 'lava') {
    // bazaltoszlopok izzó repedésekkel
    const W = 64, H = 90, G = H - 1, out = [];
    for (let i = 0; i < 6; i++) {
      const x = 7 + i * 10 + (rng() - 0.5) * 2, hh = 30 + rng() * 52 - Math.abs(i - 2.5) * 6, w2 = 4.6;
      out.push(prism([[x - w2, G], [x - w2, G - hh + 2], [x - w2 * 0.4, G - hh], [x + w2 * 0.4, G - hh], [x + w2, G - hh + 2], [x + w2, G]],
        [[x - 1, G - hh], [x - 1, G]], 'basalt', { z: (i % 2) * 2, h: 4, smooth: 0 }));
      if (rng() < 0.7) out.push(tube([[x + 1, G - 2], [x + 2, G - hh * 0.4], [x + 0.5, G - hh * 0.7]], [0.5, 0.35, 0.1], 'lavaW', { z: 4.5 + (i % 2) * 2 }));
    }
    return { w: W * U, h: H * U, prims: out, shadow: [W / 2 + 2, G - 0.5, 30, 2.5, 0.5] };
  }
  // roots: csontkupac
  const W = 56, H = 26, G = H - 1, out = [];
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 9 + rng() * 3, y = G - 2 - rng() * 4, a = (rng() - 0.5) * 1.4, l = 7 + rng() * 5;
    out.push(tube([[x - Math.cos(a) * l, y - Math.sin(a) * l], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 1, 'bone', { z: i % 2 }));
    for (const s of [-1, 1]) out.push(ell(x + s * Math.cos(a) * l, y + s * Math.sin(a) * l, 1.7, 1.5, 0, 'bone', { z: 1 + (i % 2) }));
  }
  out.push(ell(W / 2 + 2, G - 7, 6, 5, 0, 'bone', { z: 3, rz: 5 }), ell(W / 2 + 0.2, G - 7, 1.2, 1.4, 0, 'dark', { z: 7.6 }), ell(W / 2 + 4, G - 7, 1.2, 1.4, 0, 'dark', { z: 7.6 }), ell(W / 2 + 2, G - 3.4, 3.4, 1.4, 0, 'bone', { z: 5 }));
  return { w: W * U, h: H * U, prims: out, shadow: [W / 2 + 2, G - 0.5, 26, 2, 0.45] };
}

/** A téma nagy látványeleme a csarnok mélyén. */
function feature(theme) {
  const rng = mulberry32(700 + theme.length * 11), mat = ROCK[theme];
  if (theme === 'amethyst') {
    // ősi rúnaoszlop
    const W = 40, H = 120, G = H - 1, cx = W / 2, out = [];
    out.push(prism([[cx - 9, G], [cx - 8, 10], [cx - 4, 4], [cx + 4, 4], [cx + 8, 10], [cx + 9, G]], [[cx - 1.5, 4], [cx - 1.5, G]], 'stoneDark', { h: 6, smooth: 0, bump: 'rock', amp: 0.4 }));
    out.push(ell(cx, G - 2, 15, 4, 0, mat, { rz: 4, z: 1, smooth: 0 }));
    const glyphs = [[[0, 0], [0, 12], [-4, 4], [0, 0], [4, 4]], [[0, 0], [0, 12], [0, 3], [4, 0], [0, 7], [4, 4]], [[-3, 0], [-3, 12], [-3, 2], [3, 6], [-3, 10]], [[0, 0], [0, 12], [0, 6], [4, 2], [0, 6], [4, 10]]];
    glyphs.forEach((g, k) => {
      const oy = 16 + k * 22;
      for (let i = 0; i < g.length - 1; i++) out.push(tube([[cx - 1 + g[i][0], oy + g[i][1]], [cx - 1 + g[i + 1][0], oy + g[i + 1][1]]], 0.75, 'runeV', { z: 6.2 }));
    });
    for (let i = 0; i < 4; i++) out.push(shard([cx - 12 + i * 7, G - 2], [cx - 16 + i * 10 + (rng() - 0.5) * 4, G - 14 - rng() * 12], 4, 'amy', { z: 5 + i % 2 }));
    return { w: W * U, h: H * U, prims: out };
  }
  if (theme === 'lava') {
    // lávató szegélykövekkel
    const W = 160, H = 30, G = H - 2, cx = W / 2, out = [];
    out.push(sheet(blob(cx, G - 8, 70, 7, 16, rng, 0.08), 'lavaW', { bulge: 0.4, fall: 3 }));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const x = cx + Math.cos(a) * 74, y = G - 8 + Math.sin(a) * 9; if (Math.sin(a) < -0.2) continue; out.push(ell(x, y, 5 + rng() * 4, 3 + rng() * 1.5, 0, 'basalt', { z: 2, rz: 3, smooth: 0 })); }
    return { w: W * U, h: H * U, prims: out };
  }
  if (theme === 'roots') {
    // Yggdrasil vastag gyökere (a mennyezetről a padlóig ível)
    const W = 90, H = 220, out = [];
    const k = [[30, -4], [44, 50], [24, 110], [52, 170], [70, H - 6]];
    out.push(tube(k, [14, 11, 9, 7, 5], 'root', { smooth: 0 }));
    out.push(tube([[44, 52], [64, 80], [80, 110], [84, 150]], [5, 3.6, 2, 0.4], 'root', { smooth: 0, z: 1 }));
    out.push(tube([[26, 108], [10, 140], [6, 180]], [4.5, 2.6, 0.4], 'root', { smooth: 0, z: 1 }));
    out.push(tube([[36, 6], [46, 50], [30, 100], [44, 150], [64, 200]], [0.9, 0.8, 0.7, 0.6, 0.3], 'sap', { z: 14 }));
    for (let i = 0; i < 7; i++) { const t = 20 + i * 28; out.push(tube([[k[1][0] - 10 + i * 5, t], [k[1][0] - 12 + i * 5, t + 10]], [0.4, 0.1], 'sap', { z: 12 })); }
    return { w: W * U, h: H * U, prims: out };
  }
  // moss / ice: vízesés mögötti sziklaperem (maga a víz festett)
  const W = 120, H = 40, G = H - 1, out = [];
  out.push(...rockChunk(W, H, mat, rng));
  if (theme === 'moss') out.push(sheet(blob(W / 2, 8, 50, 6, 12, rng, 0.2), 'mossG', { z: 12, bulge: 1.5, fall: 2 }));
  if (theme === 'ice') for (let i = 0; i < 8; i++) out.push(shard([14 + i * 13, 6], [14 + i * 13 + (rng() - 0.5) * 2, 18 + rng() * 14], 4, 'iceC', { z: 12 }));
  return { w: W * U, h: H * U, prims: out };
}

/** Lapos padlókő / kavicsok. */
function floorStone(theme, v) {
  const rng = mulberry32(800 + v * 5 + theme.length), mat = ROCK[theme];
  const W = 40, H = 14, G = H - 1, out = [];
  out.push(prism(blob(W / 2, G - 4, 16, 3.6, 8, rng, 0.15), [[W / 2 - 8, G - 5.5], [W / 2 + 8, G - 3]], mat, { h: 2.4, smooth: 0 }));
  for (let i = 0; i < 3; i++) out.push(ell(6 + rng() * 28, G - 1.5 - rng() * 2, 2 + rng() * 2, 1.3 + rng(), 0, mat, { z: 1.5, rz: 1.4, smooth: 0 }));
  if (theme === 'moss') out.push(sheet(blob(W / 2 - 3, G - 6.5, 8, 1.6, 7, rng, 0.2), 'mossG', { z: 2.6, bulge: 0.6, fall: 1 }));
  if (theme === 'lava') out.push(tube([[10, G - 3.6], [20, G - 4.6], [30, G - 3.4]], 0.35, 'lavaW', { z: 2.8 }));
  return { w: W * U, h: H * U, prims: out, shadow: [W / 2 + 1, G - 0.5, 18, 1.5, 0.45] };
}

/* --- Szabadtér ------------------------------------------------------------- */
/** A völgy tárgyai nagyítva (ugyanaz a forma, élesebb kép). */
function enlarge(spec, k) {
  return { ...spec, w: spec.w * k, h: spec.h * k, unit: U * k };
}

/** Hegylánc több csúcsból (a peaks.mjs csúcsai egymás mellett). */
function range(kind, v) {
  const rng = mulberry32(900 + v * 41 + kind.length * 3);
  const W = 360, H = 110, out = [];
  let x = -20;
  while (x < W - 10) {
    const pw = 70 + rng() * 60, ph = Math.min(H - 2, 40 + rng() * 60);
    const pr = peak(pw * 2, ph * 2, kind === 'ash' ? 'ash' : kind === 'snow' ? 'snow' : 'rock', rng);
    out.push(...shift(pr, x, H - ph, {}).map((p) => ({ ...p, z: (p.z || 0) + rng() * 0.5 })));
    x += pw * (0.55 + rng() * 0.2);
  }
  return { w: W * U, h: H * U, prims: out, outline: 0.5 };
}

/** Zöld dombhát (rét, erdő). */
function hills(v, mat = 'turf') {
  const rng = mulberry32(950 + v * 7);
  const W = 360, H = 50, G = H, out = [];
  for (let x = -10; x < W + 20; x += 30 + rng() * 30) {
    const rx = 30 + rng() * 30, ry = 14 + rng() * 22;
    out.push(ell(x, G, rx, ry, 0, mat, { rz: ry * 0.6, smooth: 0, z: rng() * 2 }));
  }
  return { w: W * U, h: H * U, prims: out, outline: 0.4 };
}

function moon() {
  const W = 40, out = [ell(20, 20, 18, 18, 0, 'moon', { rz: 18 })];
  for (const [x, y, r] of [[13, 14, 3.4], [25, 25, 2.4], [24, 12, 1.8], [15, 26, 1.6]]) out.push(ell(x, y, r, r, 0, 'moonDark', { z: 18 - ((x - 20) ** 2 + (y - 20) ** 2) / 36 - 0.2, rz: 0.4 }));
  return { w: W * U, h: W * U, prims: out, outline: 0.2 };
}

/* --- Gyakorlótér ----------------------------------------------------------- */
function post(v) {
  const rng = mulberry32(1000 + v), W = 16, H = 60, G = H - 1, cx = W / 2, hh = 46 + rng() * 8;
  const out = [tube([[cx, G + 1], [cx + (rng() - 0.5), G - hh]], [3.4, 3.1], 'log', { smooth: 0 })];
  out.push(prism([[cx - 3.4, G - hh + 0.5], [cx + (rng() - 0.5), G - hh - 7], [cx + 3.4, G - hh + 0.5]], [[cx, G - hh - 7], [cx, G - hh + 0.5]], 'log', { h: 3, z: 0.4, smooth: 0 }));
  out.push(tube([[cx - 3.6, G - hh * 0.62], [cx + 3.6, G - hh * 0.62]], 0.6, 'rope', { z: 3 }));
  return { w: W * U, h: H * U, prims: out, shadow: [cx + 2, G - 0.5, 6, 1.4, 0.5] };
}
function torch() {
  const W = 24, H = 56, G = H - 1, cx = W / 2;
  const out = [tube([[cx, G + 1], [cx, 18]], [1.4, 1.2], 'beam', { smooth: 0 })];
  out.push(prism([[cx - 6, 12], [cx + 6, 12], [cx + 3.5, 19], [cx - 3.5, 19]], [[cx - 1, 12], [cx - 1, 19]], 'iron', { h: 2.6, z: 1, smooth: 0 }));
  out.push(ell(cx, 8, 4.4, 7, 0, 'flame', { z: 1 }), ell(cx - 0.4, 9.5, 2.2, 4, 0, 'window', { z: 3 }));
  return { w: W * U, h: H * U, prims: out, glowR: 3 };
}
function banner() {
  const W = 46, H = 80, cx = W / 2, out = [];
  out.push(tube([[4, 6], [W - 4, 6]], 1.2, 'beam', { smooth: 0, z: 2 }));
  out.push(sheet([[7, 7], [W - 7, 7], [W - 7, 60], [cx, 52], [7, 60]], 'clothRed', { bulge: 1.5, fall: 4, bump: 'grain', amp: 0.06 }));
  out.push(sheet([[9, 9], [W - 9, 9], [W - 9, 12], [9, 12]], 'clothYel', { z: 1.6, bulge: 0.2 }));
  const t = [[[cx, 18], [cx, 44]], [[cx, 18], [cx - 8, 27]], [[cx, 18], [cx + 8, 27]]];
  for (const [a, b] of t) out.push(tube([a, b], 1.4, 'runeGold', { z: 1.8 }));
  for (const x of [4, W - 4]) out.push(ell(x, 6, 2, 2, 0, 'iron', { z: 3 }));
  return { w: W * U, h: H * U, prims: out };
}
function rail() {
  const W = 120, H = 10, out = [tube([[0, 5], [W, 5.4]], 2.4, 'beam', { smooth: 0, bump: 'bark', amp: 0.2 })];
  return { w: W * U, h: H * U, prims: out };
}

/* --- Összes darab ---------------------------------------------------------- */
export function battleSprites() {
  const S = {};
  for (const t of CAVE_THEMES) {
    const mat = ROCK[t];
    for (let v = 0; v < 4; v++) {
      const rng = mulberry32(300 + v * 23 + t.length * 101);
      const extra = [];
      if (t === 'lava' && v % 2 === 0) extra.push(tube([[20, 30], [34, 38], [44, 52]], [0.6, 0.45, 0.15], 'lavaW', { z: 12 }));
      if (t === 'moss' && v % 2 === 0) extra.push(sheet(blob(30 + v * 8, 16, 14, 3.5, 9, rng, 0.3, 90, 80), 'mossG', { z: 13, bulge: 1.2, fall: 1.5 }));
      if (t === 'ice' && v === 1) extra.push(sheet(blob(40, 14, 16, 3, 9, rng, 0.3, 90, 80), 'snow', { z: 13, bulge: 1, fall: 1.5 }));
      if ((t === 'amethyst') && v % 2) for (let i = 0; i < 3; i++) extra.push(shard([30 + i * 12, 40], [26 + i * 15, 28 - i * 2], 4, 'amy', { z: 13 }));
      S[`bt-${t}-rock${v}`] = { w: 90 * U, h: 80 * U, prims: rockChunk(90, 80, mat, rng, extra) };
    }
    for (let v = 0; v < 3; v++) S[`bt-${t}-hang${v}`] = hanging(t, v);
    for (let v = 0; v < 2; v++) S[`bt-${t}-stand${v}`] = standing(t, v);
    S[`bt-${t}-deco`] = deco(t, 0);
    S[`bt-${t}-feature`] = feature(t);
    for (let v = 0; v < 3; v++) S[`bt-${t}-floor${v}`] = floorStone(t, v);
  }
  const N = natureSprites();
  for (const k of ['pine0', 'pine1', 'pine2', 'pine-snow0', 'pine-snow1', 'pine-snow2', 'birch0', 'birch1', 'dead0', 'dead1', 'dead2', 'boulder0', 'boulder1', 'boulder0s', 'bush0', 'bush-snow0', 'bones0', 'tuft0', 'fern0', 'reeds0', 'pebbles0'])
    S[`bt-${k}`] = enlarge(N[k], 3);
  for (const kind of ['rock', 'snow', 'ash']) for (let v = 0; v < 2; v++) S[`bt-range-${kind}${v}`] = range(kind, v);
  S['bt-hills0'] = hills(0); S['bt-hills1'] = hills(1, 'leaf'); S['bt-dunes'] = hills(2, 'dirt');
  S['bt-moon'] = moon();
  for (let v = 0; v < 3; v++) S[`bt-post${v}`] = post(v);
  S['bt-torch'] = torch(); S['bt-banner'] = banner(); S['bt-rail'] = rail();
  return S;
}
