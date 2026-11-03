import type { ForexAnalysis } from "../forex/engine.js";
import { fmtPrice } from "../forex/types.js";
import type { NewsItem } from "./news.js";
import type { Opportunity } from "./radar.js";
import type { DayState } from "./risk2x0.js";
import { brtMinutes, panel, RISK_BRL, TZ } from "./risk2x0.js";
import type { JournalTrade } from "./store.js";

/** NOTIFICATION CENTER: mensagens em texto simples (sem Markdown, para não quebrar com caracteres especiais) + envio pela Bot API. */
export interface Sender { (text: string): Promise<{ ok: boolean; error?: string }> }

export function telegramFromEnv(env: Record<string, string | undefined> = process.env, fetchFn: typeof fetch = fetch): Sender {
  const token = env.TELEGRAM_BOT_TOKEN, chat = env.TELEGRAM_CHAT_ID;
  return async (text) => {
    if (!token || !chat) return { ok: false, error: "Telegram não configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)." };
    try {
      const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }) });
      if (res.ok) return { ok: true };
      const j = (await res.json().catch(() => ({}))) as { description?: string };
      return { ok: false, error: `Telegram ${res.status}${j.description ? ": " + j.description : ""}`.replace(token, "***") };
    } catch (e) { return { ok: false, error: `Telegram: ${(e as Error).message}`.replace(token, "***") }; }
  };
}

const hm = (t: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000));
const dm = (t: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(t * 1000));
const side = (d: "BUY" | "SELL") => (d === "BUY" ? "COMPRA" : "VENDA");
export const dataLine = (a: ForexAnalysis, now: number) => {
  const q = a.data.quality.M1 ?? a.data.quality.M5, tf = a.data.quality.M1 ? 60 : 300;
  const age = q?.lastClosedAt ? Math.max(0, now - (q.lastClosedAt + tf)) : null;
  return `Fonte: Yahoo Finance (gratuito, pode atrasar) · idade da última vela fechada: ${age === null ? "desconhecida" : age < 120 ? `${age}s` : `${Math.round(age / 60)} min`} · gerado às ${hm(now)} (Brasília)`;
};
export const dataAgeSec = (a: ForexAnalysis, now: number): number | null => {
  const q = a.data.quality.M1 ?? a.data.quality.M5, tf = a.data.quality.M1 ? 60 : 300;
  return q?.lastClosedAt ? Math.max(0, now - (q.lastClosedAt + tf)) : null;
};

