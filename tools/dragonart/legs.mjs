/* =====================================================================
   LÁB — 18 változat, öt alaptípus (a katalógus `shape`-je szerint).
   Mellső csípő (36, 38), hátsó csípő (50, 38), talaj ~ 58,5.
   A túloldali pár csak térdtől lefelé látszik (fölötte a test takarja),
   hátrébb és sötétebben — ettől mélysége lesz.
   ===================================================================== */
import { tube, ell, horn, shard, plate } from './lib.mjs';

const G = 58.4;

const SPEC = {
  1:  { type: 'digit',  thigh: [6.2, 6.4], shin: [4.2, 3.8], claw: 0.55, deco: 'chubby' },
  2:  { type: 'digit',  claw: 1.2, deco: 'scutes' },
  3:  { type: 'pillar', deco: 'wrinkles' },
  4:  { type: 'digit',  claw: 1.2, clawMat: 'crystal', deco: 'ice' },
  5:  { type: 'pillar', deco: 'lava' },
  6:  { type: 'lanky',  spur: 1, deco: 'storm' },
  7:  { type: 'pillar', thigh: [6, 6.6], shin: [4.8, 4.5], claw: 1.4, deco: 'fur' },
  8:  { type: 'lanky',  thigh: [4.2, 5.4], shin: [1.7, 1.3], claw: 1.6, spur: 1, deco: 'bone' },
  9:  { type: 'grasp',  claw: 1.2, spur: 1, deco: 'crystal' },
  10: { type: 'hoof',   deco: 'goat' },
  11: { type: 'lanky',  thigh: [4, 5.2], shin: [1.6, 1.3], foot: 6.6, deco: 'scutes' },
  12: { type: 'digit',  claw: 1.1, spur: 2, deco: 'rooster' },
  13: { type: 'grasp',  shin: [3.8, 3.2], claw: 1.5, deco: 'knuckles' },
  14: { type: 'pillar', thigh: [5.8, 6.6], shin: [4.9, 4.7], deco: 'stone' },
  15: { type: 'digit',  claw: 1.0, deco: 'spikes' },
  16: { type: 'hoof',   shin: [3.4, 2.8], deco: 'feather' },
  17: { type: 'grasp',  claw: 1.3, clawMat: 'metal', deco: 'armor' },
  18: { type: 'lanky',  thigh: [5.6, 6.8], shin: [2.6, 2], claw: 1.1, deco: 'runner' },
};
const BASE = {
  digit:  { thigh: [5.2, 6.2], shin: [3.4, 2.6], knee: 8.6, ankle: 15.6, foot: 4.8 },
  pillar: { thigh: [5.2, 6.2], shin: [4.2, 3.8], knee: 9, ankle: 16.2, foot: 4.4 },
  lanky:  { thigh: [4.6, 6], shin: [2.2, 1.7], knee: 7.4, ankle: 15.4, foot: 5.6 },
  grasp:  { thigh: [5.2, 6.2], shin: [3.2, 2.6], knee: 8.6, ankle: 15.2, foot: 5.8 },
  hoof:   { thigh: [5, 6.2], shin: [2.6, 1.9], knee: 8.6, ankle: 15.6, foot: 2.4 },
};

