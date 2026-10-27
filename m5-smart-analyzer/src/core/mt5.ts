import { candleIssue } from './candle';
import type { Candle } from './types';

/**
 * Velas de 1 minuto exportadas do MT5/MT4. Formatos aceitos por linha:
 *   2026.10.19<TAB>00:00:00<TAB>1.0850<TAB>...      (separador tab, ; ou ,)
 *   2026.10.19 00:00,1.0850,1.0852,1.0849,1.0851
 * O horário é o do SERVIDOR da corretora do MT5 e é tratado como UTC: serve
 * para alinhar velas entre si, não para ler a hora real.
 */
export interface M1Parse {
  candles: Candle[];
  rejected: number;
}

export function parseMt5M1(text: string): M1Parse {
  const out: Candle[] = [];
  let rejected = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/^\d/.test(line)) continue; // cabeçalho e linhas vazias
    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const p = line.split(sep).map((x) => x.trim());
    let dt: string;
    let i0: number;
    if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}[ T]\d{2}:\d{2}/.test(p[0]!)) {
      dt = p[0]!;
      i0 = 1;
    } else {
      dt = `${p[0]} ${p[1] ?? ''}`;
      i0 = 2;
    }
    const m = dt.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) { rejected++; continue; }
    const t = Math.floor(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!) / 1000);
    const v = p.slice(i0, i0 + 4).map((x) => parseFloat(x.replace(',', '.')));
    if (v.length < 4 || v.some((x) => !Number.isFinite(x))) { rejected++; continue; }
    const c: Candle = { t, o: v[0]!, h: v[1]!, l: v[2]!, c: v[3]! };
    if (candleIssue(c) !== null) { rejected++; continue; }
    out.push(c);
  }
  out.sort((a, b) => a.t - b.t);
  // timestamps repetidos: mantém o primeiro e conta o resto como rejeitado
  const dedup: Candle[] = [];
  for (const c of out) {
    if (dedup.length && dedup[dedup.length - 1]!.t === c.t) { rejected++; continue; }
    dedup.push(c);
  }
  return { candles: dedup, rejected };
}

export interface Bucketed {
  c5: Candle[];
  /** Os 5 candles M1 de cada candle M5 (chave = abertura do M5, em segundos). */
  m1: Map<number, Candle[]>;
  /** Janelas de 5 minutos descartadas por não terem os 5 minutos. */
  incompleteBuckets: number;
}

/** Agrupa M1 em M5 exigindo os 5 minutos de cada janela (nada é preenchido). */
export function bucketM1(c1: Candle[]): Bucketed {
  const groups = new Map<number, Candle[]>();
  for (const m of c1) {
    const k = Math.floor(m.t / 300) * 300;
    const g = groups.get(k);
    if (g) g.push(m);
    else groups.set(k, [m]);
  }
  const c5: Candle[] = [];
  const m1 = new Map<number, Candle[]>();
  let incompleteBuckets = 0;
  for (const k of [...groups.keys()].sort((a, b) => a - b)) {
    const g = groups.get(k)!.sort((a, b) => a.t - b.t);
    const complete = g.length === 5 && g.every((c, i) => c.t === k + i * 60);
    if (!complete) { incompleteBuckets++; continue; }
    m1.set(k, g);
    c5.push({
      t: k, o: g[0]!.o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g[4]!.c,
    });
  }
  return { c5, m1, incompleteBuckets };
}

/** O arquivo parece mesmo ser de 1 minuto? (mediana dos intervalos < 5 min) */
export function looksLikeM1(c1: Candle[]): boolean {
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(c1.length, 3000); i++) gaps.push(c1[i]!.t - c1[i - 1]!.t);
  gaps.sort((a, b) => a - b);
  return gaps.length > 0 && gaps[Math.floor(gaps.length / 2)]! < 300;
}
