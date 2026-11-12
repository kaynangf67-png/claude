import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Play, Plug, Square } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Só os campos de /api/agent?action=zyon que este painel usa. */
interface Mt5View {
  enabled: boolean; connected: boolean; mode: string | null; server: string | null; lastSeen: number | null; currency: string | null;
  rules: { riskPct: number; maxHoldS: number };
  counts: { executed: number; closed: number; rejected: number; expired: number };
  profit: number;
  orders: { id: string; symbol: string; dir: "BUY" | "SELL"; status: string; volume: number | null; price: number | null; profit: number | null; note: string | null; createdAt: number }[];
}
interface ZyonView {
  lastCycle: number | null; cycles: number; nextIn: number;
  events: { id: string; at: number; who: string; kind: string; text: string }[];
  mt5: Mt5View; cycleNote?: string;
}

const CYCLE_MS = 5 * 60_000, REFRESH_MS = 30_000;
const RUN_KEY = "trade-ai:bot-mt5", TKEY = "trade-ai:admin";
const hm = (s: number) => new Date(s * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, string> = { PENDING: "na fila", SENT: "enviada ao EA", EXECUTED: "aberta no MT5", REJECTED: "recusada", EXPIRED: "expirou", CLOSED: "fechada" };

/** Token de administração: pedido numa caixa da própria aba, guardado só nesta aba (nunca no chat, nunca no navegador permanente). */
function adminToken(): string {
  let t = ""; try { t = sessionStorage.getItem(TKEY) ?? ""; } catch { /* sem sessionStorage */ }
  if (!t) { t = window.prompt("Token de administração (AGENT_ADMIN_TOKEN, o mesmo do escritório). Fica só nesta aba:") ?? ""; try { if (t) sessionStorage.setItem(TKEY, t); } catch { /* ok */ } }
  return t;
}

async function api(action: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`/api/agent?action=${action}`, init);
  const j = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
  if (!r.ok || j?.error) { if (r.status === 401) try { sessionStorage.removeItem(TKEY); } catch { /* ok */ } throw new Error(j.error ?? `Erro ${r.status}`); }
  return j;
}

/**
 * BOT MT5: o Start liga a ponte e faz a mesa de agentes rodar a cada 5 min enquanto o app estiver aberto.
 * Cada entrada que o Risk Guard aprova vai para a fila; o EA ZyonBridge no MetaTrader 5 busca e executa (só conta DEMO).
 */
