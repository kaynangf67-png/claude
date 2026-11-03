import type { CalEvent } from "../calendar.js";

/**
 * NEWS INTELLIGENCE: classifica eventos do calendário, calcula a surpresa (resultado × expectativa), liga o evento aos pares
 * afetados, mede a reação REAL do preço e decide o bloqueio de entradas ao redor de eventos de alto impacto.
 * Nada aqui transforma notícia em sinal: uma "surpresa" só é descrita; quem decide é a estrutura e a reação do preço.
 */
export type NewsImpact = "ALTO" | "MEDIO" | "BAIXO";
export interface NewsConfig { beforeMin: number; afterMin: number; blockMedium: boolean }
export const DEFAULT_NEWS_CONFIG: NewsConfig = { beforeMin: 15, afterMin: 15, blockMedium: false };

const KINDS: [RegExp, string][] = [
  [/rate decision|interest rate|cash rate|bank rate|policy rate|official bank rate|overnight rate|monetary policy statement|rate statement/i, "Decisão de juros"],
  [/fomc|ecb press|boe|boj|rba|boc|snb|rbnz|monetary policy|press conference|governor|chair|president .* speaks|speaks|testifies|minutes/i, "Banco central / discurso"],
  [/cpi|inflation|pce|ppi|hicp/i, "Inflação"],
  [/non-farm|nfp|payroll|employment change|jobs/i, "Emprego / Payroll"],
  [/unemployment|jobless|claimant/i, "Desemprego"],
  [/gdp/i, "PIB"],
  [/pmi/i, "PMI"],
  [/retail sales/i, "Vendas no varejo"],
];
const BANKS: [RegExp, string, string][] = [
  [/fomc|federal reserve|fed |powell|\bUSD\b.*(rate|speaks)/i, "FOMC", "USD"], [/ecb|lagarde/i, "BCE", "EUR"], [/boe|bailey|bank rate/i, "BoE", "GBP"],
  [/boj|ueda/i, "BoJ", "JPY"], [/rba|cash rate/i, "RBA", "AUD"], [/boc|overnight rate/i, "BOC", "CAD"], [/snb|swiss national/i, "SNB", "CHF"], [/rbnz|official cash rate/i, "RBNZ", "NZD"],
];

export interface NewsItem {
  at: number; title: string; currency: string; impact: NewsImpact; kind: string | null; bank: string | null;
  forecast: string | null; previous: string | null; actual: string | null;
  surprise: { dir: "acima" | "abaixo" | "em linha"; diff: number; text: string } | null;
  pairs: string[]; impactText: string;
}

/** "3.2%" → 3.2, "225K" → 225000, "1.5M" → 1.5e6, "-0.3%" → -0.3. Texto sem número vira null. */
export function parseNum(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%]?)/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase() as "K"] ?? 1;
  return Number(m[1]) * mult;
}

export const impactOf = (stars: number): NewsImpact => (stars >= 3 ? "ALTO" : stars === 2 ? "MEDIO" : "BAIXO");
const unit = (v: string) => (/%$/.test(v.trim()) ? "p.p." : "");

export function classify(e: CalEvent, enabledPairs: string[]): NewsItem {
  const kind = KINDS.find(([re]) => re.test(e.title))?.[1] ?? null;
  const bank = BANKS.find(([re, , cur]) => re.test(e.title) && cur === e.country)?.[1] ?? null;
  const impact = impactOf(e.impact);
  const fc = parseNum(e.forecast), ac = parseNum(e.actual), eps = Math.max(1e-9, Math.abs(fc ?? 0) * 0.001);
  let surprise: NewsItem["surprise"] = null;
  if (fc !== null && ac !== null) {
    const diff = ac - fc, dir = Math.abs(diff) <= eps ? "em linha" : diff > 0 ? "acima" : "abaixo";
    surprise = { dir, diff, text: dir === "em linha" ? `Resultado ${e.actual} em linha com a expectativa (${e.forecast}).` : `Resultado ${e.actual} ${dir} da expectativa (${e.forecast}), diferença de ${diff > 0 ? "+" : ""}${Number(diff.toFixed(3))}${unit(e.actual!)}.` };
  }
  const pairs = enabledPairs.filter((p) => p.includes(e.country));
  const impactText = !surprise
    ? (e.actual ? "Resultado divulgado, mas sem expectativa numérica para comparar." : "Resultado ainda não disponível nesta fonte; a reação do preço mostra o efeito real.")
    : "A surpresa está descrita, mas NÃO é sinal de compra ou venda: o que vale é a reação do preço e o posicionamento anterior do mercado.";
  return { at: e.at, title: e.title, currency: e.country, impact, kind, bank, forecast: e.forecast || null, previous: e.previous || null, actual: e.actual ?? null, surprise, pairs, impactText };
}

