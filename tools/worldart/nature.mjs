/* =====================================================================
   A völgy természeti tárgyai — fák, sziklák, bokrok, apró díszek.
   Egység = 2 képpont; a talaj a kép alja (G = magasság - 1).
   Minden méret és kulcs megegyezik a régi rajzokéval.
   ===================================================================== */
import { tube, ell, sheet, prism, shard } from '../dragonart/lib.mjs';
import { mulberry32 } from './rng.mjs';

const U = 2;

/** Fenyő: lefelé szélesedő, csipkés szélű tűlevél-szoknyák, a csúcson hegyes vég. */
function pine(wpx, hpx, snow, v) {
  const W = wpx / U, H = hpx / U, G = H - 1, cx = W / 2, rng = mulberry32(31 + v * 7 + (snow ? 99 : 0));
  const out = [tube([[cx, G], [cx, G - 9]], [2.2, 1.6], 'bark', { smooth: 0.5 })];
  const n = 5 + v;
  const top = 2.5, bottom = G - 6;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const yB = bottom - (bottom - top - 6) * Math.pow(f, 0.92), tierH = 10 - f * 3.5;
    const wd = (W * 0.47) * (1 - f * 0.78) + 1.5;
    const apex = [cx + (rng() - 0.5) * 0.8, yB - tierH];
    const pts = [apex];
    const teeth = 7;
    for (let k = 0; k <= teeth; k++) {
      const t = k / teeth, x = cx + wd - 2 * wd * t;
      const y = yB + (k % 2 ? -1.2 - rng() * 0.8 : 0.6 + rng() * 0.8) - Math.abs(t - 0.5) * 2.2;
      pts.push([x, y]);
    }
    out.push(sheet(pts, i % 2 ? 'needle' : 'needleD', { z: -i * 0.4, bulge: wd * 0.55, fall: wd * 0.65, smooth: 0, alb: 1 }));
    if (snow) {
      const sp = [[apex[0], apex[1] - 0.4]];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, x = cx + wd * 0.82 - 2 * wd * 0.82 * t;
        sp.push([x, apex[1] + tierH * (0.5 + Math.abs(t - 0.5) * 0.3) + (k % 2 ? -1 : 0.6) * (0.6 + rng())]);
      }
      out.push(sheet(sp, 'snow', { z: -i * 0.4 + wd * 0.3, bulge: wd * 0.3, fall: wd * 0.5, smooth: 0 }));
    }
  }
  return { prims: out, shadow: [cx + 2, G - 0.5, W * 0.42, 3, 0.4] };
}

function birch(v) {
  const W = 30, H = 46, G = H - 1, cx = W / 2, rng = mulberry32(51 + v);
  const out = [tube([[cx, G], [cx - 0.6, G - 14], [cx + 0.4, G - 26]], [1.8, 1.5, 1.1], 'birch', { smooth: 0.4 })];
  for (let i = 0; i < 6; i++) out.push(ell(cx - 0.4 + (rng() - 0.5) * 1.2, G - 3 - i * 3.6, 1.1, 0.35, 0, 'dark', { z: 1.3, smooth: 0 }));
  out.push(tube([[cx, G - 18], [cx - 5, G - 24]], [0.7, 0.4], 'birch', { smooth: 0 }), tube([[cx, G - 20], [cx + 5, G - 27]], [0.7, 0.4], 'birch', { smooth: 0 }));
  const blobs = [[0, -31, 9, 8], [-6, -26, 7, 6], [6, -27, 7, 6.5], [-3, -36, 6.5, 6], [4, -36, 6, 5.5], [0, -22, 6, 4.5], [-8, -31, 4.6, 4.4], [8, -32, 4.6, 4.4]];
  blobs.forEach(([dx, dy, rx, ry], i) => out.push(ell(cx + dx + (rng() - 0.5), G + dy + (rng() - 0.5), rx, ry, 0, i % 3 ? 'leafLight' : 'leaf', { z: i % 2 ? -1 : 1, smooth: 1.2, rz: Math.min(rx, ry) * 0.9 })));
  return { prims: out, shadow: [cx + 2, G - 0.5, 11, 2.8, 0.38] };
}

