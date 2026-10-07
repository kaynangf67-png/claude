import { getState, subscribe, type Theme } from './state';

export type ResolvedTheme = 'light' | 'dark';

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(t: Theme = getState().settings.theme): ResolvedTheme {
  if (t === 'auto') return media?.matches ? 'dark' : 'light';
  return t;
}

/** Aplica o tema na página (CSS) e avisa quem precisa trocar (mapa). */
export function installTheme() {
  const apply = () => {
    const t = resolveTheme();
    if (document.documentElement.dataset.theme !== t) {
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b0e12' : '#ffffff');
      window.dispatchEvent(new CustomEvent('vq:theme', { detail: t }));
    }
  };
  apply();
  const unsub = subscribe(apply);
  media?.addEventListener('change', apply);
  return () => {
    unsub();
    media?.removeEventListener('change', apply);
  };
}
