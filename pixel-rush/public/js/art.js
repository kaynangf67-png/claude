// Logo e troféus em pixel art (gerados em canvas).
import { drawText, textWidth } from './font.js';
import { ditherCanvas } from './mono.js';

export function logoCanvas() {
  // nome do jogo em pixel art, branco puro
  const text = 'ESTRESSE';
  const s = 4;
  const w = textWidth(text, s) + 8, h = 7 * s + 8;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawText(c.getContext('2d'), text, 4, 4, '#ffffff', s, null);
  return c;
}

const TROPHY = [
  '..hhhhhhhh..',
  'oohbbbbbbBoo',
  'o.hbbbbbbB.o',
  'o.hbbbbbbB.o',
  '.ohbbbbbbBo.',
  '..obbbbbbo..',
  '...obbbBo...',
  '....obBo....',
  '.....bB.....',
  '.....bB.....',
  '...oBBBBo...',
  '..obbbbbBo..',
  '..oooooooo..',
];
const PALS = {
  gold: { o: '#5a3a00', b: '#ffd23f', B: '#c89200', h: '#fff4b8' },
  silver: { o: '#2c3640', b: '#d7e1ea', B: '#8fa0b0', h: '#ffffff' },
  bronze: { o: '#3a1a06', b: '#e08a4b', B: '#9a4f1e', h: '#ffcfa8' },
};
const cache = {};
export function trophyURL(kind) {
  if (cache[kind]) return cache[kind];
  const pal = PALS[kind] || PALS.gold;
  const sc = 4;
  const c = document.createElement('canvas');
  c.width = 12 * sc; c.height = 13 * sc;
  const g = c.getContext('2d');
  TROPHY.forEach((row, y) => [...row].forEach((k, x) => {
    if (!pal[k]) return;
    g.fillStyle = pal[k]; g.fillRect(x * sc, y * sc, sc, sc);
  }));
  cache[kind] = ditherCanvas(c).toDataURL();
  return cache[kind];
}
