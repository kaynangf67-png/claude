import { describe, expect, it } from 'vitest';
import { adjustPixels, historyReducer, INITIAL_EDIT, initialHistory, isPristine, rectFromPoints, toOperations } from './logic';

describe('histórico do editor', () => {
  it('desfaz e refaz', () => {
    let h = initialHistory();
    h = historyReducer(h, { type: 'set', patch: { rotate: 90 } });
    h = historyReducer(h, { type: 'set', patch: { flip: true } });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toMatchObject({ rotate: 90, flip: false });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present.rotate).toBe(0);
    h = historyReducer(h, { type: 'redo' });
    expect(h.present.rotate).toBe(90);
  });

  it('arrastar o mesmo controle vira um passo só', () => {
    let h = initialHistory();
    for (const v of [5, 10, 15, 20]) h = historyReducer(h, { type: 'set', patch: { brightness: v }, key: 'brightness' });
    h = historyReducer(h, { type: 'commit' });
    expect(h.past).toHaveLength(1);
    h = historyReducer(h, { type: 'undo' });
    expect(h.present.brightness).toBe(0);
  });

  it('nova alteração descarta o refazer', () => {
    let h = initialHistory();
    h = historyReducer(h, { type: 'set', patch: { rotate: 90 } });
    h = historyReducer(h, { type: 'undo' });
    h = historyReducer(h, { type: 'set', patch: { flip: true } });
    expect(h.future).toHaveLength(0);
  });
});

describe('recorte', () => {
  it('normaliza pontos em qualquer direção', () => {
    expect(rectFromPoints({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 }, null, 1)).toEqual({ x: 0.2, y: 0.1, width: 0.6000000000000001, height: 0.8 });
  });
  it('1:1 é quadrado em pixels mesmo em imagem retangular', () => {
    const r = rectFromPoints({ x: 0, y: 0 }, { x: 0.5, y: 1 }, 1, 2); // imagem 2:1
    // 0.5 da largura (=1 unidade) deve corresponder a 1.0 da altura (=1 unidade)
    expect(r.width * 2).toBeCloseTo(r.height * 1);
  });
  it('não sai da imagem', () => {
    const r = rectFromPoints({ x: 0.9, y: 0.9 }, { x: 1.5, y: 1.5 }, 1, 1);
    expect(r.x + r.width).toBeLessThanOrEqual(1);
    expect(r.y + r.height).toBeLessThanOrEqual(1);
  });
});

describe('ajustes de pixel', () => {
  it('brilho clareia, saturação zero vira cinza', () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255]);
    expect(adjustPixels(px, 50, 0, 0)[0]).toBe(150);
    const color = new Uint8ClampedArray([200, 50, 50, 255]);
    const gray = adjustPixels(color, 0, 0, -100);
    expect(gray[0]).toBe(gray[1]);
  });
  it('contraste preserva o cinza médio', () => {
    expect(adjustPixels(new Uint8ClampedArray([128, 128, 128, 255]), 0, 60, 0)[0]).toBe(128);
  });
});

describe('operações enviadas à API', () => {
  it('estado inicial não altera nada; recorte minúsculo é ignorado', () => {
    expect(isPristine(INITIAL_EDIT)).toBe(true);
    const ops = toOperations({ ...INITIAL_EDIT, crop: { x: 0, y: 0, width: 0.001, height: 0.5 } });
    expect(ops).not.toHaveProperty('crop');
  });
});
