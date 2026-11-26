// Prévia animada do personagem (tela inicial, personalização e loja).
import { gridLevel } from '/shared/level.js';
import { createSim, step } from '/shared/sim.js';
import { IN_RIGHT, IN_JUMP } from '/shared/constants.js';
import { Renderer } from './render.js';
import { drawText, textWidth } from './font.js';
import { heroFrames } from './sprites.js';

function demoLevel(theme) {
  const W = 420;
  const rows = [];
  for (let y = 0; y < 15; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      if (y >= 11) r += '#';
      else if (y === 10 && x === 3) r += 'P';
      else if (y === 7 && x % 37 === 20) r += 'o';
      else if (y === 10 && x % 53 === 40) r += '#';
      else r += '.';
    }
    rows.push(r);
  }
  return gridLevel({ id: 'demo', name: 'demo', world: theme, theme, par: 1, map: rows, ents: [] });
}

export class DemoView {
  constructor(canvas, cos, { theme = 1, label = null } = {}) {
    this.r = new Renderer(canvas);
    this.r.shakeOn = false;
    this.theme = theme;
    this.label = label;
    this.level = demoLevel(theme);
    this.setCos(cos);
    this.raf = 0;
    this.alive = true;
    this.t = 0;
    const loop = () => {
      if (!this.alive) return;
      if (!canvas.isConnected) { this.stop(); return; }
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }
  setCos(cos) {
    this.cos = cos || {};
    this.sim = createSim(this.level);
    this.r.reset(this.level, this.cos);
    this.t = 0;
  }
  tick() {
    this.t++;
    const s = this.sim.s;
    const ph = this.t % 70;
    let m = IN_RIGHT;
    if (ph < 14) m |= IN_JUMP;
    step(this.sim, m);
    if (s.ev.length) this.r.onEvents(this.sim, s.ev);
    if (s.p.x > 400 * 16 || s.finished) this.setCos(this.cos);
    if (this.t % 600 === 300) this.r.startVictory();
    if (this.t % 600 === 420) this.r.victory = null;
    this.r.draw(this.sim, {
      hud: this.label ? (g) => drawText(g, this.label, 192 - textWidth(this.label) / 2, 8, '#fff') : null,
    });
  }
  stop() { this.alive = false; cancelAnimationFrame(this.raf); }
}

// Personagem dançando (tela inicial): usa a skin equipada.
const DANCE = [
  ['idle', 1, 0], ['r0', 1, -1], ['idle', 1, 0], ['r2', 1, -1],
  ['air', 1, -4], ['idle', 1, 0], ['idle', -1, 0], ['r0', -1, -1],
  ['idle', -1, 0], ['r2', -1, -1], ['air', -1, -4], ['idle', -1, 0],
  ['slide', 1, -2], ['slide', -1, -2], ['air', 1, -5], ['idle_blink', 1, 0],
];
export class DanceView {
  constructor(canvas, skin) {
    this.c = canvas; this.c.width = 32; this.c.height = 32;
    this.g = canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.skin = skin || 'skin_male';
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
    this.t++;
    const g = this.g;
    const [name, face, dy] = DANCE[Math.floor(this.t / 12) % DANCE.length];
    const fr = heroFrames(this.skin);
    const img = (face < 0 ? fr.l : fr.r)[name];
    // pequeno "quique" entre os passos
    const sub = (this.t % 12) / 12;
    const bounce = dy ? Math.round(dy * Math.sin(sub * Math.PI)) : (sub < 0.2 ? 1 : 0);
    g.clearRect(0, 0, 32, 32);
    if (bounce > 0) g.drawImage(img, 9, 15, 14, 15); // agachadinha no tempo da música
    else g.drawImage(img, 10, 14 + bounce, 12, 16);
  }
  stop() { this.alive = false; cancelAnimationFrame(this.raf); }
}
