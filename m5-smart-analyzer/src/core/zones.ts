import type { Candle, ContactEvent, RetractionStatus, Swing, Zone } from './types';
import { candleMetrics } from './candle';

/**
 * Zonas de interesse, toques, aproximações e rompimentos (Regras 4 e 5).
 *
 * Definições operacionais PROVISÓRIAS (a aula não traz números):
 *  - Zona: pivôs do mesmo lado (topos → resistência, fundos → suporte) a menos
 *    de `tolerance` entre si. Faixa = [menor − tol/2, maior + tol/2].
 *  - Toque: o extremo do candle alcança a faixa sem que o fechamento passe da
 *    borda externa.
 *  - Aproximação: o extremo fica a até `tolerance` da faixa, sem alcançá-la.
 *  - Rompimento: fechamento além da borda externa.
 *  - Retração observável: após o toque, o preço se afasta ao menos
 *    `retractionMin` do extremo do contato dentro de `retractionWindow`
 *    candles, sem rompimento antes disso.
 * Nada disso presume que a zona continuará funcionando.
 */

export function buildZones(swings: Swing[], tolerance: number): Zone[] {
  const zones: Zone[] = [];
  for (const kind of ['topo', 'fundo'] as const) {
    const side = kind === 'topo' ? 'resistencia' : 'suporte';
    const pivots = swings.filter((s) => s.kind === kind).sort((a, b) => a.price - b.price);
    let cluster: Swing[] = [];
    const flush = () => {
      if (cluster.length === 0) return;
      const prices = cluster.map((p) => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const idxs = cluster.map((p) => p.index).sort((a, b) => a - b);
      zones.push({
        id: `${side === 'resistencia' ? 'R' : 'S'}-${idxs[0]}`,
        side,
        lower: min - tolerance / 2,
        upper: max + tolerance / 2,
        level: prices.reduce((a, b) => a + b, 0) / prices.length,
        pivotIndexes: idxs,
        firstIndex: idxs[0]!,
        events: [],
      });
      cluster = [];
    };
    for (const p of pivots) {
      if (cluster.length > 0 && p.price - cluster[0]!.price > tolerance) flush();
      cluster.push(p);
    }
    flush();
  }
  return zones.sort((a, b) => a.firstIndex - b.firstIndex);
}

export type CandleZoneRelation = 'toque' | 'aproximacao' | 'rompimento' | 'distante';

export function relationToZone(zone: Zone, c: Candle, tolerance: number): CandleZoneRelation {
  if (zone.side === 'resistencia') {
    if (c.c > zone.upper) return 'rompimento';
    if (c.h >= zone.lower) return 'toque';
    if (c.h >= zone.lower - tolerance) return 'aproximacao';
    return 'distante';
  }
  if (c.c < zone.lower) return 'rompimento';
  if (c.l <= zone.upper) return 'toque';
  if (c.l <= zone.upper + tolerance) return 'aproximacao';
  return 'distante';
}

export interface EventParams {
  tolerance: number;
  /** null = critério de retração não definido. */
  retractionMin: number | null;
  retractionWindow: number | null;
  /** null = limite de pavio não definido. */
  wickRelevantRatio: number | null;
}

/** Calcula os eventos de contato de uma zona usando apenas candles até `lastIndex`. */
export function computeZoneEvents(zone: Zone, candles: Candle[], lastIndex: number, p: EventParams): ContactEvent[] {
  const events: ContactEvent[] = [];
  let cur: { kind: 'episodio' | 'rompimento'; start: number; end: number; hasTouch: boolean } | null = null;

  const close = () => {
    if (!cur) return;
    const ev = cur.kind === 'rompimento'
      ? makeBreakout(zone, candles, cur.start, cur.end, lastIndex)
      : makeTouch(zone, candles, cur.start, cur.end, cur.hasTouch, lastIndex, p);
    events.push(ev);
    cur = null;
  };

  for (let i = zone.firstIndex; i <= lastIndex; i++) {
    const rel = relationToZone(zone, candles[i]!, p.tolerance);
    if (rel === 'distante') {
      close();
    } else if (rel === 'rompimento') {
      if (cur && cur.kind === 'rompimento') cur.end = i;
      else {
        close();
        cur = { kind: 'rompimento', start: i, end: i, hasTouch: false };
      }
    } else {
      // toque ou aproximação: pertencem ao mesmo episódio de contato
      if (cur && cur.kind === 'episodio') {
        cur.end = i;
        if (rel === 'toque') cur.hasTouch = true;
      } else {
        close();
        cur = { kind: 'episodio', start: i, end: i, hasTouch: rel === 'toque' };
      }
    }
  }
  close();
  return events;
}

function makeBreakout(zone: Zone, candles: Candle[], start: number, end: number, lastIndex: number): ContactEvent {
  let returned = false;
  for (let j = end + 1; j <= lastIndex; j++) {
    const c = candles[j]!;
    if (zone.side === 'resistencia' ? c.c <= zone.upper : c.c >= zone.lower) {
      returned = true;
      break;
    }
  }
  return {
    kind: 'rompimento', startIndex: start, endIndex: end,
    startT: candles[start]!.t, endT: candles[end]!.t,
    pierced: false, extremeIndex: null, leftWick: null, retraction: null, returned,
  };
}

function makeTouch(
  zone: Zone, candles: Candle[], start: number, end: number, hasTouch: boolean, lastIndex: number, p: EventParams,
): ContactEvent {
  const kind = hasTouch ? 'toque' : 'aproximacao';
  const base: ContactEvent = {
    kind, startIndex: start, endIndex: end,
    startT: candles[start]!.t, endT: candles[end]!.t,
    pierced: false, extremeIndex: null, leftWick: null, retraction: null, returned: null,
  };
  if (!hasTouch) return base;

  // Candle do extremo do contato.
  const res = zone.side === 'resistencia';
  let ext = start;
  for (let i = start; i <= end; i++) {
    const c = candles[i]!;
    const e = candles[ext]!;
    if (res ? c.h > e.h : c.l < e.l) ext = i;
  }
  const extC = candles[ext]!;
  const extreme = res ? extC.h : extC.l;
  base.extremeIndex = ext;
  base.pierced = res ? extC.h > zone.upper : extC.l < zone.lower;
  if (p.wickRelevantRatio !== null) {
    const m = candleMetrics(extC);
    const ratio = res ? m.upperWickRatio : m.lowerWickRatio;
    base.leftWick = ratio !== null && ratio >= p.wickRelevantRatio;
  }

  if (p.retractionMin === null || p.retractionWindow === null) {
    base.retraction = { status: 'indefinida', magnitude: 0, confirmedAtIndex: null, confirmedAtT: null };
    return base;
  }

  // O fechamento do próprio candle final do contato já mede o pavio de rejeição.
  const endC = candles[end]!;
  let magnitude = res ? extreme - endC.c : endC.c - extreme;
  magnitude = Math.max(0, magnitude);
  let status: RetractionStatus | null = null;
  let confirmedAt: number | null = null;
  if (magnitude >= p.retractionMin) {
    status = 'confirmada';
    confirmedAt = end;
  } else {
    for (let j = end + 1; j <= Math.min(end + p.retractionWindow, lastIndex); j++) {
      const c = candles[j]!;
      if (res ? c.c > zone.upper : c.c < zone.lower) {
        status = 'rompida';
        break;
      }
      magnitude = Math.max(magnitude, res ? extreme - c.l : c.h - extreme);
      if (magnitude >= p.retractionMin) {
        status = 'confirmada';
        confirmedAt = j;
        break;
      }
    }
  }
  if (status === null) {
    if (end === lastIndex) status = 'em_andamento';
    else if (end + p.retractionWindow <= lastIndex) status = 'ausente';
    else status = 'aguardando';
  } else if (status === 'confirmada' && end === lastIndex) {
    status = 'em_andamento'; // o contato ainda pode continuar no próximo candle
    confirmedAt = null;
  }
  base.retraction = {
    status,
    magnitude,
    confirmedAtIndex: confirmedAt,
    confirmedAtT: confirmedAt !== null ? candles[confirmedAt]!.t : null,
  };
  return base;
}

/** Relação do último candle com a zona e o evento correspondente (se houver). */
export function currentContact(zone: Zone, lastIndex: number): ContactEvent | null {
  const last = zone.events[zone.events.length - 1];
  return last && last.endIndex === lastIndex ? last : null;
}

/** Toques anteriores ao evento corrente com retração confirmada. */
export function priorValidTouches(zone: Zone, before: number): ContactEvent[] {
  return zone.events.filter(
    (e) => e.kind === 'toque' && e.endIndex < before && e.retraction?.status === 'confirmada',
  );
}

/** Toques anteriores em que o candle do extremo deixou pavio relevante. */
export function priorWickTouches(zone: Zone, before: number): ContactEvent[] {
  return zone.events.filter((e) => e.kind === 'toque' && e.endIndex < before && e.leftWick === true);
}
