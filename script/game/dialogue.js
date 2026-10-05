/* =====================================================================
   Párbeszéd és fejezetcímek — a saga megjelenítése (DOM)
   ---------------------------------------------------------------------
   - Párbeszéd: alul, portréval; az írógép-szöveg kattintásra / Szóköz
     (E, Enter) kiírja magát, a következő kattintás továbblép. Esc vagy
     az „Átugrás" gomb az egészet átugorja.
   - A portrék vásznon készülnek, kódból (mint a völgy minden grafikája),
     egyszer, és dataURL-ként maradnak meg.
   - Fejezetcím: középen, rúnavonallal, magától eltűnik.

   Csak transform/opacity animálódik (CSS), a gyenge gépeket kímélve.
   ===================================================================== */
import { esc } from './hud.js';

/* =====================================================================
   Szereplők
   ===================================================================== */
export const CAST = {
  hervor:   { name: 'Hervör, a Völva',           color: '#4fffe0', draw: drawSeer },
  huginn:   { name: 'Huginn, a gondolat hollója', color: '#b18cff', draw: (c, s) => drawRaven(c, s, false) },
  muninn:   { name: 'Muninn, az emlékezet hollója', color: '#9fe8ff', draw: (c, s) => drawRaven(c, s, true) },
  ragnhild: { name: 'Ragnhild, a fegyvermester', color: '#ff9a6b', draw: drawWarrior },
  nidhoggr: { name: 'Níðhöggr',                  color: '#c28cff', draw: drawWyrmEye },
  // A völgy lakói (lásd places.js)
  gunnhild: { name: 'Gunnhild, a remete', color: '#7dffb0', draw: (c, s) => drawPerson(c, s, {
    bg: ['#1f4a2a', '#050a06'], ring: '#7dffb0', skin: '#d8b8a0', hair: '#d9d9d9', hat: 'hood', hatColor: '#3f5a2a',
    wrinkles: true, cloak: '#2e4a22', extra: herbsInHood }) },
  brokk:    { name: 'Brokk, a törpe kovács', color: '#ffb36b', draw: (c, s) => drawPerson(c, s, {
    bg: ['#5a2a10', '#0a0503'], ring: '#ffb36b', skin: '#d99a74', hair: '#8a3b1a', beard: '#a8461f', beardLen: 0.42, braided: true,
    hat: 'helmet', hatColor: '#7d869f', cloak: '#4a3322', soot: true }) },
  hrimthurs: { name: 'Hrímþurs, a fagyóriás', color: '#9fe8ff', draw: (c, s) => drawPerson(c, s, {
    bg: ['#1a3a5a', '#02060c'], ring: '#9fe8ff', skin: '#8fb8d8', hair: '#eef6ff', beard: '#eef6ff', beardLen: 0.4, icicles: true,
    hat: 'icecrown', hatColor: '#cff4ff', eye: '#e8fffb', glowEyes: true, cloak: '#3a5a7a' }) },
  surtr:    { name: 'Surtr lángja', color: '#ff8a3d', draw: drawFlame },
  brynhild: { name: 'Brynhild, a valkűr', color: '#fff3c4', draw: (c, s) => drawPerson(c, s, {
    bg: ['#6a5a2a', '#0b0904'], ring: '#fff3c4', skin: '#ecc9a8', hair: '#f2d27a', hat: 'winged', hatColor: '#e6edf8',
    cloak: '#c9d3ea', eye: '#4f8fd8', longHair: true }) },
  bjarki:   { name: 'Bjarki, a halász', color: '#8fd3ff', draw: (c, s) => drawPerson(c, s, {
    bg: ['#1d4a6a', '#03080c'], ring: '#8fd3ff', skin: '#d9a37e', hair: '#5a3d24', beard: '#6b4a2e', beardLen: 0.3,
    hat: 'beanie', hatColor: '#b8392f', cloak: '#3a5a7a' }) },
  sigrid:   { name: 'Sigrid, a kalmár', color: '#ffd36b', draw: (c, s) => drawPerson(c, s, {
    bg: ['#5a3a6a', '#08040a'], ring: '#ffd36b', skin: '#e6b48f', hair: '#2a1a12', hat: 'scarf', hatColor: '#2f6fb8',
    cloak: '#6a2a5a', earrings: true, eye: '#3a6f3a', longHair: true }) },
  einar:    { name: 'Einar, a skald', color: '#c28cff', draw: (c, s) => drawPerson(c, s, {
    bg: ['#3a2a5a', '#06040a'], ring: '#c28cff', skin: '#ecc0a0', hair: '#d9a03a', beard: '#d9a03a', beardLen: 0.12,
    hat: 'none', cloak: '#5a3a8a', longHair: true, lyre: true }) },
  vandor:   { name: 'Egy öreg vándor', color: '#c9f0ff', draw: (c, s) => drawPerson(c, s, {
    bg: ['#2a3550', '#03040a'], ring: '#c9f0ff', skin: '#c9a284', hair: '#b8bcc8', beard: '#c9ccd6', beardLen: 0.46,
    hat: 'wide', hatColor: '#3a3f55', cloak: '#3a4560', patch: true, ravens: true }) },
};

