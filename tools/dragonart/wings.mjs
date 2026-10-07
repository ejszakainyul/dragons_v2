/* =====================================================================
   SZÁRNY — 18 változat. A szárnytő (36, 27); a szárny felfelé és hátra
   nyílik, hogy ne takarja a hátat. A játék a szárnytő körül forgatja.
   ===================================================================== */
import { tube, ell, sheet, horn, shard, qcurve } from './lib.mjs';

const R = [36, 27];

/** Denevérszárny: kar → könyök → csukló, ujjak, közöttük ívesen behúzott hártya. */
function bat(o) {
  const { elbow, wrist, tips, attach } = o;
  const sc = o.scallop ?? 0.3, z = o.z ?? 4;
  const edge = [];
  let prev = tips[0];
  for (const t of [...tips.slice(1), attach]) {
    const mid = [(prev[0] + t[0]) / 2, (prev[1] + t[1]) / 2];
    const c = [mid[0] + (wrist[0] - mid[0]) * sc, mid[1] + (wrist[1] - mid[1]) * sc];
    const seg = qcurve(prev, c, t, 7);
    if (o.jag) seg.forEach((p, i) => { if (i % 2 === 0 && i < seg.length - 1) { p[0] += (wrist[0] - p[0]) * 0.06 * o.jag; p[1] += (wrist[1] - p[1]) * 0.06 * o.jag; } });
    edge.push(...seg);
    prev = t;
  }
  const poly = [R, elbow, wrist, tips[0], ...edge, ...qcurve(attach, [(attach[0] + R[0]) / 2, (attach[1] + R[1]) / 2 + 2.4], R, 5)];
  const memMat = o.mem || 'membrane';
  const out = [sheet(poly, memMat, { z, bulge: 1.0, fall: 4, ...(o.memOpt || {}) })];
  const arm = o.arm || [1.7, 1.25, 1.05], fw = o.finger ?? 0.85;
  out.push(tube([[R[0] + 0.6, R[1] - 1.6], elbow, wrist], arm, o.boneMat || 'smooth', { z: z + 1.4 }));
  for (const t of tips) out.push(tube([wrist, [(wrist[0] + t[0]) / 2 + 0.5, (wrist[1] + t[1]) / 2 + 0.3], t], [fw, fw * 0.7, 0.25], o.boneMat || 'smooth', { z: z + 1 }));
  if (o.thumb !== false) out.push(horn([wrist[0] - 0.5, wrist[1] - 0.5], [wrist[0] - 3.4, wrist[1] - 2.4], 1.3, -0.3, 'claw', { z: z + 2.2 }));
  if (o.claws !== false) for (const t of tips) out.push(horn(t, [t[0] + (t[0] - wrist[0]) * 0.13, t[1] + (t[1] - wrist[1]) * 0.13], 0.9, 0.2, 'claw', { z: z + 1.6 }));
  for (const [x, y, r] of o.holes || []) out.push(ell(x, y, r, r * 0.8, 0.4, o.holeMat || 'mouth', { z: z + 1.3, smooth: 0, col: o.holeCol || [24, 14, 12] }));
  for (const [x, y, r] of o.embers || []) out.push(ell(x, y, r * 1.25, r, 0.4, 'ember', { z: z + 1.25, smooth: 0 }));
  for (let i = 0; i < (o.tatters || 0); i++) {
    const f = (i + 0.5) / o.tatters, a = tips[tips.length - 1], b = attach;
    const p0 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    out.push(tube([p0, [p0[0] + 0.8, p0[1] + 2.6], [p0[0] + 1.6, p0[1] + 4.6 + (i % 2) * 2]], [1.1, 0.8, 0.1], memMat, { z: z - 0.2, smooth: 0 }));
  }
  if (o.facets) {
    let pt = tips[0];
    [...tips.slice(1), attach].forEach((t, i) => {
      out.push(shard([(wrist[0] + pt[0] + t[0]) / 3, (wrist[1] + pt[1] + t[1]) / 3 + 1], [(pt[0] + t[0]) / 2, (pt[1] + t[1]) / 2], 2.4, 'crystal', { z: z + 1.2 }));
      pt = t;
    });
  }
  return out;
}

/** Egy toll: lapos, hegyes lap középérrel (ztolltengely). */
function featherShape(b, t, w, mat, o = {}, jag = false) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const pts = [];
  for (let i = 0; i <= 10; i++) { const f = i / 10, wd = w / 2 * Math.sin(Math.PI * Math.min(1, f * 0.95 + 0.05)) ** 0.7 * (jag && i % 2 ? 0.7 : 1); pts.push([b[0] + dx * f + nx * wd, b[1] + dy * f + ny * wd]); }
  for (let i = 10; i >= 0; i--) { const f = i / 10, wd = w / 2 * 0.8 * Math.sin(Math.PI * Math.min(1, f * 0.95 + 0.05)) ** 0.7; pts.push([b[0] + dx * f - nx * wd, b[1] + dy * f - ny * wd]); }
  return [sheet(pts, mat, { bulge: 0.7, fall: w * 0.35, smooth: 0, ...o }), tube([b, t], [0.35, 0.1], 'horn', { z: (o.z || 0) + 0.7, smooth: 0, col: [230, 220, 200] })];
}

