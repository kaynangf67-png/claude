import { addDays } from './dates';
import { progress } from './routine';
import type { AppData } from './types';

export const HABITS = [
  { id: 'nao-espremi', label: 'Não espremi nem cutuquei' },
  { id: 'dormi-bem', label: 'Dormi bem' },
  { id: 'fronha', label: 'Troquei a fronha / toalha' },
  { id: 'lavei-apos-suar', label: 'Lavei o rosto depois de suar' },
] as const;

export const TAGS = [
  'Dia de estresse',
  'Treinei / suei muito',
  'Usei capacete, boné ou máscara',
  'Produto novo',
  'Período menstrual',
  'Pouco sono',
  'Muito sol',
] as const;

export interface DaySummary {
  date: string;
  routineDone: number;
  routineTotal: number;
  complete: boolean;
  hasEntry: boolean;
}

export function lastDays(data: AppData, today: string, count: number): DaySummary[] {
  const out: DaySummary[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const entry = data.days[date];
    const p = progress(data.routine, entry);
    out.push({ date, routineDone: p.done, routineTotal: p.total, complete: p.complete, hasEntry: !!entry });
  }
  return out;
}

/** Dias seguidos com a rotina completa, terminando hoje (ou ontem, se hoje ainda não fechou). */
export function streak(data: AppData, today: string): number {
  let count = 0;
  let day = progress(data.routine, data.days[today]).complete ? today : addDays(today, -1);
  while (progress(data.routine, data.days[day]).complete) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