function dead(v) {
  const W = 28, H = 40, G = H - 1, cx = W / 2, rng = mulberry32(71 + v);
  const lean = (rng() - 0.5) * 3;
  const out = [tube([[cx, G], [cx + lean * 0.4, G - 12], [cx + lean, G - 24], [cx + lean * 1.2, G - 32]], [2.2, 1.7, 1.1, 0.4], 'dead', { smooth: 0.5 })];
  for (let i = 0; i < 4; i++) {
    const y = G - 12 - i * 5, dir = i % 2 ? 1 : -1, bx = cx + lean * (0.4 + i * 0.2);
    out.push(tube([[bx, y], [bx + dir * 4, y - 3 - rng() * 2], [bx + dir * (7 + rng() * 3), y - 6 - rng() * 3]], [0.9, 0.6, 0.15], 'dead', { smooth: 0.4 }));
  }
  out.push(tube([[cx - 1, G], [cx - 4.5, G + 0.2]], [1.2, 0.3], 'dead', { smooth: 0.4 }), tube([[cx + 1, G], [cx + 4, G + 0.3]], [1.1, 0.3], 'dead', { smooth: 0.4 }));
  return { prims: out, shadow: [cx + 2, G - 0.5, 8, 2, 0.35] };
}

function boulder(v, snow) {
  const W = 28, H = 23, G = H - 1, cx = W / 2, rng = mulberry32(91 + v);
  const out = [
    ell(cx - 2, G - 7, 10, 7.5, -0.15, 'rock', { rz: 8, smooth: 1.6 }),
    ell(cx + 5, G - 5, 7, 5.5, 0.2, 'rock', { rz: 6, smooth: 1.6 }),
    ell(cx - 8, G - 3.6, 4.6, 3.6, 0, 'rockWarm', { rz: 4, smooth: 1.2 }),
  ];
  if (v === 1) out.push(ell(cx + 1, G - 12, 5, 4, 0.3, 'rock', { rz: 5, smooth: 1.6 }));
  if (snow) out.push(sheet([[cx - 11, G - 9], [cx - 6, G - 14.5], [cx + 2, G - 15], [cx + 8, G - 10], [cx + 6, G - 8.5], [cx, G - 11], [cx - 6, G - 10]], 'snow', { z: 6.8, bulge: 1.2, fall: 2, smooth: 0 }));
  else out.push(ell(cx - 4 + rng() * 2, G - 13, 3.6, 1.2, 0, 'leaf', { z: 7.4, smooth: 0, rz: 0.6 }));
  return { prims: out, shadow: [cx + 2, G - 0.4, 12, 2.6, 0.45] };
}

function bush(v, snow) {
  const W = 22, H = 17, G = H - 1, cx = W / 2, rng = mulberry32(111 + v);
  const out = [];
  const blobs = [[-5, -5, 5, 4.4], [4.6, -5, 5, 4.4], [0, -8, 5.6, 5], [-1, -3, 6, 3.4], [6, -2.6, 3.6, 2.8]];
  blobs.forEach(([dx, dy, rx, ry], i) => out.push(ell(cx + dx, G + dy, rx, ry, 0, i % 2 ? 'leaf' : 'leafLight', { smooth: 1, rz: Math.min(rx, ry) })));
  if (!snow && v !== 1) for (let i = 0; i < 6; i++) out.push(ell(cx - 6 + rng() * 12, G - 3 - rng() * 7, 0.7, 0.7, 0, 'berry', { z: 5.6, smooth: 0 }));
  if (snow) blobs.slice(0, 3).forEach(([dx, dy, rx, ry]) => out.push(ell(cx + dx - 0.6, G + dy - ry * 0.55, rx * 0.8, ry * 0.4, 0, 'snow', { z: ry * 0.9, smooth: 0 })));
  return { prims: out, shadow: [cx + 1.5, G - 0.3, 10, 2, 0.35] };
}

function tuft(v) {
  const W = 14, H = 10, G = H - 0.5, cx = W / 2, rng = mulberry32(131 + v);
  const out = [];
  for (let i = 0; i < 9; i++) {
    const x = cx - 4 + i, h = 4 + rng() * 4.5, lean = (rng() - 0.5) * 3;
    out.push(tube([[x, G], [x + lean * 0.5, G - h * 0.6], [x + lean, G - h]], [0.5, 0.35, 0.05], i % 3 ? 'grass' : 'grassDry', { smooth: 0, z: (rng() - 0.5) * 1.5 }));
  }
  return { prims: out };
}

