const dateLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const number = new Intl.NumberFormat("pt-BR");

/** Aceita ISO completo ou chave local AAAA-MM-DD (interpretada como data local). */
function toDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  return new Date(value);
}

export const formatDateLong = (v: string) => dateLong.format(toDate(v));
export const formatDateShort = (v: string) => dateShort.format(toDate(v)).replace(".", "");
export const formatWeekday = (v: Date) => {
  const s = weekday.format(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const formatNumber = (n: number) => number.format(n);

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