export function Mt5Bot() {
  const [z, setZ] = useState<ZyonView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(() => { try { return localStorage.getItem(RUN_KEY) === "1"; } catch { return false; } });
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try { const r = await api("zyon"); if (!r?.mt5) throw new Error("Resposta inesperada do servidor."); setZ(r); setErr(null); } catch (e) { setErr((e as Error).message); }
  }, []);

  const cycle = useCallback(async () => {
    try { const r: ZyonView = await api("zyon-cycle", { method: "POST" }); if (r?.mt5) setZ(r); setNote(r.cycleNote ?? null); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);

  useEffect(() => { refresh(); const id = window.setInterval(refresh, REFRESH_MS); return () => window.clearInterval(id); }, [refresh]);

  // enquanto ligado e com o app aberto: um ciclo agora e outro a cada 5 minutos
  useEffect(() => {
    if (!running) return;
    cycle();
    timer.current = window.setInterval(cycle, CYCLE_MS);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [running, cycle]);

  // se a ponte foi desligada em outro lugar (escritório), o bot daqui para também
  useEffect(() => { if (z?.mt5 && !z.mt5.enabled && running) setRun(false); }, [z, running]);

  function setRun(on: boolean) { setRunning(on); try { localStorage.setItem(RUN_KEY, on ? "1" : "0"); } catch { /* ok */ } }

  async function toggle() {
    const on = !running;
    const t = adminToken(); if (!t) { setErr("Token não informado."); return; }
    setBusy(true); setErr(null);
    try {
      await api("control", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, body: JSON.stringify({ op: on ? "mt5-on" : "mt5-off" }) });
      setRun(on); setNote(on ? "Bot ligado: a mesa analisa agora e a cada 5 minutos." : "Bot desligado: nenhuma ordem nova vai ao MT5.");
      await refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const m = z?.mt5;
  const conn = !m ? "…" : m.connected ? (m.mode === "DEMO" ? "EA conectado · conta DEMO" : `EA conectado · conta ${m.mode} (bloqueada)`) : m.lastSeen ? `EA desconectado (visto às ${hm(m.lastSeen)})` : "EA nunca conectou";
  const ready = !!m?.connected && m.mode === "DEMO";

  return (
    <section className="card3d animate-fade mt-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Bot size={18} className="text-info" />
        <h2 className="text-[15px] font-bold">Bot MetaTrader 5</h2>
        <span className="ml-auto text-[11.5px] text-faint">Só conta DEMO · risco {m?.rules.riskPct ?? 0.5}% por operação</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={toggle} disabled={busy}
          className={cx("flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-colors disabled:opacity-60",
            running ? "bg-bear/90 text-white hover:bg-bear" : "bg-bull/90 text-white hover:bg-bull")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : running ? <Square size={16} /> : <Play size={16} />}
          {running ? "Stop" : "Start"}
        </button>
        <div className="text-[12.5px]">
          <div className={cx("flex items-center gap-1.5 font-semibold", ready ? "text-bull" : "text-warn")}><Plug size={13} /> {conn}</div>
          <div className="text-faint">{running ? `Ligado · ciclo a cada 5 min com o app aberto${z?.lastCycle ? ` · último às ${hm(z.lastCycle)}` : ""}` : "Desligado"}</div>
        </div>
      </div>

      {running && !ready && m && (
        <div className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px]">
          O bot está ligado, mas as ordens só chegam ao MetaTrader quando o EA <b>ZyonBridge</b> estiver rodando no gráfico, numa conta <b>DEMO</b>. Veja o passo a passo em docs/MT5.md.
        </div>
      )}
      {note && <div className="mt-3 text-[12px] text-faint">{note}</div>}
      {err && <div className="mt-3 text-[12px] text-bear">{err}</div>}

      {m && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Ordens no MT5</div>
            <div className="mt-1 text-[12px] text-faint">
              {m.counts.executed} abertas · {m.counts.closed} fechadas · {m.counts.rejected} recusadas · {m.counts.expired} expiradas
              {m.counts.closed > 0 && <> · resultado <b className={m.profit >= 0 ? "text-bull" : "text-bear"}>{m.profit >= 0 ? "+" : ""}{m.profit.toFixed(2)} {m.currency ?? ""}</b></>}
            </div>
            <ul className="mt-2 space-y-1">
              {m.orders.length === 0 && <li className="text-[12px] text-faint">Nenhuma ordem ainda. Elas aparecem quando o Risk Guard aprova uma entrada.</li>}
              {m.orders.map((o) => (
                <li key={o.id} className="num flex flex-wrap gap-x-2 text-[12px]">
                  <span className="text-faint">{hm(o.createdAt)}</span>
                  <b className={o.dir === "BUY" ? "text-bull" : "text-bear"}>{o.dir === "BUY" ? "Compra" : "Venda"}</b>
                  <span>{o.symbol}</span>
                  <span className="text-faint">{STATUS[o.status] ?? o.status}{o.volume ? ` · ${o.volume} lote` : ""}</span>
                  {o.profit !== null && <span className={o.profit >= 0 ? "text-bull" : "text-bear"}>{o.profit >= 0 ? "+" : ""}{o.profit.toFixed(2)}</span>}
                  {o.note && <span className="w-full text-faint">{o.note}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">O que os agentes fizeram</div>
            <ul className="mt-2 space-y-1">
              {(z?.events ?? []).slice(0, 6).map((e) => (
                <li key={e.id} className="text-[12px]"><span className="text-faint">{hm(e.at)} {e.who}</span> {e.text}</li>
              ))}
              {!z?.events.length && <li className="text-[12px] text-faint">Nenhum ciclo ainda.</li>}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-faint">
        Sem vantagem comprovada nos testes até agora: use para medir em demo, não para ganhar dinheiro. Com o app fechado o bot não analisa nada novo;
        o EA continua gerenciando no MT5 o stop, o alvo e o prazo das ordens já abertas.
      </p>
    </section>
  );
}
