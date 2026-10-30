import { CANDLE_ISSUE_MESSAGES, candleIssue } from './candle';
import { isValidTimezone, zonedWallTimeToUnix } from './time';
import type { Candle } from './types';

/**
 * Importação de candles via CSV com validação estrita.
 *
 * Política: se QUALQUER linha for inválida, a importação inteira é rejeitada
 * ("dados inválidos impedem a análise"). Nunca descartamos linhas em silêncio
 * nem inventamos candles ausentes.
 */

export type ImportIssueCode =
  | 'ARQUIVO_VAZIO'
  | 'COLUNA_AUSENTE'
  | 'COLUNAS_INCOMPATIVEIS'
  | 'TIMESTAMP_INVALIDO'
  | 'FUSO_NECESSARIO'
  | 'FUSO_INVALIDO'
  | 'NUMERO_INVALIDO'
  | 'CAMPO_VAZIO'
  | 'PRECO_NAO_POSITIVO'
  | 'HIGH_MENOR_QUE_LOW'
  | 'HIGH_MENOR_QUE_CORPO'
  | 'LOW_MAIOR_QUE_CORPO'
  | 'VOLUME_INVALIDO'
  | 'NAO_FINITO'
  | 'TIMESTAMP_DUPLICADO'
  | 'LIMITE_LINHAS'
  | 'SEM_CANDLES'
  | 'ORDENADO_AUTOMATICAMENTE'
  | 'LACUNA'
  | 'FORA_DA_GRADE'
  | 'INTERVALO_MENOR';

export interface ImportIssue {
  /** Número da linha no arquivo (1 = cabeçalho); null para problemas globais. */
  line: number | null;
  code: ImportIssueCode;
  message: string;
}

export interface Gap {
  fromT: number;
  toT: number;
  missingCandles: number;
}

export interface ImportOptions {
  /** Fuso dos timestamps sem offset ('UTC' ou nome IANA, ex.: 'America/Sao_Paulo'). */
  timezone?: string;
  /** Duração do timeframe em segundos (M5 = 300). */
  timeframeSeconds: number;
  maxRows?: number;
  /** Máximo de erros detalhados devolvidos. */
  maxIssues?: number;
}

export interface ImportResult {
  ok: boolean;
  candles: Candle[];
  errors: ImportIssue[];
  /** Total de erros encontrados (pode ser maior que `errors.length`). */
  errorsTotal: number;
  warnings: ImportIssue[];
  gaps: Gap[];
  /** Há timestamps sem offset e nenhum fuso foi informado. */
  needsTimezone: boolean;
  stats: {
    rowsRead: number;
    rowsValid: number;
    duplicates: number;
    sortedAutomatically: boolean;
    hasVolume: boolean;
    firstT: number | null;
    lastT: number | null;
    medianStepSeconds: number | null;
  };
}

const DEFAULT_MAX_ROWS = 100_000;

const HEADER_ALIASES: Record<string, string> = {
  timestamp: 'timestamp',
  time: 'timestamp',
  datetime: 'timestamp',
  date: 'timestamp',
  data: 'timestamp',
  open: 'open',
  high: 'high',
  low: 'low',
  close: 'close',
  volume: 'volume',
  vol: 'volume',
};

/** Divide o texto em registros respeitando aspas duplas. */
export function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(headerLine: string): string {
  const counts = [',', ';', '\t'].map((d) => [d, headerLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}

export type TimestampParse =
  | { kind: 'ok'; t: number }
  | { kind: 'naive'; y: number; mo: number; d: number; h: number; mi: number; s: number }
  | { kind: 'error' };

function validParts(y: number, mo: number, d: number, h: number, mi: number, s: number): boolean {
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Interpreta um timestamp textual. Não aplica fuso: devolve `naive` quando falta offset. */
export function parseTimestamp(raw: string): TimestampParse {
  const s = raw.trim();
  if (/^\d{10}(\.\d+)?$/.test(s)) return { kind: 'ok', t: Math.floor(Number(s)) };
  if (/^\d{13}$/.test(s)) return { kind: 'ok', t: Math.floor(Number(s) / 1000) };

  let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(s);
  let parts: number[] | null = null;
  let offset: string | undefined;
  if (m) {
    parts = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[6] ?? '0'].map(Number);
    offset = m[7];
  } else {
    m = /^(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) parts = [m[3]!, m[2]!, m[1]!, m[4]!, m[5]!, m[6] ?? '0'].map(Number);
  }
  if (!parts) return { kind: 'error' };
  const [y, mo, d, h, mi, sec] = parts as [number, number, number, number, number, number];
  if (!validParts(y, mo, d, h, mi, sec)) return { kind: 'error' };

  if (offset === undefined) return { kind: 'naive', y, mo, d, h, mi, s: sec };
  let offsetSeconds = 0;
  if (offset.toUpperCase() !== 'Z') {
    const sign = offset.startsWith('-') ? -1 : 1;
    const digits = offset.slice(1).replace(':', '');
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2) || '0');
    if (oh > 14 || om > 59) return { kind: 'error' };
    offsetSeconds = sign * (oh * 3600 + om * 60);
  }
  return { kind: 'ok', t: Math.floor(Date.UTC(y, mo - 1, d, h, mi, sec) / 1000) - offsetSeconds };
}

