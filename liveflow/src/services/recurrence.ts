import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Recurrence } from '@/types/domain';

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Combina data (yyyy-MM-dd) e hora (HH:mm) no fuso local do navegador. */
export function combineDateTime(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = parseISO(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function matches(rule: Recurrence, day: Date, start: Date): boolean {
  switch (rule.frequency) {
    case 'none':
      return differenceInCalendarDays(day, start) === 0;
    case 'daily':
      return true;
    case 'weekdays': {
      const wd = day.getDay();
      return wd >= 1 && wd <= 5;
    }
    case 'weekly':
      return (rule.weekdays ?? []).includes(day.getDay());
    case 'interval': {
      const step = Math.max(1, rule.intervalDays ?? 1);
      return differenceInCalendarDays(day, start) % step === 0;
    }
  }
}

/**
 * Expande uma regra em ocorrências concretas dentro de [from, until].
 * `limit` protege contra regras sem fim gerando milhares de linhas.
 */
export function expandRecurrence(
  rule: Recurrence,
  opts: { from?: Date; until: Date; limit?: number },
): Date[] {
  const start = parseISO(rule.startDate);
  const end = rule.endDate ? parseISO(rule.endDate) : null;
  const limit = opts.limit ?? 120;
  const from = opts.from && opts.from > start ? opts.from : start;
  const out: Date[] = [];

  let day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (out.length < limit) {
    if (end && differenceInCalendarDays(day, end) > 0) break;
    if (differenceInCalendarDays(day, opts.until) > 0) break;
    if (matches(rule, day, start)) {
      const occ = combineDateTime(format(day, 'yyyy-MM-dd'), rule.time);
      if (!opts.from || occ >= opts.from) out.push(occ);
    }
    if (rule.frequency === 'none') break;
    day = addDays(day, 1);
  }
  return out;
}

export function nextOccurrence(rule: Recurrence, now = new Date()): Date | null {
  const [first] = expandRecurrence(rule, { from: now, until: addDays(now, 400), limit: 1 });
  return first ?? null;
}

export function describeRecurrence(rule: Recurrence): string {
  const at = `às ${rule.time}`;
  switch (rule.frequency) {
    case 'none':
      return `Uma vez, ${format(parseISO(rule.startDate), 'dd/MM')} ${at}`;
    case 'daily':
      return `Todos os dias ${at}`;
    case 'weekdays':
      return `Segunda a sexta ${at}`;
    case 'weekly': {
      const days = [...(rule.weekdays ?? [])].sort().map((d) => WEEKDAY_LABELS[d]);
      return `${days.join(', ')} ${at}`;
    }
    case 'interval':
      return rule.intervalDays === 1 ? `Todos os dias ${at}` : `A cada ${rule.intervalDays} dias ${at}`;
  }
}
