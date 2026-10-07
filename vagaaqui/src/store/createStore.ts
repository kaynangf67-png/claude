import { useSyncExternalStore } from 'react';

/** Store mínima baseada em useSyncExternalStore (sem dependências extras). */
export function createStore<S extends object>(initial: S) {
  let state = initial;
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (patch: Partial<S> | ((s: S) => Partial<S>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    for (const l of listeners) l();
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  function useStore<T>(selector: (s: S) => T): T {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  }
  return { get, set, subscribe, useStore };
}
