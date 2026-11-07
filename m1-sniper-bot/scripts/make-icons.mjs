// Gera os ícones PNG (mira verde sobre fundo azul-marinho) sem dependências.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy) / (size / 2);
      let col = [8, 14, 30, 255];
      if (d > 0.98) col = [0, 0, 0, 0];
      const ring = Math.abs(d - 0.62) < 0.07;
      const cross = (Math.abs(dx) < size * 0.045 || Math.abs(dy) < size * 0.045) && d < 0.9 && d > 0.25;
      const dot = d < 0.12;
      if (d <= 0.98 && (ring || cross)) col = [34, 197, 94, 255];
      if (dot) col = [239, 68, 68, 255];
      raw.set(col, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(new URL(`../icons/icon${s}.png`, import.meta.url), png(s));
console.log('ícones gerados');