/** Tollas szárny: evezőtollak legyezőben, fedőtollak sorai a kar mentén. */
function feathers(o) {
  const E = o.elbow || [41, 17], W = o.wrist || [47, 10], n = o.n || 7, len = o.len || 22, z = 4;
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), a = (o.spread?.[0] ?? -1.3) + ((o.spread?.[1] ?? -0.1) - (o.spread?.[0] ?? -1.3)) * f;
    const base = [W[0] + (R[0] + 6 - W[0]) * f * 0.9, W[1] + (R[1] - 2 - W[1]) * f * 0.9];
    const L = len * (1 - f * 0.45), tip = [base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L];
    const mid = [base[0] + Math.cos(a) * L * 0.55, base[1] + Math.sin(a) * L * 0.55 + 0.6];
    out.push(featherShape(base, tip, o.jag ? 3.6 : 3.2, o.mat || 'feather', { z: z - f * 0.8, alb: i % 2 ? 0.66 : 0.8 }, o.jag));
    if (o.jag) out.push(tube([mid, [mid[0] + 1.6, mid[1] + 1.2]], [0.6, 0.1], 'storm', { z: z + 1, smooth: 0 }));
  }
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    const f = i / 4, b = [E[0] + (W[0] - E[0]) * f * 0.8 - r * 1.6, E[1] + (W[1] - E[1]) * f * 0.8 + 1.2 + r * 2.4];
    out.push(featherShape(b, [b[0] + 6 - r, b[1] + 4.4 + r], 2.8, o.mat || 'feather', { z: z + 1 + r * 0.4, alb: r ? 0.7 : 0.84 }));
  }
  out.push(tube([[R[0] + 0.6, R[1] - 1.6], E, W], [1.6, 1.3, 1.0], o.mat || 'feather', { z: z + 2.2 }));
  return out.flat();
}

/** Rovarszárny: hosszú, keskeny, áttetsző hártyák erezettel (két pár). */
function insect(list) {
  const out = [];
  list.forEach(([tip, w, bend], j) => {
    const r0 = [R[0] + j * 0.8, R[1] + j * 0.6];
    const dx = tip[0] - r0[0], dy = tip[1] - r0[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, wd = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.2), bb = bend * L * Math.sin(Math.PI * t); pts.push([r0[0] + dx * t + nx * (wd / 2 + bb), r0[1] + dy * t + ny * (wd / 2 + bb)]); }
    for (let i = 12; i >= 0; i--) { const t = i / 12, wd = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.2), bb = bend * L * Math.sin(Math.PI * t); pts.push([r0[0] + dx * t - nx * (wd / 2 - bb), r0[1] + dy * t - ny * (wd / 2 - bb)]); }
    out.push(sheet(pts, 'membrane', { z: 4 - j * 0.5, bulge: 0.5, fall: 1.6, alb: 0.8 }));
    out.push(tube([r0, [r0[0] + dx * 0.5 + nx * bend * L, r0[1] + dy * 0.5 + ny * bend * L], tip], [0.5, 0.35, 0.1], 'smooth', { z: 4.8 - j * 0.5, smooth: 0, alb: 0.4 }));
    for (let k = 1; k < 7; k++) {
      const t = k / 7, c = [r0[0] + dx * t + nx * bend * L * Math.sin(Math.PI * t), r0[1] + dy * t + ny * bend * L * Math.sin(Math.PI * t)], wd = w * 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      out.push(tube([[c[0] - nx * wd, c[1] - ny * wd], [c[0] + nx * wd, c[1] + ny * wd]], 0.18, 'smooth', { z: 4.7 - j * 0.5, smooth: 0, alb: 0.42 }));
    }
  });
  out.push(ell(R[0] + 0.6, R[1], 2.2, 1.8, 0, 'smooth', { z: 5 }));
  return out;
}

/** Úszószárny: legyező alakú hártya merevítő sugarakkal. */
function fin(s, rays, a0, a1) {
  const pts = [R], out = [];
  for (let i = 0; i <= rays; i++) {
    const a = a0 + (a1 - a0) * i / rays, L = s * (0.75 + 0.25 * Math.sin(Math.PI * i / rays)), t = [R[0] + Math.cos(a) * L, R[1] + Math.sin(a) * L];
    if (i) { const am = a - (a1 - a0) / rays / 2; pts.push([R[0] + Math.cos(am) * L * 0.86, R[1] + Math.sin(am) * L * 0.86]); }
    pts.push(t);
    out.push(tube([[R[0] + Math.cos(a) * 2, R[1] + Math.sin(a) * 2], t], [0.55, 0.15], 'bone', { z: 5, smooth: 0 }));
  }
  return [sheet(pts, 'membrane', { z: 4, bulge: 0.6, fall: 2 }), ...out];
}

