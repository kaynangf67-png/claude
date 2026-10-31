import { useEffect, useRef } from 'react';
import { track } from '../lib/analytics';

/** Adiciona .is-visible aos elementos .reveal quando entram na tela (uma única vez). */
export function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/** Dispara um evento uma única vez quando ~40% do elemento fica visível. */
export function useViewEvent<T extends HTMLElement>(name: string, params: Record<string, string> = {}) {
  const ref = useRef<T>(null);
  const key = name + JSON.stringify(params);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          track(name, params, { once: key });
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}
