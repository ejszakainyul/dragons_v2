/* Előnézet: node preview.mjs <dir> <out.png> [slot|mix]  — PNG-kből rakja össze. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { composite, sheet } from './compose.mjs';
import { encodePNG } from './render.mjs';
const [, , dir, outFile, mode = 'mix'] = process.argv;
function readPNG(f) {
  const b = fs.readFileSync(f); let o = 8, w, h; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8ClampedArray(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)]; for (let x = 0; x < st; x++) { const v = raw[y * (st + 1) + 1 + x], a = x >= 4 ? px[y * st + x - 4] : 0, bb = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0; let p = 0; if (f === 1) p = a; else if (f === 2) p = bb; else if (f === 3) p = (a + bb) >> 1; else if (f === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; } px[y * st + x] = (v + p) & 255; } }
  return { px, w };
}
const L = (s, n) => ({ base: readPNG(`${dir}/${s}[${n}].png`).px, fx: readPNG(`${dir}/${s}[${n}]-fx.png`).px });
const size = readPNG(`${dir}/body[2].png`).w;
const cols = ['#ff8a3d', '#4fd6ff', '#9d7bff', '#2dd4a7', '#ffc46b', '#ff5d6c', '#bcd9ff', '#e2e2e2', '#8fd14f', '#ff9ecd', '#7ce7ff', '#c9b6ff'];
let combos;
if (mode === 'mix') { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; combos = Array.from({ length: 18 }, () => ({ body: 1 + Math.floor(r() * 18), legs: 1 + Math.floor(r() * 18), head: 1 + Math.floor(r() * 18), wings: 1 + Math.floor(r() * 18) })); }
else if (mode.startsWith('solo:')) combos = Array.from({ length: 18 }, (_, i) => ({ [mode.slice(5)]: i + 1 }));
else combos = Array.from({ length: 18 }, (_, i) => ({ body: 2, legs: 2, head: 2, wings: 2, [mode]: i + 1 }));
const imgs = combos.map((c, i) => composite(['body', 'legs', 'head', 'wings'].filter((s) => c[s]).map((s) => L(s, c[s])), cols[i % cols.length], size));
const g = sheet(imgs, size, 6);
fs.writeFileSync(outFile, encodePNG(g.px, g.W, g.H));
console.log(JSON.stringify(combos.slice(0, 6)));
