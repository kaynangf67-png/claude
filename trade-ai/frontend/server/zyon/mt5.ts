import type { Store } from "../agent/store.js";
import type { Opportunity } from "./core.js";

/**
 * PONTE MT5: fila de ordens entre a mesa Zyon e o Expert Advisor (ZyonBridge.mq5) rodando no MetaTrader 5 do usuário.
 * - A mesa só enfileira o que o Risk Guard APROVOU, e só com a ponte LIGADA (desligada por padrão).
 * - O EA puxa a fila (o servidor nunca conecta no computador do usuário), executa e reporta o negócio real.
 * - Só conta DEMO: se o EA informar conta real, nenhuma ordem é entregue. O EA também se recusa a iniciar em conta real.
 * - Senha da corretora nunca passa por aqui: o EA usa a conta já logada no terminal. A autenticação é um token (MT5_BRIDGE_TOKEN).
 * - O lote é calculado no EA pelo risco fixo abaixo, com os dados reais do símbolo na corretora.
 */
export const MT5_KEY = "zyon:mt5";
export const MT5_RULES = { riskPct: 0.5, orderTtlS: 120, heartbeatFreshS: 90, maxHoldS: 3600, keep: 100 } as const;

export type Mt5Status = "PENDING" | "SENT" | "EXECUTED" | "REJECTED" | "EXPIRED" | "CLOSED";
export interface Mt5Order {
  id: string; symbol: string; dir: "BUY" | "SELL"; entry: number; sl: number; tp: number; riskPct: number; maxHoldS: number;
  createdAt: number; expiresAt: number; status: Mt5Status;
  ticket?: string; price?: number; volume?: number; note?: string; profit?: number; closedAt?: number;
}
export interface Heartbeat { at: number; mode: string; server: string; currency: string; balance: number | null; equity: number | null; open: number; ea: string }
export interface Mt5State { enabled: boolean; heartbeat: Heartbeat | null; orders: Mt5Order[] }
const empty = (): Mt5State => ({ enabled: false, heartbeat: null, orders: [] });

export async function loadMt5(store: Store): Promise<Mt5State> { return (await store.getKv<Mt5State>(MT5_KEY)) ?? empty(); }