function parseNumber(raw: string, decimalComma: boolean): number | null {
  let s = raw.trim();
  if (decimalComma) s = s.replace(',', '.');
  return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Lacunas e anomalias de intervalo em candles já ordenados. */
export function findGaps(candles: Candle[], stepSeconds: number): { gaps: Gap[]; offGrid: number; shorter: number } {
  const gaps: Gap[] = [];
  let shorter = 0;
  let offGrid = 0;
  for (let i = 1; i < candles.length; i++) {
    const delta = candles[i]!.t - candles[i - 1]!.t;
    if (delta > stepSeconds) {
      gaps.push({
        fromT: candles[i - 1]!.t,
        toT: candles[i]!.t,
        missingCandles: Math.max(1, Math.round(delta / stepSeconds) - 1),
      });
    } else if (delta < stepSeconds) shorter++;
  }
  for (const c of candles) if (c.t % stepSeconds !== 0) offGrid++;
  return { gaps, offGrid, shorter };
}

export function importCandlesCsv(text: string, options: ImportOptions): ImportResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxIssues = options.maxIssues ?? 50;
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  let errorsTotal = 0;
  let needsTimezone = false;

  const addError = (line: number | null, code: ImportIssueCode, message: string) => {
    errorsTotal++;
    if (errors.length < maxIssues) errors.push({ line, code, message });
  };

  const empty = (): ImportResult => ({
    ok: false,
    candles: [],
    errors,
    errorsTotal,
    warnings,
    gaps: [],
    needsTimezone,
    stats: {
      rowsRead: 0, rowsValid: 0, duplicates: 0, sortedAutomatically: false,
      hasVolume: false, firstT: null, lastT: null, medianStepSeconds: null,
    },
  });

  const clean = text.replace(/^﻿/, '');
  if (clean.trim() === '') {
    addError(null, 'ARQUIVO_VAZIO', 'O arquivo está vazio.');
    return empty();
  }

  const firstLine = clean.split(/\r?\n/, 1)[0]!;
  const delimiter = detectDelimiter(firstLine);
  const decimalComma = delimiter === ';';
  const table = tokenizeCsv(clean, delimiter).filter((r) => !(r.length === 1 && r[0]!.trim() === ''));

  const header = table[0]!.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    timestamp: col('timestamp'), open: col('open'), high: col('high'), low: col('low'),
    close: col('close'), volume: col('volume'),
  };
  const missing = (['timestamp', 'open', 'high', 'low', 'close'] as const).filter((k) => idx[k] < 0);
  if (missing.length > 0) {
    addError(
      1,
      'COLUNA_AUSENTE',
      `Colunas obrigatórias ausentes: ${missing.join(', ')}. Colunas encontradas: ${table[0]!.map((h) => h.trim()).join(', ') || '(nenhuma)'}. ` +
        'O arquivo precisa ter: timestamp, open, high, low, close (e opcionalmente volume).',
    );
    return empty();
  }

  const tz = options.timezone;
  if (tz !== undefined && !isValidTimezone(tz)) {
    addError(null, 'FUSO_INVALIDO', `Fuso horário desconhecido: "${tz}".`);
    return empty();
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) {
    addError(null, 'SEM_CANDLES', 'O arquivo tem cabeçalho, mas nenhuma linha de dados.');
    return empty();
  }
  if (dataRows.length > maxRows) {
    addError(null, 'LIMITE_LINHAS', `O arquivo tem ${dataRows.length} linhas; o limite é ${maxRows}. Divida o arquivo em partes menores.`);
    return empty();
  }

  const parsed: Array<{ candle: Candle; line: number }> = [];
  let naiveCount = 0;

  dataRows.forEach((row, i) => {
    const line = i + 2;
    if (row.length !== header.length) {
      addError(line, 'COLUNAS_INCOMPATIVEIS', `Linha ${line}: tem ${row.length} colunas, mas o cabeçalho tem ${header.length}.`);
      return;
    }
    const tsRaw = row[idx.timestamp]!.trim();
    if (tsRaw === '') {
      addError(line, 'CAMPO_VAZIO', `Linha ${line}: o campo timestamp está vazio.`);
      return;
    }
    const ts = parseTimestamp(tsRaw);
    if (ts.kind === 'error') {
      addError(
        line, 'TIMESTAMP_INVALIDO',
        `Linha ${line}: timestamp "${tsRaw}" não reconhecido. Formatos aceitos: 2026-01-05T09:00:00Z, 2026-01-05 09:00:00, 05/01/2026 09:00 ou Unix em segundos/milissegundos.`,
      );
      return;
    }
    let t: number;
    if (ts.kind === 'naive') {
      naiveCount++;
      if (tz === undefined) return; // sem fuso: sinalizado de forma global abaixo
      t = zonedWallTimeToUnix(ts.y, ts.mo, ts.d, ts.h, ts.mi, ts.s, tz);
    } else t = ts.t;

    const nums: Record<string, number> = {};
    for (const k of ['open', 'high', 'low', 'close'] as const) {
      const raw = row[idx[k]]!;
      if (raw.trim() === '') {
        addError(line, 'CAMPO_VAZIO', `Linha ${line}: o campo ${k} está vazio.`);
        return;
      }
      const n = parseNumber(raw, decimalComma);
      if (n === null) {
        addError(line, 'NUMERO_INVALIDO', `Linha ${line}: ${k} = "${raw.trim()}" não é um número válido${decimalComma ? '' : ' (use ponto como separador decimal)'}.`);
        return;
      }
      nums[k] = n;
    }
    let v: number | undefined;
    if (idx.volume >= 0) {
      const raw = row[idx.volume]!;
      if (raw.trim() !== '') {
        const n = parseNumber(raw, decimalComma);
        if (n === null) {
          addError(line, 'VOLUME_INVALIDO', `Linha ${line}: volume = "${raw.trim()}" não é um número válido.`);
          return;
        }
        v = n;
      }
    }
    const candle: Candle = { t, o: nums.open!, h: nums.high!, l: nums.low!, c: nums.close! };
    if (v !== undefined) candle.v = v;
    const issue = candleIssue(candle);
    if (issue) {
      addError(line, issue, `Linha ${line}: ${CANDLE_ISSUE_MESSAGES[issue]} (O=${nums.open} H=${nums.high} L=${nums.low} C=${nums.close}).`);
      return;
    }
    parsed.push({ candle, line });
  });

  if (naiveCount > 0 && tz === undefined) {
    needsTimezone = true;
    addError(
      null, 'FUSO_NECESSARIO',
      `${naiveCount} timestamp(s) não informam fuso horário. Escolha o fuso em que o arquivo foi exportado antes de importar.`,
    );
  }

  // Duplicidades: apenas entre linhas válidas.
  const seen = new Map<number, number>();
  let duplicates = 0;
  for (const { candle, line } of parsed) {
    const first = seen.get(candle.t);
    if (first !== undefined) {
      duplicates++;
      addError(line, 'TIMESTAMP_DUPLICADO', `Linha ${line}: timestamp repetido (já aparece na linha ${first}).`);
    } else seen.set(candle.t, line);
  }

  const base = empty();
  base.stats.rowsRead = dataRows.length;
  base.stats.duplicates = duplicates;
  base.stats.hasVolume = idx.volume >= 0;
  if (errorsTotal > 0) {
    base.stats.rowsValid = parsed.length;
    return base;
  }

  let sortedAutomatically = false;
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i]!.candle.t < parsed[i - 1]!.candle.t) {
      sortedAutomatically = true;
      break;
    }
  }
  const candles = parsed.map((p) => p.candle);
  if (sortedAutomatically) {
    candles.sort((a, b) => a.t - b.t);
    warnings.push({ line: null, code: 'ORDENADO_AUTOMATICAMENTE', message: 'As linhas não estavam em ordem cronológica e foram ordenadas.' });
  }

  const { gaps, offGrid, shorter } = findGaps(candles, options.timeframeSeconds);
  if (gaps.length > 0) {
    const total = gaps.reduce((s, g) => s + g.missingCandles, 0);
    warnings.push({
      line: null, code: 'LACUNA',
      message: `${gaps.length} lacuna(s) temporal(is) encontrada(s), somando ${total} candle(s) ausente(s). Os candles ausentes NÃO foram inventados.`,
    });
  }
  if (offGrid > 0) {
    warnings.push({ line: null, code: 'FORA_DA_GRADE', message: `${offGrid} candle(s) não começam em múltiplos de ${options.timeframeSeconds / 60} min (confira o fuso horário escolhido).` });
  }
  if (shorter > 0) {
    warnings.push({ line: null, code: 'INTERVALO_MENOR', message: `${shorter} intervalo(s) menor(es) que o timeframe selecionado.` });
  }

  const steps: number[] = [];
  for (let i = 1; i < candles.length; i++) steps.push(candles[i]!.t - candles[i - 1]!.t);

  return {
    ok: true,
    candles,
    errors: [],
    errorsTotal: 0,
    warnings,
    gaps: gaps.slice(0, 200),
    needsTimezone: false,
    stats: {
      rowsRead: dataRows.length,
      rowsValid: candles.length,
      duplicates: 0,
      sortedAutomatically,
      hasVolume: idx.volume >= 0,
      firstT: candles[0]!.t,
      lastT: candles[candles.length - 1]!.t,
      medianStepSeconds: median(steps),
    },
  };
}

/** Serializa candles no formato aceito pela importação. */
export function candlesToCsv(candles: Candle[]): string {
  const withVolume = candles.some((c) => c.v !== undefined);
  const lines = [withVolume ? 'timestamp,open,high,low,close,volume' : 'timestamp,open,high,low,close'];
  for (const c of candles) {
    const base = [new Date(c.t * 1000).toISOString().replace('.000Z', 'Z'), c.o, c.h, c.l, c.c];
    if (withVolume) base.push(c.v ?? '');
    lines.push(base.join(','));
  }
  return lines.join('\n') + '\n';
}