function fern(v) {
  const W = 20, H = 15, G = H - 0.5, cx = W / 2, rng = mulberry32(151 + v);
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.42 + (rng() - 0.5) * 0.1, L = 9 + rng() * 3;
    const tip = [cx + Math.cos(a) * L, G + Math.sin(a) * L * 0.9];
    const mid = [cx + Math.cos(a) * L * 0.55, G + Math.sin(a) * L * 0.6 - 1];
    out.push(tube([[cx, G], mid, tip], [0.35, 0.3, 0.05], 'leaf', { smooth: 0, z: 1 }));
    for (let k = 1; k < 6; k++) {
      const t = k / 6, p = [cx + (tip[0] - cx) * t, G + (tip[1] - G) * t - Math.sin(t * Math.PI) * 1.2];
      const nx = -(tip[1] - G) / L, ny = (tip[0] - cx) / L, l = 2.4 * (1 - t * 0.6);
      for (const s of [-1, 1]) out.push(tube([p, [p[0] + nx * l * s, p[1] + ny * l * s + 0.6]], [0.5, 0.1], 'leafLight', { smooth: 0, z: 0.5 }));
    }
  }
  return { prims: out, shadow: [cx + 1, G - 0.3, 8, 1.6, 0.25] };
}

function mushroom(v) {
  const W = 16, H = 13, G = H - 0.5, rng = mulberry32(171 + v);
  const out = [];
  const caps = [[5.5, 7, 3.4], [10.5, 5.2, 2.6], [8, 8.6, 1.8]].slice(0, 2 + (v % 2));
  const red = v !== 2;
  caps.forEach(([x, h, r]) => {
    out.push(tube([[x, G], [x, G - h]], [r * 0.32, r * 0.28], 'stem', { smooth: 0.3 }));
    out.push(ell(x, G - h - r * 0.15, r, r * 0.62, 0, red ? 'mushRed' : 'mushTan', { smooth: 0, z: 0.5, rz: r * 0.8 }));
    if (red) for (let i = 0; i < 4; i++) out.push(ell(x - r * 0.6 + rng() * r * 1.2, G - h - r * 0.3 - rng() * r * 0.3, 0.35, 0.3, 0, 'stem', { z: r * 0.85 + 0.5, smooth: 0 }));
  });
  return { prims: out, shadow: [W / 2 + 1, G - 0.3, 6, 1.2, 0.3] };
}

function reeds(v) {
  const W = 15, H = 20, G = H - 0.5, rng = mulberry32(191 + v);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const x = 3 + i * 1.5 + rng(), h = 10 + rng() * 8, lean = (rng() - 0.5) * 2;
    out.push(tube([[x, G], [x + lean * 0.5, G - h * 0.6], [x + lean, G - h]], [0.4, 0.32, 0.08], i % 2 ? 'grass' : 'grassDry', { smooth: 0, z: (rng() - 0.5) }));
    if (i % 3 === 1) out.push(ell(x + lean * 0.85, G - h * 0.82, 0.7, 1.8, lean * 0.08, 'log', { z: 1.2, smooth: 0, bump: null }));
  }
  return { prims: out };
}

function stump(v) {
  const W = 17, H = 14, G = H - 0.5, cx = W / 2;
  const out = [
    tube([[cx, G - 0.5], [cx, G - 6]], [4.4, 4], 'log', { smooth: 0.6, open1: true }),
    ell(cx, G - 6.4, 3.8, 1.5, 0, 'stem', { z: 4.6, smooth: 0, bump: 'noise', amp: 0.15, rz: 0.4, col: [214, 176, 128] }),
    ell(cx, G - 6.4, 1.8, 0.7, 0, 'log', { z: 5.1, smooth: 0, rz: 0.1 }),
    tube([[cx - 3, G - 1], [cx - 6.6, G]], [1.4, 0.4], 'log', { smooth: 0.4 }), tube([[cx + 3, G - 1], [cx + 6.4, G - 0.2]], [1.3, 0.4], 'log', { smooth: 0.4 }),
  ];
  if (v === 1) out.push(ell(cx + 1, G - 4, 1.6, 1, 0, 'leaf', { z: 4.6, smooth: 0 }));
  if (v === 2) out.push(ell(cx + 3.6, G - 3.4, 1.2, 0.8, 0, 'mushTan', { z: 4.4, smooth: 0 }));
  return { prims: out, shadow: [cx + 1.5, G - 0.3, 7, 1.6, 0.35] };
}

