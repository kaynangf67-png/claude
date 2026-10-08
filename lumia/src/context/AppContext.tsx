/**
 * Estado global simples (React context): usuário, preferências de
 * acessibilidade, Minha Lista, favoritos, "continuar assistindo", avisos e
 * revisões humanas. Tudo persiste no navegador.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentUser, signOut as authSignOut, type User } from '@/services/authService';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type AccessibilityPrefs } from '@/services/accessibilityService';
import { loadRaw, save } from '@/services/storage';
import { appendAudit, loadReviews, saveReviews, type ReviewMap } from '@/services/validationService';
import type { ReviewRecord } from '@/ai/types';

export interface ProgressEntry {
  time: number;
  duration: number;
  updatedAt: number;
}

interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'warn';
}

interface AppState {
  user: User | null;
  setUser: (u: User | null) => void;
  signOut: () => void;
  prefs: AccessibilityPrefs;
  setPrefs: (patch: Partial<AccessibilityPrefs>) => void;
  resetPrefs: () => void;
  myList: string[];
  toggleList: (id: string) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  notify: string[];
  toggleNotify: (id: string) => void;
  progress: Record<string, ProgressEntry>;
  setProgress: (id: string, p: ProgressEntry | null) => void;
  reviews: ReviewMap;
  setReview: (key: string, r: ReviewRecord, prev: ReviewRecord['status']) => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<AppState | null>(null);

function listKey(user: User | null, name: string) {
  return `${name}:${user?.id ?? 'guest'}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => currentUser());
  const [prefs, setPrefsState] = useState<AccessibilityPrefs>(() => loadPrefs(currentUser()?.id ?? null));
  const [myList, setMyList] = useState<string[]>(() => loadRaw(listKey(currentUser(), 'list'), []));
  const [favorites, setFavorites] = useState<string[]>(() => loadRaw(listKey(currentUser(), 'fav'), []));
  const [notify, setNotify] = useState<string[]>(() => loadRaw(listKey(currentUser(), 'notify'), []));
  const [progress, setProgressState] = useState<Record<string, ProgressEntry>>(() => loadRaw(listKey(currentUser(), 'progress'), {}));
  const [reviews, setReviews] = useState<ReviewMap>(() => loadReviews());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // trocar de usuário recarrega o "perfil" dele
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    setPrefsState(loadPrefs(u?.id ?? null));
    setMyList(loadRaw(listKey(u, 'list'), []));
    setFavorites(loadRaw(listKey(u, 'fav'), []));
    setNotify(loadRaw(listKey(u, 'notify'), []));
    setProgressState(loadRaw(listKey(u, 'progress'), {}));
  }, []);

  const signOut = useCallback(() => {
    authSignOut();
    setUser(null);
  }, [setUser]);

  const setPrefs = useCallback(
    (patch: Partial<AccessibilityPrefs>) => {
      setPrefsState((p) => {
        const next = { ...p, ...patch };
        savePrefs(user?.id ?? null, next);
        return next;
      });
    },
    [user],
  );

  const resetPrefs = useCallback(() => {
    savePrefs(user?.id ?? null, DEFAULT_PREFS);
    setPrefsState(DEFAULT_PREFS);
  }, [user]);

  const toggler = (setter: React.Dispatch<React.SetStateAction<string[]>>, name: string) => (id: string) =>
    setter((l) => {
      const next = l.includes(id) ? l.filter((x) => x !== id) : [id, ...l];
      save(listKey(user, name), next);
      return next;
    });

  const setProgress = useCallback(
    (id: string, p: ProgressEntry | null) => {
      setProgressState((cur) => {
        const next = { ...cur };
        if (p) next[id] = p;
        else delete next[id];
        save(listKey(user, 'progress'), next);
        return next;
      });
    },
    [user],
  );

  const setReview = useCallback(
    (key: string, r: ReviewRecord, prev: ReviewRecord['status']) => {
      setReviews((cur) => {
        const next = { ...cur, [key]: r };
        saveReviews(next);
        return next;
      });
      if (r.reviewer && r.role) appendAudit({ key, from: prev, to: r.status, reviewer: r.reviewer, role: r.role, at: r.at ?? new Date().toISOString(), note: r.note });
    },
    [],
  );

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
    document.documentElement.dataset.motion = prefs.reduceMotion ? 'reduce' : 'normal';
    document.documentElement.lang = prefs.uiLanguage;
  }, [prefs.highContrast, prefs.reduceMotion, prefs.uiLanguage]);

  const value = useMemo<AppState>(
    () => ({
      user,
      setUser,
      signOut,
      prefs,
      setPrefs,
      resetPrefs,
      myList,
      toggleList: toggler(setMyList, 'list'),
      favorites,
      toggleFavorite: toggler(setFavorites, 'fav'),
      notify,
      toggleNotify: toggler(setNotify, 'notify'),
      progress,
      setProgress,
      reviews,
      setReview,
      toasts,
      toast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, prefs, myList, favorites, notify, progress, reviews, toasts, setPrefs, setProgress, setReview, toast, setUser, signOut, resetPrefs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}
