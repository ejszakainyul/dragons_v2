/* A renderelő magja a játékkal közös (script/game/render3d.js); itt csak a PNG-kódoló. */
export { renderPart, renderScene, MATS, GRID } from '../../script/game/render3d.js';
/* --- PNG kódoló (zlib, soronként a legjobb szűrővel) --------------------- */
import zlib from 'node:zlib';
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(rgba, w, h) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride);
    let best = null, bestSum = Infinity, bestF = 0;
    for (const f of [0, 1, 2, 4]) {
      const line = Buffer.alloc(stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
        let pr = 0;
        if (f === 1) pr = a; else if (f === 2) pr = b;
        else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        line[x] = (row[x] - pr) & 255;
      }
      let s = 0; for (const v of line) s += v < 128 ? v : 256 - v;
      if (s < bestSum) { bestSum = s; best = line; bestF = f; }
    }
    raw[y * (stride + 1)] = bestF;
    best.copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
