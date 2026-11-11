import { assessQuality, cleanCandles, closedOnly } from "../forex/candles.js";
import { FOREX_LABEL, FOREX_YAHOO, parseYahooCandles } from "../forex/marketData.js";
import type { Candle, TF } from "../forex/types.js";
import { TF_SECONDS } from "../forex/types.js";
import { analyzeLatest, backtestBinary, DEFAULT_EXPIRY, STRATEGY_LABEL, type BinStrategy } from "./engine.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Ativos das binárias: os 12 pares de Forex + cripto e commodities (preços do Yahoo; futuros de ouro/prata/petróleo diferem um pouco da corretora). */
export const BINARY_ASSETS: Record<string, { yahoo: string; label: string; digits: number }> = {
  ...Object.fromEntries(Object.entries(FOREX_YAHOO).map(([id, y]) => [id, { yahoo: y, label: FOREX_LABEL(id), digits: id.includes("JPY") ? 3 : 5 }])),
  BTCUSD: { yahoo: "BTC-USD", label: "BTC/USD", digits: 2 }, ETHUSD: { yahoo: "ETH-USD", label: "ETH/USD", digits: 2 }, LTCUSD: { yahoo: "LTC-USD", label: "LTC/USD", digits: 2 },
  XAUUSD: { yahoo: "GC=F", label: "Ouro", digits: 2 }, XAGUSD: { yahoo: "SI=F", label: "Prata", digits: 3 }, USOIL: { yahoo: "CL=F", label: "Petróleo", digits: 2 },
};
export const BINARY_TFS = ["M1", "M5", "M15"] as const;
type BTf = (typeof BINARY_TFS)[number];
const SPEC: Record<BTf, { interval: string; live: string; test: string }> = {
  M1: { interval: "1m", live: "2d", test: "7d" }, M5: { interval: "5m", live: "5d", test: "60d" }, M15: { interval: "15m", live: "10d", test: "60d" },
};
const isTf = (v: unknown): v is BTf => typeof v === "string" && (BINARY_TFS as readonly string[]).includes(v);
const isStrategy = (v: unknown): v is BinStrategy | "auto" => v === "auto" || v === "reversao" || v === "retracao" || v === "fluxo" || v === "tres";

export async function fetchBinarySeries(assetId: string, tf: BTf, range: "live" | "test"): Promise<Candle[]> {
  const a = BINARY_ASSETS[assetId];
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(a.yahoo)}?interval=${SPEC[tf].interval}&range=${SPEC[tf][range]}`, { headers: { "user-agent": "Mozilla/5.0 (TradeAI binary)" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status} (${tf})`);
  return cleanCandles(parseYahooCandles(await res.json())).candles;
}

export interface BinDeps { series?: (assetId: string, tf: BTf, range: "live" | "test") => Promise<Candle[]>; now?: () => number }

