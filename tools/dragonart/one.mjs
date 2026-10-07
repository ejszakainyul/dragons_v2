import fs from 'node:fs';
import { renderPart, encodePNG } from './render.mjs';
import { composite, sheet } from './compose.mjs';
import { headDesign } from './heads.mjs';
import { bodyDesign } from './bodies.mjs';
import { legDesign } from './legs.mjs';
import { wingDesign } from './wings.mjs';
const [, , out, ...specs] = process.argv;   // specs: h,b,l,w,#color
const size = 640;
const imgs = specs.map((s) => {
  const [h, b, l, w, c] = s.split(',');
  const parts = [bodyDesign(+b), legDesign(+l), headDesign(+h), wingDesign(+w)].map((p) => renderPart(p, { size, ss: 2 }));
  return composite(parts, c, size);
});
const g = sheet(imgs, size, Math.min(3, imgs.length));
fs.writeFileSync(out, encodePNG(g.px, g.W, g.H));
