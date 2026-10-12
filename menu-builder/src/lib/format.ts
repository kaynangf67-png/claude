const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatBRL = (value: number) => brl.format(value);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** "32,90" / "32.9" / "R$ 1.234,50" → número; vazio → null; inválido → NaN. */
export function parsePriceInput(text: string): number | null {
  const clean = text.replace(/R\$|\s/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : NaN;
}

export function priceInputValue(value: number | null): string {
  return value === null ? '' : value.toFixed(2).replace('.', ',');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