function pebbles(v) {
  const W = 15, H = 8, G = H - 0.5, rng = mulberry32(211 + v);
  const out = [];
  for (let i = 0; i < 4; i++) { const r = 1.2 + rng() * 1.4; out.push(ell(2.5 + i * 3 + rng(), G - r * 0.6, r, r * 0.7, rng(), i % 2 ? 'rock' : 'rockWarm', { smooth: 0, rz: r * 0.7, scale: 2 })); }
  return { prims: out };
}

function bones(v) {
  const W = 22, H = 13, G = H - 0.5, cx = W / 2;
  const out = [
    ell(cx - 4, G - 4, 3.6, 3, 0.1, 'bone', { smooth: 0.6 }), ell(cx - 5.2, G - 4.2, 0.9, 0.9, 0, 'dark', { z: 3, smooth: 0 }), ell(cx - 2.6, G - 4.4, 0.8, 0.8, 0, 'dark', { z: 3, smooth: 0 }),
    tube([[cx - 1, G - 2], [cx + 7, G - 3]], [0.7, 0.6], 'bone', { smooth: 0 }),
  ];
  for (let i = 0; i < 3 + v; i++) out.push(tube([[cx + 1 + i * 2, G - 3.4], [cx + 1.6 + i * 2, G - 0.6]], [0.45, 0.3], 'bone', { smooth: 0, z: 0.6 }));
  return { prims: out };
}

function vent(v) {
  const W = 20, H = 11, G = H - 1, cx = W / 2, rng = mulberry32(231 + v);
  const out = [];
  for (let i = 0; i < 3; i++) out.push(tube([[cx - 6 + i * 4, G - 1.5 + (rng() - 0.5) * 2], [cx - 3 + i * 4 + rng() * 2, G - 3 - rng() * 2]], [0.6, 0.35], i % 2 ? 'lava' : 'ember', { smooth: 0 }));
  out.push(ell(cx, G - 2, 4, 1.4, 0, 'ember', { smooth: 0, z: 0.5 }));
  return { prims: out, glowOnly: true };
}

function crystal(v) {
  const W = 15, H = 20, G = H - 0.5, cx = W / 2, rng = mulberry32(251 + v);
  const out = [];
  [[0, 15, 2.6], [-3.4, 10, 2], [3.2, 11, 2.2], [-5.4, 6, 1.6], [5.4, 7, 1.6]].forEach(([dx, h, w], i) => {
    const lean = dx * 0.25 + (rng() - 0.5);
    out.push(shard([cx + dx, G], [cx + dx + lean, G - h], w * 1.4, 'ice', { z: i ? -i * 0.3 : 0.5 }));
  });
  return { prims: out, shadow: [cx + 1, G - 0.3, 6, 1.4, 0.3] };
}

function herb() {
  const W = 15, H = 15, G = H - 0.5, cx = W / 2;
  const out = [];
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; out.push(tube([[cx, G], [cx + Math.cos(a) * 4, G + Math.sin(a) * 4 - 1], [cx + Math.cos(a) * 6.5, G + Math.sin(a) * 6.2]], [0.5, 1.0, 0.1], 'leafLight', { smooth: 0 })); }
  for (const [x, y] of [[cx - 2.6, G - 8.6], [cx + 2.2, G - 9.4], [cx, G - 11]]) {
    out.push(tube([[cx, G - 2], [x, y]], 0.25, 'leaf', { smooth: 0 }));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; out.push(ell(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.7, 0.7, 0, 'flowerW', { z: 1, smooth: 0 })); }
    out.push(ell(x, y, 0.55, 0.55, 0, 'flowerY', { z: 1.8, smooth: 0 }));
  }
  return { prims: out, shadow: [cx + 1, G - 0.3, 5, 1.2, 0.3] };
}

function egg() {
  const W = 15, H = 19, G = H - 0.5, cx = W / 2, rng = mulberry32(271);
  const out = [ell(cx, G - 8, 5.6, 7.6, 0, 'egg', { rz: 5.4 })];
  for (let i = 0; i < 9; i++) out.push(ell(cx - 4 + rng() * 8, G - 13 + rng() * 10, 0.7 + rng() * 0.5, 0.5 + rng() * 0.4, rng(), 'mushTan', { z: 5.3, smooth: 0, rz: 0.2 }));
  return { prims: out, shadow: [cx + 1, G - 0.5, 5, 1.4, 0.4] };
}