/** Kristályszárny: legyezőbe rendezett prizmák. */
function crystals(list, mat = 'crystal') {
  return [...list.map(([tip, w, from]) => shard(from || R, tip, w, mat, { z: 4 })), ell(R[0], R[1], 2.4, 2, 0, 'smooth', { z: 5 })];
}

export function wingDesign(n) {
  switch (n) {
    case 1: return bat({ elbow: [38.6, 21], wrist: [42, 16.6], tips: [[39.6, 10.4], [46.6, 11.4], [50.4, 16.6]], attach: [47, 25], scallop: 0.22, arm: [1.9, 1.5, 1.3], finger: 1, claws: false });
    case 2: return bat({ elbow: [38.8, 19.4], wrist: [43, 13], tips: [[44, 1.2], [54, 3], [60.6, 10.6]], attach: [56, 25] });
    case 3: return bat({ elbow: [38.6, 18.6], wrist: [42.6, 12], tips: [[40.4, 0.8], [50.6, 0.6], [59, 4.6], [63, 13], [62, 21.4]], attach: [57, 26], scallop: 0.34 });
    case 4: return crystals([[[41, 1.6], 3.6], [[48.6, 2.4], 4.0], [[55.6, 7.4], 3.8], [[59.6, 14.4], 3.2], [[57.4, 21], 2.6], [[45, 9], 2.6, [40, 18]]]);
    case 5: return bat({ elbow: [38.8, 19], wrist: [43, 12.6], tips: [[42, 1], [52, 1.6], [59.6, 7.6], [62, 16.4]], attach: [56, 25], jag: 2, holes: [[49, 10.4, 1.4], [53.4, 15.6, 1.1]], embers: [[46.4, 17, 0.8], [55, 9, 0.6], [50.6, 20, 0.6]] });
    case 6: return feathers({ n: 7, len: 21, jag: true, spread: [-1.35, -0.1] });
    case 7: return bat({ elbow: [38.4, 18], wrist: [42.4, 10.6], tips: [[38.6, 0.6], [48.6, 0.4], [57.6, 3], [62.8, 10.6], [63, 19.6]], attach: [58, 26.4], arm: [2.4, 1.8, 1.5], finger: 1.05, mem: 'hide', memOpt: { alb: 0.55 } });
    case 8: return bat({ elbow: [38.8, 19], wrist: [43, 12.6], tips: [[42.4, 1], [52.4, 1.6], [59.6, 7.6], [62, 15.6]], attach: [56, 24.6], jag: 3, tatters: 5, mem: 'membrane', memOpt: { alb: 0.42 } });
    case 9: return bat({ elbow: [38.8, 18.6], wrist: [43, 12], tips: [[41.6, 0.6], [52, 1], [60, 6.6], [63, 15]], attach: [57, 25], scallop: 0.22, facets: true });
    case 10: return feathers({ n: 8, len: 22, spread: [-1.4, -0.05] });
    case 11: return insect([[[52, 3], 4.6, 0.04], [[58.6, 10.6], 4.4, 0.05], [[60, 19], 3.6, 0.03]]);
    case 12: return fin(16, 7, -2.0, -0.35);
    case 13: return [...bat({ elbow: [38.4, 21.6], wrist: [43, 18.4], tips: [[47, 14.6], [53.4, 17.4], [56, 22.6]], attach: [51, 26.4], arm: [1.6, 1.2, 1], z: 2 }),
      ...bat({ elbow: [39.4, 17.4], wrist: [43.6, 10.4], tips: [[39.6, 3.4], [48, 4.4], [52.4, 10]], attach: [49, 22], z: 6 })];
    case 14: return crystals([[[38.6, 0.8], 3.2, [37, 24]], [[45, 0.4], 4.2], [[52.4, 3.2], 4.6], [[58.6, 8.6], 4.4], [[61.6, 15.6], 3.8], [[60, 21.6], 3], [[51, 10], 3.0, [44, 16]]], 'amethyst');
    case 15: return bat({ elbow: [38.8, 18.8], wrist: [43, 12.4], tips: [[42, 1], [52, 1.4], [59.6, 7.4], [62.4, 15.4]], attach: [56.4, 25], scallop: 0.42, holes: [[47.6, 6.6, 1.6], [53.6, 12.6, 2.0], [49.6, 18.4, 1.3]], holeCol: [36, 30, 50] });
    case 16: return bat({ elbow: [37.6, 23.6], wrist: [40, 20.6], tips: [[39.6, 16.4], [44, 17.6], [45.6, 21.4]], attach: [43, 26.4], arm: [1.6, 1.2, 1], finger: 0.9, claws: false, thumb: false });
    case 17: return insect([[[56, 4.4], 6.6, -0.18], [[61, 14.6], 5.4, -0.16]]);
    default: return bat({ elbow: [38.4, 18.4], wrist: [42.4, 11.6], tips: [[38.6, 0.8], [47.4, 0.4], [55.4, 2.4], [61, 8.4], [63.2, 17], [62, 26]], attach: [57, 31], scallop: 0.2, mem: 'hide', memOpt: { alb: 0.5 } });
  }
}
