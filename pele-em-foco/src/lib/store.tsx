import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayKey } from './dates';
import { mergeRoutine, slugify } from './routine';
import { clear, emptyData, emptyDay, load, save } from './storage';
import type { AppData, DayEntry, Period, Preferences } from './types';

interface Store {
  data: AppData;
  today: string;
  /** false quando o navegador bloqueia o armazenamento (modo privado etc.) */
  persistent: boolean;
  day: (date: string) => DayEntry;
  updateDay: (date: string, patch: Partial<DayEntry>) => void;
  toggleStep: (date: string, stepId: string) => void;
  toggleIn: (date: string, field: 'habits' | 'tags', value: string) => void;
  completeOnboarding: (prefs: Preferences) => void;
  updatePreferences: (prefs: Preferences) => void;
  setStepEnabled: (stepId: string, enabled: boolean) => void;
  addCustomStep: (period: Period, label: string) => void;
  removeStep: (stepId: string) => void;
  resetAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => load());
  const [persistent, setPersistent] = useState(true);
  const today = todayKey();

  useEffect(() => {
    // Antes do onboarding não há nada da pessoa para guardar: não grava nada no aparelho.
    if (!data.onboardedAt && Object.keys(data.days).length === 0) {
      clear();
      return;
    }
    setPersistent(save(data));
  }, [data]);

  const updateDay = useCallback((date: string, patch: Partial<DayEntry>) => {
    setData((d) => ({ ...d, days: { ...d.days, [date]: { ...emptyDay(), ...d.days[date], ...patch } } }));
  }, []);

  const store = useMemo<Store>(() => {
    const day = (date: string) => data.days[date] ?? emptyDay();
    return {
      data,
      today,
      persistent,
      day,
      updateDay,
      toggleStep: (date, stepId) => updateDay(date, { done: toggle(day(date).done, stepId) }),
      toggleIn: (date, field, value) => updateDay(date, { [field]: toggle(day(date)[field], value) }),
      completeOnboarding: (prefs) =>
        setData((d) => {
          const now = new Date().toISOString();
          return { ...d, onboardedAt: now, disclaimerAcceptedAt: now, preferences: prefs, routine: mergeRoutine(d.routine, prefs) };
        }),
      updatePreferences: (prefs) => setData((d) => ({ ...d, preferences: prefs, routine: mergeRoutine(d.routine, prefs) })),
      setStepEnabled: (stepId, enabled) =>
        setData((d) => ({ ...d, routine: d.routine.map((s) => (s.id === stepId ? { ...s, enabled } : s)) })),
      addCustomStep: (period, label) =>
        setData((d) => {
          const id = `custom-${slugify(label) || 'passo'}-${Date.now().toString(36)}`;
          return { ...d, routine: [...d.routine, { id, period, label: label.trim(), enabled: true, custom: true }] };
        }),
      removeStep: (stepId) => setData((d) => ({ ...d, routine: d.routine.filter((s) => s.id !== stepId || !s.custom) })),
      resetAll: () => {
        clear();
        setData(emptyData());
      },
    };
  }, [data, today, persistent, updateDay]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore fora do StoreProvider');
  return store;
}
