/* =====================================================================
   TEST — 18 törzs. A nyak a (26, 20)-ban ér véget (oda jön a fej), a
   törzs lefedi a csípőket (36, 38) és (50, 38), a szárnytő (36, 27).
   ===================================================================== */
import { tube, ell, sheet, horn, shard, plate, prism, backline, along, qcurve } from './lib.mjs';

/** Közös váz: nyak + mellkas + törzs + far + farok. */
function torso(o) {
  const m = o.mat || 'skin';
  const B = (v) => (o.belly === false ? undefined : v);
  return [
    tube(o.neck, o.neckR, m, { belly: B([-0.25, -0.85]), z: o.z || 0, smooth: 2 }),
    ell(...o.chest, m, { belly: B([0.25, 0.9]), smooth: 2.4 }),
    tube(o.barrel, o.barrelR.map((r) => r * 1.06), m, { belly: B([-0.3, -0.9]), smooth: 2.4 }),
    ell(...o.haunch, m, { belly: B([0.35, 0.95]), smooth: 2.4 }),
    tube(o.tail, o.tailR, m, { belly: B([0.35, 0.9]), smooth: 1.8 }),
  ];
}
const STD = {
  neck: [[26, 19.5], [29, 22.4], [31.4, 26], [34, 30]], neckR: [3.2, 3.8, 4.8, 6],
  chest: [37.5, 33, 8.4, 7.8, -0.1], barrel: [[35, 33], [43, 34.4], [50.5, 34.5]], barrelR: [7, 6.6, 7],
  haunch: [50.5, 34, 8.8, 8.2, 0.1], tail: [[55.5, 32], [60, 30], [62.5, 23], [60.4, 13.6]], tailR: [5, 3.2, 1.6, 0.6],
};

/** Hátdísz a sziluett mentén. */
function ridge(core, x0, x1, n, fn) {
  const line = backline(core, x0, x1);
  return along(line, n).map((q, i) => fn(q, i));
}
const spike = (len, w, mat = 'horn', lean = -0.25, o = {}) => (q) => {
  const tip = [q.x + q.nx * len + lean * len, q.y + q.ny * len];
  return horn([q.x - q.nx * 1.2, q.y - q.ny * 1.2], tip, w, -0.12, mat, o);
};
/** Farokvég a farok utolsó két pontja szerint. */
function tailTip(tail, kind, s = 1) {
  const e = tail[tail.length - 1], q = tail[tail.length - 2];
  const dx = e[0] - q[0], dy = e[1] - q[1], l = Math.hypot(dx, dy) || 1;
  const tx = dx / l, ty = dy / l, nx = -ty, ny = tx;
  const at = (a, b) => [e[0] + tx * a + nx * b, e[1] + ty * a + ny * b];
  switch (kind) {
    case 'tuft': return [tube([at(-1, 0), at(3, 0.6), at(6 * s, -0.4)], [1.6, 1.4, 0.2], 'fur'), tube([at(-1, 0), at(3, 2.4), at(4.6 * s, 4 * s)], [1.3, 1.1, 0.2], 'fur'), tube([at(-1, 0), at(3, -2.2), at(4.6 * s, -4 * s)], [1.3, 1.1, 0.2], 'fur')];
    case 'club': return [ell(...at(1.2, 0), 4 * s, 3.4 * s, Math.atan2(ty, tx), 'armor', { smooth: 0.6 }), ...[[0.6, 1], [0.6, -1], [3.6, 0], [2.2, 0.8]].map(([a, b]) => horn(at(a, b * 2.8 * s), at(a * 1.3, b * 6.2 * s + (b ? 0 : 0)), 2, 0, 'bone'))];
    case 'spiked': return [[-3, 1], [-3, -1], [0.4, 1], [0.4, -1]].map(([a, b]) => horn(at(a, 0), at(a + 2.4, b * 6.4 * s), 2.2, 0, 'horn'));
    case 'arrow': return [prism([at(-1.6, 0), at(-0.6, 3.4 * s), at(6.2 * s, 0), at(-0.6, -3.4 * s)], [at(-1.6, 0), at(6.2 * s, 0)], 'dark', { h: 1.6, smooth: 0 })];
    case 'shard': return [shard(at(-2, 0), at(8 * s, 0), 3.6 * s), shard(at(-1, 0), at(4, 4.6 * s), 2.2 * s)];
    case 'fin': return [sheet([at(-3, 1.2), at(2, 5.2 * s), at(7 * s, 2.4 * s), at(4, 0), at(7 * s, -2.6 * s), at(2, -5 * s), at(-3, -1.2)], 'membrane', { bulge: 0.5, fall: 1.5, z: -0.5 })];
    case 'fan': return [-2, -1, 0, 1, 2].map((i) => tube([at(-0.6, 0), at(3.4 * s * Math.cos(i * 0.36), 3.4 * s * Math.sin(i * 0.36)), at(6.6 * s * Math.cos(i * 0.38), 6.6 * s * Math.sin(i * 0.38))], [0.9, 1.3, 0.2], 'feather', { smooth: 0, z: i * 0.2 }));
    case 'flame': return [tube([at(-1, 0), at(3, -1), at(7 * s, 1)], [1.8, 1.4, 0.15], 'lava', { smooth: 0 }), tube([at(-1, 0.5), at(2.6, 3), at(5 * s, 4.6 * s)], [1.2, 1, 0.1], 'ember', { smooth: 0 })];
    case 'crystalfan': return [-1, 0, 1].map((i) => shard(at(-1, 0), at(7 * s * Math.cos(i * 0.5), 7 * s * Math.sin(i * 0.5)), 2.6 * s, 'amethyst'));
    case 'wisp': return [0, 1, -1].map((i) => tube([at(-2, 0), at(3, i * 2 + 1), at(7, i * 3.4), at(9 * s, i * 5 - 1)], [1.8, 1.4, 0.8, 0.1], 'smooth', { alb: 0.85, smooth: 0.6 }));
  }
  return [];
}