export function confirmedMsg(a: ForexAnalysis, now: number): string {
  const t = a.trade!, s = a.symbol, f = (v: number | null) => (v === null ? "—" : fmtPrice(v, s));
  const rr = (i: number) => (t.rr[i] == null ? "" : ` (1:${t.rr[i]!.toFixed(2)})`);
  return [
    a.state === "entrada_antecipada" ? `TRADE AGENT | ENTRADA ANTECIPADA (modo Livre — sem todos os filtros)` : `TRADE AGENT | SETUP CONFIRMADO`, ``, `${a.label} | ${side(t.dir)}`, ``,
    `Estratégia: ${a.chosen!.name}`, `Temporalidade: M5 · Confirmação: ${a.trigger?.source ?? "M5"}`,
    `Tendência H1: ${a.tfs.H1.trend} · M15: ${a.tfs.M15?.trend ?? "indisponível"} · M5: ${a.tfs.M5.trend}`,
    `Gatilho: ${a.trigger?.detail ?? "—"}`, ``,
    `Entrada: ${f(t.entry)}`, `Stop: ${f(t.sl)}`, `Take 1: ${f(t.tps[0])}${rr(0)}`, `Take 2: ${f(t.tps[1])}${rr(1)}`, `Risco/retorno (alvo 1): 1:${(t.rr[0] ?? 0).toFixed(2)}`,
    `Confluência: ${a.score?.total ?? "—"}/100 (soma de evidências técnicas, não probabilidade)`, ``,
    `Notícias: ${a.filters.find((x) => x.id === 9)?.note ?? "não verificadas"}`, `Invalidação: ${a.invalidation}`, `STATUS: ${a.state === "entrada_antecipada" ? `ANTECIPADA — faltou: ${a.missing.slice(0, 3).join(" · ") || "—"}` : "CONFIRMADO"} · operação SIMULADA (risco R$ ${RISK_BRL.toFixed(2).replace(".", ",")}) — nenhuma ordem é enviada`,
    ``, `Oportunidade identificada às ${hm(a.at)}`, dataLine(a, now),
  ].join("\n");
}
export function formingMsg(a: ForexAnalysis, o: Opportunity, now: number): string {
  return [`TRADE AGENT | SETUP EM FORMAÇÃO`, ``, `${a.label} | ${o.dir ? side(o.dir) : ""} (aguardando)`, `Estratégia: ${o.strategy}`, `Qualidade técnica: ${o.quality}/100`, ``,
    `Falta: ${a.missing.slice(0, 3).join(" · ") || o.why}`, a.watch ? `Condição: ${a.watch.condition}` : "", `Invalidação: ${a.invalidation}`, `STATUS: AGUARDANDO — não é entrada`, ``, dataLine(a, now)].filter((x) => x !== "").join("\n");
}
export function distantMsg(a: ForexAnalysis, o: Opportunity, now: number): string {
  return [`TRADE AGENT | PAR PRÓXIMO DE REGIÃO RELEVANTE`, ``, `${a.label}: ${o.why}`, `Região: ${o.region ? `${fmtPrice(o.region.low, a.symbol)}–${fmtPrice(o.region.high, a.symbol)}` : "—"}`, `STATUS: observação — ainda não é setup`, ``, dataLine(a, now)].join("\n");
}
export function invalidatedMsg(label: string, dir: string | null, strategy: string | null, reason: string): string {
  return [`TRADE AGENT | CENÁRIO INVALIDADO`, ``, `${label}${dir ? " | " + side(dir as "BUY" | "SELL") : ""}${strategy ? " | " + strategy : ""}`, reason, `Nenhuma entrada foi feita neste setup.`].join("\n");
}
export function resultMsg(t: JournalTrade, d: DayState, now: number): string {
  const p = panel(d, now), ok = t.status === "WIN";
  return [`TRADE AGENT | RESULTADO ${ok ? "WIN" : t.status === "LOSS" ? "LOSS" : "INDEFINIDO"}`, ``, `${t.label} | ${side(t.dir)} | ${t.strategy}`,
    `Saída: ${t.outcome === "tp1" ? "Take 1" : t.outcome === "stop" ? "Stop" : t.outcome === "ambiguo" ? "Stop e Take na mesma vela (contado como Stop)" : "Fim do tempo (1 h) sem Take 1 — não conta como vitória"}`,
    `Resultado: ${t.r?.toFixed(2) ?? "—"}R (já com custos) = R$ ${t.brl?.toFixed(2).replace(".", ",") ?? "—"} simulados`, ``, p.wins, p.losses, p.ops, `ESTADO: ${p.state}`, ...(p.banner ? [p.banner] : []),
    ...(p.state === "DAILY_LOCKED" && d.trades.some((x) => x.result === "WIN") ? [`Meta perfeita 2x0 comprometida.`] : [])].join("\n");
}
export function targetMsg(d: DayState, now: number): string { const p = panel(d, now); return [`TRADE AGENT | META ALCANÇADA — 2X0`, ``, p.wins, p.losses, `Resultado do dia: ${p.resultR.toFixed(2)}R = R$ ${p.resultBrl.toFixed(2).replace(".", ",")} simulados`, p.banner ?? ""].join("\n"); }
export function lockedMsg(d: DayState, now: number): string { const p = panel(d, now); return [`TRADE AGENT | DIA ENCERRADO — LOSS IDENTIFICADO`, ``, p.wins, p.losses, `Resultado do dia: ${p.resultR.toFixed(2)}R = R$ ${p.resultBrl.toFixed(2).replace(".", ",")} simulados`, `Novas entradas bloqueadas até o próximo dia operacional.`].join("\n"); }
export function newsMsg(n: NewsItem, now: number): string {
  const when = n.at >= now ? `em ${Math.max(1, Math.round((n.at - now) / 60))} min` : `há ${Math.round((now - n.at) / 60)} min`;
  return [`TRADE AGENT | NOTÍCIA — ${n.impact} IMPACTO`, ``, `${n.currency}: ${n.title} (${hm(n.at)}, ${when})`, `Categoria: ${n.kind ?? "—"}${n.bank ? " · " + n.bank : ""}`, `Expectativa: ${n.forecast ?? "—"} · Anterior: ${n.previous ?? "—"} · Resultado: ${n.actual ?? "ainda não disponível nesta fonte"}`,
    n.surprise ? n.surprise.text : "", `Pares afetados: ${n.pairs.length ? n.pairs.join(", ") : "—"}`, n.impactText].filter((x) => x !== "").join("\n");
}
export function openingMsg(d: DayState, news: NewsItem[], pairs: string[], now: number, newsVerified: boolean): string {
  const p = panel(d, now);
  return [`TRADE AGENT | ABERTURA — ${dm(now)}`, ``, `Pares monitorados: ${pairs.join(", ")}`, p.goal, p.risk, `ESTADO: ${p.state}`, ``,
    newsVerified ? (news.length ? `Notícias das próximas 24 h:\n${news.slice(0, 6).map((n) => `• ${hm(n.at)} ${n.currency} ${n.title} [${n.impact}]`).join("\n")}` : "Sem notícias de médio/alto impacto nas próximas 24 h.") : "Notícias NÃO verificadas (calendário indisponível).", ``, `Modo: ANALISTA AUTÔNOMO — nenhuma ordem real é enviada.`].join("\n");
}
export const minutesLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
void brtMinutes;