const num = (v: unknown, lo: number, hi: number, d: number) => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export async function handleBinary(request: Request, deps: BinDeps = {}): Promise<Response> {
  const get = deps.series ?? fetchBinarySeries, now = Math.floor((deps.now ?? Date.now)() / 1000);
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.searchParams.get("action") === "backtest") {
      const id = (url.searchParams.get("symbol") ?? "EURUSD").toUpperCase(), tf = url.searchParams.get("tf") ?? "M5", st = url.searchParams.get("strategy") ?? "reversao";
      if (!BINARY_ASSETS[id]) return json({ error: "Ativo desconhecido" }, 400);
      if (!isTf(tf)) return json({ error: "Tempo gráfico inválido (use M1, M5 ou M15)" }, 400);
      if (st !== "reversao" && st !== "retracao" && st !== "fluxo" && st !== "tres") return json({ error: "Estratégia inválida (reversao, retracao, fluxo ou tres)" }, 400);
      const payout = num(url.searchParams.get("payout"), 0.5, 1, 0.85), expiry = Math.round(num(url.searchParams.get("expiry"), 1, 10, DEFAULT_EXPIRY[st]));
      const candles = closedOnly(await get(id, tf, "test"), tf as TF, now);
      const out = (minLevel: "confirmada" | "parcial") => backtestBinary(candles, { strategy: st, expiry, payout, minLevel });
      const conf = out("confirmada"), part = out("parcial");
      const first = candles[0]?.t ?? null, last = candles.at(-1)?.t ?? null;
      return json({
        symbol: id, label: BINARY_ASSETS[id].label, tf, strategy: st, strategyLabel: STRATEGY_LABEL[st], expiry, payout, breakEven: 1 / (1 + payout),
        period: { candles: candles.length, from: first, to: last, days: first && last ? Math.round((last - first) / 86400) : 0 },
        confirmada: { all: conf.all, development: conf.development, validation: conf.validation }, parcial: { all: part.all, development: part.development, validation: part.validation },
        verdict: verdictOf(conf.all, part.all),
        note: "Backtest sem olhar o futuro: o sinal usa só a vela fechada, a entrada é a abertura da vela seguinte, empate não conta. Com preços do Yahoo (podem diferir da corretora) e sem o atraso real de execução. Taxa de acerto aqui é medida, não prevista.",
      });
    }
    if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.asset === "string" ? body.asset.toUpperCase() : "";
    if (!BINARY_ASSETS[id]) return json({ error: "Ativo desconhecido" }, 400);
    const tf: BTf = isTf(body.tf) ? body.tf : "M5", pick = isStrategy(body.strategy) ? body.strategy : "auto";
    const payout = num(body.payout, 0.5, 1, 0.85);
    const a = BINARY_ASSETS[id], step = TF_SECONDS[tf as TF];
    const candles = closedOnly(await get(id, tf, "live"), tf as TF, now);
    const q = assessQuality(candles, tf as TF, now);
    // binária só precisa de ~60 velas; histórico curto de M1 em ativo parado não bloqueia
    const issues = q.issues.filter((x) => !x.includes("histórico curto"));
    const res = analyzeLatest(candles, pick);
    const dataOk = issues.length === 0 && !!res;
    const base = { symbol: id, label: a.label, tf, digits: a.digits, now, payout, breakEven: 1 / (1 + payout), data: { ok: dataOk, issues: res ? issues : [...issues, "Poucas velas para analisar."], ageMin: q.ageMin } };
    if (!dataOk || !res) return json({ ...base, price: candles.at(-1)?.c ?? null, signal: null, signals: null });

    const best = res.best, expiry = Math.round(num(body.expiry, 1, 10, best.defaultExpiry));
    // entrada na abertura da PRÓXIMA vela; expiração depois de `expiry` velas
    const entryAt = Math.ceil((now + 5) / step) * step, expiryAt = entryAt + expiry * step;
    const warnings: string[] = [];
    if (q.ageMin !== null && q.ageMin * 60 > step) warnings.push(`A última vela fechada tem ${Math.round(q.ageMin)} min: os dados gratuitos atrasam. Confira o preço no gráfico da corretora antes de entrar.`);
    if (best.level === "fraca") warnings.push("Nenhuma estratégia está completa agora: este é o lado mais provável, de BAIXA convicção.");
    if (id === "XAUUSD" || id === "XAGUSD" || id === "USOIL") warnings.push("Preço do contrato futuro do Yahoo; o da corretora pode diferir.");
    return json({
      ...base, price: candles.at(-1)!.c, signal: { ...best, expiryCandles: expiry, expiryMinutes: (expiry * step) / 60, entryAt, expiryAt, pick },
      signals: Object.fromEntries(Object.entries(res.signals).map(([k, s]) => [k, { strategy: s.strategy, label: s.label, dir: s.dir, level: s.level, met: s.met, total: s.total }])),
      warnings,
    });
  } catch (e) { return json({ error: (e as Error).message.slice(0, 200) }, 502); }
}

function verdictOf(conf: ReturnType<typeof backtestBinary>["all"], part: ReturnType<typeof backtestBinary>["all"]): string {
  const x = conf.n >= 30 ? conf : part;
  if (x.n < 30) return `Poucos sinais (${x.n}): ainda não dá para concluir nada.`;
  if (x.ci && x.ci[0] > x.breakEven) return "Acima do ponto de equilíbrio com margem estatística neste período. Isso pode não se repetir: confirme em outros períodos e ao vivo.";
  if (x.ci && x.ci[1] < x.breakEven) return "Abaixo do ponto de equilíbrio com margem estatística: do jeito que está, perde dinheiro.";
  return "Não dá para distinguir a taxa de acerto do ponto de equilíbrio: sem vantagem comprovada.";
}
