import { losses, panel, wins, type DayState } from "./risk2x0.js";
import type { AlertRecord, JournalTrade, ScanRecord } from "./store.js";

/** DAILY REPORT: o que foi monitorado, o que virou sinal, o que foi descartado e por quê, e se as regras 2x0 foram cumpridas. */
export interface Group { key: string; n: number; wins: number; losses: number; r: number; brl: number }
export interface DailyReport {
  date: string; pairs: string[]; scans: number;
  opportunities: { distant: number; forming: number; confirmed: number };
  confirmed: number; discarded: { setupId: string | null; label: string; cls: string | null; reason: string }[];
  wins: number; losses: number; open: number; notExecuted: number;
  strategies: string[]; resultR: number; resultBrl: number; byPair: Group[]; byStrategy: Group[];
  rules: { target: string; perfect2x0: boolean; text: string }; text: string;
}

function groupBy(trades: JournalTrade[], key: (t: JournalTrade) => string): Group[] {
  const m = new Map<string, Group>();
  for (const t of trades) {
    const g = m.get(key(t)) ?? { key: key(t), n: 0, wins: 0, losses: 0, r: 0, brl: 0 };
    g.n++; if (t.status === "WIN") g.wins++; if (t.status === "LOSS") g.losses++;
    g.r = Math.round((g.r + (t.r ?? 0)) * 100) / 100; g.brl = Math.round((g.brl + (t.brl ?? 0)) * 100) / 100; m.set(key(t), g);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

export function buildDailyReport(day: DayState, trades: JournalTrade[], scans: ScanRecord[], alerts: AlertRecord[], pairs: string[], nowSec: number): DailyReport {
  const today = trades.filter((t) => t.day === day.date);
  const distinct = (cls: string) => new Set(scans.filter((s) => s.cls === cls && s.setupId).map((s) => s.setupId)).size;
  const confirmedIds = new Set(today.map((t) => t.setupId));
  // descartados: confirmados que não viraram operação + setups em formação que nunca confirmaram
  const seen = new Set<string>();
  const discarded: DailyReport["discarded"] = [];
  for (const s of scans) {
    if (!s.setupId || seen.has(s.setupId) || confirmedIds.has(s.setupId)) continue;
    if (s.cls === "CONFIRMADA" || (s.cls === "FORMACAO" && !scans.some((x) => x.setupId === s.setupId && x.cls === "CONFIRMADA"))) {
      seen.add(s.setupId);
      discarded.push({ setupId: s.setupId, label: s.label, cls: s.cls, reason: s.discard ?? (s.cls === "FORMACAO" ? "Gatilho não confirmou até o fim da observação." : "Não executado.") });
    }
  }
  const closed = today.filter((t) => t.status === "WIN" || t.status === "LOSS");
  const p = panel(day, nowSec);
  const w = wins(day), l = losses(day);
  const rules = {
    target: `${w}/2 vitórias · ${l}/1 derrotas · ${day.trades.length}/2 operações`,
    perfect2x0: w === 2 && l === 0,
    text: w === 2 && l === 0 ? "META 2x0 ALCANÇADA: duas vitórias e nenhuma derrota." : l >= 1 ? (w ? "Meta 2x0 comprometida: houve uma derrota (após 1 vitória). Dia encerrado pelo limite de perdas." : "Meta 2x0 comprometida: derrota na primeira operação. Dia encerrado pelo limite de perdas.") : w === 1 ? "Meta parcial: 1 vitória; a segunda não aconteceu (nenhum setup passou nos filtros ou o dia acabou)." : "Nenhuma operação: nenhum setup passou em todos os filtros. Isso é um resultado correto — o agente não força entrada.",
  };
  const rep: DailyReport = {
    date: day.date, pairs, scans: scans.length,
    opportunities: { distant: distinct("DISTANTE"), forming: distinct("FORMACAO"), confirmed: distinct("CONFIRMADA") },
    confirmed: today.length, discarded, wins: w, losses: l, open: today.filter((t) => t.status === "OPEN" || t.status === "UNKNOWN").length,
    notExecuted: discarded.filter((d) => d.cls === "CONFIRMADA").length,
    strategies: [...new Set(today.map((t) => t.strategy))], resultR: p.resultR, resultBrl: p.resultBrl,
    byPair: groupBy(closed, (t) => t.label), byStrategy: groupBy(closed, (t) => t.strategy), rules, text: "",
  };
  const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const gl = (g: Group[]) => (g.length ? g.map((x) => `• ${x.key}: ${x.wins}W/${x.losses}L, ${x.r.toFixed(2)}R, ${brl(x.brl)}`).join("\n") : "• (sem operações encerradas)");
  rep.text = [
    `TRADE AGENT | RELATÓRIO DO DIA ${day.date}`, ``,
    `Pares monitorados: ${pairs.join(", ")} (${scans.length} varreduras)`,
    `Oportunidades: ${rep.opportunities.distant} distantes · ${rep.opportunities.forming} em formação · ${rep.opportunities.confirmed} confirmadas`,
    `Sinais confirmados: ${rep.confirmed} · descartados/não executados: ${discarded.length}`,
    `Vencedoras: ${w} · Perdedoras: ${l} · Em aberto/indefinidas: ${rep.open}`,
    `Estratégias usadas: ${rep.strategies.join(", ") || "—"}`,
    `Resultado: ${rep.resultR.toFixed(2)}R = ${brl(rep.resultBrl)} (simulado, risco fixo ${brl(5)}, já com custos)`, ``,
    `Por ativo:\n${gl(rep.byPair)}`, ``, `Por estratégia:\n${gl(rep.byStrategy)}`, ``,
    `Regras 2x0: ${rules.target}`, rules.text,
    ...(discarded.length ? [``, `Oportunidades não aproveitadas:`, ...discarded.slice(0, 8).map((d) => `• ${d.label} (${d.cls === "CONFIRMADA" ? "confirmada" : "em formação"}): ${d.reason}`)] : []),
    ...(alerts.some((a) => a.error) ? [``, `Atenção: ${alerts.filter((a) => a.error).length} alerta(s) não puderam ser enviados (ver painel).`] : []),
    ``, `Resultado simulado em velas reais do Yahoo (gratuito). Não é recomendação nem garantia.`,
  ].join("\n");
  return rep;
}
