/* =====================================================================
   Az oldal ikonja:  node tools/iconart/build.mjs [--head=18] [--color=#e8502a]
   Sárgaréz szegélyű kőmedalion, rajta egy sárkányfej — ugyanazzal a
   renderelővel, mint a játék sárkányai és tárgyai.
   Kimenet: favicon.ico (16+32+48), img/icon/*.png, site.webmanifest
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPart, renderScene, encodePNG } from '../dragonart/render.mjs';
import { headDesign } from '../dragonart/heads.mjs';
import { tube, ell } from '../dragonart/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const HEAD = +(args.head || 18), COLOR = args.color || '#d8482a', N = 512;

/* --- 1. a medalion ------------------------------------------------------ */
const MATS = {
  medal: { col: [40, 46, 68], bump: 'noise', amp: 0.3, spec: 0.12, shin: 20 },
  brass: { col: [196, 146, 68], bump: 'grain', amp: 0.05, spec: 0.7, shin: 50 },
};
const ring = (r, rad, mat, z) => {
  const pts = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([32 + Math.cos(a) * r, 32 + Math.sin(a) * r]); }
  return tube(pts, rad, mat, { z, smooth: 0, per: 4 });
};
const medalPrims = [ell(32, 32, 29.5, 29.5, 0, 'medal', { rz: 5, smooth: 0 }), ring(29.8, 1.9, 'brass', 3.5), ring(26.4, 0.45, 'brass', 4.4)];
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; medalPrims.push(ell(32 + Math.cos(a) * 29.8, 32 + Math.sin(a) * 29.8, 0.95, 0.95, 0, 'brass', { z: 5.2, smooth: 0 })); }
const medal = renderScene(medalPrims, { w: N, h: N, unit: N / 64, ss: 2, mats: MATS, color: true, outline: 0.6 }).color;

/* --- 2. a fej, kiszínezve, átlátszó háttéren ----------------------------- */
const HS = 1024;
const head = renderPart(headDesign(HEAD), { size: HS, ss: 2 });
const hexRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const tint = hexRgb(COLOR).map((v) => Math.min(1, (v / 255) * 1.3));
const hpx = new Float32Array(HS * HS * 4);
for (let i = 0; i < HS * HS; i++) {
  const o = i * 4, a = head.base[o + 3] / 255, f = head.fx[o + 3] / 255;
  let r = 0, g = 0, b = 0, al = 0;
  if (a > 0) { r = head.base[o] / 255 * tint[0]; g = head.base[o + 1] / 255 * tint[1]; b = head.base[o + 2] / 255 * tint[2]; al = a; }
  if (f > 0) { r = head.fx[o] / 255 * f + r * (1 - f); g = head.fx[o + 1] / 255 * f + g * (1 - f); b = head.fx[o + 2] / 255 * f + b * (1 - f); al = f + al * (1 - f); }
  hpx[o] = r; hpx[o + 1] = g; hpx[o + 2] = b; hpx[o + 3] = al;      // nem előszorzott
}
let x0 = HS, y0 = HS, x1 = 0, y1 = 0;
for (let y = 0; y < HS; y++) for (let x = 0; x < HS; x++) if (hpx[(y * HS + x) * 4 + 3] > 0.04) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }

/* --- 3. összerakás: medalion + parázsfény + vetett árnyék + fej ----------- */
const out = new Float32Array(N * N * 4);
for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = medal[i * 4 + c] / 255;
const inDisc = (x, y) => (x - N / 2) ** 2 + (y - N / 2) ** 2 < (N * 0.4) ** 2;
// parázsfény a fej mögött
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (!inDisc(x, y)) continue;
  const d = Math.hypot(x - N * 0.52, y - N * 0.44) / (N * 0.36), k = Math.max(0, 1 - d) ** 1.4 * 0.7, o = (y * N + x) * 4;
  out[o] += (1 - out[o]) * k * 0.95; out[o + 1] += (0.55 - out[o + 1]) * k * 0.7; out[o + 2] += (0.2 - out[o + 2]) * k * 0.5;
}
const box = N * 0.74, sc = Math.min(box / (x1 - x0), box / (y1 - y0));
const dw = (x1 - x0) * sc, dh = (y1 - y0) * sc, ox = (N - dw) / 2 - N * 0.01, oy = (N - dh) / 2 + N * 0.005;
const sample = (fx, fy) => {      // a fej képpontja (bilineáris, előszorzott keveréssel)
  const sx = x0 + fx / sc, sy = y0 + fy / sc, ix = Math.floor(sx), iy = Math.floor(sy), tx = sx - ix, ty = sy - iy;
  const acc = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
    const X = Math.min(HS - 1, ix + dx), Y = Math.min(HS - 1, iy + dy), o = (Y * HS + X) * 4, a = hpx[o + 3] * w;
    acc[0] += hpx[o] * a; acc[1] += hpx[o + 1] * a; acc[2] += hpx[o + 2] * a; acc[3] += a;
  }
  return acc[3] > 0 ? [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3]] : [0, 0, 0, 0];
};
// vetett árnyék (jobbra lent, elmosva)
const sh = N * 0.018, blur = 6;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let a = 0, n = 0;
  for (let k = -blur; k <= blur; k += 3) for (let j = -blur; j <= blur; j += 3) {
    const fx = x - ox - sh + k, fy = y - oy - sh + j;
    if (fx >= 0 && fy >= 0 && fx < dw && fy < dh) a += sample(fx, fy)[3];
    n++;
  }
  a = (a / n) * 0.6;
  if (a > 0 && inDisc(x, y)) { const o = (y * N + x) * 4; for (let c = 0; c < 3; c++) out[o + c] *= 1 - a; }
}
for (let y = Math.floor(oy); y < Math.ceil(oy + dh); y++) for (let x = Math.floor(ox); x < Math.ceil(ox + dw); x++) {
  if (x < 0 || y < 0 || x >= N || y >= N) continue;
  const [r, g, b, a] = sample(x - ox, y - oy);
  if (a <= 0) continue;
  const o = (y * N + x) * 4;
  out[o] = r * a + out[o] * (1 - a); out[o + 1] = g * a + out[o + 1] * (1 - a); out[o + 2] = b * a + out[o + 2] * (1 - a);
  out[o + 3] = a + out[o + 3] * (1 - a);
}

