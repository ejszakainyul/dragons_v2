/* =====================================================================
   Níðhöggr — a végső ellenfél külön rajza
   ---------------------------------------------------------------------
   Nem testrészekből áll, mint a többi sárkány: kódból rajzolt, kétszer-
   háromszor akkora szörny. Hosszú, szegmentált nyak, szarvkoronás fej
   három pár izzó szemmel és nyíló állkapoccsal, tépett bőrszárnyak,
   tüskés farok, a testén lila fénnyel izzó gyökérerek — a Világfa
   gyökeréből nőtt ki, és azt rágja ezer éve.

   A rész-képek külön textúrák, egy tárolóban mozognak (lélegzés,
   nyakringás, szárnycsapás, állkapocs). Balra néz, mint minden ellenfél.
   A részeket a közös renderelő gyártja (tools/worldart/boss.mjs →
   img/battle/boss-*.png, a csata tölti be); az itteni kódrajz csak
   tartalék, ha a képek nem érkeznek meg.
   A tároló origója a talppont (a talaj közepe a sárkány alatt).
   ===================================================================== */
import { mulberry32 } from './rules.js';

const INK = '#07040c';
const HIDE = ['#4a3a66', '#2a1f3d', '#140d1f'];      // pikkely: fény → alap → árnyék
const BONE = ['#efe6cf', '#b9ab8c', '#6e634f'];
const VEIN = '#b874ff';
const EYE = '#ffd36b';

/** A teljes alak natív magassága (képpont) — ehhez méretezünk. */
export const BOSS_NATIVE_H = 470;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

/**
 * Elvékonyodó cső (nyak, farok, láb) körök láncából: körvonal, árnyékos
 * alsó fél, alapszín, bal-felső fény — így szerves, kerek hatású.
 */
function tube(ctx, curve, r0, r1, n = 60, cols = HIDE) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([...bez(...curve, t), r0 + (r1 - r0) * t]);
  }
  const pass = (fill, dr, ox, oy, k = 1) => {
    ctx.fillStyle = fill;
    for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x + ox * r, y + oy * r, Math.max(1, r * k + dr), 0, Math.PI * 2); ctx.fill(); }
  };
  pass(INK, 3.5, 0, 0);
  pass(cols[2], 0, 0, 0);
  pass(cols[1], 0, -0.12, -0.16, 0.86);
  pass(cols[0], 0, -0.3, -0.38, 0.42);
  return pts;
}

