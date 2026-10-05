const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** R$ 2.490,00 */
export const formatBRL = (value: number) => brl.format(value);
/** R$ 2.490 */
export const formatBRLShort = (value: number) => brlShort.format(value);

export const DAY = 24 * 60 * 60 * 1000;
export const HOUR = 60 * 60 * 1000;

export function daysBetween(fromIso: string, now = Date.now()) {
  return Math.max(0, (now - new Date(fromIso).getTime()) / DAY);
}

export function relativeTime(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `${days} dias atrás`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / DAY);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Minúsculas e sem acentos — para comparar textos digitados no WhatsApp. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const MASCULINE_ENDING_IN_A = ['guarda-roupa', 'sofa', 'pijama', 'problema', 'sistema', 'programa', 'dia', 'mapa', 'tema', 'clima'];

/** Artigo definido para um produto/serviço: "o sofá", "a mesa". Heurística simples. */
export function article(productName: string) {
  const first = normalize(productName.trim().split(/\s+/)[0] ?? '');
  if (MASCULINE_ENDING_IN_A.includes(first)) return 'o';
  if (first.endsWith('a') || first.endsWith('agem') || first.endsWith('cao') || first.endsWith('dade')) return 'a';
  return 'o';
}

/** "o sofá retrátil" — nome do produto em minúsculas no meio da frase. */
export function productRef(productName: string) {
  const name = productName.trim();
  const lowered = name.charAt(0).toLowerCase() + name.slice(1);
  return `${article(name)} ${lowered}`;
}

/** "do sofá retrátil" / "da mesa de jantar". */
export function ofProduct(productName: string) {
  const ref = productRef(productName);
  return ref.startsWith('a ') ? `da ${ref.slice(2)}` : `do ${ref.slice(2)}`;
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export function whatsappLink(phone: string, text: string) {
  let d = phone.replace(/\D/g, '');
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
