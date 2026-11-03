import { FOREX_YAHOO } from "./marketData.js";

/** Trade Profile: critérios operacionais salvos pelo usuário e aplicados em TODAS as análises. */
export type Style = "conservador" | "equilibrado" | "agressivo" | "livre";
export const ALL_PAIRS = Object.keys(FOREX_YAHOO);
export const ALL_STRATEGIES = [1, 2, 3, 4, 5, 9] as const;

export interface Profile {
  market: "Forex";
  pairs: string[];
  mainTf: "M5";
  entryTf: "M1" | "M5";
  context: ("M15" | "H1")[];
  maxRiskPct: number;
  minRR: number;
  strategies: number[];
  style: Style;
  /** Saldo opcional (em USD) só para calcular o tamanho da posição; sem ele nada é calculado. */
  balance: number | null;
}

/** Regras de cada perfil. A pontuação mínima NÃO é probabilidade de acerto: é só o corte de confluência. */
export const STYLE_RULES: Record<Style, { minScore: number; minRR: number; requireM1: boolean; blockUnverifiedNews: boolean; relaxed?: boolean; text: string }> = {
  conservador: { minScore: 80, minRR: 2.0, requireM1: true, blockUnverifiedNews: true, text: "Confluência mínima 80, gatilho obrigatório no M1, bloqueia se o calendário de notícias não puder ser verificado." },
  equilibrado: { minScore: 75, minRR: 1.5, requireM1: false, blockUnverifiedNews: false, text: "Confluência mínima 75; se o M1 faltar, o gatilho é avaliado no M5." },
  agressivo: { minScore: 70, minRR: 1.2, requireM1: false, blockUnverifiedNews: false, text: "Confluência mínima 70 e R:R menor: mais sinais e, em geral, mais ruído." },
  /** Modo LIVRE: entrada ANTECIPADA sem exigir todos os filtros. Só dados válidos e notícia de alto impacto continuam bloqueando. */
  livre: { minScore: 55, minRR: 1.0, requireM1: false, blockUnverifiedNews: false, relaxed: true, text: "Entradas ANTECIPADAS: não exige todos os filtros nem o gatilho. Só bloqueia dados atrasados e notícia de alto impacto. Muito mais sinais e muito mais erros." },
};

export const DEFAULT_PROFILE: Profile = {
  market: "Forex", pairs: [...ALL_PAIRS], mainTf: "M5", entryTf: "M1", context: ["M15", "H1"],
  maxRiskPct: 1, minRR: STYLE_RULES.equilibrado.minRR, strategies: [...ALL_STRATEGIES], style: "equilibrado", balance: null,
};

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Valida o que veio do navegador: nada de campos soltos, valores dentro de limites e listas sem itens desconhecidos. */
export function sanitizeProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const style: Style = r.style === "conservador" || r.style === "agressivo" || r.style === "equilibrado" || r.style === "livre" ? r.style : DEFAULT_PROFILE.style;
  const pairs = Array.isArray(r.pairs) ? [...new Set(r.pairs.filter((p): p is string => typeof p === "string" && p in FOREX_YAHOO))] : [];
  const strategies = Array.isArray(r.strategies) ? [...new Set(r.strategies.filter((s): s is number => (ALL_STRATEGIES as readonly number[]).includes(s as number)))] : [];
  const context = Array.isArray(r.context) ? ([...new Set(r.context.filter((c) => c === "M15" || c === "H1"))] as Profile["context"]) : [...DEFAULT_PROFILE.context];
  const balance = r.balance === null || r.balance === undefined || r.balance === "" ? null : num(r.balance, 1, 1e9, NaN);
  return {
    market: "Forex", mainTf: "M5",
    entryTf: r.entryTf === "M5" ? "M5" : "M1",
    pairs: pairs.length ? pairs : [...ALL_PAIRS],
    context,
    maxRiskPct: num(r.maxRiskPct, 0.1, 5, DEFAULT_PROFILE.maxRiskPct),
    minRR: num(r.minRR, 1, 5, STYLE_RULES[style].minRR),
    strategies: strategies.length ? strategies.sort((a, b) => a - b) : [...ALL_STRATEGIES],
    style,
    balance: Number.isFinite(balance as number) ? (balance as number) : null,
  };
}

/** Valor de 1 pip por lote padrão (100 mil unidades) em USD, só quando dá para calcular sem outra cotação. */
function pipValueUsd(symbol: string, price: number): number | null {
  if (symbol.endsWith("USD")) return 10;
  if (symbol === "USDJPY") return 1000 / price;
  if (symbol === "USDCHF" || symbol === "USDCAD") return 10 / price;
  return null; // cruzamentos (EURGBP, EURJPY, GBPJPY, AUDCAD, AUDJPY) precisam de outra cotação
}

export interface Sizing { riskPct: number; riskUsd: number | null; lots: number | null; note: string }

/** Tamanho da posição pelo risco máximo do perfil. Sem saldo informado, ou em cruzamentos, devolve só a explicação. */
export function positionSize(p: Profile, symbol: string, price: number, riskPips: number): Sizing {
  if (p.balance === null) return { riskPct: p.maxRiskPct, riskUsd: null, lots: null, note: `Risco máximo de ${p.maxRiskPct}% por operação. Informe o saldo (USD) no perfil para calcular o lote.` };
  const riskUsd = (p.balance * p.maxRiskPct) / 100, pv = pipValueUsd(symbol, price);
  if (pv === null || riskPips <= 0) return { riskPct: p.maxRiskPct, riskUsd, lots: null, note: `Risco de ${riskUsd.toFixed(2)} USD. Lote não calculado: ${riskPips <= 0 ? "stop inválido" : "este cruzamento precisa de outra cotação para converter o pip"}.` };
  const lots = Math.floor((riskUsd / (riskPips * pv)) * 100) / 100;
  return { riskPct: p.maxRiskPct, riskUsd, lots, note: `Risco de ${riskUsd.toFixed(2)} USD (${p.maxRiskPct}% de ${p.balance}) ÷ (${riskPips.toFixed(1)} pips × ${pv.toFixed(2)} USD/pip) = ${lots.toFixed(2)} lote. Considera conta em USD; confira o valor do pip na sua corretora.` };
}
