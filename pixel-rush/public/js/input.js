// Entrada: teclado, controle (Gamepad API) e toque.
import { IN_LEFT, IN_RIGHT, IN_JUMP } from '/shared/constants.js';

const KEYS = {
  ArrowLeft: IN_LEFT, KeyA: IN_LEFT,
  ArrowRight: IN_RIGHT, KeyD: IN_RIGHT,
  Space: IN_JUMP, // pulo só no Espaço
};

export class Input {
  constructor() {
    this.held = new Set();
    this.touch = 0;
    this.handlers = {};
    this.enabled = false;
    this.onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (KEYS[e.code] !== undefined) { this.held.add(e.code); e.preventDefault(); }
      if (e.repeat) return;
      if (e.code === 'KeyR') this.handlers.restart?.();
      if (e.code === 'Escape' || e.code === 'KeyP') this.handlers.pause?.();
      if (/^Digit[1-4]$/.test(e.code)) this.handlers.emote?.(Number(e.code.slice(5)) - 1);
    };
    this.onKeyUp = (e) => { this.held.delete(e.code); };
    this.onBlur = () => { this.held.clear(); this.touch = 0; };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.padPrev = {};
  }

  on(name, fn) { this.handlers[name] = fn; }

  bindTouch(root) {
    const btns = root.querySelectorAll('[data-touch]');
    btns.forEach((b) => {
      const bit = { left: IN_LEFT, right: IN_RIGHT, jump: IN_JUMP }[b.dataset.touch];
      const down = (e) => { e.preventDefault(); this.touch |= bit; b.classList.add('on'); };
      const up = (e) => { e.preventDefault(); this.touch &= ~bit; b.classList.remove('on'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
  }

  mask() {
    let m = this.touch;
    for (const k of this.held) m |= KEYS[k] || 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      if (ax < -0.35 || p.buttons[14]?.pressed) m |= IN_LEFT;
      if (ax > 0.35 || p.buttons[15]?.pressed) m |= IN_RIGHT;
      if (p.buttons[0]?.pressed || p.buttons[1]?.pressed || p.buttons[12]?.pressed) m |= IN_JUMP;
      const start = p.buttons[9]?.pressed, sel = p.buttons[8]?.pressed || p.buttons[3]?.pressed;
      if (start && !this.padPrev.start) this.handlers.pause?.();
      if (sel && !this.padPrev.sel) this.handlers.restart?.();
      this.padPrev = { start, sel };
    }
    if ((m & IN_LEFT) && (m & IN_RIGHT)) m &= ~(IN_LEFT | IN_RIGHT);
    return m;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
