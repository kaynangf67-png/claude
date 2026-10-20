export type SkinFeel = 'oleosa' | 'mista' | 'normal' | 'seca' | 'nao-sei';
export type Period = 'manha' | 'noite';

export interface Preferences {
  /** Como a pessoa quer ser chamada. Opcional. */
  name: string;
  skinFeel: SkinFeel;
  usesMakeup: boolean;
  shaves: boolean;
  /** Já usa um tratamento indicado por profissional. */
  hasTreatment: boolean;
}

export interface RoutineStep {
  id: string;
  period: Period;
  label: string;
  hint?: string;
  enabled: boolean;
  custom?: boolean;
}

export type SkinToday = 'como-sempre' | 'mais-oleosa' | 'repuxando' | 'irritada';

export interface DayEntry {
  /** ids dos passos concluídos */
  done: string[];
  habits: string[];
  skin?: SkinToday;
  newSpots?: boolean;
  tags: string[];
  note: string;
}

export interface AppData {
  version: 1;
  onboardedAt: string | null;
  disclaimerAcceptedAt: string | null;
  preferences: Preferences;
  routine: RoutineStep[];
  days: Record<string, DayEntry>;
}
