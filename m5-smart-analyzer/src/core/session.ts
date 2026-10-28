import { buildIntrabar, liveSource, splitForming } from './binance';
import { analyze } from './engine';
import {
  detectEntry, isResolvable, resolveEntry, type JournalEntry,
} from './journal';
import type { AnalysisConfig, AnalysisResult, Candle } from './types';

/**
 * Sessão de SIMULAÇÃO ao vivo, sem DOM e sem rede embutida: a busca de candles e
 * o relógio são injetados. Usada pelo agente 24 h. Nada aqui envia ordens: só lê
 * candles, avalia o gatilho e registra entradas VIRTUAIS, resolvidas no
 * fechamento do M5.
 */
export interface SessionDeps {
  fetchKlines(symbol: string, interval: '1m' | '5m', limit: number, extra?: string): Promise<Candle[]>;
  /** Relógio em ms, já corrigido pelo horário da corretora. */
  now(): number;
}

export interface TickReport {
  symbolsOk: number;
  errors: Array<{ symbol: string; message: string }>;
  newEntries: JournalEntry[];
  resolved: JournalEntry[];
  analyses: Map<string, AnalysisResult>;
}

export class SimSession {
  private warm = true;
  private readonly seen: Set<string>;
  journal: JournalEntry[];

  constructor(
    private readonly deps: SessionDeps,
    private readonly config: AnalysisConfig,
    readonly symbols: string[],
    journal: JournalEntry[] = [],
    private readonly candlesPerRequest = 700,
  ) {
    this.journal = [...journal];
    this.seen = new Set(journal.map((e) => e.id));
  }

  /** Um ciclo: consulta os pares, analisa, registra toques novos e resolve os que fecharam. */
  async tick(): Promise<TickReport> {
    const report: TickReport = { symbolsOk: 0, errors: [], newEntries: [], resolved: [], analyses: new Map() };
    const nowSec = this.deps.now() / 1000;

    await Promise.all(this.symbols.map(async (symbol) => {
      try {
        const [c5, m1] = await Promise.all([
          this.deps.fetchKlines(symbol, '5m', this.candlesPerRequest),
          this.deps.fetchKlines(symbol, '1m', 8),
        ]);
        const split = splitForming(c5, nowSec);
        if (!split) throw new Error('candles insuficientes');
        const intrabar = buildIntrabar(split, m1, nowSec);
        const source = liveSource(symbol, split.closed, 'UTC', this.deps.now());
        const analysis = analyze({ candles: split.closed, source, config: this.config, intrabar });
        report.analyses.set(symbol, analysis);
        report.symbolsOk++;
        // o primeiro ciclo só "aquece": um toque já em andamento ao ligar não é registrado
        if (!this.warm) {
          const e = detectEntry(symbol, analysis, this.config, split.formingOpenT, intrabar.remainingSeconds, nowSec);
          if (e && !this.seen.has(e.id)) {
            this.seen.add(e.id);
            this.journal.push(e);
            report.newEntries.push(e);
          }
        }
      } catch (err) {
        report.errors.push({ symbol, message: err instanceof Error ? err.message : String(err) });
      }
    }));

    for (const e of this.journal.filter((x) => isResolvable(x, nowSec))) {
      try {
        const k = await this.deps.fetchKlines(e.symbol, '5m', 1, `&startTime=${e.t5 * 1000}`);
        const done = resolveEntry(e, k[0], this.deps.now() / 1000);
        if (done !== e) {
          this.journal = this.journal.map((x) => (x.id === e.id ? done : x));
          report.resolved.push(done);
        }
      } catch (err) {
        report.errors.push({ symbol: e.symbol, message: `resolução: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
    this.warm = false;
    return report;
  }
}