/** Csont színű, ívelt, elvékonyodó szarv / tüske / karom. */
function horn(ctx, base, tip, width, bend = 0.25, cols = BONE) {
  const [bx, by] = base, [tx, ty] = tip;
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;                    // normális
  const cx = bx + dx * 0.5 + nx * len * bend, cy = by + dy * 0.5 + ny * len * bend;
  ctx.beginPath();
  ctx.moveTo(bx + nx * width / 2, by + ny * width / 2);
  ctx.quadraticCurveTo(cx + nx * width * 0.25, cy + ny * width * 0.25, tx, ty);
  ctx.quadraticCurveTo(cx - nx * width * 0.25, cy - ny * width * 0.25, bx - nx * width / 2, by - ny * width / 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(bx, by, tx, ty);
  g.addColorStop(0, cols[2]); g.addColorStop(0.35, cols[1]); g.addColorStop(1, cols[0]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  // gyűrűs barázdák
  ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 1.2;
  for (let k = 0.2; k < 0.7; k += 0.15) {
    const px = bx + dx * k + nx * len * bend * 0.6 * (1 - Math.abs(0.5 - k)), py = by + dy * k + ny * len * bend * 0.6 * (1 - Math.abs(0.5 - k));
    const w = width * (1 - k) * 0.5;
    ctx.beginPath(); ctx.moveTo(px + nx * w, py + ny * w); ctx.lineTo(px - nx * w, py - ny * w); ctx.stroke();
  }
}

/** Izzó gyökérerek egy alakzaton belül (vágómaszk mellett hívandó). */
function veins(ctx, rng, x0, y0, x1, y1, count, len = 9) {
  ctx.save();
  ctx.strokeStyle = VEIN; ctx.shadowColor = VEIN; ctx.shadowBlur = 9; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
    let a = rng() * Math.PI * 2;
    ctx.lineWidth = 1.2 + rng() * 1.6;
    ctx.globalAlpha = 0.55 + rng() * 0.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < len; k++) {
      a += (rng() - 0.5) * 0.9;
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      ctx.lineTo(x, y);
      if (rng() < 0.18) { ctx.moveTo(x, y); a += (rng() < 0.5 ? -1 : 1) * 0.9; }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Pikkelymintázat: apró, fénytől elforduló ívek. */
function scales(ctx, rng, x0, y0, x1, y1, count) {
  ctx.save();
  ctx.lineWidth = 1.3;
  for (let i = 0; i < count; i++) {
    const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0), r = 4 + rng() * 6;
    ctx.strokeStyle = rng() < 0.6 ? 'rgba(0,0,0,.35)' : 'rgba(150,130,200,.18)';
    ctx.beginPath(); ctx.arc(x, y, r, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
}

/* --- Szárny ---------------------------------------------------------- */
function drawWing(ctx, rng, near) {
  const R = [70, 360], E = [200, 170], Wr = [320, 70];
  const F = [[475, 30], [470, 170], [420, 290], [320, 360]];
  const bone = near ? BONE : ['#8f8470', '#6b6150', '#3e382d'];
  // hártya: a gyökértől a csuklón át az ujjhegyekig, csipkés, tépett szél
  ctx.beginPath();
  ctx.moveTo(...R); ctx.lineTo(...E); ctx.lineTo(...Wr); ctx.lineTo(...F[0]);
  for (let i = 1; i < F.length; i++) {
    const a = F[i - 1], b = F[i];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const pull = 0.32 + rng() * 0.1;
    const cx = mx + (Wr[0] - mx) * pull, cy = my + (Wr[1] - my) * pull;
    // tépett szél: néhány cikk-cakk a hullámívben
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const qx = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0];
      const qy = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
      ctx.lineTo(qx + (s < steps ? (rng() - 0.5) * 12 : 0), qy + (s < steps ? (rng() - 0.5) * 12 : 0));
    }
  }
  ctx.quadraticCurveTo(210, 400, R[0] + 10, R[1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(R[0], R[1], 470, 40);
  g.addColorStop(0, near ? '#2c1d3c' : '#1a1224');
  g.addColorStop(0.6, near ? '#43305c' : '#271b36');
  g.addColorStop(1, near ? '#5a4478' : '#33264a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();

  ctx.save(); ctx.clip();
  // erek a csuklóból, és gyökérfény
  ctx.strokeStyle = 'rgba(10,6,16,.55)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const f = F[i % F.length];
    ctx.beginPath(); ctx.moveTo(...Wr);
    ctx.quadraticCurveTo((Wr[0] + f[0]) / 2 + (rng() - 0.5) * 60, (Wr[1] + f[1]) / 2 + (rng() - 0.5) * 60, f[0] + (rng() - 0.5) * 80, f[1] + (rng() - 0.5) * 80);
    ctx.stroke();
  }
  if (near) veins(ctx, rng, 120, 150, 380, 320, 5, 8);
  // lyukak: kiszakadt hártya
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (near ? 4 : 3); i++) {
    const hx = 220 + rng() * 200, hy = 140 + rng() * 180, r = 8 + rng() * 14;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; ctx.lineTo(hx + Math.cos(a) * r * (0.6 + rng() * 0.6), hy + Math.sin(a) * r * (0.6 + rng() * 0.6)); }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // csontváz: kar és ujjak
  const limb = (a, b, w) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    ctx.strokeStyle = bone[1]; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    ctx.strokeStyle = bone[0]; ctx.lineWidth = w * 0.35; ctx.beginPath(); ctx.moveTo(a[0] - 1, a[1] - 2); ctx.lineTo(b[0] - 1, b[1] - 2); ctx.stroke();
  };
  limb(R, E, 22); limb(E, Wr, 16);
  for (const f of F) limb(Wr, f, 7);
  // karom a csuklón
  horn(ctx, [Wr[0] - 4, Wr[1] - 6], [Wr[0] - 34, Wr[1] - 40], 12, -0.35, bone);
}

/* --- Test (törzs + hátsó láb) --------------------------------------- */
function drawBody(ctx, rng) {
  // A canvas 440×340, a talaj y=332, balra néz (a mellkas balra)
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(70, 200);
    ctx.bezierCurveTo(55, 130, 80, 70, 130, 58);
    ctx.bezierCurveTo(190, 40, 260, 70, 305, 95);
    ctx.bezierCurveTo(360, 115, 405, 150, 400, 200);
    ctx.bezierCurveTo(398, 245, 350, 270, 300, 268);
    ctx.bezierCurveTo(230, 282, 150, 275, 110, 258);
    ctx.bezierCurveTo(80, 245, 72, 225, 70, 200);
    ctx.closePath();
  };
  shape();
  const g = ctx.createRadialGradient(170, 105, 10, 220, 170, 230);
  g.addColorStop(0, HIDE[0]); g.addColorStop(0.45, HIDE[1]); g.addColorStop(1, HIDE[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();

  ctx.save(); shape(); ctx.clip();
  scales(ctx, rng, 70, 50, 400, 270, 260);
  // hasi pikkelylapok
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const [x, y] = bez([95, 238], [150, 280], [260, 288], [340, 255], t);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25 + t * 0.6);
    ctx.fillStyle = i % 2 ? '#6d5c45' : '#7d6a4f';
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,.2)'; ctx.beginPath(); ctx.ellipse(-4, -4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  veins(ctx, rng, 120, 90, 380, 230, 9, 10);
  // mohás, gyökeres foltok
  ctx.fillStyle = 'rgba(60,90,50,.35)';
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(120 + rng() * 260, 80 + rng() * 60, 4 + rng() * 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();

  // háttüskék a gerinc mentén
  for (let i = 0; i < 9; i++) {
    const t = 0.05 + i * 0.11;
    const [x, y] = bez([120, 60], [190, 38], [270, 70], [395, 160], t);
    const s = 40 - i * 2.8;
    horn(ctx, [x, y + 6], [x + s * 0.55, y - s], s * 0.45, 0.15);
  }

  // hátsó láb: vastag comb, alatta karmos talp
  tube(ctx, [[335, 205], [360, 250], [345, 290], [330, 318]], 52, 24, 40);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(335, 200, 66, 62, -0.3, 0, Math.PI * 2);
  const tg = ctx.createRadialGradient(310, 175, 6, 335, 200, 70);
  tg.addColorStop(0, HIDE[0]); tg.addColorStop(0.6, HIDE[1]); tg.addColorStop(1, HIDE[2]);
  ctx.fillStyle = tg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.clip(); scales(ctx, rng, 270, 140, 400, 260, 50); veins(ctx, rng, 300, 170, 380, 240, 2, 7);
  ctx.restore();
  ctx.fillStyle = HIDE[2]; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(322, 322, 40, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 3; k++) horn(ctx, [298 + k * 14, 324], [268 + k * 14, 334], 11, 0.3);
}

/* --- Farok ------------------------------------------------------------ */
function drawTail(ctx, rng) {
  // A canvas 360×300; a tő balra fent, a vége lent jobbra, felhajló pengével
  const pts = tube(ctx, [[20, 110], [160, 60], [290, 150], [250, 270]], 46, 9, 70);
  for (let i = 4; i < pts.length - 6; i += 7) {
    const [x, y, r] = pts[i];
    horn(ctx, [x, y - r * 0.7], [x + r * 0.5, y - r * 1.6], r * 0.55, 0.1);
  }
  // csontpenge a végén
  const [ex, ey] = pts[pts.length - 1];
  horn(ctx, [ex, ey], [ex - 54, ey + 6], 26, -0.35);
  horn(ctx, [ex, ey], [ex + 20, ey - 40], 18, 0.3);
}

/* --- Mellső láb ------------------------------------------------------- */
function drawForeleg(ctx, rng) {
  // A canvas 190×250, a talaj y=242
  tube(ctx, [[120, 20], [150, 90], [80, 140], [95, 222]], 36, 20, 50);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(118, 40, 42, 40, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(100, 22, 4, 118, 40, 46);
  g.addColorStop(0, HIDE[0]); g.addColorStop(1, HIDE[2]);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.clip(); veins(ctx, rng, 90, 20, 150, 70, 2, 6);
  ctx.restore();
  // a talp gyökereket markol
  ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 238); ctx.bezierCurveTo(60, 222, 120, 248, 190, 232); ctx.stroke();
  ctx.strokeStyle = VEIN; ctx.lineWidth = 2; ctx.shadowColor = VEIN; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(0, 236); ctx.bezierCurveTo(60, 220, 120, 246, 190, 230); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = HIDE[2]; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(92, 228, 34, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 4; k++) horn(ctx, [70 + k * 12, 232], [34 + k * 12, 246 - (k % 2) * 4], 12, 0.35);
}

/* --- Nyak --------------------------------------------------------------- */
function drawNeck(ctx, rng) {
  // A canvas 240×260; a tő (a váll) jobbra lent, a fej felé balra fent ível
  const curve = [[205, 230], [150, 235], [150, 70], [52, 52]];
  const pts = tube(ctx, curve, 58, 34, 70);
  // torokpikkelyek a nyak alsó oldalán
  for (let i = 6; i < pts.length - 4; i += 6) {
    const [x, y, r] = pts[i];
    ctx.fillStyle = '#4f4236'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x - r * 0.5, y + r * 0.55, r * 0.32, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // tüskesor a nyak tetején
  for (let i = 8; i < pts.length - 2; i += 8) {
    const [x, y, r] = pts[i];
    horn(ctx, [x + r * 0.35, y - r * 0.75], [x + r * 0.95, y - r * 1.5], r * 0.42, 0.2);
  }
  ctx.save();
  ctx.globalAlpha = 0.9;
  veins(ctx, rng, 70, 70, 200, 220, 4, 7);
  ctx.restore();
}

/* --- Fej ------------------------------------------------------------- */
const HEAD_JOINT = [262, 120];          // a nyakhoz illesztés pontja a fej képén
const JAW_HINGE = [212, 128];           // az állkapocs csuklója a fej képén
function drawHead(ctx, rng) {
  // A canvas 360×210, balra néz: hosszú, keskeny pofa, szarvkorona hátul
  // szarvak hátul (a koponya mögött, ezért előbb)
  const crown = [
    [[230, 72], [352, 10], 26, 0.18], [[240, 92], [356, 70], 22, 0.12], [[215, 60], [300, 0], 22, 0.25],
    [[250, 112], [350, 140], 20, -0.15], [[190, 58], [228, 6], 16, 0.3],
  ];
  for (const [b, t, w, bend] of crown) horn(ctx, b, t, w, bend);

  const skull = () => {
    ctx.beginPath();
    ctx.moveTo(268, 92);
    ctx.quadraticCurveTo(245, 52, 190, 56);
    ctx.quadraticCurveTo(150, 58, 118, 74);
    ctx.quadraticCurveTo(64, 82, 18, 104);
    ctx.quadraticCurveTo(6, 112, 14, 122);
    ctx.lineTo(205, 132);
    ctx.quadraticCurveTo(250, 140, 268, 128);
    ctx.closePath();
  };
  skull();
  const g = ctx.createLinearGradient(0, 56, 0, 135);
  g.addColorStop(0, HIDE[0]); g.addColorStop(0.55, HIDE[1]); g.addColorStop(1, HIDE[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.save(); skull(); ctx.clip();
  scales(ctx, rng, 20, 56, 268, 135, 90);
  veins(ctx, rng, 150, 70, 250, 125, 2, 6);
  // pofacsont-gerinc
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(40, 108); ctx.quadraticCurveTo(140, 96, 236, 112); ctx.stroke();
  ctx.strokeStyle = 'rgba(180,160,230,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(40, 100); ctx.quadraticCurveTo(120, 82, 180, 70); ctx.stroke();
  ctx.restore();

  // szemöldökcsont-tüskék
  for (let k = 0; k < 4; k++) horn(ctx, [120 + k * 22, 70 - k * 3], [140 + k * 24, 42 - k * 6], 10, 0.2);

  // három pár izzó szem a homlok mentén
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const ex = 118 + k * 30, ey = 84 + k * 4, r = 7 - k;
    ctx.fillStyle = '#1a0a00'; ctx.beginPath(); ctx.ellipse(ex, ey, r + 4, r + 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = EYE; ctx.shadowBlur = 14;
    ctx.fillStyle = EYE; ctx.beginPath(); ctx.ellipse(ex, ey, r + 1.5, r - 1, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0a00'; ctx.beginPath(); ctx.ellipse(ex, ey, 1.6, r - 1.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // orrlyuk parázsfénnyel
  ctx.fillStyle = '#0a0406'; ctx.beginPath(); ctx.ellipse(32, 104, 7, 3.5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,140,60,.6)'; ctx.beginPath(); ctx.ellipse(32, 104, 3, 1.5, -0.3, 0, Math.PI * 2); ctx.fill();

  // felső fogsor
  for (let x = 24; x < 200; x += 11 + rng() * 5) {
    const y = 104 + (x - 14) * (28 / 190) + 18;
    const long = x < 60 || rng() < 0.25;
    horn(ctx, [x, y - 4], [x - 2, y + (long ? 22 : 12)], long ? 8 : 6, 0.1);
  }
  // pofa-tüskék hátul lefelé (gallér)
  for (let k = 0; k < 3; k++) horn(ctx, [238 + k * 6, 124 + k * 6], [276 + k * 18, 156 + k * 14], 14 - k * 2, -0.2);
}

function drawJaw(ctx, rng) {
  // A canvas 230×100; a csukló jobbra fent (210, 18)
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(216, 14);
    ctx.quadraticCurveTo(130, 14, 22, 22);
    ctx.quadraticCurveTo(8, 26, 14, 36);
    ctx.quadraticCurveTo(70, 62, 170, 58);
    ctx.quadraticCurveTo(212, 56, 222, 34);
    ctx.closePath();
  };
  // fogak (felfelé) előbb, hogy az állkapocs pereme takarja a tövüket
  for (let x = 30; x < 196; x += 12 + rng() * 5) {
    const long = x < 56 || rng() < 0.2;
    horn(ctx, [x, 22], [x + 2, long ? 0 : 8], long ? 8 : 6, -0.1);
  }
  shape();
  const g = ctx.createLinearGradient(0, 14, 0, 60);
  g.addColorStop(0, HIDE[1]); g.addColorStop(1, HIDE[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); shape(); ctx.clip();
  // a száj belseje (ínyhús) a perem mentén
  ctx.fillStyle = '#5a1420'; ctx.fillRect(0, 12, 230, 7);
  scales(ctx, rng, 20, 20, 220, 60, 30);
  ctx.restore();
  for (let k = 0; k < 3; k++) horn(ctx, [60 + k * 40, 52], [50 + k * 40, 80], 9, 0.2);
}

/* =====================================================================
   Textúrák és nézet
   ===================================================================== */
const PARTS = {
  'boss-wing-far':  [480, 410, (c, r) => drawWing(c, r, false)],
  'boss-wing-near': [480, 410, (c, r) => drawWing(c, r, true)],
  'boss-tail':      [360, 300, drawTail],
  'boss-body':      [440, 340, drawBody],
  'boss-foreleg':   [190, 250, drawForeleg],
  'boss-neck':      [240, 260, drawNeck],
  'boss-head':      [360, 210, drawHead],
  'boss-jaw':       [230, 100, drawJaw],
};

export function buildBossTextures(scene) {
  const rng = mulberry32(6669);
  for (const [key, [w, h, draw]] of Object.entries(PARTS)) {
    if (scene.textures.exists(key)) continue;
    const c = canvas(w, h);
    draw(c.getContext('2d'), rng);
    scene.textures.addCanvas(key, c);
  }
}

/**
 * Níðhöggr nézete: tároló, origó a talppontban. A `parts` ugyanolyan
 * mezőket ad, mint a többi sárkányé (inner, body, head, wings, legs), és
 * még: jaw, neck, tail, wingFar, maw (a torokfény), imgs (minden kép).
 * @param {number} height a kívánt kijelzett magasság (képpont)
 */
export function makeBossView(scene, height) {
  buildBossTextures(scene);
  const k = height / BOSS_NATIVE_H;
  const view = scene.add.container(0, 0);
  const inner = scene.add.container(0, 0).setScale(k);
  view.add(inner);
  const img = (key, x, y, ox, oy) => scene.add.image(x, y, key).setOrigin(ox, oy);

  // Rétegek hátulról előre. Koordináták a talppont körül, natív képpontban.
  const wingFar = img('boss-wing-far', 70, -250, 70 / 480, 360 / 410).setRotation(0.02).setScale(0.74);
  const tail = img('boss-tail', 150, -150, 20 / 360, 110 / 300);
  const body = img('boss-body', 40, 8, 0.5, 332 / 340);
  const wings = img('boss-wing-near', 30, -225, 70 / 480, 360 / 410).setRotation(0.3).setScale(0.8);
  const legs = img('boss-foreleg', -110, 8, 0.5, 242 / 250);

  // Nyak + fej: a váll körül forgó csoport; a fej a nyak végén külön is biccent
  const head = scene.add.container(-82, -210);
  const neck = img('boss-neck', 0, 0, 205 / 240, 230 / 260);
  const skull = scene.add.container(-153, -178);                     // a nyak vége (52,52) a tőhöz képest
  const glow = scene.add.image(-150, 12, 'fx-dot').setTint(0xff7a3d).setBlendMode('ADD').setScale(2.2, 1.1).setAlpha(0);
  const jaw = img('boss-jaw', JAW_HINGE[0] - HEAD_JOINT[0], JAW_HINGE[1] - HEAD_JOINT[1], 212 / 230, 16 / 100);
  const headImg = img('boss-head', 0, 0, HEAD_JOINT[0] / 360, HEAD_JOINT[1] / 210);
  const eyes = scene.add.image(-118, -30, 'fx-dot').setTint(0xffd36b).setBlendMode('ADD').setScale(3, 1.3).setAlpha(0.35);
  skull.add([glow, jaw, headImg, eyes]);
  head.add([neck, skull]);

  inner.add([wingFar, tail, body, wings, legs, head]);
  const imgs = [wingFar, tail, body, wings, legs, neck, jaw, headImg];
  view.setData('parts', { inner, body, head, wings, legs, jaw, neck, tail, wingFar, skull, maw: glow, eyes, imgs, k });
  return view;
}

/**
 * A nézet „élete": lélegzés, nyakringás, lassú szárnycsapás, izzó szemek.
 * @returns a leállítandó tweenek
 */
export function animateBoss(scene, view) {
  const p = view.getData('parts');
  const tw = (cfg) => scene.tweens.add({ yoyo: true, repeat: -1, ease: 'Sine.easeInOut', ...cfg });
  return [
    tw({ targets: p.body, scaleY: 1.025, duration: 1700 }),
    tw({ targets: p.head, rotation: { from: -0.05, to: 0.07 }, duration: 2300 }),
    tw({ targets: p.skull, rotation: { from: 0.04, to: -0.06 }, duration: 1900 }),
    tw({ targets: p.wings, rotation: { from: 0.32, to: 0.14 }, duration: 1400 }),
    tw({ targets: p.wingFar, rotation: { from: 0.04, to: -0.12 }, duration: 1500 }),
    tw({ targets: p.tail, rotation: { from: -0.04, to: 0.06 }, duration: 2600 }),
    tw({ targets: p.jaw, rotation: { from: 0, to: -0.06 }, duration: 1700 }),
    tw({ targets: p.eyes, alpha: { from: 0.25, to: 0.7 }, duration: 900 }),
  ];
}

/** A száj (a fej orra alatt) világkoordinátája — innen jön a lehelet. */
export function bossMouth(view) {
  const p = view.getData('parts');
  const m = p.jaw.getWorldTransformMatrix();
  const out = m.transformPoint(-0.85 * p.jaw.width * p.jaw.originX, 6);
  return { x: out.x, y: out.y };
}