const portraitCache = new Map();
export function portraitOf(who, size = 120) {
  const key = `${who}:${size}`;
  if (!portraitCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    CAST[who]?.draw(c.getContext('2d'), size);
    portraitCache.set(key, c.toDataURL());
  }
  return portraitCache.get(key);
}

/* --- Rajzolás: mindegyik egy kör alakú érme ------------------------- */
function medallion(ctx, s, inner, outer) {
  const g = ctx.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.55);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, 7); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 1, 0, 7); ctx.clip();
}

function drawSeer(ctx, s) {
  medallion(ctx, s, '#1d4a7a', '#05070f');
  // Csillagpor a háttérben
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(160,255,240,${0.15 + (i % 5) * 0.08})`;
    ctx.fillRect((i * 37) % s, (i * 53) % (s * 0.6), 1.5, 1.5);
  }
  const INK = '#05070f';
  // Bot izzó kővel, jobbra
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = s * 0.035;
  ctx.beginPath(); ctx.moveTo(s * 0.86, s); ctx.lineTo(s * 0.8, s * 0.2); ctx.stroke();
  const orb = ctx.createRadialGradient(s * 0.8, s * 0.18, 0, s * 0.8, s * 0.18, s * 0.14);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.3, '#4fffe0'); orb.addColorStop(1, 'rgba(79,255,224,0)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(s * 0.8, s * 0.18, s * 0.14, 0, 7); ctx.fill();
  // Köpeny és csuklya
  ctx.fillStyle = '#22306a'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.12);
  ctx.bezierCurveTo(s * 0.2, s * 0.14, s * 0.18, s * 0.5, s * 0.08, s * 1.02);
  ctx.lineTo(s * 0.92, s * 1.02);
  ctx.bezierCurveTo(s * 0.82, s * 0.5, s * 0.8, s * 0.14, s * 0.5, s * 0.12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Redők
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = s * 0.015;
  for (const x of [0.3, 0.42, 0.6, 0.72]) { ctx.beginPath(); ctx.moveTo(s * x, s * 0.62); ctx.lineTo(s * (x + (x - 0.5) * 0.4), s); ctx.stroke(); }
  // Arc helye: mély árnyék
  ctx.fillStyle = '#03040a';
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.44, s * 0.16, s * 0.2, 0, 0, 7); ctx.fill();
  // Ezüst hajtincsek
  ctx.strokeStyle = '#c9d3ea'; ctx.lineWidth = s * 0.018; ctx.lineCap = 'round';
  for (const [x0, x1] of [[0.37, 0.33], [0.4, 0.38], [0.63, 0.67], [0.6, 0.62]]) {
    ctx.beginPath(); ctx.moveTo(s * x0, s * 0.42); ctx.quadraticCurveTo(s * (x0 + x1) / 2, s * 0.6, s * x1, s * 0.76); ctx.stroke();
  }
  // Izzó szemek
  for (const x of [0.44, 0.56]) {
    const e = ctx.createRadialGradient(s * x, s * 0.42, 0, s * x, s * 0.42, s * 0.05);
    e.addColorStop(0, '#ffffff'); e.addColorStop(0.35, '#4fffe0'); e.addColorStop(1, 'rgba(79,255,224,0)');
    ctx.fillStyle = e; ctx.beginPath(); ctx.arc(s * x, s * 0.42, s * 0.05, 0, 7); ctx.fill();
  }
  // Arany szegély a csuklyán
  ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = s * 0.022;
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.45, s * 0.2, s * 0.25, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.66); ctx.lineTo(s * 0.5, s); ctx.stroke();
  ctx.restore();
  ring(ctx, s, '#4fffe0');
}

function drawRaven(ctx, s, white) {
  medallion(ctx, s, white ? '#2a5a6e' : '#3a2a66', '#05070f');
  const body = white ? '#c9d3ea' : '#10131f';
  const edge = white ? '#7f8aa6' : '#2c3352';
  ctx.lineJoin = 'round';
  // Test és szárny
  ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = s * 0.018;
  ctx.beginPath(); ctx.ellipse(s * 0.45, s * 0.86, s * 0.32, s * 0.3, -0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.7);
  ctx.quadraticCurveTo(s * 0.45, s * 0.62, s * 0.72, s * 0.86);
  ctx.quadraticCurveTo(s * 0.5, s * 0.8, s * 0.25, s * 0.95);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Toll-vonalak
  ctx.strokeStyle = white ? 'rgba(80,90,120,.6)' : 'rgba(120,130,190,.35)'; ctx.lineWidth = s * 0.012;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(s * (0.3 + i * 0.07), s * (0.74 + i * 0.01)); ctx.lineTo(s * (0.26 + i * 0.07), s * (0.9 + i * 0.01)); ctx.stroke(); }
  // Fej
  ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = s * 0.018;
  ctx.beginPath(); ctx.arc(s * 0.46, s * 0.44, s * 0.2, 0, 7); ctx.fill(); ctx.stroke();
  // Torok-tollak
  ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.6); ctx.lineTo(s * 0.5, s * 0.72); ctx.lineTo(s * 0.58, s * 0.58); ctx.closePath(); ctx.fill();
  // Csőr: hosszú, ívelt
  ctx.fillStyle = white ? '#8f98b0' : '#2a3048'; ctx.strokeStyle = '#05070f';
  ctx.beginPath();
  ctx.moveTo(s * 0.6, s * 0.36);
  ctx.quadraticCurveTo(s * 0.82, s * 0.36, s * 0.95, s * 0.5);
  ctx.quadraticCurveTo(s * 0.8, s * 0.48, s * 0.62, s * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = s * 0.01;
  ctx.beginPath(); ctx.moveTo(s * 0.64, s * 0.4); ctx.quadraticCurveTo(s * 0.8, s * 0.4, s * 0.9, s * 0.47); ctx.stroke();
  // Szem
  ctx.fillStyle = white ? '#0c2a33' : '#e8e0ff';
  ctx.beginPath(); ctx.arc(s * 0.52, s * 0.4, s * 0.05, 0, 7); ctx.fill();
  ctx.fillStyle = white ? '#9fe8ff' : '#05070f';
  ctx.beginPath(); ctx.arc(s * 0.53, s * 0.4, s * 0.028, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.54, s * 0.385, s * 0.01, 0, 7); ctx.fill();
  ctx.restore();
  ring(ctx, s, white ? '#9fe8ff' : '#b18cff');
}

function drawWarrior(ctx, s) {
  medallion(ctx, s, '#6a2a1f', '#0b0605');
  const INK = '#05070f';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Prémes vállpalást
  ctx.fillStyle = '#5a3d24'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 1.04, s * 0.48, s * 0.26, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6844';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(s * (0.12 + i * 0.095), s * (0.84 + Math.sin(i) * 0.02), s * 0.05, 0, 7); ctx.fill(); }
  // Fonott copfok (rézvörös)
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#a8461f' : '#c4602f'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.012;
      ctx.beginPath(); ctx.ellipse(s * (0.5 + dir * 0.23), s * (0.5 + i * 0.075), s * 0.045, s * 0.042, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
  }
  // Nyak, arc
  ctx.fillStyle = '#d9a37e'; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.018;
  ctx.fillRect(s * 0.43, s * 0.66, s * 0.14, s * 0.14);
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.52, s * 0.17, s * 0.21, 0, 0, 7); ctx.fill(); ctx.stroke();
  // Harci festék: kék csík a szemek alatt
  ctx.fillStyle = 'rgba(60,110,220,.75)';
  ctx.fillRect(s * 0.35, s * 0.53, s * 0.3, s * 0.035);
  // Szemek
  for (const x of [0.43, 0.57]) {
    ctx.fillStyle = '#f2ece2'; ctx.beginPath(); ctx.ellipse(s * x, s * 0.49, s * 0.032, s * 0.02, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a6f8a'; ctx.beginPath(); ctx.arc(s * x, s * 0.49, s * 0.016, 0, 7); ctx.fill();
  }
  // Szemöldök, száj, sebhely
  ctx.strokeStyle = '#6b2f17'; ctx.lineWidth = s * 0.018;
  ctx.beginPath(); ctx.moveTo(s * 0.38, s * 0.45); ctx.lineTo(s * 0.47, s * 0.46); ctx.moveTo(s * 0.53, s * 0.46); ctx.lineTo(s * 0.62, s * 0.44); ctx.stroke();
  ctx.strokeStyle = '#8a4a36'; ctx.lineWidth = s * 0.014;
  ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.64); ctx.quadraticCurveTo(s * 0.5, s * 0.66, s * 0.56, s * 0.63); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,210,.7)'; ctx.lineWidth = s * 0.01;
  ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.5); ctx.lineTo(s * 0.64, s * 0.6); ctx.stroke();
  // Sisak: kupola + orrvédő
  const metal = ctx.createLinearGradient(s * 0.3, s * 0.2, s * 0.7, s * 0.45);
  metal.addColorStop(0, '#e6edf8'); metal.addColorStop(0.5, '#9aa4bd'); metal.addColorStop(1, '#5d667f');
  ctx.fillStyle = metal; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(s * 0.31, s * 0.43);
  ctx.bezierCurveTo(s * 0.3, s * 0.14, s * 0.7, s * 0.14, s * 0.69, s * 0.43);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7d869f';
  ctx.beginPath(); ctx.roundRect(s * 0.475, s * 0.38, s * 0.05, s * 0.18, s * 0.02); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5d667f'; ctx.fillRect(s * 0.31, s * 0.395, s * 0.38, s * 0.04);
  ctx.strokeRect(s * 0.31, s * 0.395, s * 0.38, s * 0.04);
  ctx.fillStyle = '#d9b45a';
  for (const x of [0.36, 0.44, 0.56, 0.64]) { ctx.beginPath(); ctx.arc(s * x, s * 0.415, s * 0.01, 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * 0.015;
  ctx.beginPath(); ctx.arc(s * 0.45, s * 0.32, s * 0.1, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
  ring(ctx, s, '#ff9a6b');
}

function drawWyrmEye(ctx, s) {
  medallion(ctx, s, '#2a1440', '#020103');
  // Pikkelyek
  ctx.strokeStyle = 'rgba(160,110,220,.18)'; ctx.lineWidth = s * 0.012;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const x = s * (col / 6 + (row % 2) * 0.08 - 0.04), y = s * (row / 6);
    ctx.beginPath(); ctx.arc(x, y, s * 0.09, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  // Gyökérindák
  ctx.strokeStyle = 'rgba(90,50,120,.7)'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[0, 0.85, 0.35, 0.7], [1, 0.8, 0.7, 0.68], [0.1, 0.1, 0.32, 0.32], [0.95, 0.15, 0.7, 0.3]]) {
    ctx.beginPath(); ctx.moveTo(s * x0, s * y0); ctx.quadraticCurveTo(s * 0.5, s * (y0 + y1) / 2, s * x1, s * y1); ctx.stroke();
  }
  // Szem: mandula alakú, izzó írisz, függőleges pupilla
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s * 0.5);
  ctx.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.88, s * 0.5);
  ctx.quadraticCurveTo(s * 0.5, s * 0.84, s * 0.12, s * 0.5);
  ctx.closePath();
  const glow = ctx.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.38);
  glow.addColorStop(0, '#fff3a0'); glow.addColorStop(0.35, '#ffb347'); glow.addColorStop(0.75, '#c2410c'); glow.addColorStop(1, '#3a0a0a');
  ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = s * 0.15;
  ctx.fillStyle = glow; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,40,0,.45)'; ctx.lineWidth = s * 0.01;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(s * 0.5 + Math.cos(a) * s * 0.08, s * 0.5 + Math.sin(a) * s * 0.08);
    ctx.lineTo(s * 0.5 + Math.cos(a) * s * 0.3, s * 0.5 + Math.sin(a) * s * 0.3); ctx.stroke();
  }
  ctx.fillStyle = '#05010a';
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.5, s * 0.045, s * 0.24, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(s * 0.4, s * 0.4, s * 0.04, s * 0.025, -0.5, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#05010a'; ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.5);
  ctx.quadraticCurveTo(s * 0.5, s * 0.14, s * 0.9, s * 0.5);
  ctx.quadraticCurveTo(s * 0.5, s * 0.86, s * 0.1, s * 0.5);
  ctx.stroke();
  ctx.restore();
  ring(ctx, s, '#c28cff');
}

/**
 * Általános arckép: köpeny, nyak, arc, haj, szakáll, fejfedő — a
 * paraméterek teszik egyedivé (lásd a CAST bejegyzéseit).
 */
function drawPerson(ctx, s, o) {
  medallion(ctx, s, o.bg[0], o.bg[1]);
  const INK = '#05070f';
  const X = (v) => s * v;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Köpeny / váll
  ctx.fillStyle = o.cloak || '#3a4560'; ctx.strokeStyle = INK; ctx.lineWidth = X(0.02);
  ctx.beginPath(); ctx.ellipse(X(0.5), X(1.05), X(0.46), X(0.3), 0, 0, 7); ctx.fill(); ctx.stroke();
  if (o.lyre) {
    ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = X(0.03);
    ctx.beginPath(); ctx.moveTo(X(0.72), X(0.98)); ctx.quadraticCurveTo(X(0.66), X(0.76), X(0.76), X(0.72)); ctx.moveTo(X(0.86), X(0.98)); ctx.quadraticCurveTo(X(0.94), X(0.76), X(0.84), X(0.72)); ctx.stroke();
    ctx.lineWidth = X(0.008); ctx.strokeStyle = '#fff3c4';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X(0.75 + i * 0.03), X(0.76)); ctx.lineTo(X(0.75 + i * 0.03), X(0.97)); ctx.stroke(); }
  }
  // Hosszú haj a fej mögött
  if (o.longHair) {
    ctx.fillStyle = o.hair; ctx.strokeStyle = INK; ctx.lineWidth = X(0.015);
    ctx.beginPath(); ctx.ellipse(X(0.5), X(0.62), X(0.24), X(0.3), 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  // Nyak és arc
  ctx.fillStyle = o.skin; ctx.strokeStyle = INK; ctx.lineWidth = X(0.018);
  ctx.fillRect(X(0.43), X(0.66), X(0.14), X(0.14));
  ctx.beginPath(); ctx.ellipse(X(0.5), X(0.52), X(0.17), X(0.21), 0, 0, 7); ctx.fill(); ctx.stroke();
  if (o.soot) { ctx.fillStyle = 'rgba(30,20,10,.35)'; ctx.beginPath(); ctx.ellipse(X(0.42), X(0.58), X(0.05), X(0.03), 0.4, 0, 7); ctx.fill(); }
  if (o.wrinkles) {
    ctx.strokeStyle = 'rgba(90,60,40,.55)'; ctx.lineWidth = X(0.008);
    for (const y of [0.44, 0.47]) { ctx.beginPath(); ctx.moveTo(X(0.42), X(y)); ctx.lineTo(X(0.58), X(y)); ctx.stroke(); }
  }
  // Szemek (vagy szemkötő)
  const eye = (x, patch) => {
    if (patch) {
      ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.ellipse(X(x), X(0.5), X(0.04), X(0.03), 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = X(0.012); ctx.beginPath(); ctx.moveTo(X(0.32), X(0.44)); ctx.lineTo(X(0.68), X(0.5)); ctx.stroke();
      return;
    }
    if (o.glowEyes) {
      const g = ctx.createRadialGradient(X(x), X(0.5), 0, X(x), X(0.5), X(0.045));
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, o.eye); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), X(0.5), X(0.045), 0, 7); ctx.fill();
      return;
    }
    ctx.fillStyle = '#f2ece2'; ctx.beginPath(); ctx.ellipse(X(x), X(0.5), X(0.03), X(0.019), 0, 0, 7); ctx.fill();
    ctx.fillStyle = o.eye || '#4a3a2a'; ctx.beginPath(); ctx.arc(X(x), X(0.5), X(0.015), 0, 7); ctx.fill();
  };
  eye(0.43, false); eye(0.57, !!o.patch);
  // Orr, száj
  ctx.strokeStyle = 'rgba(80,45,30,.6)'; ctx.lineWidth = X(0.012);
  ctx.beginPath(); ctx.moveTo(X(0.5), X(0.52)); ctx.lineTo(X(0.48), X(0.58)); ctx.lineTo(X(0.51), X(0.59)); ctx.stroke();
  if (!o.beard) { ctx.beginPath(); ctx.moveTo(X(0.45), X(0.64)); ctx.quadraticCurveTo(X(0.5), X(0.66), X(0.55), X(0.64)); ctx.stroke(); }
  if (o.earrings) {
    ctx.fillStyle = '#ffd36b';
    for (const x of [0.33, 0.67]) { ctx.beginPath(); ctx.arc(X(x), X(0.6), X(0.018), 0, 7); ctx.fill(); }
  }
  // Szakáll
  if (o.beard) {
    const len = o.beardLen ?? 0.3;
    ctx.fillStyle = o.beard; ctx.strokeStyle = INK; ctx.lineWidth = X(0.015);
    ctx.beginPath();
    ctx.moveTo(X(0.34), X(0.52));
    ctx.quadraticCurveTo(X(0.33), X(0.62 + len * 0.6), X(0.5), X(0.6 + len));
    ctx.quadraticCurveTo(X(0.67), X(0.62 + len * 0.6), X(0.66), X(0.52));
    ctx.quadraticCurveTo(X(0.58), X(0.6), X(0.5), X(0.6));
    ctx.quadraticCurveTo(X(0.42), X(0.6), X(0.34), X(0.52));
    ctx.fill(); ctx.stroke();
    if (o.braided) {
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = X(0.01);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X(0.46), X(0.66 + i * 0.07)); ctx.lineTo(X(0.54), X(0.68 + i * 0.07)); ctx.stroke(); }
      ctx.fillStyle = '#d9b45a'; ctx.fillRect(X(0.47), X(0.6 + len - 0.06), X(0.06), X(0.03));
    }
    if (o.icicles) {
      ctx.fillStyle = '#e8fffb';
      for (const x of [0.4, 0.47, 0.54, 0.61]) { ctx.beginPath(); ctx.moveTo(X(x - 0.02), X(0.72)); ctx.lineTo(X(x), X(0.86)); ctx.lineTo(X(x + 0.02), X(0.72)); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(60,30,20,.7)'; ctx.lineWidth = X(0.012);
    ctx.beginPath(); ctx.moveTo(X(0.45), X(0.6)); ctx.quadraticCurveTo(X(0.5), X(0.58), X(0.55), X(0.6)); ctx.stroke();
  }
  // Fejfedő / haj
  ctx.strokeStyle = INK; ctx.lineWidth = X(0.02);
  switch (o.hat) {
    case 'hood':
      ctx.fillStyle = o.hatColor;
      ctx.beginPath(); ctx.moveTo(X(0.5), X(0.12)); ctx.bezierCurveTo(X(0.2), X(0.16), X(0.22), X(0.6), X(0.24), X(0.8));
      ctx.lineTo(X(0.34), X(0.78)); ctx.quadraticCurveTo(X(0.3), X(0.4), X(0.5), X(0.32)); ctx.quadraticCurveTo(X(0.7), X(0.4), X(0.66), X(0.78));
      ctx.lineTo(X(0.76), X(0.8)); ctx.bezierCurveTo(X(0.78), X(0.6), X(0.8), X(0.16), X(0.5), X(0.12)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(X(0.5), X(0.35), X(0.15), X(0.05), 0, 0, 7); ctx.fill();
      break;
    case 'helmet': {
      const m = ctx.createLinearGradient(X(0.3), X(0.2), X(0.7), X(0.42));
      m.addColorStop(0, '#e6edf8'); m.addColorStop(1, o.hatColor);
      ctx.fillStyle = m;
      ctx.beginPath(); ctx.moveTo(X(0.31), X(0.42)); ctx.bezierCurveTo(X(0.3), X(0.16), X(0.7), X(0.16), X(0.69), X(0.42)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5d667f'; ctx.fillRect(X(0.31), X(0.4), X(0.38), X(0.04)); ctx.strokeRect(X(0.31), X(0.4), X(0.38), X(0.04));
      break;
    }
    case 'winged': {
      ctx.fillStyle = o.hatColor;
      ctx.beginPath(); ctx.moveTo(X(0.31), X(0.42)); ctx.bezierCurveTo(X(0.3), X(0.18), X(0.7), X(0.18), X(0.69), X(0.42)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const dir of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(X(0.5 + dir * 0.17), X(0.36));
        for (let i = 0; i < 4; i++) ctx.lineTo(X(0.5 + dir * (0.24 + i * 0.05)), X(0.12 + i * 0.05));
        ctx.lineTo(X(0.5 + dir * 0.2), X(0.4)); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#d9b45a'; ctx.fillRect(X(0.31), X(0.4), X(0.38), X(0.035));
      break;
    }
    case 'wide':
      ctx.fillStyle = o.hatColor;
      ctx.beginPath(); ctx.ellipse(X(0.5), X(0.36), X(0.36), X(0.07), -0.08, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(0.36), X(0.35)); ctx.quadraticCurveTo(X(0.4), X(0.08), X(0.56), X(0.12)); ctx.quadraticCurveTo(X(0.66), X(0.2), X(0.64), X(0.34)); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'beanie':
      ctx.fillStyle = o.hatColor;
      ctx.beginPath(); ctx.moveTo(X(0.32), X(0.42)); ctx.bezierCurveTo(X(0.32), X(0.14), X(0.68), X(0.14), X(0.68), X(0.42)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X(0.32), X(0.37), X(0.36), X(0.05));
      break;
    case 'scarf':
      ctx.fillStyle = o.hatColor;
      ctx.beginPath(); ctx.moveTo(X(0.3), X(0.5)); ctx.bezierCurveTo(X(0.28), X(0.18), X(0.72), X(0.18), X(0.7), X(0.5)); ctx.quadraticCurveTo(X(0.66), X(0.36), X(0.5), X(0.34)); ctx.quadraticCurveTo(X(0.34), X(0.36), X(0.3), X(0.5)); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd36b'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(X(0.36 + i * 0.07), X(0.32 - Math.sin(i / 4 * Math.PI) * 0.06), X(0.012), 0, 7); ctx.fill(); }
      break;
    case 'icecrown':
      ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(X(0.5), X(0.34), X(0.18), X(0.07), 0, 0, 7); ctx.fill();
      ctx.fillStyle = o.hatColor;
      for (let i = 0; i < 5; i++) {
        const x = 0.36 + i * 0.07, hh = i === 2 ? 0.2 : i % 2 ? 0.14 : 0.1;
        ctx.beginPath(); ctx.moveTo(X(x - 0.03), X(0.34)); ctx.lineTo(X(x), X(0.34 - hh)); ctx.lineTo(X(x + 0.03), X(0.34)); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    default:
      ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(X(0.5), X(0.36), X(0.18), X(0.1), 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  }
  o.extra?.(ctx, s);
  if (o.ravens) {
    for (const [x, y, dir] of [[0.12, 0.55, 1], [0.88, 0.6, -1]]) {
      ctx.fillStyle = '#0d1020';
      ctx.beginPath(); ctx.ellipse(X(x), X(y), X(0.06), X(0.08), 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(X(x + dir * 0.02), X(y - 0.08), X(0.04), 0, 7); ctx.fill();
      ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.moveTo(X(x + dir * 0.05), X(y - 0.09)); ctx.lineTo(X(x + dir * 0.1), X(y - 0.07)); ctx.lineTo(X(x + dir * 0.05), X(y - 0.06)); ctx.fill();
      ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.arc(X(x + dir * 0.03), X(y - 0.09), X(0.008), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  ring(ctx, s, o.ring);
}

function herbsInHood(ctx, s) {
  ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = s * 0.012;
  for (const [x, y] of [[0.3, 0.3], [0.68, 0.28]]) {
    ctx.beginPath(); ctx.moveTo(s * x, s * (y + 0.06)); ctx.lineTo(s * (x + 0.02), s * (y - 0.04)); ctx.stroke();
    ctx.fillStyle = '#b58cff'; ctx.beginPath(); ctx.arc(s * (x + 0.02), s * (y - 0.05), s * 0.018, 0, 7); ctx.fill();
  }
}

function drawFlame(ctx, s) {
  medallion(ctx, s, '#6a1a05', '#0a0201');
  const layer = (col, k) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.95);
    ctx.bezierCurveTo(s * (0.12 + k), s * 0.6, s * 0.35, s * (0.5 - k), s * 0.4, s * (0.18 + k));
    ctx.bezierCurveTo(s * 0.48, s * 0.4, s * 0.5, s * 0.32, s * 0.56, s * (0.1 + k));
    ctx.bezierCurveTo(s * 0.66, s * 0.4, s * (0.86 - k), s * 0.5, s * 0.8, s * 0.95);
    ctx.closePath(); ctx.fill();
  };
  layer('#c2410c', 0); layer('#ff8a3d', 0.08); layer('#ffd36b', 0.18);
  // Arc a lángban: két üres szem, száj
  ctx.fillStyle = '#3a0a02';
  for (const x of [0.42, 0.58]) { ctx.beginPath(); ctx.ellipse(s * x, s * 0.56, s * 0.04, s * 0.06, x < 0.5 ? 0.3 : -0.3, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.74, s * 0.08, s * 0.03, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff3c4';
  for (const x of [0.42, 0.58]) { ctx.beginPath(); ctx.arc(s * x, s * 0.57, s * 0.012, 0, 7); ctx.fill(); }
  ctx.restore();
  ring(ctx, s, '#ff8a3d');
}

function ring(ctx, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.03;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - s * 0.03, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}

/* =====================================================================
   Párbeszéd
   ===================================================================== */

/** A HTML első n látható karaktere (a címkék és entitások egyben maradnak). */
function partial(html, n) {
  let out = '', count = 0;
  for (let i = 0; i < html.length && count < n; i++) {
    const ch = html[i];
    if (ch === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j; continue; }
    if (ch === '&') { const j = html.indexOf(';', i); out += html.slice(i, j + 1); i = j; count++; continue; }
    out += ch; count++;
  }
  return out;
}
const visibleLength = (html) => html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '_').length;

export class Dialogue {
  constructor(root, hud, sfx) {
    this.hud = hud;
    this.sfx = sfx;
    this.el = document.createElement('div');
    this.el.className = 'game-dialogue';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `
      <div class="gdl-card">
        <img class="gdl-portrait" alt="">
        <div class="gdl-body">
          <b class="gdl-name"></b>
          <p class="gdl-text"></p>
        </div>
        <span class="gdl-next" aria-hidden="true">▼</span>
        <button class="gdl-skip btn btn-ghost btn-sm" type="button">Átugrás <kbd>Esc</kbd></button>
      </div>`;
    root.appendChild(this.el);
    this.$ = {
      card: this.el.querySelector('.gdl-card'),
      img: this.el.querySelector('.gdl-portrait'),
      name: this.el.querySelector('.gdl-name'),
      text: this.el.querySelector('.gdl-text'),
      skip: this.el.querySelector('.gdl-skip'),
    };
    this.open = false;
    this.closedAt = 0;
  }

  /**
   * Sorok lejátszása. line = { who, text, choices? } — a text HTML (b, em).
   * Ha egy sornak választási lehetőségei vannak, a kiírás után gombok
   * jelennek meg (1–3 billentyű is jó), és csak a választás után lép tovább.
   * @returns {Promise<number>} az utolsó választás indexe (−1, ha nem volt / átugrotta)
   */
  play(lines) {
    if (!lines?.length) return Promise.resolve(-1);
    return new Promise((resolve) => {
      let i = -1, typing = null, shown = 0, full = '', total = 0;
      let answer = -1, asking = null;
      this.open = true;
      this.hud.dialogueOpen = true;
      this.hud.prompt(null);
      this.el.hidden = false;
      requestAnimationFrame(() => this.el.classList.add('is-in'));

      const finishTyping = () => {
        clearInterval(typing); typing = null;
        this.$.text.innerHTML = full;
        this.el.classList.add('is-done');
        const ch = lines[i]?.choices;
        if (ch) {
          asking = ch;
          this.el.classList.add('is-asking');
          const box = document.createElement('div');
          box.className = 'gdl-choices';
          box.innerHTML = ch.map((c, k) => `<button type="button" class="btn btn-sm" data-choice="${k}"><kbd>${k + 1}</kbd> ${c}</button>`).join('');
          this.$.card.querySelector('.gdl-body').appendChild(box);
          box.querySelector('button')?.focus();
        }
      };
      const choose = (k) => {
        if (!asking || k < 0 || k >= asking.length) return;
        answer = k;
        asking = null;
        this.sfx.click();
        this.el.classList.remove('is-asking');
        this.$.card.querySelector('.gdl-choices')?.remove();
        next();
      };
      const show = (line) => {
        const who = CAST[line.who] || { name: line.name || '', color: '#ffe7c2' };
        const changed = this.$.name.dataset.who !== line.who;
        this.$.name.dataset.who = line.who;
        this.$.name.textContent = line.name || who.name;
        this.$.card.style.setProperty('--who', who.color);
        this.$.img.src = CAST[line.who] ? portraitOf(line.who) : (line.img || '');
        this.$.img.hidden = !this.$.img.src;
        if (changed) { this.$.img.classList.remove('is-pop'); void this.$.img.offsetWidth; this.$.img.classList.add('is-pop'); }
        if (line.who === 'huginn' || line.who === 'muninn') { if (changed) this.sfx.caw(); }
        full = line.text; total = visibleLength(full); shown = 0;
        this.el.classList.remove('is-done');
        this.$.text.innerHTML = '';
        const speed = line.who === 'nidhoggr' ? 2 : 1;          // a sárkány lassan, nyomatékkal beszél
        let tick = 0;
        typing = setInterval(() => {
          if (++tick % speed) return;
          shown += 1;
          this.$.text.innerHTML = partial(full, shown);
          if (shown % 3 === 0) this.sfx.blip();
          if (shown >= total) finishTyping();
        }, 24);
      };
      const next = () => {
        if (typing) { finishTyping(); return; }
        if (asking) return;                       // előbb választani kell
        i++;
        if (i >= lines.length) return close();
        show(lines[i]);
      };
      // Esc: a következő választásig ugrik (azt nem lehet átugrani), vagy a végére
      const skip = () => {
        if (asking) return;
        const ask = lines.findIndex((l, k) => k > i && l.choices);
        if (ask >= 0) { clearInterval(typing); typing = null; i = ask - 1; next(); finishTyping(); return; }
        if (lines[i]?.choices && answer < 0) return;
        close();
      };
      const close = () => {
        clearInterval(typing);
        this.$.card.querySelector('.gdl-choices')?.remove();
        this.el.classList.remove('is-asking');
        document.removeEventListener('keydown', onKey, true);
        this.el.removeEventListener('pointerdown', onPointer);
        this.el.classList.remove('is-in', 'is-done');
        this.open = false;
        this.hud.dialogueOpen = false;
        this.closedAt = performance.now();
        setTimeout(() => { if (!this.open) this.el.hidden = true; }, 260);
        resolve(answer);
      };
      const onKey = (e) => {
        if (asking && /^[1-9]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); choose(Number(e.key) - 1); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); skip(); return; }
        if (asking && e.key === 'Enter' && e.target?.dataset?.choice) { e.preventDefault(); e.stopPropagation(); choose(Number(e.target.dataset.choice)); return; }
        if ([' ', 'Enter', 'e', 'E'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); next(); }
      };
      const onPointer = (e) => {
        const c = e.target.closest('[data-choice]');
        if (c) { choose(Number(c.dataset.choice)); return; }
        if (e.target.closest('.gdl-skip')) { skip(); return; }
        next();
      };
      // Rögzítő fázisban: a Phaser és a völgy billentyűi ne kapják meg
      document.addEventListener('keydown', onKey, true);
      this.el.addEventListener('pointerdown', onPointer);
      next();
    });
  }
}

/* =====================================================================
   Fejezetcím
   ===================================================================== */
export function chapterCard(root, kicker, title, sfx) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'game-chapter';
    el.innerHTML = `
      <div class="gc-inner">
        <p class="gc-kicker">${esc(kicker)}</p>
        <h2 class="gc-title" data-norune>${esc(title)}</h2>
        <div class="gc-line" aria-hidden="true"><i></i><span>ᛟ</span><i></i></div>
      </div>`;
    root.appendChild(el);
    sfx?.drum();
    requestAnimationFrame(() => el.classList.add('is-in'));
    const done = () => {
      if (!el.isConnected) return;
      el.classList.add('is-out');
      setTimeout(() => { el.remove(); resolve(); }, 600);
    };
    const t = setTimeout(done, 3200);
    el.addEventListener('pointerdown', () => { clearTimeout(t); done(); });
  });
}
