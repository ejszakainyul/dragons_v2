/* =====================================================================
   A völgy tárgyainak és a csatahátterek darabjainak legyártása:
     node tools/worldart/build.mjs [--only=pine0,bt-moss*] [--out=dir] [--sheet=png]
   Kimenet: img/world/<kulcs>.png, img/battle/bt-*.png + script/game/world-manifest.js
   ===================================================================== */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScene } from '../../script/game/render3d.js';
import { encodePNG } from '../dragonart/render.mjs';
import { WMATS } from './mats.mjs';
import { natureSprites } from './nature.mjs';
import { placeSprites } from './places.mjs';
import { peakSheet } from './peaks.mjs';
import { battleSprites, BMATS } from './battle.mjs';
import { bossSprites, BOSS_MATS } from './boss.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
export function allSprites() { return { ...natureSprites(), ...placeSprites(), ...battleSprites(), ...bossSprites() }; }
const MATS = { ...WMATS, ...BMATS, ...BOSS_MATS };
const isBattle = (k) => /^(bt|boss)-/.test(k);
const dirOf = (k, out) => (isBattle(k) ? out.replace(/world$/, 'battle') : out);

/** Egy sprite: render + puha talajárnyék alá. */
export function bake(spec) {
  const unit = spec.unit || 2;
  const r = renderScene(spec.prims, { w: spec.w, h: spec.h, unit, ss: 2, mats: MATS, color: true, aoR: spec.aoR ?? 1.2, glowR: spec.glowR ?? 1.4, outline: spec.outline ?? 0.8 });
  const px = r.color;
  if (spec.holes) cutHoles(px, spec.w, spec.h, spec.holes);
  if (spec.glowOnly) return px;
  if (spec.shadow) {
    const [cx, cy, rx, ry, a] = spec.shadow;
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < spec.h; y++) for (let x = 0; x < spec.w; x++) {
      const dx = ((x + 0.5) / unit - cx) / rx, dy = ((y + 0.5) / unit - cy) / ry, q = dx * dx + dy * dy;
      const sa = q < 1 ? a * (1 - q) ** 1.5 : 0;
      const i = (y * spec.w + x) * 4, oa = px[i + 3] / 255, ta = oa + sa * (1 - oa);
      if (ta <= 0) continue;
      for (let c = 0; c < 3; c++) out[i + c] = (px[i + c] * oa + 8 * sa * (1 - oa)) / ta;
      out[i + 3] = ta * 255;
    }
    return out;
  }
  return px;
}

if (isMainThread) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
  const out = path.resolve(args.out || path.join(ROOT, 'img/world'));
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(dirOf('bt-', out), { recursive: true });
  const all = allSprites();
  let keys = Object.keys(all);
  if (args.only) { const want = args.only.split(','); keys = keys.filter((k) => want.some((w) => k === w || (w.endsWith('*') && k.startsWith(w.slice(0, -1))))); }
  const W = Math.min(os.cpus().length, 8, Math.max(1, keys.length));
  const t0 = Date.now();
  await Promise.all(Array.from({ length: W }, (_, k) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { keys: keys.filter((_, i) => i % W === k), out } });
    w.on('error', reject); w.on('exit', resolve);
  })));
  if (!args.only || args.peaks) {
    const pk = peakSheet();
    fs.writeFileSync(path.join(out, 'peaks.png'), encodePNG(pk.px, pk.w, pk.h));
    const manifest = { keys: Object.keys(all).filter((k) => !isBattle(k)), battle: Object.keys(all).filter(isBattle), peaks: pk.frames, v: Date.now().toString(36) };
    fs.writeFileSync(path.join(ROOT, 'script/game/world-manifest.js'),
      '/* GENERÁLT — tools/worldart/build.mjs írja. A völgy renderelt tárgyai (img/world/) és a csatahátterek darabjai (img/battle/). */\n'
      + `export const WORLD_ART = ${JSON.stringify(manifest)};\n`);
  }
  if (args.sheet) {
    const imgs = keys.map((k) => ({ k, s: all[k], px: new Uint8ClampedArray(decode(path.join(dirOf(k, out), `${k}.png`))) }));
    writeSheet(imgs, args.sheet);
  }
  console.log(`Kész: ${keys.length} tárgy, ${((Date.now() - t0) / 1000).toFixed(1)} mp → ${out}`);
} else {
  const all = allSprites();
  for (const k of workerData.keys) fs.writeFileSync(path.join(dirOf(k, workerData.out), `${k}.png`), encodePNG(bake(all[k]), all[k].w, all[k].h));
}

/* --- előnézeti lap (fűszínű háttéren) --- */
import zlib from 'node:zlib';
function decode(f) {
  const b = fs.readFileSync(f); let o = 8, w, h; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8ClampedArray(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)]; for (let x = 0; x < st; x++) { const v = raw[y * (st + 1) + 1 + x], a = x >= 4 ? px[y * st + x - 4] : 0, bb = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0; let p = 0; if (f === 1) p = a; else if (f === 2) p = bb; else if (f === 3) p = (a + bb) >> 1; else if (f === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; } px[y * st + x] = (v + p) & 255; } }
  return px;
}
function writeSheet(imgs, file) {
  const pad = 6, maxW = 1800, zoom = (im) => (im.s.w * im.s.h > 30000 ? 1 : 2);
  let x = pad, y = pad, rowH = 0; const pos = [];
  for (const im of imgs) { const Z = zoom(im), w = im.s.w * Z, h = im.s.h * Z; if (x + w > maxW) { x = pad; y += rowH + pad; rowH = 0; } pos.push([x, y]); x += w + pad; rowH = Math.max(rowH, h); }
  const SW = maxW, SH = y + rowH + pad, px = new Uint8ClampedArray(SW * SH * 4);
  for (let i = 0; i < SW * SH; i++) px.set([88, 128, 72, 255], i * 4);
  imgs.forEach((im, n) => {
    const [ox, oy] = pos[n], Z = zoom(im);
    for (let yy = 0; yy < im.s.h * Z; yy++) for (let xx = 0; xx < im.s.w * Z; xx++) {
      const si = ((yy / Z | 0) * im.s.w + (xx / Z | 0)) * 4, a = im.px[si + 3] / 255, di = ((oy + yy) * SW + ox + xx) * 4;
      for (let c = 0; c < 3; c++) px[di + c] = im.px[si + c] * a + px[di + c] * (1 - a);
    }
  });
  fs.writeFileSync(file, encodePNG(px, SW, SH));
}

/** Kiszakadt lyukak (képpont-sokszögek) kivágása, puha széllel. */
function cutHoles(px, w, h, holes) {
  for (const poly of holes) {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) px[(y * w + x) * 4 + 3] = 0;
    }
  }
}