/* --- 4. méretek ------------------------------------------------------------ */
/** Kicsinyítés területátlaggal (előszorzott alfával), kis méreten enyhe élesítéssel. */
function resize(src, S, D) {
  const dst = new Float32Array(D * D * 4), f = S / D;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const acc = [0, 0, 0, 0];
    const sx0 = x * f, sy0 = y * f;
    let wsum = 0;
    for (let yy = Math.floor(sy0); yy < Math.ceil(sy0 + f); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx0 + f); xx++) {
      const w = (Math.min(xx + 1, sx0 + f) - Math.max(xx, sx0)) * (Math.min(yy + 1, sy0 + f) - Math.max(yy, sy0));
      if (w <= 0) continue;
      const o = (yy * S + xx) * 4, a = src[o + 3];
      acc[0] += src[o] * a * w; acc[1] += src[o + 1] * a * w; acc[2] += src[o + 2] * a * w; acc[3] += a * w; wsum += w;
    }
    const o = (y * D + x) * 4, a = acc[3] / wsum;
    dst[o + 3] = a;
    for (let c = 0; c < 3; c++) dst[o + c] = acc[3] > 0 ? acc[c] / acc[3] : 0;
  }
  if (D <= 48) {   // élesítés: a részletek ne mosódjanak egy foltba
    const cp = dst.slice();
    for (let y = 1; y < D - 1; y++) for (let x = 1; x < D - 1; x++) for (let c = 0; c < 3; c++) {
      const o = (y * D + x) * 4 + c, n = (cp[o - 4] + cp[o + 4] + cp[o - D * 4] + cp[o + D * 4]) / 4;
      dst[o] = Math.min(1, Math.max(0, cp[o] + (cp[o] - n) * 0.45));
    }
  }
  return dst;
}
const toBytes = (f, D, bg = null) => {
  const px = new Uint8ClampedArray(D * D * 4);
  for (let i = 0; i < D * D; i++) {
    const a = f[i * 4 + 3];
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round((bg ? f[i * 4 + c] * a + bg[c] * (1 - a) : f[i * 4 + c]) * 255);
    px[i * 4 + 3] = bg ? 255 : Math.round(a * 255);
  }
  return px;
};
const dir = path.join(ROOT, 'img/icon');
fs.mkdirSync(dir, { recursive: true });
/** Kis méretre a medalion belseje: a vékony belső gyűrű lesz a keret, a fej nagyobb. */
function zoomed(k = 0.86) {
  const M = Math.round(N * k), o0 = (N - M) / 2, z = new Float32Array(M * M * 4);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const s = ((y + o0) * N + x + o0) * 4, d = (y * M + x) * 4;
    for (let c = 0; c < 4; c++) z[d + c] = out[s + c];
    const r = Math.hypot(x + 0.5 - M / 2, y + 0.5 - M / 2) / (M / 2);
    z[d + 3] *= Math.max(0, Math.min(1, (1 - r) * M * 0.5 + 0.5));      // puha kerek maszk
  }
  return { z, M };
}
const small = zoomed();
const png = (D, bg = null) => encodePNG(toBytes(D === N ? out : D <= 32 ? resize(small.z, small.M, D) : resize(out, N, D), D, bg), D, D);
const BG = [5 / 255, 7 / 255, 15 / 255];
const files = { 'icon-512.png': png(512), 'icon-192.png': png(192), 'favicon-48.png': png(48), 'favicon-32.png': png(32), 'favicon-16.png': png(16) };
// Apple: átlátszatlan, kis peremmel (iOS maga kerekít)
{
  const D = 180, inner = 156, small = resize(out, N, inner), f = new Float32Array(D * D * 4);
  for (let i = 0; i < D * D; i++) { f[i * 4] = BG[0]; f[i * 4 + 1] = BG[1]; f[i * 4 + 2] = BG[2]; f[i * 4 + 3] = 1; }
  const o0 = (D - inner) / 2;
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++) {
    const s = (y * inner + x) * 4, d = ((y + o0) * D + x + o0) * 4, a = small[s + 3];
    for (let c = 0; c < 3; c++) f[d + c] = small[s + c] * a + f[d + c] * (1 - a);
  }
  files['apple-touch-icon.png'] = encodePNG(toBytes(f, D), D, D);
}
for (const [n, buf] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), buf);

// favicon.ico: PNG-képek ICO-tárolóban (16, 32, 48)
const icoImgs = [[16, files['favicon-16.png']], [32, files['favicon-32.png']], [48, files['favicon-48.png']]];
const head6 = Buffer.alloc(6); head6.writeUInt16LE(0, 0); head6.writeUInt16LE(1, 2); head6.writeUInt16LE(icoImgs.length, 4);
let offset = 6 + 16 * icoImgs.length;
const dirs = icoImgs.map(([D, buf]) => {
  const e = Buffer.alloc(16);
  e[0] = D; e[1] = D; e[2] = 0; e[3] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([head6, ...dirs, ...icoImgs.map(([, b]) => b)]));

fs.writeFileSync(path.join(ROOT, 'site.webmanifest'), JSON.stringify({
  name: 'Sárkányok és Vikingek',
  short_name: 'Sárkányok',
  icons: [{ src: 'img/icon/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'img/icon/icon-512.png', sizes: '512x512', type: 'image/png' }],
  theme_color: '#05070f',
  background_color: '#05070f',
  display: 'standalone',
  start_url: 'index.php',
}, null, 2) + '\n');
console.log(`Kész: ${Object.keys(files).length} kép + favicon.ico + site.webmanifest (fej: ${HEAD}, szín: ${COLOR})`);
