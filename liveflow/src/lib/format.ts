import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR');

export const formatCurrency = (value: number) => brl.format(value);
export const formatNumber = (value: number) => integer.format(Math.round(value));
export const formatCompact = (value: number) => (Math.abs(value) < 10_000 ? integer.format(Math.round(value)) : compact.format(value));
export const formatPercent = (ratio: number, digits = 1) =>
  `${(ratio * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

export const formatDate = (d: string | Date, pattern = 'dd/MM/yyyy') => format(toDate(d), pattern, { locale: ptBR });
export const formatTime = (d: string | Date) => format(toDate(d), 'HH:mm', { locale: ptBR });
export const formatDateTime = (d: string | Date) => format(toDate(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
export const formatRelative = (d: string | Date) => formatDistanceToNow(toDate(d), { addSuffix: true, locale: ptBR });

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[i]}`;
}
