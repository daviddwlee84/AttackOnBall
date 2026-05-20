// Generates the PWA icons (a doodle hero face) as PNGs with no dependencies,
// using a minimal hand-rolled PNG encoder over Node's built-in zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draw a green rounded-square hero face on a paper background.
function draw(size) {
  const s = size;
  const bg = [253, 246, 227, 255];
  const green = [154, 212, 43, 255];
  const dark = [43, 43, 43, 255];
  const white = [255, 255, 255, 255];
  const m = s * 0.16; // margin
  const r = s * 0.22; // corner radius
  const x0 = m;
  const x1 = s - m;
  const y0 = m;
  const y1 = s - m;

  const inRoundRect = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return Math.hypot(x - cx, y - cy) <= r;
  };
  const nearEdge = (x, y) => {
    // crude outline: inside body but close to its boundary
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    const d = Math.hypot(x - cx, y - cy);
    if (x > x0 + r && x < x1 - r) {
      return Math.abs(y - y0) < s * 0.02 || Math.abs(y - y1) < s * 0.02;
    }
    if (y > y0 + r && y < y1 - r) {
      return Math.abs(x - x0) < s * 0.02 || Math.abs(x - x1) < s * 0.02;
    }
    return Math.abs(d - r) < s * 0.02;
  };

  const eyeY = s * 0.42;
  const eyeR = s * 0.045;
  const eyeDX = s * 0.13;
  const inEye = (x, y) =>
    Math.hypot(x - (s / 2 - eyeDX), y - eyeY) <= eyeR ||
    Math.hypot(x - (s / 2 + eyeDX), y - eyeY) <= eyeR;
  const mouthX = s * 0.34;
  const mouthW = s * 0.32;
  const mouthY = s * 0.56;
  const mouthH = s * 0.16;
  const inMouth = (x, y) => x > mouthX && x < mouthX + mouthW && y > mouthY && y < mouthY + mouthH;
  const onMouthEdge = (x, y) =>
    inMouth(x, y) &&
    (x < mouthX + s * 0.02 ||
      x > mouthX + mouthW - s * 0.02 ||
      y < mouthY + s * 0.02 ||
      y > mouthY + mouthH - s * 0.02);

  return (x, y) => {
    if (inEye(x, y)) return dark;
    if (onMouthEdge(x, y)) return dark;
    if (inMouth(x, y)) return white;
    if (nearEdge(x, y)) return dark;
    if (inRoundRect(x, y)) return green;
    return bg;
  };
}

for (const size of [192, 512]) {
  const png = encodePNG(size, draw(size));
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
