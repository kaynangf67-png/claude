// Logo e troféus em pixel art (gerados em canvas).
import { drawText, textWidth } from './font.js';

export function logoCanvas() {
  const text = 'PIXEL RUSH';
  const s = 4;
  const w = textWidth(text, s) + 24, h = 7 * s + 30;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // contorno grosso
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [0, 4], [2, 4], [-2, 4]]) {
    drawText(g, text, 12 + dx, 8 + dy, '#140c24', s, null);
  }
  // gradiente por linhas aplicado com máscara do texto
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const t = tmp.getContext('2d');
  const cols = ['#fff4b8', '#ffd23f', '#ffb020', '#ff7a1a', '#ff3d6e', '#ff3d6e', '#c2185b'];
  for (let i = 0; i < 7; i++) { t.fillStyle = cols[i]; t.fillRect(0, 8 + i * s, w, s); }
  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  drawText(mask.getContext('2d'), text, 12, 8, '#fff', s, null);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(mask, 0, 0);
  g.drawImage(tmp, 0, 0);
  // subtítulo
  const sub = 'CORRIDA MUNDIAL';
  drawText(g, sub, Math.round((w - textWidth(sub, 1)) / 2), h - 10, '#3ee0ff', 1, '#140c24');
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
  cache[kind] = c.toDataURL();
  return cache[kind];
}
