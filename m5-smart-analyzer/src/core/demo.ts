import type { Candle, DataSourceInfo } from './types';

/**
 * Dados SINTÉTICOS para demonstração. São gerados por um sorteio com semente
 * fixa e NÃO representam nenhum ativo, corretora ou período real.
 */

export type DemoScenario = 'lateral' | 'tendencia';

export const DEMO_LABEL = 'DADOS FICTÍCIOS — gerados por computador, não são cotações reais';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START_T = Date.UTC(2026, 0, 5, 8, 0, 0) / 1000;

export function generateDemoCandles(scenario: DemoScenario, count = 240): Candle[] {
  const rand = mulberry32(scenario === 'lateral' ? 20260105 : 20260106);
  const noise = (s: number) => (rand() - 0.5) * 2 * s;
  const candles: Candle[] = [];
  let prev = 1.1;
  const unit = 0.0004;
  for (let i = 0; i < count; i++) {
    let target: number;
    if (scenario === 'lateral') {
      // oscila entre ~1.0985 e ~1.1035 com ciclos irregulares: cria topos/fundos próximos
      target = 1.1 + 0.0025 * Math.sin(i / 5.2) + 0.0008 * Math.sin(i / 2.1);
    } else {
      // tendência de alta contínua com pouquíssimas retrações
      target = 1.1 + i * 0.00022 + 0.0002 * Math.sin(i / 3);
    }
    const open = prev;
    // Mais ruído que deriva: candles reais de M5 alternam bastante de cor.
    const drift = (target - open) * (scenario === 'lateral' ? 0.3 : 0.7);
    const close = open + drift + noise(unit * (scenario === 'lateral' ? 1.6 : 0.8));
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const wickScale = scenario === 'lateral' ? unit * 1.3 : unit * 0.25;
    const high = bodyTop + rand() * wickScale;
    const low = bodyBottom - rand() * wickScale;
    const r = (x: number) => Math.round(x * 1e5) / 1e5;
    candles.push({
      t: START_T + i * 300,
      o: r(open), h: r(Math.max(high, open, close)), l: r(Math.min(low, open, close)), c: r(close),
      v: Math.round(800 + rand() * 600),
    });
    prev = r(close);
  }
  return candles;
}

export function sourceFor(
  candles: Candle[],
  fields: Pick<DataSourceInfo, 'kind' | 'name' | 'origin' | 'synthetic' | 'asset' | 'otc' | 'timezone' | 'displayTimezone'>,
  now: number,
): DataSourceInfo {
  const first = candles[0]!.t;
  const last = candles[candles.length - 1]!.t;
  return {
    ...fields,
    importedAt: now,
    rows: candles.length,
    firstT: first,
    lastT: last,
    datasetId: `${fields.name}|${first}|${last}|${candles.length}`,
  };
}

export function demoSource(scenario: DemoScenario, candles: Candle[], displayTimezone: string, now: number): DataSourceInfo {
  return sourceFor(candles, {
    kind: 'demo_sintetico',
    name: scenario === 'lateral' ? 'Demonstração: mercado lateral' : 'Demonstração: tendência contínua',
    origin: DEMO_LABEL,
    synthetic: true,
    asset: 'FICTICIO',
    otc: false,
    timezone: 'UTC',
    displayTimezone,
  }, now);
}
