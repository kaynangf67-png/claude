import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Tokens de cor do tema (bg-surface-2, text-ink-3…) precisam ser conhecidos para não serem tratados como tamanho de fonte.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['bg', 'surface', 'surface-2', 'surface-3', 'line', 'line-strong', 'ink', 'ink-2', 'ink-3', 'brand', 'brand-2', 'brand-ink', 'up', 'down', 'warn', 'info'],
    },
  },
});

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
