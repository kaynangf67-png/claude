import { atr as atrOf } from './candle';
import { analyze } from './engine';
import { breakevenRate, tally, verdict, type Tally, type Verdict } from './stats';
import { priorValidTouches } from './zones';
import type { AnalysisConfig, Candle, DataSourceInfo, FilterStatus, ScenarioState } from './types';

/**
 * Teste histórico com RESULTADO: cada toque numa zona armada vira uma linha;
 * ganha se o candle M5 fecha do lado certo do preço de entrada.
 *
 * Sem olhar o futuro: a análise recebe só os candles M5 anteriores; o caminho
 * do candle (M1) é reproduzido até o instante do toque, e os critérios do
 * gatilho são avaliados com o mesmo código do uso ao vivo.
 *
 * Limites: a entrada é a borda da zona; o instante do toque é o meio do
 * minuto em que a borda foi alcançada; a expiração é o fechamento do M5.
 * Nada disso vem da aula, e o payout da corretora varia.
 */

export interface BacktestRow {
  t: number;
  zoneId: string;
  side: 'resistencia' | 'suporte';
  entry: number;
  close: number;
  win: boolean;
  tie: boolean;
  remainingSeconds: number;
  state: ScenarioState;
  triggerConfirmed: boolean;
  /** status de cada critério do gatilho */
  criteria: Record<string, string>;
  /** status de cada filtro avaliado */
  filters: Record<string, FilterStatus>;
}

export interface BacktestResult {
  rows: BacktestRow[];
  analyzedCandles: number;
  skipped: { semAnalise: number; m1Divergente: number; semM1: number };
}

export function runBacktest(
  c5: Candle[], m1: Map<number, Candle[]>, config: AnalysisConfig, source: DataSourceInfo | null,
  opts: { from?: number; to?: number } = {},
): BacktestResult {
  const p = config.params;
  const histLen = Math.max(p.minCandles.value!, p.contextWindow.value! + p.swingLookback.value! + 30);
  const minPrior = p.minPriorValidTouches.value ?? 2;
  const rows: BacktestRow[] = [];
  const skipped = { semAnalise: 0, m1Divergente: 0, semM1: 0 };
  let analyzed = 0;
  const start = Math.max(opts.from ?? 0, p.minCandles.value!);
  const end = Math.min(opts.to ?? c5.length - 1, c5.length - 1);

  for (let i = start; i <= end; i++) {
    const cand = c5[i]!;
    const m = m1.get(cand.t);
    if (!m || m.length < 5) { skipped.semM1++; continue; }
    const hist = c5.slice(Math.max(0, i - histLen), i);
    const a0 = analyze({ candles: hist, source, config });
    if (a0.state === 'NAO_AVALIAVEL' || hist[hist.length - 1]!.t + 300 !== cand.t) { skipped.semAnalise++; continue; }
    // os M1 precisam bater com o M5; senão o dado está ruim
    const tolPx = 0.05 * (atrOf(hist, hist.length - 1) ?? 0);
    if (Math.abs(m[0]!.o - cand.o) > tolPx || Math.abs(m[4]!.c - cand.c) > tolPx) { skipped.m1Divergente++; continue; }
    analyzed++;

    for (const z of a0.zones) {
      if (priorValidTouches(z, hist.length).length < minPrior) continue; // zona não armada
      const res = z.side === 'resistencia';
      if (res ? cand.o > z.upper : cand.o < z.lower) continue; // já abriu além da zona
      let k = -1;
      for (let j = 0; j < 5; j++) {
        if (res ? m[j]!.h >= z.lower : m[j]!.l <= z.upper) { k = j; break; }
      }
      if (k < 0) continue;
      const edge = res ? z.lower : z.upper;
      const entry = res ? Math.max(m[k]!.o, edge) : Math.min(m[k]!.o, edge);
      if (res ? entry > z.upper : entry < z.lower) continue;

      const closed = m.slice(0, k);
      const h = Math.max(cand.o, entry, ...closed.map((x) => x.h));
      const l = Math.min(cand.o, entry, ...closed.map((x) => x.l));
      const remainingSeconds = 300 - (k * 60 + 30);
      const a1 = analyze({
        candles: hist, source, config,
        intrabar: { remainingSeconds, forming: { o: cand.o, h, l, c: entry }, m1: closed, focusZoneId: z.id },
      });
      if (!a1.entry || a1.entry.zoneId !== z.id) continue;

      const criteria: Record<string, string> = {};
      for (const c of a1.trigger.criteria) criteria[c.id] = c.status;
      const filters: Record<string, FilterStatus> = {};
      for (const f of a1.filters) filters[f.id] = f.status;
      rows.push({
        t: cand.t, zoneId: z.id, side: z.side, entry, close: cand.c,
        win: res ? cand.c < entry : cand.c > entry, tie: cand.c === entry,
        remainingSeconds, state: a1.state, triggerConfirmed: a1.trigger.confirmed, criteria, filters,
      });
    }
  }
  return { rows, analyzedCandles: analyzed, skipped };
}

export interface AblationRow {
  id: string;
  label: string;
  pass: Tally;
  fail: Tally;
}

export interface BacktestSummary {
  breakeven: number;
  todos: Tally;
  favoravel: Tally;
  gatilho: Tally;
  verdicts: { todos: Verdict; favoravel: Verdict; gatilho: Verdict };
  ablation: AblationRow[];
}

const ABLATION: Array<{ id: string; label: string; kind: 'filter' | 'criterion' }> = [
  { id: 'gatilho_tempo_restante', label: 'Tempo restante ≥ 2:30', kind: 'criterion' },
  { id: 'reversao', label: 'Sem reversão contra (F1)', kind: 'filter' },
  { id: 'vela_proxima_regiao', label: 'Vela não nasceu perto da zona (F2)', kind: 'filter' },
  { id: 'sequencia_direcional', label: 'Sem fluxo de 3 velas da mesma cor (F3)', kind: 'filter' },
  { id: 'vela_lenta_parada', label: 'Vela não está lenta nem parada (F4)', kind: 'filter' },
  { id: 'gatilho_velas_com_pavio', label: 'Velas anteriores com força a favor', kind: 'criterion' },
  { id: 'gatilho_dois_toques_com_pavio', label: '2 toques anteriores com pavio', kind: 'criterion' },
];

export function summarizeBacktest(rows: BacktestRow[], payoutPercent: number): BacktestSummary {
  const be = breakevenRate(payoutPercent);
  const todos = tally(rows);
  const favoravel = tally(rows.filter((r) => r.state === 'FAVORAVEL'));
  const gatilho = tally(rows.filter((r) => r.triggerConfirmed));
  const passes = (r: BacktestRow, a: (typeof ABLATION)[number]) =>
    a.kind === 'filter' ? r.filters[a.id] === 'favoravel' : r.criteria[a.id] === 'atendido';
  return {
    breakeven: be,
    todos, favoravel, gatilho,
    verdicts: { todos: verdict(todos, be), favoravel: verdict(favoravel, be), gatilho: verdict(gatilho, be) },
    ablation: ABLATION.map((a) => ({
      id: a.id, label: a.label,
      pass: tally(rows.filter((r) => passes(r, a))),
      fail: tally(rows.filter((r) => !passes(r, a))),
    })),
  };
}
