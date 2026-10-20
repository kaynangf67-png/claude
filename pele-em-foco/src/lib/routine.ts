import type { Period, RoutineCompletion } from '../services/types';

export interface RoutineStep {
  key: string;
  period: Period;
  label: string;
  hint: string;
}

/** Passos educativos fixos (espelham a constraint routine_step_valid no banco). */
export const ROUTINE_STEPS: RoutineStep[] = [
  { period: 'manha', key: 'limpeza', label: 'Limpeza suave', hint: 'Limpador suave, ponta dos dedos, água morna. Sem esfregar.' },
  { period: 'manha', key: 'hidratacao', label: 'Hidratação', hint: 'Hidratante leve, de preferência oil free e não comedogênico.' },
  { period: 'manha', key: 'protecao-solar', label: 'Proteção solar', hint: 'Amplo espectro, FPS 30 ou mais. Rosto, orelhas e pescoço.' },
  { period: 'noite', key: 'limpeza', label: 'Limpeza suave', hint: 'Remove protetor, suor e oleosidade do dia.' },
  { period: 'noite', key: 'hidratacao', label: 'Hidratação', hint: 'Ajuda a pele a tolerar produtos que ressecam.' },
  { period: 'noite', key: 'revisao', label: 'Revisão dos cuidados utilizados', hint: 'O que você usou hoje? Algum produto novo ardeu ou irritou?' },
];

export const PERIOD_LABEL: Record<Period, string> = { manha: 'Manhã', noite: 'Noite' };

export const stepsFor = (period: Period) => ROUTINE_STEPS.filter((s) => s.period === period);

export function isDone(completions: RoutineCompletion[], date: string, period: Period, key: string) {
  return completions.some((c) => c.completedOn === date && c.period === period && c.stepKey === key);
}

export function dayProgress(completions: RoutineCompletion[], date: string, period?: Period) {
  const steps = period ? stepsFor(period) : ROUTINE_STEPS;
  const done = steps.filter((s) => isDone(completions, date, s.period, s.key)).length;
  return { done, total: steps.length, complete: done === steps.length };
}