export function bodyDesign(n) {
  switch (n) {

  /* 1 — Karcsú gyíktest, bóbitás farok */
  case 1: {
    const tail = [[55, 32.4], [59.6, 30.4], [62.2, 23], [59.4, 15], [55, 11.6]];
    const core = torso({ ...STD, neckR: [3, 3.4, 4.2, 5.2], chest: [37, 33, 7, 6.4, -0.1], barrel: [[35, 33.4], [43, 34.6], [50.5, 34]], barrelR: [5.8, 5.2, 5.8], haunch: [50.5, 33.8, 7.2, 6.8, 0.1], tail, tailR: [4.4, 3, 1.8, 1.1, 0.8] });
    return [...core, ...ridge(core, 27, 56, 10, spike(1.8, 1.8, 'horn')), ...tailTip(tail, 'tuft')];
  }
  /* 2 — Pikkelyes: a klasszikus, puha tüskesorral */
  case 2: {
    const core = torso(STD);
    return [...core, ...ridge(core, 27, 62, 14, (q, i) => spike(2.2 + 2 * Math.sin(q.f * Math.PI), 2.6)(q))];
  }
  /* 3 — Páncélos: kupolás, sávos páncélhát dudorokkal, buzogányfarok */
  case 3: {
    const tail = [[55, 34], [58.4, 33], [59.8, 30]];
    const parts = [
      tube([[26, 19.5], [28, 23.6], [29.6, 27], [32, 30.6]], [3.6, 4.4, 5.6, 6.6], 'skin', { belly: [-0.25, -0.85] }),
      ell(38, 35, 8.6, 6.4, 0, 'skin', { belly: [0.2, 0.9] }), ell(51, 35, 8.6, 6.4, 0, 'skin', { belly: [0.2, 0.9] }),
      tube(tail, [5, 4, 3.2], 'skin'),
      ell(44.5, 29.5, 15, 9.6, 0, 'armor', { smooth: 0.4, scale: 1.1, rz: 11 }),
    ];
    for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) {
      const x = 34 + i * 4.4 + k * 0.4, y = 23.4 + k * 3.6 + Math.abs(i - 2.6) * 0.7;
      parts.push(ell(x, y, 0.9, 0.8, 0, 'bone', { z: 11 - k * 1.5 - Math.abs(i - 2.5) * 0.8, smooth: 0 }));
    }
    parts.push(tube([[30, 34.5], [44, 36.6], [59, 34.4]], [1.4, 1.6, 1.3], 'armor', { z: 6, smooth: 0 }));
    return [...parts, ...tailTip(tail, 'club', 1.05)];
  }
  /* 4 — Jégpáncél: ívelt hát, jégkristály-sor, kristálypenge a farkon */
  case 4: {
    const tail = [[56, 31.4], [60.6, 29], [62.4, 22], [60, 15.4]];
    const core = torso({ ...STD, neck: [[26, 19.5], [29.4, 21.6], [32, 23.6], [34.6, 27]], chest: [38, 31, 8.2, 7.4, -0.16], barrel: [[35.5, 31], [43, 32], [51, 33.4]], barrelR: [7, 6.6, 7], haunch: [50.5, 33, 8.8, 8.2, 0.14], tail, tailR: [4.8, 3, 1.4, 0.7] });
    return [...core, ...ridge(core, 28, 60, 9, (q, i) => shard([q.x - q.nx * 1.5, q.y - q.ny * 1.5], [q.x + q.nx * (4 + 5 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.7 : 1) + 1, q.y + q.ny * (4 + 5 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.7 : 1)], 3.2)), ...tailTip(tail, 'shard')];
  }
  /* 5 — Izzó: sötét bazaltlemezek, köztük izzó repedések, lánguszony */
  case 5: {
    const tail = [[55.5, 32], [60, 30], [62.5, 23], [60.4, 14]];
    const core = torso({ ...STD, mat: 'armor', tail });
    const cracks = [
      [[31, 30], [34, 32], [33, 35], [36, 38]], [[38, 27], [40, 31], [39, 34], [42, 37]], [[45, 28], [47, 31], [46, 35], [48, 39]],
      [[52, 28], [54, 31], [53, 35]], [[33, 33.4], [40, 34], [47, 33.6], [56, 34.6]],
    ].map((pts) => tube(pts, [0.4, 0.5, 0.4, 0.3], 'lava', { z: 7.6, smooth: 0 }));
    return [...core, ...cracks, ...ridge(core, 28, 58, 8, (q) => plate([q.x - q.nx * 1.4, q.y - q.ny * 1.4], [q.x + q.nx * (2.4 + 2.6 * Math.sin(q.f * Math.PI)) + 0.8, q.y + q.ny * (2.4 + 2.6 * Math.sin(q.f * Math.PI))], 4.2, 'armor')), ...tailTip(tail, 'flame')];
  }
  /* 6 — Viharbőr: agárszerű, mély mellkas, behúzott has, villámos úszó */
  case 6: {
    const tail = [[55, 31], [59.4, 28], [62.6, 20.4], [61, 11], [57.4, 6.6]];
    const core = [
      tube([[26, 19.5], [29.6, 21.4], [32.4, 23.6], [35, 27]], [3, 3.6, 4.6, 5.4], 'smooth', { belly: [-0.25, -0.85] }),
      ell(37.6, 31.6, 7.6, 8.6, -0.25, 'smooth', { belly: [0.3, 0.95] }),
      tube([[37, 30], [44, 30.8], [51, 31.4]], [5.2, 3.8, 5], 'smooth', { belly: [-0.3, -0.9] }),
      ell(50.6, 32.4, 7.2, 7.2, 0.2, 'smooth', { belly: [0.35, 0.95] }),
      tube(tail, [4, 2.6, 1.6, 1, 0.6], 'smooth'),
    ];
    const line = backline(core, 28, 62);
    const fin = [];
    along(line, 22, 0.02, 0.95).forEach((q, i) => fin.push([q.x + q.nx * (2.2 + 3 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.75 : 1), q.y + q.ny * (2.2 + 3 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.75 : 1)]));
    const baseL = along(line, 22, 0.02, 0.95).map((q) => [q.x - q.nx * 1.5, q.y - q.ny * 1.5]).reverse();
    const streaks = [[[31, 26], [34, 28], [32.6, 29.6], [37, 31]], [[41, 27.6], [44, 29], [42.4, 30.6], [47, 31.6]], [[50, 27.6], [52.6, 29.2], [51.4, 30.6], [55, 32]]]
      .map((pts) => tube(pts, 0.32, 'storm', { z: 7.4, smooth: 0, per: 3 }));
    return [sheet([...fin, ...baseL], 'membrane', { z: -1, bulge: 0.6, fall: 1.2 }), ...core, ...streaks, ...tailTip(tail, 'fin', 0.9)];
  }
  /* 7 — Ősi test: púpos óriás, váltakozó hátlemezek, tüskés farokvég */
  case 7: {
    const tail = [[57, 33], [60.4, 31], [61.6, 26.4], [60, 21]];
    const core = torso({ neck: [[26, 19.5], [28.4, 23], [30.6, 26.4], [33.4, 30]], neckR: [3.8, 4.6, 5.8, 7], chest: [38, 32, 10, 9.4, -0.1], barrel: [[35, 33.5], [44, 33], [51, 35]], barrelR: [9, 8.6, 9.2], haunch: [51, 33.6, 10, 9.4, 0.08], tail, tailR: [6.2, 4.2, 2.6, 1.6], mat: 'hide' });
    return [...ridge(core, 30, 60, 8, (q, i) => plate([q.x - q.nx * 2, q.y - q.ny * 2], [q.x + q.nx * (4 + 6 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.7 : 1) + 1, q.y + q.ny * (4 + 6 * Math.sin(q.f * Math.PI)) * (i % 2 ? 0.7 : 1)], 6, 'armor', { z: i % 2 ? -1 : 0.5 })),
      ...core, ...tailTip(tail, 'spiked', 1.1)];
  }
  /* 8 — Árnyéktest: sovány, kilátszó bordák, magas tűtüskék, ostorfarok */
  case 8: {
    const tail = [[54.6, 32], [59, 30], [62, 22], [60, 13], [54.6, 7], [50, 8.6], [51.4, 12]];
    const core = torso({ neck: [[26, 19.5], [29, 22.6], [30.6, 26], [33, 30]], neckR: [2.4, 2.8, 3.4, 4.2], chest: [37.4, 32.4, 6.8, 6.4, -0.12], barrel: [[35, 33], [43, 33.6], [50, 34.6]], barrelR: [5.2, 3.6, 5.2], haunch: [50, 34.2, 6.8, 6.6, 0.1], tail, tailR: [3.6, 2.2, 1.4, 1, 0.7, 0.5, 0.3], mat: 'dark' });
    const ribs = [];
    for (let i = 0; i < 6; i++) { const x = 33.4 + i * 2.8; ribs.push(tube([[x, 28], [x - 2, 32], [x + 0.4, 37 - Math.abs(i - 2) * 0.3]], [0.7, 0.75, 0.5], 'dark', { z: 4.6, alb: 0.5, smooth: 0.4 })); }
    return [...core, ...ribs, ...ridge(core, 27, 61, 12, (q, i) => spike((3 + 4.6 * Math.sin(q.f * Math.PI)) * (i % 3 === 1 ? 0.6 : 1), 1.4, 'claw', -0.35)(q))];
  }
  /* 9 — Titkos test: királyi legyezővitorla, kristálylegyező a farkon */
  case 9: {
    const tail = [[56, 31.4], [60.6, 29], [62.4, 22], [60, 15]];
    const core = torso({ ...STD, neck: [[26, 19.5], [29.4, 21.6], [32, 23.6], [34.6, 27]], chest: [38, 31, 8.2, 7.4, -0.16], barrel: [[35.5, 31], [43, 32], [51, 33.4]], haunch: [50.5, 33, 8.8, 8.2, 0.14], tail, tailR: [4.8, 3, 1.4, 0.8], mat: 'smooth' });
    return [...sail(core, 29, 57, (f) => 3 + 9 * Math.sin(f * Math.PI) ** 0.8, 8), ...core, ...tailTip(tail, 'crystalfan')];
  }
  /* 10 — Kígyótest: hosszú, hullámzó test, hurokba csavarodó farok */
  case 10: {
    const pts = [[26, 19.5], [28.4, 24.6], [32, 30], [38, 34.4], [45, 35.6], [52, 34], [58, 29.6], [61.4, 22], [59, 14], [52.6, 10.4], [47.6, 13.6], [49.4, 19], [54.4, 19.6]];
    const core = [tube(pts, [3, 4.4, 5.6, 6.2, 6.2, 5.6, 4.6, 3.6, 2.8, 2.2, 1.6, 1, 0.5], 'skin', { belly: [-0.35, -0.9], per: 8 }), ell(38.6, 34.6, 6.4, 5.8, 0, 'skin', { belly: [0.3, 0.95] }), ell(49.8, 35, 6.4, 5.6, 0, 'skin', { belly: [0.3, 0.95] })];
    return [...core, ...ridge(core, 28, 58, 12, spike(1.4, 1.6, 'horn', -0.2))];
  }
  /* 11 — Zömök test: hordóhas, rövid vastag nyak, csonka buzogányfarok */
  case 11: {
    const tail = [[56, 35.4], [58.6, 34.2], [59.4, 31.6]];
    const core = [
      tube([[26, 19.5], [27.6, 23.6], [29.4, 27], [32, 30.4]], [4, 5, 6.4, 7.6], 'skin', { belly: [-0.25, -0.85] }),
      ell(44, 33.4, 13.4, 10.4, 0.02, 'skin', { belly: [0.15, 0.85] }), ell(37, 31.6, 8, 7.6, -0.2, 'skin', { belly: [0.3, 0.9] }),
      tube(tail, [5.4, 4.4, 3.4], 'skin'),
    ];
    return [...core, ...ridge(core, 28, 57, 7, spike(1.6, 2.6, 'horn', -0.2)), ...tailTip(tail, 'club', 0.95)];
  }
  /* 12 — Bordás test: kidomborodó bordakosár, tüskés gerinc, nyílhegy-farok */
  case 12: {
    const tail = [[55, 32], [59.6, 30], [62.4, 23], [60, 14.6]];
    const core = torso({ neck: [[26, 19.5], [29, 22.4], [31, 25.6], [33.4, 29.6]], neckR: [2.8, 3.2, 4, 5], chest: [38.6, 32.6, 8.6, 7.4, -0.05], barrel: [[36, 33], [44, 34], [50, 34.6]], barrelR: [6.2, 5, 6], haunch: [50.4, 34, 7.6, 7.2, 0.1], tail, tailR: [4, 2.6, 1.4, 0.7], mat: 'hide' });
    const ribs = [];
    for (let i = 0; i < 7; i++) { const x = 31.8 + i * 3; ribs.push(tube([[x + 1, 26.6 + Math.abs(i - 3) * 0.3], [x - 2.4, 32], [x + 0.6, 38.4 - Math.abs(i - 3) * 0.3]], [1.1, 1.2, 0.7], 'hide', { z: 6, smooth: 0.7 })); }
    return [...core, ...ribs, ...ridge(core, 27, 61, 10, spike(2.6, 2.2, 'horn')), ...tailTip(tail, 'arrow')];
  }
  /* 13 — Íves hát: magas púp, széles vitorla, tolllegyező farok */
  case 13: {
    const tail = [[55.4, 31], [59.6, 28.4], [61.4, 21.6], [58.6, 14.6]];
    const core = [
      tube([[26, 19.5], [29.6, 21.2], [32.6, 22.6], [35.4, 25.6]], [3, 3.6, 4.6, 5.4], 'skin', { belly: [-0.25, -0.85] }),
      ell(39, 30, 8.4, 8.2, -0.3, 'skin', { belly: [0.35, 0.95] }), ell(46, 28.6, 7.4, 7.4, 0, 'skin'), ell(51, 32.6, 8.2, 7.6, 0.2, 'skin', { belly: [0.35, 0.95] }),
      tube([[37, 34], [44, 35.4], [50, 35.4]], [5, 5, 5], 'skin', { belly: [-0.3, -0.9] }), tube(tail, [4.6, 3, 1.6, 0.8], 'skin'),
    ];
    return [...sail(core, 30, 57, (f) => 3 + 7 * Math.sin(f * Math.PI), 8), ...core, ...tailTip(tail, 'fan', 1.15)];
  }
  /* 14 — Vasbordájú: hosszú, alacsony test, szegecselt vaspántok, tüskés farok */
  case 14: {
    const tail = [[57, 34], [60.4, 31.6], [61.6, 26], [59, 19]];
    const core = torso({ neck: [[26, 19.5], [28.6, 23], [30.4, 27], [33, 31.6]], neckR: [3.2, 3.8, 5, 6.2], chest: [37, 34.6, 8, 7.4, -0.06], barrel: [[34.5, 35.4], [44, 35.6], [53, 36.4]], barrelR: [7.4, 7.2, 7.4], haunch: [53, 35.6, 8.6, 7.8, 0.05], tail, tailR: [5, 3.4, 1.8, 0.8] });
    const bands = [];
    [33, 38.6, 44.2, 49.8, 55.4].forEach((x) => {
      bands.push(tube([[x + 0.6, 27.2], [x - 0.4, 34.6], [x - 1, 42]], [1.1, 1.2, 1.1], 'metal', { z: 6.8, smooth: 0 }));
      [29.6, 33.4, 37.2].forEach((y) => bands.push(ell(x - (y - 28) * 0.08, y, 0.45, 0.45, 0, 'metal', { z: 8.2, smooth: 0 })));
    });
    return [...core, ...bands, ...ridge(core, 27, 62, 10, spike(2.4, 2.6, 'metal')), ...tailTip(tail, 'spiked')];
  }
  /* 15 — Mohos test: hosszú, bozontos mohabunda, lelógó mohaszálak */
  case 15: {
    const tail = [[57, 34], [60.4, 31.6], [61.6, 26], [59, 19]];
    const core = torso({ neck: [[26, 19.5], [28.6, 23], [30.4, 27], [33, 31.6]], neckR: [3.4, 4, 5.2, 6.4], chest: [37, 34.6, 8, 7.4, -0.06], barrel: [[34.5, 35.4], [44, 35.6], [53, 36.4]], barrelR: [7.4, 7.2, 7.4], haunch: [53, 35.6, 8.6, 7.8, 0.05], tail, tailR: [5, 3.4, 1.8, 1], mat: 'hide' });
    const moss = ridge(core, 29, 60, 11, (q, i) => ell(q.x + 0.5, q.y + 1.2, 3 + (i % 3) * 0.6, 2.2, 0, 'moss', { z: 3, smooth: 0.8 }));
    const hang = [34, 38.6, 43, 47.6, 52, 56].map((x, i) => tube([[x, 40.6], [x + 0.6, 43], [x + 1.2, 45.6 + (i % 2) * 1.6]], [1.1, 0.8, 0.15], 'moss', { z: 5, smooth: 0 }));
    return [...core, ...moss, ...hang, ...tailTip(tail, 'tuft', 1.2)];
  }
  /* 16 — Ködtest: kígyózó test, ami ködfoszlányokra bomlik */
  case 16: {
    const pts = [[26, 19.5], [28.4, 24.6], [32, 30], [38, 34], [45, 35], [52, 33.4], [57.6, 29], [60, 22.6], [58, 16]];
    const core = [tube(pts, [3, 4.2, 5.4, 6, 6, 5.2, 4, 3, 2], 'smooth', { belly: [-0.35, -0.9], per: 8 }), ell(38.6, 34, 6.4, 5.6, 0, 'smooth', { belly: [0.3, 0.95] }), ell(49.8, 34.4, 6.4, 5.4, 0, 'smooth', { belly: [0.3, 0.95] })];
    const wisps = [[[52, 30], [62, 31.6]], [[50, 33], [58.6, 40]], [[45, 34], [49.6, 42.6]]].map(([b, t]) => tube([b, [(b[0] + t[0]) / 2 + 1, (b[1] + t[1]) / 2 - 1], t], [1.8, 1.2, 0.1], 'smooth', { alb: 0.88, z: -2, smooth: 0.5 }));
    return [...wisps, ...core, ...tailTip(pts, 'wisp', 1.2)];
  }
  /* 17 — Csontváz: csigolyák, különálló bordák, medence */
  case 17: {
    const spine = [[26, 19.5], [29, 23], [33, 26.4], [40, 27.6], [47, 27.4], [53, 28.4], [58, 27.6], [61.4, 22], [61, 15], [58.6, 10]];
    const parts = [tube(spine, [2, 2.2, 2.2, 2, 2, 2, 1.7, 1.3, 0.9, 0.5], 'dark', { per: 6, alb: 0.45 })];
    for (let i = 0; i < 6; i++) { const x = 34 + i * 2.9; parts.push(tube([[x, 27.4], [x - 2.6, 31.6], [x - 1.4, 36], [x + 1.6, 38.4 - Math.abs(i - 2) * 0.4]], [1.0, 0.9, 0.7, 0.4], 'bone', { z: 1.5, smooth: 0 })); }
    for (let i = 0; i < 26; i++) { const k = i / 25, idx = k * (spine.length - 1), j = Math.min(spine.length - 2, Math.floor(idx)), f = idx - j; const x = spine[j][0] + (spine[j + 1][0] - spine[j][0]) * f, y = spine[j][1] + (spine[j + 1][1] - spine[j][1]) * f; parts.push(ell(x, y, 1.4 * (1 - k * 0.6), 1.2 * (1 - k * 0.6), 0, 'bone', { z: 1.6, smooth: 0 })); }
    parts.push(tube([[47, 30], [51, 32.6], [55, 31]], [2.2, 2.6, 1.8], 'bone', { smooth: 0 }), tube([[50, 31], [49, 36.6]], [1.6, 1.2], 'bone', { smooth: 0 }), ell(35.6, 30.6, 3.2, 4.6, 0.5, 'bone', { smooth: 0 }));
    return [...parts, ...ridge(parts.slice(0, 1), 30, 58, 10, (q) => shard([q.x, q.y + 0.6], [q.x + q.nx * 3.6 + 0.8, q.y + q.ny * 3.6], 1.6, 'bone'))];
  }
  /* 18 — Vitorlás hát: spinoszaurusz-vitorla merevítő tüskékkel, uszonyfarok */
  default: {
    const tail = [[55.5, 32], [60, 30], [62.5, 23], [60.4, 14]];
    const core = torso({ ...STD, tail });
    return [...sail(core, 31, 56, (f) => 2 + 13 * Math.sin(f * Math.PI) ** 1.3, 9, 'horn'), ...core, ...tailTip(tail, 'fin')];
  }
  }
}

/** Vitorla: hártya a hátvonal fölött, merevítő tüskékkel. */
function sail(core, x0, x1, h, rays, rayMat = 'bone') {
  const line = backline(core, x0, x1);
  const top = along(line, 24).map((q) => [q.x + q.nx * h(q.f), q.y + q.ny * h(q.f)]);
  const base = along(line, 24).map((q) => [q.x - q.nx * 2, q.y - q.ny * 2]).reverse();
  const out = [sheet([...top, ...base], 'membrane', { z: -2, bulge: 0.8, fall: 2 })];
  along(line, rays, 0.06, 0.94).forEach((q) => out.push(tube([[q.x - q.nx * 1.5, q.y - q.ny * 1.5], [q.x + q.nx * h(q.f) * 1.04, q.y + q.ny * h(q.f) * 1.04]], [0.7, 0.2], rayMat, { z: -1.2, smooth: 0 })));
  return out;
}
