import type { SkinFeel } from '../services/types';

export const SKIN_FEELS: { value: SkinFeel; label: string }[] = [
  { value: 'como-sempre', label: 'Como sempre' },
  { value: 'mais-oleosa', label: 'Mais oleosa' },
  { value: 'repuxando', label: 'Seca / repuxando' },
  { value: 'irritada', label: 'Irritada / ardendo' },
];

/** Espelha a constraint journal_entries.observations no banco. */
export const OBSERVATIONS: { value: string; label: string }[] = [
  { value: 'espinhas-novas', label: 'Notei espinhas novas' },
  { value: 'menos-espinhas', label: 'Notei menos espinhas' },
  { value: 'oleosidade', label: 'Oleosidade' },
  { value: 'ressecamento', label: 'Ressecamento' },
  { value: 'vermelhidao', label: 'Vermelhidão' },
  { value: 'coceira', label: 'Coceira' },
];

export const NOTES_MAX = 2000;
export const PRODUCTS_MAX = 500;

export const skinFeelLabel = (v: SkinFeel | null) => SKIN_FEELS.find((s) => s.value === v)?.label ?? null;
export const observationLabel = (v: string) => OBSERVATIONS.find((o) => o.value === v)?.label ?? v;
