import { describe, expect, it } from 'vitest';
import { evPorEntrada, kellyFracao, percentil, simularBanca, simularCenarios, validarBanca, type BancaInput } from './banca';
import { wilson } from './stats';

const base: BancaInput = { winRate: 0.6, payoutPercent: 80, stakeMode: 'percent', stake: 2, initial: 1000, trades: 200, paths: 500 };

describe('fórmulas', () => {
  it('valor esperado por entrada: p·b − (1 − p)', () => {
    expect(evPorEntrada(0.6, 80)).toBeCloseTo(0.08, 10);
    expect(evPorEntrada(1 / 1.8, 80)).toBeCloseTo(0, 10); // exatamente o equilíbrio
    expect(evPorEntrada(0.5, 80)).toBeCloseTo(-0.1, 10);
  });

  it('Kelly: (p·b − q) ÷ b, e 0 quando o valor esperado não é positivo', () => {
    expect(kellyFracao(0.6, 80)).toBeCloseTo(0.1, 10);
    expect(kellyFracao(0.5, 80)).toBe(0);
    expect(kellyFracao(0.9, 80)).toBeGreaterThan(kellyFracao(0.6, 80));
  });

  it('percentil por interpolação', () => {
    expect(percentil([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentil([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentil([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(percentil([0, 10], 0.25)).toBe(2.5);
    expect(percentil([], 0.5)).toBeNaN();
  });
});

describe('validação', () => {
  it('rejeita entradas absurdas com mensagem em português', () => {
    expect(validarBanca({ ...base, winRate: 1.2 })).toMatch(/taxa de acerto/);
    expect(validarBanca({ ...base, payoutPercent: 0 })).toMatch(/payout/);
    expect(validarBanca({ ...base, initial: 0 })).toMatch(/banca inicial/);
    expect(validarBanca({ ...base, stake: 150 })).toMatch(/100%/);
    expect(validarBanca({ ...base, trades: 0 })).toMatch(/operações/);
    expect(validarBanca(base)).toBeNull();
    expect(() => simularBanca({ ...base, winRate: -1 })).toThrow();
  });
});

describe('simulação', () => {
  it('é reprodutível com a mesma semente e muda com outra', () => {
    const a = simularBanca(base);
    expect(simularBanca(base)).toEqual(a);
    expect(simularBanca({ ...base, seed: 99 }).final.p50).not.toBe(a.final.p50);
  });

  it('acerto de 100%: banca cresce de forma determinística (juros compostos)', () => {
    const r = simularBanca({ ...base, winRate: 1, trades: 10, paths: 50 });
    const esperado = 1000 * (1 + 0.02 * 0.8) ** 10;
    expect(r.final.p5).toBeCloseTo(esperado, 6);
    expect(r.final.p95).toBeCloseTo(esperado, 6);
    expect(r.pAcima).toBe(1);
    expect(r.maxDrawdown.p95).toBe(0);
  });

  it('acerto de 0%: perde a mesma fração a cada entrada e quebra', () => {
    const r = simularBanca({ ...base, winRate: 0, trades: 200, paths: 50 });
    expect(r.final.p50).toBeCloseTo(1000 * 0.98 ** 200, 6);
    expect(r.pQuebra).toBe(1);
    expect(r.pAcima).toBe(0);
  });

  it('com taxa abaixo do equilíbrio, a banca tende a perder (mediana < inicial, poucas chances de ganhar)', () => {
    const r = simularBanca({ ...base, winRate: 0.5, trades: 500, paths: 1000 });
    expect(r.ev).toBeLessThan(0);
    expect(r.final.p50).toBeLessThan(1000);
    expect(r.pAcima).toBeLessThan(0.2);
    expect(r.kelly).toBe(0);
  });

  it('com vantagem real e amostra longa, quase sempre termina acima', () => {
    const r = simularBanca({ ...base, winRate: 0.7, trades: 300, paths: 1000 });
    expect(r.ev).toBeGreaterThan(0);
    expect(r.pAcima).toBeGreaterThan(0.95);
    expect(r.final.p50).toBeGreaterThan(1000);
  });

  it('no equilíbrio exato o valor esperado é zero, mas o risco de perder segue alto', () => {
    const r = simularBanca({ ...base, winRate: 1 / 1.8, trades: 400, paths: 1000 });
    expect(r.ev).toBeCloseTo(0, 10);
    expect(r.pAcima).toBeLessThan(0.7);
    expect(r.pQueda50).toBeGreaterThan(0);
  });

  it('entrada maior aumenta o risco de ruína', () => {
    const calmo = simularBanca({ ...base, winRate: 0.58, stake: 1, trades: 300 });
    const agressivo = simularBanca({ ...base, winRate: 0.58, stake: 20, trades: 300 });
    expect(agressivo.pQuebra).toBeGreaterThan(calmo.pQuebra);
    expect(agressivo.maxDrawdown.mediana).toBeGreaterThan(calmo.maxDrawdown.mediana);
  });

  it('as faixas ao longo do tempo são ordenadas e começam na banca inicial', () => {
    const r = simularBanca(base);
    expect(r.faixas[0]).toMatchObject({ trade: 0, p5: 1000, p50: 1000, p95: 1000 });
    expect(r.faixas[r.faixas.length - 1]!.trade).toBe(200);
    for (const f of r.faixas) {
      expect(f.p5).toBeLessThanOrEqual(f.p50);
      expect(f.p50).toBeLessThanOrEqual(f.p95);
    }
    for (const q of [r.maxDrawdown.mediana, r.maxDrawdown.p95]) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
    expect(r.final.p5).toBeLessThanOrEqual(r.final.p95);
  });

  it('entrada fixa nunca deixa a banca negativa e para quando acaba o dinheiro', () => {
    const r = simularBanca({ ...base, winRate: 0.3, stakeMode: 'fixo', stake: 100, trades: 300, paths: 300 });
    expect(r.final.p5).toBeGreaterThanOrEqual(0);
    expect(r.pQuebra).toBeGreaterThan(0.9);
  });
});

describe('cenários a partir de uma amostra', () => {
  it('usa o intervalo de Wilson: pessimista < observado < otimista, e o pior caso é pior', () => {
    const c = simularCenarios(60, 100, { ...base, trades: 300 });
    const [lo, hi] = wilson(60, 100);
    expect(c.pessimista.winRate).toBeCloseTo(lo, 10);
    expect(c.otimista.winRate).toBeCloseTo(hi, 10);
    expect(c.observado.winRate).toBeCloseTo(0.6, 10);
    expect(c.pessimista.result.final.p50).toBeLessThan(c.observado.result.final.p50);
    expect(c.observado.result.final.p50).toBeLessThan(c.otimista.result.final.p50);
    // com 60 de 100 e payout 80%, o cenário pessimista (≈50%) está abaixo do equilíbrio (55,6%)
    expect(c.pessimista.winRate).toBeLessThan(c.pessimista.result.breakeven);
  });

  it('amostra maior estreita os cenários', () => {
    const peq = simularCenarios(6, 10, { ...base, paths: 50 });
    const grande = simularCenarios(600, 1000, { ...base, paths: 50 });
    expect(grande.otimista.winRate - grande.pessimista.winRate).toBeLessThan(peq.otimista.winRate - peq.pessimista.winRate);
  });

  it('rejeita amostra inválida', () => {
    expect(() => simularCenarios(11, 10, base)).toThrow();
    expect(() => simularCenarios(0, 0, base)).toThrow();
  });
});
