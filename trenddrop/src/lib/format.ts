const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const int = new Intl.NumberFormat('pt-BR');
const dec1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const money = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : brl.format(v));
export const number = (v: number | null | undefined) => (v == null ? '—' : int.format(v));
export const pct = (v: number | null | undefined, signed = false) =>
  v == null ? '—' : `${signed && v > 0 ? '+' : ''}${dec1.format(v)}%`;

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** Datas só com dia (AAAA-MM-DD) são locais; o construtor padrão as leria em UTC (dia anterior no Brasil). */
export function parseDate(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
}
export function shortDate(iso: string) {
  return parseDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
export function longDate(iso: string) {
  return parseDate(iso).toLocaleDateString('pt-BR');
}
export function relative(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}
export function ageDays(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}
