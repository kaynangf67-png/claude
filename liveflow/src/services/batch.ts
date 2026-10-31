import { addDays, format, parseISO } from 'date-fns';
import { combineDateTime } from '@/services/recurrence';
import { FORMAT_KEYS } from '@/services/formats';
import type { PostFormat } from '@/types/domain';

/** Máximo de publicações criadas de uma vez (protege o plano e o PostgREST). */
export const MAX_BATCH = 60;
/** Dois vídeos programados com menos que isso de distância contam como conflito. */
export const MIN_GAP_MINUTES = 30;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "12h, 18:00 21:30" → ['12:00', '18:00', '21:30'] (ordenado, sem repetidos). Inválidos vão em `invalid`. */
export function parseTimes(raw: string): { times: string[]; invalid: string[] } {
  const times = new Set<string>();
  const invalid: string[] = [];
  for (const token of raw.split(/[\s,;]+/).filter(Boolean)) {
    const m = token.toLowerCase().match(/^(\d{1,2})(?:[:h](\d{2})?)?$/);
    const norm = m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : '';
    if (TIME_RE.test(norm)) times.add(norm);
    else invalid.push(token);
  }
  return { times: [...times].sort(), invalid };
}

export interface SlotPlanInput {
  count: number;
  /** yyyy-MM-dd do primeiro dia. */
  startDate: string;
  /** Horários do dia em HH:mm. */
  times: string[];
  skipWeekends?: boolean;
  /** Horários já ocupados (publicações programadas). */
  busy?: Date[];
  now?: Date;
}

/**
 * Distribui `count` publicações nos horários diários a partir de `startDate`,
 * pulando horários no passado, fins de semana (opcional) e horários a menos de
 * {@link MIN_GAP_MINUTES} de uma publicação já programada.
 */
export function planSlots({ count, startDate, times, skipWeekends = false, busy = [], now = new Date() }: SlotPlanInput): Date[] {
  const n = Math.min(Math.max(0, Math.floor(count)), MAX_BATCH);
  const daily = [...new Set(times.filter((t) => TIME_RE.test(t)))].sort();
  if (n === 0 || daily.length === 0) return [];
  const gap = MIN_GAP_MINUTES * 60_000;
  const taken = busy.map((d) => d.getTime());
  const out: Date[] = [];
  let day = parseISO(startDate);
  // Teto de dias evita loop infinito se tudo estiver ocupado.
  for (let i = 0; out.length < n && i < 366; i++, day = addDays(day, 1)) {
    const wd = day.getDay();
    if (skipWeekends && (wd === 0 || wd === 6)) continue;
    for (const t of daily) {
      if (out.length >= n) break;
      const slot = combineDateTime(format(day, 'yyyy-MM-dd'), t);
      if (slot.getTime() < now.getTime()) continue;
      if (taken.some((b) => Math.abs(b - slot.getTime()) < gap)) continue;
      out.push(slot);
      taken.push(slot.getTime());
    }
  }
  return out;
}

/** Formato da i-ésima publicação: fixo, ou alternando entre os formatos sem rosto. */
export function formatFor(index: number, choice: PostFormat | 'alternar'): PostFormat {
  return choice === 'alternar' ? FORMAT_KEYS[index % FORMAT_KEYS.length] : choice;
}
