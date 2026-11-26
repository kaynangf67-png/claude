// Prévia animada do personagem (tela inicial, personalização e loja).
import { gridLevel } from '/shared/level.js';
import { createSim, step } from '/shared/sim.js';
import { IN_RIGHT, IN_JUMP } from '/shared/constants.js';
import { Renderer } from './render.js';
import { drawText, textWidth } from './font.js';

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