function leg(hx, hy, back, S, z, far) {
  const k = far ? 0.9 : 1;
  const out = [];
  const th = S.thigh, sh = S.shin, t = S.type;
  let knee = [hx + (back ? -3.6 : -1.2), hy + S.knee], ank = [hx + (back ? 1.8 : 0.6), hy + S.ankle];
  if (t === 'lanky') { knee = [hx + (back ? -4.8 : -2.8), hy + S.knee]; ank = [hx + (back ? 3 : 1.4), hy + S.ankle]; }
  if (t === 'pillar') { knee = [hx - 0.6, hy + S.knee]; ank = [hx - 0.2, hy + S.ankle]; }
  ank[1] = Math.min(ank[1], G - 3.2);
  const mat = S.mat || 'skin';
  // Comb: a csípőnél széles izomtömeg, a teteje beleolvad a törzsbe
  if (!far) out.push(tube([[hx + (back ? 1.2 : 0.2), hy - 3.4], [hx + (back ? 0.4 : -0.2), hy + 2.2], [knee[0] + (back ? 0.8 : 0.3), knee[1] - 1.4]], [th[0] * 0.95, th[0] * 0.9, sh[0] * 1.05], mat, { z, fade: [hy - 2.6, hy - 0.4], smooth: 1.6 }));
  out.push(tube([far ? [knee[0] + 0.5, knee[1] - 3] : [knee[0] + 0.3, knee[1] - 1.6], knee, ank], [sh[0] * k, sh[1] * k * 1.05, sh[1] * k], mat, { z, smooth: 1.4, ...(far ? { fade: [knee[1] - 3, knee[1] - 0.6] } : {}) }));
  const toe = [ank[0] - S.foot, G - 0.8];
  const clawMat = S.clawMat || 'claw';
  const cl = S.claw ?? 1;
  switch (t) {
    case 'pillar':
      out.push(tube([[ank[0], ank[1] - 2], [ank[0] - 0.4, G - 2.4]], [sh[1] * k, sh[1] * k * 1.15], mat, { z }));
      out.push(ell(ank[0] - 0.8, G - 2, sh[1] * k * 1.3, 2.2, 0, mat, { z }));
      for (let i = 0; i < 3; i++) out.push(ell(ank[0] - 4.2 * k + i * 2.5 * k, G - 0.9, 1.1, 0.9, 0, 'claw', { z: z + 2.6, smooth: 0, col: [210, 196, 170] }));
      break;
    case 'hoof': {
      out.push(tube([ank, [ank[0] - 0.6, G - 3]], [sh[1] * k, sh[1] * k * 0.95], mat, { z }));
      out.push(ell(ank[0] - 1.2, G - 1.6, 2.6, 1.7, 0, 'claw', { z: z + 0.5, smooth: 0, col: [70, 60, 56] }));
      break;
    }
    case 'grasp':
      out.push(ell(ank[0] - 1.4, G - 2.6, 3.4 * k, 2.4, 0, mat, { z }));
      for (let i = 0; i < 4; i++) {
        const bx = ank[0] - 2.4 - i * 1.1, tip = [bx - 3.2 - (2 - Math.abs(i - 1.5)) * 0.8, G - 0.4];
        out.push(tube([[bx + 1, G - 3 + i * 0.2], [tip[0] + 1, tip[1] - 1.1], tip], [1.1 * k, 0.95 * k, 0.75 * k], mat, { z: z + 0.4 }));
        out.push(horn([tip[0] + 0.3, tip[1] - 0.5], [tip[0] - 2.1 * cl, tip[1] + 1.1], 1.2, 0.35, clawMat, { z: z + 1.8 }));
      }
      break;
    case 'lanky':
      out.push(tube([ank, [ank[0] - 0.8, G - 1.8]], [sh[1] * k, sh[1] * k], mat, { z }));
      [[-S.foot, -0.2], [-S.foot * 0.72, 0.5], [1.8, 0.2]].forEach(([dx, dy]) => {
        const tip = [ank[0] - 0.8 + dx, G - 0.5 + dy];
        out.push(tube([[ank[0] - 0.8, G - 1.8], tip], [1.3 * k, 0.9 * k], mat, { z: z + 0.3 }));
        out.push(horn([tip[0] + (dx < 0 ? 0.4 : -0.4), tip[1] - 0.2], [tip[0] + (dx < 0 ? -2 : 1.5) * cl, tip[1] + 0.8], 1.1, dx < 0 ? 0.3 : -0.3, clawMat, { z: z + 1.6 }));
      });
      break;
    default: // digit
      out.push(tube([[ank[0] + 0.6, ank[1] - 0.6], [ank[0], G - 2.1], toe], [sh[1] * k, sh[1] * k * 0.95, sh[1] * k * 0.85], mat, { z }));
      for (let i = 0; i < 3; i++) {
        const cx = toe[0] + i * 1.8, cy = G - 0.3 - Math.abs(i - 1) * 0.3;
        out.push(horn([cx + 0.8, cy - 1.1], [cx - 1.9 * cl, cy + 1.3 * cl], 1.5, 0.3, clawMat, { z: z + 2.4 }));
      }
  }

  /* --- egyedi díszek --- */
  const mid = [(knee[0] + ank[0]) / 2, (knee[1] + ank[1]) / 2];
  const zz = z + 3;
  switch (S.deco) {
    case 'ice':
      out.push(shard([knee[0] + 1.2, knee[1] - 0.6], [knee[0] + 5.4, knee[1] - 3.8], 2, 'crystal', { z: zz }), shard([mid[0] + 1, mid[1]], [mid[0] + 4.6, mid[1] - 1.4], 1.6, 'crystal', { z: zz }));
      break;
    case 'lava':
      out.push(tube([[hx - 2.6, hy + 2], [hx - 0.8, hy + 4.6], [hx - 1.6, hy + 7], [hx, hy + 9.4]], 0.38, 'lava', { z: z + 6.2, smooth: 0 }));
      out.push(tube([[ank[0] - 2, knee[1] + 1], [ank[0] - 0.6, knee[1] + 3.4], [ank[0] - 1.6, knee[1] + 5.6]], 0.34, 'lava', { z: z + 5, smooth: 0 }));
      break;
    case 'storm':
      out.push(tube([[hx - 2, hy + 1], [hx + 0.4, hy + 3], [hx - 1, hy + 4.2], [hx + 1.6, hy + 6.6]], 0.3, 'storm', { z: z + 6, smooth: 0, per: 3 }));
      break;
    case 'fur':
      for (let i = 0; i < 4; i++) out.push(tube([[ank[0] - 3 + i * 1.8, ank[1] - 1], [ank[0] - 3.6 + i * 1.9, ank[1] + 2], [ank[0] - 4.6 + i * 2, ank[1] + 4.2]], [1, 0.8, 0.12], 'fur', { z: z + 1.2, smooth: 0 }));
      break;
    case 'bone':
      out.push(ell(knee[0], knee[1], 1.5, 1.3, 0, 'bone', { z: z + 1.6, smooth: 0 }));
      break;
    case 'crystal':
      out.push(shard([hx + 2, hy + 3], [hx + 6.6, hy + 0.6], 2.2, 'amethyst', { z: zz }));
      break;
    case 'goat':
    case 'feather': {
      const big = S.deco === 'feather';
      for (let i = 0; i < (big ? 5 : 3); i++) {
        const bx = ank[0] - 2.8 + i * 1.4;
        out.push(tube([[bx, ank[1] - (big ? 2.4 : 0.6)], [bx - 0.6, ank[1] + 1.6], [bx - 1.2 + i * 0.4, G - (big ? 0.8 : 2)]], [1.1, 0.9, 0.15], 'fur', { z: z + 1.4, smooth: 0, alb: big ? 0.85 : 0.7 }));
      }
      break;
    }
    case 'spikes':
      for (let i = 0; i < 3; i++) {
        const f = 0.2 + i * 0.3, b = [knee[0] + (ank[0] - knee[0]) * f + 1.6, knee[1] + (ank[1] - knee[1]) * f];
        out.push(horn(b, [b[0] + 3, b[1] - 2.2], 1.6, -0.1, 'horn', { z: z + 0.6 }));
      }
      out.push(horn([hx + 3.4, hy + 2], [hx + 7, hy - 0.6], 2, -0.1, 'horn', { z: z + 0.6 }));
      break;
    case 'armor':
      out.push(ell(hx, hy + 3, 4.4, 2.8, -0.1, 'metal', { z: z + 5.2, smooth: 0, rz: 0.9 }), ell(mid[0], mid[1], 3.2, 2.2, 0.3, 'metal', { z: z + 3.2, smooth: 0, rz: 0.8 }));
      break;
    case 'stone':
      out.push(ell(hx - 0.4, hy + 9, 4, 2.4, 0.1, 'armor', { z: z + 4.2, smooth: 0.3, rz: 1 }));
      break;
  }
  if (S.spur) {
    const len = S.spur > 1 ? 4.4 : 3.2;
    out.push(horn([ank[0] + 0.8, ank[1] + 0.6], [ank[0] + 0.8 + len, ank[1] + 2.2], 1.5, -0.25, 'horn', { z: z + 0.8 }));
  }
  return out;
}

export function legDesign(n, p) {
  const sp = SPEC[n] || SPEC[2];
  const S = { ...BASE[sp.type], ...sp };
  const bumps = { scutes: { bump: 'plates' }, rooster: { bump: 'plates' }, wrinkles: { bump: 'grain' }, stone: { bump: 'grain' } }[S.deco];
  S.mat = S.deco === 'lava' || S.deco === 'stone' ? 'armor' : S.deco === 'bone' ? 'dark' : S.deco === 'fur' ? 'hide' : 'skin';
  const all = [
    ...leg(39.6, 36.6, false, S, -6, true), ...leg(53.6, 36.6, true, S, -6, true),
    ...leg(36, 38, false, S, 3, false), ...leg(50, 38, true, S, 3, false),
  ];
  return bumps ? all.map((q) => (q.mat === S.mat ? { ...q, ...bumps } : q)) : all;
}
