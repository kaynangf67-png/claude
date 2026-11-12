/** Só o que o alerta usa do calendário (serve para CalEvent e NewsEvent). */
type CalEvent = { at: number; title: string; country: string; impact: number };

/**
 * ALERTA DE NOTÍCIA (regra do usuário): se uma das moedas do ativo tem notícia de 2 estrelas ou mais (média ou alta)
 * de 15 min antes até 15 min depois do momento da análise, a entrada só aparece depois que ele decidir ver.
 * Não bloqueia: a decisão de entrar é sempre do usuário. Calendário indisponível também gera alerta (não deu para checar).
 */
export const NEWS_RULES = { minImpact: 2, beforeMin: 15, afterMin: 15, nextHours: 12 } as const;

export interface NewsItem { title: string; country: string; impact: number; at: number; brt: string; minutes: number }
export interface NewsAlert {
  /** "alerta" = notícia forte na janela; "sem_calendario" = não deu para verificar; null = liberado. */
  level: "alerta" | "sem_calendario" | null;
  message: string;
  events: NewsItem[];
  /** Próxima notícia de 2+ estrelas das moedas do ativo (só informativo). */
  next: NewsItem | null;
  currencies: string[];
  rules: typeof NEWS_RULES;
}

const brt = (t: number) => new Date(t * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const item = (e: CalEvent, now: number): NewsItem => ({ title: e.title, country: e.country, impact: e.impact, at: e.at, brt: brt(e.at), minutes: Math.round((e.at - now) / 60) });
const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));

/** Moedas que afetam o ativo: par de 6 letras → as duas; ouro/prata/petróleo e afins cotados em dólar → USD. */
export function currenciesForAsset(symbol: string | null | undefined): string[] {
  const s = (symbol ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length === 6) return [s.slice(0, 3), s.slice(3)];
  if (/OIL|WTI|BRENT|GOLD|SILVER|XAU|XAG/.test(s) || s.includes("USD")) return ["USD"];
  return [];
}

export function newsAlertFor(currencies: string[], events: CalEvent[] | null, now: number): NewsAlert {
  const base = { currencies, rules: NEWS_RULES };
  if (!currencies.length) return { ...base, level: null, message: "Ativo sem moeda identificada: notícias não verificadas.", events: [], next: null };
  if (!events) return { ...base, level: "sem_calendario", message: "Calendário econômico indisponível agora: não consegui verificar se há notícia forte. A decisão de entrar é sua.", events: [], next: null };
  const mine = events.filter((e) => e.impact >= NEWS_RULES.minImpact && currencies.includes(e.country));
  const inWin = mine.filter((e) => e.at >= now - NEWS_RULES.afterMin * 60 && e.at <= now + NEWS_RULES.beforeMin * 60).map((e) => item(e, now));
  const nx = mine.find((e) => e.at > now + NEWS_RULES.beforeMin * 60 && e.at <= now + NEWS_RULES.nextHours * 3600);
  const next = nx ? item(nx, now) : null;
  if (!inWin.length) return { ...base, level: null, message: `Sem notícia de 2+ estrelas para ${currencies.join("/")} entre 15 min antes e 15 min depois de agora.`, events: [], next };
  const desc = inWin.map((e) => `${e.country} ${stars(e.impact)} ${e.title} (${e.minutes === 0 ? "agora" : e.minutes > 0 ? `em ${e.minutes} min` : `há ${-e.minutes} min`})`).join("; ");
  return { ...base, level: "alerta", message: `Notícia forte na janela de ±15 min: ${desc}. O preço pode disparar para os dois lados e o spread abrir. A decisão de entrar é sua.`, events: inWin, next };
}
