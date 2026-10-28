import { describe, expect, it } from 'vitest';
import { atr } from './candle';
import { analyze } from './engine';
import { calcularSinal, checklist, zonaMaisProxima } from './sinal';
import { fullConfig, rangeBound, strongTrend, testSource, touchingIntrabar } from './testing/fixtures';

const cs = rangeBound(5, 5);
const cfg = fullConfig();
const zona = analyze({ candles: cs, source: testSource(cs), config: cfg }).zones.find((z) => z.side === 'resistencia')!;
const a0 = atr(cs, cs.length - 1)!;
const live = (opts = {}) => analyze({ candles: cs, source: testSource(cs), config: cfg, intrabar: touchingIntrabar(cs, zona, a0, opts) });

describe('sinal simples', () => {
  it('sem análise: conectando; sem dados: explica', () => {
    expect(calcularSinal(null, null)).toMatchObject({ tipo: 'sem_dados', titulo: 'Conectando…' });
    const curto = rangeBound(2, 0);
    const r = analyze({ candles: curto, source: testSource(curto), config: cfg });
    expect(calcularSinal(r, 1).tipo).toBe('sem_dados');
  });

  it('todos os critérios + zona armada tocada: ENTRADA com o lado certo', () => {
    const s = calcularSinal(live({ remaining: 200 }), 1.1021);
    expect(s).toMatchObject({ tipo: 'entrada', lado: 'venda', titulo: 'VENDA agora' });
    expect(s.detalhe).toMatch(/resistência/);
    expect(s.checklist.every((i) => i.status === 'ok')).toBe(true);
    expect(s.faltam).toEqual([]);
  });

  it('o mesmo toque no suporte é COMPRA', () => {
    const sup = analyze({ candles: cs, source: testSource(cs), config: cfg }).zones.find((z) => z.side === 'suporte')!;
    const r = analyze({ candles: cs, source: testSource(cs), config: cfg, intrabar: touchingIntrabar(cs, sup, a0, { remaining: 200 }) });
    expect(calcularSinal(r, 1.0999)).toMatchObject({ tipo: 'entrada', lado: 'compra', titulo: 'COMPRA agora' });
  });

  it('menos de 2:30: "Tempo esgotado" (não entre), mesmo com a zona tocada', () => {
    const s = calcularSinal(live({ remaining: 120 }), 1.1021);
    expect(s).toMatchObject({ tipo: 'nao_entre', titulo: 'Tempo esgotado' });
    expect(s.checklist.find((i) => i.id === 'gatilho_tempo_restante')!.status).toBe('falta');
  });

  it('reversão ou vela nascendo na zona: NÃO ENTRE com o motivo', () => {
    const s = calcularSinal(live({ counterATR: 0.5 }), 1.1021);
    expect(s).toMatchObject({ tipo: 'nao_entre', titulo: 'NÃO ENTRE' });
    expect(s.detalhe).toMatch(/Reversão/);
    expect(s.faltam).toContain('Sem reversão');
    expect(calcularSinal(live({ openOffsetATR: 0.1 }), 1.1021).faltam).toContain('Não nasceu na zona');
  });

  it('sem contato com a zona: AGUARDE com a distância até a zona armada mais próxima', () => {
    const longe = { remainingSeconds: 200, forming: { o: 1.1008, h: 1.1011, l: 1.1007, c: 1.101 }, m1: [] };
    const r = analyze({ candles: cs, source: testSource(cs), config: cfg, intrabar: longe });
    const s = calcularSinal(r, 1.101);
    expect(s.tipo).toBe('aguarde');
    expect(s.detalhe).toMatch(/(Resistência|Suporte) armada a \d+,\d{2}% do preço/);
  });

  it('zona com poucos toques válidos não é confiável', () => {
    const r = analyze({ candles: cs, source: testSource(cs), config: fullConfig({ minPriorValidTouches: 10 }), intrabar: touchingIntrabar(cs, zona, a0) });
    expect(calcularSinal(r, 1.1021, 10)).toMatchObject({ tipo: 'aguarde' });
  });

  it('o sinal nunca vira "entrada" sem gatilho confirmado (ex.: só candles fechados)', () => {
    const r = analyze({ candles: cs, source: testSource(cs), config: cfg });
    expect(calcularSinal(r, 1.1021).tipo).not.toBe('entrada');
    const t = strongTrend(60);
    expect(calcularSinal(analyze({ candles: t, source: testSource(t), config: cfg }), 1.12).tipo).not.toBe('entrada');
  });

  it('checklist com 7 itens: ok / falta / não avaliável', () => {
    const l = checklist(analyze({ candles: cs, source: testSource(cs), config: cfg }));
    expect(l).toHaveLength(7);
    expect(l.find((i) => i.id === 'vela_lenta_parada')!.status).toBe('na'); // sem candle em formação
    expect(checklist(null).every((i) => i.status === 'na')).toBe(true);
  });

  it('zonaMaisProxima ignora zonas já atingidas e fracas', () => {
    const r = analyze({ candles: cs, source: testSource(cs), config: cfg });
    expect(zonaMaisProxima(r, zona.upper + 1)?.lado).not.toBe('resistencia');
    expect(zonaMaisProxima(r, 1.101, 99)).toBeNull();
  });
});