export interface NewsGate { blocked: boolean; reason: string | null; event: NewsItem | null; /** instante em que o bloqueio termina */ until: number | null }

/** Bloqueio de NOVAS entradas: [evento − antes, evento + depois] para eventos de ALTO impacto (e médio, se configurado) das moedas do par. */
export function newsGate(events: CalEvent[] | null, currencies: string[], now: number, cfg: NewsConfig = DEFAULT_NEWS_CONFIG): NewsGate {
  if (!events) return { blocked: true, reason: "Notícias NÃO verificadas (calendário indisponível): entradas bloqueadas por segurança.", event: null, until: null };
  const hit = events.filter((e) => (e.impact >= 3 || (cfg.blockMedium && e.impact === 2)) && currencies.includes(e.country) && now >= e.at - cfg.beforeMin * 60 && now <= e.at + cfg.afterMin * 60)
    .sort((a, b) => b.impact - a.impact || a.at - b.at)[0];
  if (!hit) return { blocked: false, reason: null, event: null, until: null };
  const item = classify(hit, []);
  const when = now < hit.at ? `em ${Math.ceil((hit.at - now) / 60)} min` : `há ${Math.floor((now - hit.at) / 60)} min`;
  return { blocked: true, reason: `${item.impact} IMPACTO: ${hit.country} ${hit.title} (${when}). Novas entradas bloqueadas de ${cfg.beforeMin} min antes a ${cfg.afterMin} min depois; depois disso volatilidade e estrutura são reavaliadas.`, event: item, until: hit.at + cfg.afterMin * 60 };
}

export function upcoming(events: CalEvent[] | null, now: number, enabledPairs: string[], hours = 24, minImpact = 2): NewsItem[] {
  if (!events) return [];
  return events.filter((e) => e.at >= now - 3600 && e.at <= now + hours * 3600 && e.impact >= minImpact).map((e) => classify(e, enabledPairs)).slice(0, 12);
}

export interface Reaction { windowMin: number; netPips: number; rangePips: number; dir: "alta" | "baixa" | "lateral"; text: string }
/** Reação real do preço nos primeiros `windowMin` minutos depois do evento (fechamento antes do evento × fechamento da última vela dentro da janela). */
export function priceReaction(candles: { t: number; o: number; h: number; l: number; c: number }[], eventAt: number, now: number, pip: number, windowMin = 15): Reaction | null {
  if (now < eventAt + 60) return null;
  const before = [...candles].reverse().find((k) => k.t < eventAt);
  const inside = candles.filter((k) => k.t >= eventAt && k.t < eventAt + windowMin * 60 && k.t + 60 <= now);
  if (!before || !inside.length) return null;
  const last = inside[inside.length - 1], net = (last.c - before.c) / pip, range = (Math.max(...inside.map((k) => k.h)) - Math.min(...inside.map((k) => k.l))) / pip;
  const dir = Math.abs(net) < 2 ? "lateral" : net > 0 ? "alta" : "baixa";
  return { windowMin, netPips: Math.round(net * 10) / 10, rangePips: Math.round(range * 10) / 10, dir, text: `Nos ${windowMin} min seguintes ao evento o preço ${dir === "lateral" ? "ficou lateral" : dir === "alta" ? "subiu" : "caiu"} ${Math.abs(Math.round(net * 10) / 10)} pips (amplitude de ${Math.round(range * 10) / 10} pips).` };
}
