import type { DayEntry, Period, Preferences, RoutineStep } from './types';

/** Monta a rotina básica sugerida pelo guia a partir das preferências. */
export function buildRoutine(prefs: Preferences): RoutineStep[] {
  const steps: RoutineStep[] = [];
  const add = (period: Period, id: string, label: string, hint?: string) =>
    steps.push({ id, period, label, hint, enabled: true });

  if (prefs.shaves) add('manha', 'barbear', 'Barbear com lâmina limpa', 'Produto de barbear suave, sem esfregar.');
  add('manha', 'limpeza-manha', 'Limpeza suave', 'Ponta dos dedos, água morna, sem esfregar.');
  add('manha', 'hidratante-manha', 'Hidratante leve', 'Oil free e não comedogênico.');
  add('manha', 'protetor', 'Protetor solar FPS 30+', 'Amplo espectro. Rosto, orelhas e pescoço.');

  if (prefs.usesMakeup) add('noite', 'demaquilar', 'Remover maquiagem', 'Demaquilante suave antes do limpador.');
  add('noite', 'limpeza-noite', 'Limpeza suave', 'Tira protetor, suor e oleosidade do dia.');
  if (prefs.hasTreatment) add('noite', 'tratamento', 'Tratamento indicado', 'Siga a orientação de quem indicou: quantidade e frequência.');
  add('noite', 'hidratante-noite', 'Hidratante leve', 'Ajuda a tolerar ativos que ressecam.');

  return steps;
}

/** Reaplica as preferências mantendo passos personalizados e o que a pessoa desativou. */
export function mergeRoutine(current: RoutineStep[], prefs: Preferences): RoutineStep[] {
  const disabled = new Set(current.filter((s) => !s.enabled).map((s) => s.id));
  const base = buildRoutine(prefs).map((s) => ({ ...s, enabled: !disabled.has(s.id) }));
  return [...base, ...current.filter((s) => s.custom)];
}

export function stepsFor(routine: RoutineStep[], period: Period): RoutineStep[] {
  return routine.filter((s) => s.enabled && s.period === period);
}

export function progress(routine: RoutineStep[], entry: DayEntry | undefined, period?: Period) {
  const steps = routine.filter((s) => s.enabled && (!period || s.period === period));
  const done = steps.filter((s) => entry?.done.includes(s.id)).length;
  return { done, total: steps.length, complete: steps.length > 0 && done === steps.length };
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
