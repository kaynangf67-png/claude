import type { FontPreset, Theme } from '../types/menu.ts';

interface FontSpec {
  display: string;
  body: string;
  /** Query do Google Fonts (css2). */
  googleFamilies: string;
}

export const FONT_PRESETS: Record<FontPreset, FontSpec> = {
  classico: {
    display: "'DM Serif Display', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    googleFamilies: 'family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700',
  },
  elegante: {
    display: "'Cormorant Garamond', Georgia, serif",
    body: "'Karla', system-ui, sans-serif",
    googleFamilies: 'family=Cormorant+Garamond:wght@500;600;700&family=Karla:wght@400;500;600;700',
  },
  moderno: {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFamilies: 'family=Bricolage+Grotesque:wght@500;600;700;800&family=Inter:wght@400;500;600;700',
  },
  rustico: {
    display: "'Fraunces', Georgia, serif",
    body: "'Work Sans', system-ui, sans-serif",
    googleFamilies: 'family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700',
  },
};

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Razão de contraste WCAG entre duas cores #rrggbb. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Branco ou quase-preto, o que tiver mais contraste sobre `hex`. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#111111') ? '#ffffff' : '#111111';
}

/** Variáveis CSS do tema, injetadas no <head> no build (sem "piscar" de cor). */
export function themeCss(theme: Theme): string {
  const font = FONT_PRESETS[theme.font] ?? FONT_PRESETS.classico;
  const vars: Record<string, string> = {
    '--brand': theme.primary,
    '--brand-contrast': readableOn(theme.primary),
    '--accent': theme.accent,
    '--accent-contrast': readableOn(theme.accent),
    '--bg': theme.background,
    '--surface': theme.surface,
    '--ink': theme.text,
    '--font-display-family': font.display,
    '--font-body-family': font.body,
  };
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;
}

export function googleFontsHref(theme: Theme): string {
  const font = FONT_PRESETS[theme.font] ?? FONT_PRESETS.classico;
  return `https://fonts.googleapis.com/css2?${font.googleFamilies}&display=swap`;
}
