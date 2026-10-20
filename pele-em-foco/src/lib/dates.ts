// Datas no formato AAAA-MM-DD, sempre no fuso local do aparelho.

export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): string {
  return toKey(now);
}

export function addDays(key: string, days: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return toKey(date);
}

/** Diferença em dias inteiros (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

export function formatLong(key: string): string {
  return fromKey(key).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShort(key: string): string {
  return fromKey(key).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}
