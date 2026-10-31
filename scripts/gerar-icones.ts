/**
 * Gera os ícones PNG do app (sem dependências): um relógio com uma seta de
 * queda de preço. Desenho por SDF com supersampling para bordas suaves.
 * Uso: npm run icones
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type RGBA = [number, number, number, number];

const BG: RGBA = [11, 18, 32, 255];
const BAND: RGBA = [58, 72, 99, 255];
const CASE: RGBA = [236, 241, 248, 255];
const FACE: RGBA = [17, 27, 46, 255];
const ACCENT: RGBA = [34, 197, 94, 255];

const sdCircle = (x: number, y: number, cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) - r;
function sdRoundRect(x: number, y: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
  const dx = Math.abs(x - cx) - hw + r;
  const dy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}
function sdSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number, r: number): number {
  const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

/** Cor do ponto (coordenadas 0..1). `inset` encolhe o desenho (ícone "maskable"). */
function shade(u: number, v: number, maskable: boolean): RGBA | null {
  const inset = maskable ? 0.72 : 0.86;
  const x = (u - 0.5) / inset + 0.5;
  const y = (v - 0.5) / inset + 0.5;
  // Fundo: quadrado arredondado (ou sangrado no maskable).
  if (!maskable && sdRoundRect(u, v, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) return null;
  let color: RGBA = BG;
  if (sdRoundRect(x, y, 0.5, 0.5, 0.17, 0.46, 0.08) < 0) color = BAND;
  if (sdCircle(x, y, 0.5, 0.5, 0.3) < 0) color = CASE;
  if (sdRoundRect(x, y, 0.83, 0.5, 0.035, 0.06, 0.02) < 0) color = CASE;
  if (sdCircle(x, y, 0.5, 0.5, 0.245) < 0) color = FACE;
  // Seta de queda de preço: diagonal + ponta.
  const arrow = Math.min(
    sdSegment(x, y, 0.4, 0.4, 0.6, 0.6, 0.032),
    sdSegment(x, y, 0.6, 0.6, 0.6, 0.47, 0.032),
    sdSegment(x, y, 0.6, 0.6, 0.47, 0.6, 0.032),
  );
  if (arrow < 0) color = ACCENT;
  return color;
}

function render(size: number, maskable = false): Buffer {
  const ss = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const c = shade((i + (si + 0.5) / ss) / size, (j + (sj + 0.5) / ss) / size, maskable);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }
      const n = ss * ss;
      const o = (j * size + i) * 4;
      const alpha = a / n;
      // Cor não pré-multiplicada.
      const k = a > 0 ? 255 / a : 0;
      px[o] = Math.round(r * k);
      px[o + 1] = Math.round(g * k);
      px[o + 2] = Math.round(b * k);
      px[o + 3] = Math.round(alpha);
    }
  }
  return png(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w: number, h: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // bits
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../web/public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), render(192));
writeFileSync(new URL('icon-512.png', out), render(512));
writeFileSync(new URL('maskable-512.png', out), render(512, true));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, true));
writeFileSync(new URL('favicon-48.png', out), render(48));
console.log('Ícones gerados em web/public/icons/');
