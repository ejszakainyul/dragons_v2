/* =====================================================================
   A sárkányrészek legyártása:  node tools/dragonart/build.mjs [--only=head:3,body] [--out=dir]
   Kimenet: dragons/hd/{head,body,legs,wings}[n].png  (színezhető réteg)
            dragons/hd/{...}[n]-fx.png               (saját színű réteg)
   ===================================================================== */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPart, encodePNG } from './render.mjs';
import { headDesign } from './heads.mjs';
import { bodyDesign } from './bodies.mjs';
import { legDesign } from './legs.mjs';
import { wingDesign } from './wings.mjs';

export const SLOTS = { head: headDesign, body: bodyDesign, legs: legDesign, wings: wingDesign };
const SIZE = 320;
const here = path.dirname(fileURLToPath(import.meta.url));

if (isMainThread) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
  const out = path.resolve(args.out || path.join(here, '../../dragons/hd'));
  fs.mkdirSync(out, { recursive: true });
  let jobs = [];
  for (const slot of Object.keys(SLOTS)) for (let n = 1; n <= 18; n++) jobs.push([slot, n]);
  if (args.only) {
    const want = args.only.split(',');
    jobs = jobs.filter(([s, n]) => want.some((w) => { const [ws, wn] = w.split(':'); return ws === s && (!wn || +wn === n); }));
  }
  const W = Math.min(os.cpus().length, 8, jobs.length);
  let done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: W }, (_, k) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: jobs.filter((_, i) => i % W === k), out } });
    w.on('message', () => { done++; if (done % 8 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}`); });
    w.on('error', reject); w.on('exit', resolve);
  })));
  console.log(`Kész: ${jobs.length} rész, ${((Date.now() - t0) / 1000).toFixed(1)} mp → ${out}`);
} else {
  for (const [slot, n] of workerData.jobs) {
    const r = renderPart(SLOTS[slot](n), { size: SIZE });
    // A fő kép a TELJES rész: a színezhető (szürke) réteg + a saját színű anyagok
    // (szarv, karom, szem…) ott, ahol a szürke réteg nem fed. Így a sima listákban
    // is teljes a rajz; a színezett nézetek a -fx réteget teszik rá, hogy a szarv
    // ne kapja meg a sárkány színét.
    const main = new Uint8ClampedArray(r.base.length);
    for (let i = 0; i < r.base.length; i += 4) {
      const ba = r.base[i + 3] / 255, fa = (r.fx[i + 3] / 255) * (1 - ba);
      const a = ba + fa;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) main[i + c] = (r.base[i + c] * ba + r.fx[i + c] * fa) / a;
      main[i + 3] = a * 255;
    }
    fs.writeFileSync(path.join(workerData.out, `${slot}[${n}].png`), encodePNG(main, SIZE, SIZE));
    fs.writeFileSync(path.join(workerData.out, `${slot}[${n}]-fx.png`), encodePNG(r.fx, SIZE, SIZE));
    parentPort.postMessage(1);
  }
}
