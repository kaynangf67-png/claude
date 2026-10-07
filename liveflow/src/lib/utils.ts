import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function sum<T>(items: T[], pick: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += pick(item);
  return total;
}

export function safeDivide(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K | null | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k == null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Remove id/user_id/timestamps para reaproveitar um registro como novo insert. */
export function stripBase<T extends { id: string; user_id: string; created_at: string; updated_at: string }>(
  record: T,
): Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const copy: Partial<T> = { ...record };
  delete copy.id;
  delete copy.user_id;
  delete copy.created_at;
  delete copy.updated_at;
  return copy as Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
}
