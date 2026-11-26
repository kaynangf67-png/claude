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

// Título "ESTRESSE" animado: letras em onda e, de tempos em tempos, uma "tremedeira" de estresse.
export class AnimatedTitle {
  constructor(canvas, text = 'ESTRESSE') {
    this.c = canvas; this.text = text;
    this.sc = 4;
    this.c.width = textWidth(text, this.sc) + 16;
    this.c.height = 7 * this.sc + 24;
    this.g = canvas.getContext('2d');
    this.t = 0; this.alive = true;
    const loop = () => {
      if (!this.alive) return;
      if (!canvas.isConnected) { this.stop(); return; }
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }
  draw() {
    const { g, sc, text } = this;
    this.t++;
    g.clearRect(0, 0, this.c.width, this.c.height);
    const shaking = this.t % 240 > 200; // ~0,7 s de tremedeira a cada 4 s
    for (let i = 0; i < text.length; i++) {
      let dy = Math.round(Math.sin(this.t * 0.07 + i * 0.7) * 4);
      let dx = 0;
      if (shaking) { dx = Math.round((Math.random() - 0.5) * 4); dy += Math.round((Math.random() - 0.5) * 4); }
      const x = 8 + i * 6 * sc + dx, y = 12 + dy;
      drawText(g, text[i], x + sc, y + sc, '#262626', sc, null); // sombra
      drawText(g, text[i], x, y, '#fff', sc, null);
    }
  }
  stop() { this.alive = false; cancelAnimationFrame(this.raf); }
}
