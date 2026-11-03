import { describe, expect, it } from 'vitest';
import { journalStats, type JournalEntry } from './journal';
import { formatSummary } from './relatorio';

const e = (result: JournalEntry['result'], i: number): JournalEntry => ({
  id: String(i), symbol: 'BTCUSDT', side: 'resistencia', zoneId: 'R', t5: 1000 + i * 300, detectedAt: 1000, entry: 1, remainingSeconds: 200,
  state: 'FAVORAVEL', triggerConfirmed: false, criteria: {}, filters: {}, rulesVersion: 'v', configHash: 'h', close: 1, result,
});
const many = (w: number, l: number) => [...Array(w).fill(0).map((_, i) => e('ganhou', i)), ...Array(l).fill(0).map((_, i) => e('perdeu', 1000 + i))];
const text = (list: JournalEntry[], payout = 80) => formatSummary(journalStats(list, payout), payout).join('\n');

describe('relatório do agente de simulação', () => {
  it('sem resultados diz que ainda não há o que concluir', () => {
    expect(text([e(null, 1)])).toMatch(/Ainda sem resultado/);
  });

  it('amostra pequena é sempre avisada, mesmo com acerto altíssimo', () => {
    const t = text(many(9, 1));
    expect(t).toMatch(/amostra pequena \(n=10\)/);
    expect(t).not.toMatch(/vantagem/i);
  });

  it('abaixo do equilíbrio é dito com todas as letras', () => {
    expect(text(many(300, 700))).toMatch(/PERDE dinheiro/);
  });

  it('só fala em "possível vantagem" com amostra grande e intervalo acima do equilíbrio, sem chamar de prova', () => {
    const t = text(many(700, 300));
    expect(t).toMatch(/Possível vantagem, mas NÃO é prova/);
    expect(text(many(60, 40))).not.toMatch(/Possível vantagem/);
  });

  it('mostra o resultado virtual em unidades de entrada, como dinheiro de mentira', () => {
    const t = text(many(1, 1));
    expect(t).toMatch(/Resultado virtual: \+?-?0,80 entradas|Resultado virtual: -0,20|dinheiro de mentira/);
    expect(text(many(2, 1), 80)).toMatch(/\+0,60 entradas \(dinheiro de mentira\)/);
  });
});