function sheep(up) {
  const W = 20, H = 15, G = H - 0.5;
  const out = [];
  for (const x of [6, 8.5, 12.5, 15]) out.push(tube([[x, G - 4], [x, G - 0.4]], [0.7, 0.6], 'sheepFace', { smooth: 0, z: x % 2 ? -1 : 1 }));
  [[10.5, G - 7.4, 6.8, 4.4], [7, G - 8.6, 3.6, 3.4], [14, G - 8.4, 3.6, 3.4], [10.5, G - 10, 4, 3]].forEach(([x, y, rx, ry]) => out.push(ell(x, y, rx, ry, 0, 'wool', { smooth: 1.4, rz: Math.min(rx, ry) })));
  out.push(ell(3.6, up ? G - 10.6 : G - 5.2, 2.4, 1.8, up ? -0.4 : 0.5, 'sheepFace', { z: 2, smooth: 0.5 }), ell(4.8, up ? G - 11.6 : G - 6.6, 1.1, 0.6, 0.4, 'sheepFace', { z: 3, smooth: 0 }));
  out.push(ell(2.9, up ? G - 11 : G - 5.6, 0.4, 0.4, 0, 'dark', { z: 3.6, smooth: 0 }));
  return { prims: out, shadow: [10.5, G - 0.3, 8, 1.4, 0.35] };
}

function raven(up) {
  const W = 28, H = 18, cx = W / 2, cy = 10;
  const wy = up ? -7 : 5;
  const out = [
    ell(cx, cy, 5, 2.2, 0, 'feather', { smooth: 0.8 }), ell(cx - 5, cy - 0.6, 2, 1.7, 0, 'feather', { smooth: 0.8 }),
    tube([[cx - 6.6, cy - 0.4], [cx - 8.6, cy]], [0.6, 0.1], 'gold', { smooth: 0, col: [60, 54, 50] }),
    sheet([[cx + 4, cy], [cx + 9, cy - 1.6], [cx + 9, cy + 1.6]], 'feather', { bulge: 0.3, fall: 1, smooth: 0 }),
    sheet([[cx - 2, cy - 0.6], [cx - 5, cy + wy * 0.8], [cx, cy + wy], [cx + 4, cy + wy * 0.9], [cx + 3, cy - 0.2]], 'feather', { bulge: 0.4, fall: 1.2, smooth: 0, z: 1 }),
  ];
  return { prims: out };
}

/** Az összes természeti sprite: kulcs → { w, h (px), prims, shadow } */
export function natureSprites() {
  const S = {};
  for (let v = 0; v < 3; v++) {
    S[`pine${v}`] = { w: 64, h: 90 + v * 10, ...pine(64, 90 + v * 10, false, v) };
    S[`pine-snow${v}`] = { w: 64, h: 90 + v * 10, ...pine(64, 90 + v * 10, true, v) };
    S[`birch${v}`] = { w: 60, h: 92, ...birch(v) };
    S[`dead${v}`] = { w: 56, h: 80, ...dead(v) };
    S[`bush${v}`] = { w: 44, h: 34, ...bush(v, false) };
    S[`bush-snow${v}`] = { w: 44, h: 34, ...bush(v, true) };
    S[`tuft${v}`] = { outline: 0.2, w: 28, h: 20, ...tuft(v) };
    S[`fern${v}`] = { outline: 0.2, w: 40, h: 30, ...fern(v) };
    S[`mushroom${v}`] = { w: 32, h: 26, ...mushroom(v) };
    S[`reeds${v}`] = { outline: 0.2, w: 30, h: 40, ...reeds(v) };
    S[`stump${v}`] = { w: 34, h: 28, ...stump(v) };
    S[`pebbles${v}`] = { w: 30, h: 16, ...pebbles(v) };
    S[`bones${v}`] = { w: 44, h: 26, ...bones(v) };
    S[`vent${v}`] = { w: 40, h: 22, ...vent(v) };
    S[`crystal${v}`] = { w: 30, h: 40, ...crystal(v) };
  }
  for (let v = 0; v < 2; v++) for (const snow of [false, true]) S[`boulder${v}${snow ? 's' : ''}`] = { w: 56, h: 46, ...boulder(v, snow) };
  S.herb = { w: 30, h: 30, ...herb() };
  S.egg = { w: 30, h: 38, ...egg() };
  S.sheep0 = { w: 40, h: 30, ...sheep(false) };
  S.sheep1 = { w: 40, h: 30, ...sheep(true) };
  S.raven0 = { w: 56, h: 36, ...raven(true) };
  S.raven1 = { w: 56, h: 36, ...raven(false) };
  return S;
}