/** Leitura–alteração–gravação protegida por trava (a mesa e o EA mexem na mesma fila). */
async function mutate<T>(store: Store, now: number, fn: (s: Mt5State) => T): Promise<T> {
  for (let i = 0; i < 20; i++) {
    if (await store.acquireLease("zyon-mt5", 10, now)) {
      try { const s = await loadMt5(store); const out = fn(s); s.orders = s.orders.slice(-MT5_RULES.keep); await store.setKv(MT5_KEY, s); return out; }
      finally { await store.releaseLease("zyon-mt5"); }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Fila do MT5 ocupada; tente de novo.");
}

const expire = (s: Mt5State, now: number) => { for (const o of s.orders) if (o.status === "PENDING" && o.expiresAt <= now) { o.status = "EXPIRED"; o.note = "O EA não buscou a ordem a tempo."; } };
export const connected = (s: Mt5State, now: number) => !!s.heartbeat && now - s.heartbeat.at <= MT5_RULES.heartbeatFreshS;

export async function setEnabled(store: Store, on: boolean, now: number): Promise<void> { await mutate(store, now, (s) => { s.enabled = on; }); }

/** Chamado pela mesa quando o Risk Guard aprova. Devolve o motivo quando NÃO enfileira. */
export async function enqueue(store: Store, o: Opportunity, now: number): Promise<{ queued: boolean; reason: string }> {
  return mutate(store, now, (s) => {
    expire(s, now);
    if (!s.enabled) return { queued: false, reason: "ponte MT5 desligada" };
    if (!connected(s, now)) return { queued: false, reason: "EA do MT5 desconectado" };
    if (s.heartbeat!.mode !== "DEMO") return { queued: false, reason: "a conta conectada não é DEMO" };
    if (s.orders.some((x) => x.id === o.id)) return { queued: false, reason: "ordem já enfileirada" };
    if (s.orders.some((x) => x.symbol === o.symbol && (x.status === "PENDING" || x.status === "SENT" || x.status === "EXECUTED"))) return { queued: false, reason: `já existe ordem ativa em ${o.label}` };
    const tp = o.tps[0]; if (tp === null) return { queued: false, reason: "sem alvo" };
    s.orders.push({ id: o.id, symbol: o.symbol, dir: o.dir, entry: o.entry, sl: o.sl, tp, riskPct: MT5_RULES.riskPct, maxHoldS: MT5_RULES.maxHoldS, createdAt: now, expiresAt: now + MT5_RULES.orderTtlS, status: "PENDING" });
    return { queued: true, reason: "ordem enviada à fila do MT5 (demo)" };
  });
}

const num = (v: string | null) => { const n = v === null || v === "" ? NaN : Number(v); return Number.isFinite(n) ? n : null; };

/** O EA chama a cada poucos segundos: registra o sinal de vida e recebe as ordens pendentes (uma única vez cada). */
export async function poll(store: Store, p: URLSearchParams, now: number): Promise<{ orders: Mt5Order[]; note: string }> {
  return mutate(store, now, (s) => {
    s.heartbeat = { at: now, mode: (p.get("mode") ?? "").toUpperCase().slice(0, 12), server: (p.get("server") ?? "").slice(0, 60), currency: (p.get("currency") ?? "").slice(0, 8),
      balance: num(p.get("balance")), equity: num(p.get("equity")), open: num(p.get("open")) ?? 0, ea: (p.get("ea") ?? "").slice(0, 12) };
    expire(s, now);
    if (!s.enabled) return { orders: [], note: "ponte desligada no escritório" };
    if (s.heartbeat.mode !== "DEMO") return { orders: [], note: "conta real: ordens bloqueadas" };
    const out = s.orders.filter((o) => o.status === "PENDING");
    for (const o of out) o.status = "SENT";
    return { orders: out.map((o) => ({ ...o })), note: "ok" };
  });
}

/** O EA reporta o que aconteceu de verdade na corretora. Repetir o mesmo aviso não muda nada. */
export async function report(store: Store, p: URLSearchParams, now: number): Promise<{ ok: boolean; note: string }> {
  const id = p.get("id") ?? "", type = p.get("type") ?? "";
  return mutate(store, now, (s) => {
    const o = s.orders.find((x) => x.id === id);
    if (!o) return { ok: false, note: "ordem desconhecida" };
    if (type === "executed") {
      if (o.status === "EXECUTED" || o.status === "CLOSED") return { ok: true, note: "já registrada" };
      if (o.status !== "SENT" && o.status !== "PENDING") return { ok: false, note: `ordem em ${o.status}` };
      o.status = "EXECUTED"; o.ticket = (p.get("ticket") ?? "").slice(0, 24); o.price = num(p.get("price")) ?? undefined; o.volume = num(p.get("volume")) ?? undefined;
      return { ok: true, note: "executada" };
    }
    if (type === "rejected") {
      if (o.status === "EXECUTED" || o.status === "CLOSED") return { ok: false, note: "ordem já executada" };
      o.status = "REJECTED"; o.note = (p.get("reason") ?? "").slice(0, 160);
      return { ok: true, note: "rejeitada" };
    }
    if (type === "closed") {
      if (o.status === "CLOSED") return { ok: true, note: "já registrada" };
      if (o.status !== "EXECUTED") return { ok: false, note: `ordem em ${o.status}` };
      o.status = "CLOSED"; o.profit = num(p.get("profit")) ?? undefined; o.closedAt = now;
      return { ok: true, note: "fechada" };
    }
    return { ok: false, note: "tipo inválido" };
  });
}

/** Formato de linhas para o EA (JSON em MQL5 é frágil): ORDER|id|symbol|BUY|entry|sl|tp|riskPct|maxHoldS */
export function toText(r: { orders: Mt5Order[]; note: string }): string {
  return [`NOTE|${r.note}`, ...r.orders.map((o) => ["ORDER", o.id, o.symbol, o.dir, o.entry, o.sl, o.tp, o.riskPct, o.maxHoldS].join("|"))].join("\n") + "\n";
}

/** O que o escritório mostra (sem saldo nem número de conta: a página é aberta). */
export function publicView(s: Mt5State, now: number) {
  const done = s.orders.filter((o) => o.status === "CLOSED");
  return {
    enabled: s.enabled, connected: connected(s, now), mode: s.heartbeat?.mode ?? null, server: s.heartbeat?.server ?? null, lastSeen: s.heartbeat?.at ?? null,
    currency: s.heartbeat?.currency ?? null, rules: MT5_RULES,
    counts: { executed: s.orders.filter((o) => o.status === "EXECUTED").length, closed: done.length, rejected: s.orders.filter((o) => o.status === "REJECTED").length, expired: s.orders.filter((o) => o.status === "EXPIRED").length },
    profit: done.reduce((a, o) => a + (o.profit ?? 0), 0),
    orders: s.orders.slice(-8).reverse().map((o) => ({ id: o.id, symbol: o.symbol, dir: o.dir, status: o.status, volume: o.volume ?? null, price: o.price ?? null, profit: o.profit ?? null, note: o.note ?? null, createdAt: o.createdAt })),
  };
}
