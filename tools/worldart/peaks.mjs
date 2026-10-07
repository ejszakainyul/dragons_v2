/* =====================================================================
   Hegycsúcsok egy textúralapon (a terrain.js képkockáit pótolja):
   csiszolt, kétoldalt megvilágított sziklagerincek, havas sapka északon,
   izzó repedések a hamuvidéken. Képkocka: `${kind}${méret}-${változat}`.
   ===================================================================== */
import { renderScene } from '../../script/game/render3d.js';
import { prism, sheet, tube } from '../dragonart/lib.mjs';
import { WMATS } from './mats.mjs';
import { mulberry32 } from './rng.mjs';

const SIZES = [[112, 92], [150, 118], [88, 70]];
const KINDS = ['rock', 'snow', 'ash'];

export function peak(wpx, hpx, kind, rng) {
  const W = wpx / 2, H = hpx / 2, G = H - 0.5;
  const n = 1 + Math.floor(rng() * 3);
  const out = [];
  const mat = kind === 'ash' ? 'ashrock' : 'rock';
  const summits = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.22 + (0.56 * i) / (n - 1) + (rng() - 0.5) * 0.06;
    const main = n === 1 || i === Math.floor(n / 2);
    summits.push([W * t, main ? 2 + rng() * 3 : H * (0.25 + rng() * 0.18)]);
  }
  // hátul a mellékcsúcsok, elöl a fő
  const order = summits.map((s, i) => [s, i]).sort((a, b) => b[0][1] - a[0][1]);
  order.forEach(([[sx, sy]], k) => {
    const hw = (G - sy) * (0.9 + rng() * 0.3);
    const L = Math.max(0, sx - hw), R = Math.min(W, sx + hw);
    const pts = [[L, G]];
    for (let j = 1; j < 4; j++) { const t = j / 4; pts.push([L + (sx - L) * t + (rng() - 0.5) * 2, G + (sy - G) * t + (rng() - 0.3) * 2.4]); }
    pts.push([sx, sy]);
    for (let j = 1; j < 4; j++) { const t = j / 4; pts.push([sx + (R - sx) * t + (rng() - 0.5) * 2, sy + (G - sy) * t + (rng() - 0.3) * 2.4]); }
    pts.push([R, G]);
    const foot = [sx + hw * (0.15 + rng() * 0.2), G];
    out.push(prism(pts, [[sx, sy], foot], mat, { z: k * 2, h: hw * 0.9, smooth: 0, scale: 0.6, amp: 0.9 }));
    if (kind === 'snow') {
      const capH = (G - sy) * (0.3 + rng() * 0.12), f = capH / (G - sy);
      const lx = sx - (sx - L) * f * 0.96, rx = sx + (R - sx) * f * 0.96;
      const cp = [[sx, sy - 0.3], [rx, sy + capH]];
      for (let j = 1; j < 6; j++) { const t = j / 6, x = rx + (lx - rx) * t; cp.push([x, sy + capH + (j % 2 ? -1.8 : 0.8) * (0.6 + rng()) - Math.sin(t * Math.PI) * capH * 0.15]); }
      cp.push([lx, sy + capH]);
      out.push(prism(cp, [[sx, sy], [sx + (foot[0] - sx) * f, sy + capH]], 'snow', { z: k * 2 + hw * 0.62, h: hw * 0.32, smooth: 0 }));
    }
    if (kind === 'ash') {
      let x = sx + (rng() - 0.5) * 4, y = sy + (G - sy) * 0.35;
      const cr = [[x, y]];
      for (let j = 0; j < 4; j++) { x += (rng() - 0.5) * 5; y += 3 + rng() * 3; cr.push([x, Math.min(G - 1, y)]); }
      out.push(tube(cr, 0.45, 'lava', { z: k * 2 + hw * 0.9, smooth: 0, per: 3 }));
    }
  });
  return out;
}

export function peakSheet() {
  const rng = mulberry32(9090);
  const cellW = Math.max(...SIZES.map(([w]) => w)) + 4, cellH = Math.max(...SIZES.map(([, h]) => h)) + 4;
  const cols = SIZES.length * 3, W = cols * cellW, H = KINDS.length * cellH;
  const px = new Uint8ClampedArray(W * H * 4);
  const frames = [];
  KINDS.forEach((kind, row) => SIZES.forEach(([w, h], v) => {
    for (let k = 0; k < 3; k++) {
      const r = renderScene(peak(w, h, kind, rng), { w, h, unit: 2, ss: 2, mats: WMATS, color: true, aoR: 1.6, glowR: 1.6, outline: 0.6, edgeDrop: 3 });
      const ox = (v * 3 + k) * cellW, oy = row * cellH;
      for (let y = 0; y < h; y++) px.set(r.color.subarray(y * w * 4, (y + 1) * w * 4), ((oy + y) * W + ox) * 4);
      frames.push([`${kind}${v}-${k}`, ox, oy, w, h]);
    }
  }));
  return { px, w: W, h: H, frames };
}
