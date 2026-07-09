// Generates a 512x512 rounded-square gradient icon with a magnifying-glass
// glyph. Standalone (Node built-ins only). Run: `node assets/generate-icon.js`.
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const SIZE = 512;
const RADIUS = 112;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Distance from a point to a rounded-rect edge (negative = inside).
function roundedRectAlpha(x, y) {
  const min = RADIUS;
  const max = SIZE - RADIUS;
  let dx = 0;
  let dy = 0;
  if (x < min) dx = min - x;
  else if (x > max) dx = x - max;
  if (y < min) dy = min - y;
  else if (y > max) dy = y - max;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, RADIUS + 0.5 - dist));
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function buildImage() {
  // Diagonal gradient: indigo -> violet.
  const c0 = [79, 70, 229]; // #4f46e5
  const c1 = [124, 58, 237]; // #7c3aed
  const glass = [255, 255, 255];

  // Magnifying glass geometry.
  const cx = 215;
  const cy = 215;
  const ring = 120;
  const thickness = 30;

  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const t = (x + y) / (2 * SIZE);
      let r = lerp(c0[0], c1[0], t);
      let g = lerp(c0[1], c1[1], t);
      let b = lerp(c0[2], c1[2], t);

      // Glass ring.
      const dr = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const ringA = Math.max(0, Math.min(1, thickness / 2 + 1 - Math.abs(dr - ring)));

      // Handle: thick diagonal segment from the ring toward bottom-right.
      const hx0 = cx + ring * Math.SQRT1_2;
      const hy0 = cy + ring * Math.SQRT1_2;
      const hx1 = 400;
      const hy1 = 400;
      const vx = hx1 - hx0;
      const vy = hy1 - hy0;
      const len2 = vx * vx + vy * vy;
      let proj = ((x - hx0) * vx + (y - hy0) * vy) / len2;
      proj = Math.max(0, Math.min(1, proj));
      const px = hx0 + proj * vx;
      const py = hy0 + proj * vy;
      const hd = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      const handleA = Math.max(0, Math.min(1, thickness / 2 + 1 - hd));

      const glassA = Math.max(ringA, handleA);
      if (glassA > 0) {
        r = lerp(r, glass[0], glassA);
        g = lerp(g, glass[1], glassA);
        b = lerp(b, glass[2], glassA);
      }

      const a = Math.round(roundedRectAlpha(x, y) * 255);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  return raw;
}

function encodePNG(raw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "extension-icon.png");
fs.writeFileSync(out, encodePNG(buildImage()));
console.log(`Wrote ${out}`);
