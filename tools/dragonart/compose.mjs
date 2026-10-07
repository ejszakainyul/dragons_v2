/* Előnézet: részek egymásra rakása a sárkány színével (mint az oldal és a játék). */
export function composite(layers, hex, size, bg = [42, 36, 56]) {
  const n = parseInt(hex.replace('#', ''), 16);
  const tint = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(1, (v / 255) * 1.3));
  const out = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) { out[i * 3] = bg[0] / 255; out[i * 3 + 1] = bg[1] / 255; out[i * 3 + 2] = bg[2] / 255; }
  const over = (i, r, g, b, a) => { out[i * 3] = r * a + out[i * 3] * (1 - a); out[i * 3 + 1] = g * a + out[i * 3 + 1] * (1 - a); out[i * 3 + 2] = b * a + out[i * 3 + 2] * (1 - a); };
  for (const L of layers) {
    for (let i = 0; i < size * size; i++) {
      const o = i * 4;
      const a = L.base[o + 3] / 255;
      if (a > 0) over(i, L.base[o] / 255 * tint[0], L.base[o + 1] / 255 * tint[1], L.base[o + 2] / 255 * tint[2], a);
      const f = L.fx[o + 3] / 255;
      if (f > 0) over(i, L.fx[o] / 255, L.fx[o + 1] / 255, L.fx[o + 2] / 255, f);
    }
  }
  const px = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) { px[i * 4] = out[i * 3] * 255; px[i * 4 + 1] = out[i * 3 + 1] * 255; px[i * 4 + 2] = out[i * 3 + 2] * 255; px[i * 4 + 3] = 255; }
  return px;
}
/** Képek rácsba. */
export function sheet(imgs, size, cols) {
  const rows = Math.ceil(imgs.length / cols), W = cols * size, Hh = rows * size;
  const px = new Uint8ClampedArray(W * Hh * 4);
  imgs.forEach((im, k) => {
    const ox = (k % cols) * size, oy = Math.floor(k / cols) * size;
    for (let y = 0; y < size; y++) px.set(im.subarray(y * size * 4, (y + 1) * size * 4), ((oy + y) * W + ox) * 4);
  });
  return { px, W, H: Hh };
}
