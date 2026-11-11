import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Loader2, Timer, X } from "lucide-react";
import type { Asset } from "../lib/markets";
import { hhmm } from "../lib/math";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

type Strat = "auto" | "reversao" | "retracao";
type Tf = "M1" | "M5" | "M15";
const STRATS: { id: Strat; title: string; sub: string }[] = [
  { id: "auto", title: "✦ IA escolhe", sub: "a mais completa agora" },
  { id: "reversao", title: "Reversão de preço", sub: "preço esticado volta à média" },
  { id: "retracao", title: "Retração", sub: "recuo na tendência, retoma" },
];
const TFS: Tf[] = ["M1", "M5", "M15"];
const EXPIRIES = [0, 1, 2, 3, 5]; // 0 = sugerida pela estratégia

interface Signal {
  strategy: "reversao" | "retracao"; label: string; dir: "CALL" | "PUT"; level: "confirmada" | "parcial" | "fraca"; met: number; total: number;
  conds: { ok: boolean; text: string }[]; expiryCandles: number; expiryMinutes: number; entryAt: number; expiryAt: number;
}
interface Result {
  label: string; tf: Tf; digits: number; price: number | null; payout: number; breakEven: number;
  data: { ok: boolean; issues: string[] }; signal: Signal | null; warnings?: string[];
  signals?: Record<string, { label: string; dir: string; level: string; met: number; total: number }> | null;
}
interface Stats { n: number; wins: number; losses: number; ties: number; winRate: number | null; breakEven: number; expectancy: number | null; ci: [number, number] | null }
interface Backtest {
  strategyLabel: string; tf: string; expiry: number; payout: number; breakEven: number; period: { candles: number; days: number };
  confirmada: { all: Stats; validation: Stats }; parcial: { all: Stats; validation: Stats }; verdict: string; note: string;
}

const LEVEL = { confirmada: { t: "CONFIRMADA", c: "text-buy" }, parcial: { t: "PARCIAL", c: "text-warn" }, fraca: { t: "BAIXA CONVICÇÃO", c: "text-sell" } } as const;

/** Operações rápidas (binárias): reversão de preço e retração em M1, M5 e M15. Só análise: nada é enviado a corretora. */
export function BinaryAnalysis({ asset, payoutPct, onRecord }: {
  asset: Asset; payoutPct: number;
  onRecord: (e: { symbol: string; timeframe: string; decision: "CALL" | "PUT"; quality: string; entryAt: number; expiryAt: number }) => void;
}) {
  const [strategy, setStrategy] = useState<Strat>("auto");
  const [tf, setTf] = useState<Tf>("M5");
  const [expiry, setExpiry] = useState(0);
  const [busy, setBusy] = useState(false), [btBusy, setBtBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [bt, setBt] = useState<Backtest | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setRes(null); setBt(null); setError(null); setSaved(false); }, [asset.id, strategy, tf, expiry]);

  const call = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init);
    const body = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
    if (!r.ok) throw new Error(body.error ?? `Erro ${r.status}`);
    return body;
  };
  const run = async () => {
    setBusy(true); setError(null); setRes(null); setSaved(false);
    try {
      setRes(await call("/api/binary", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: asset.id, tf, strategy, payout: payoutPct / 100, ...(expiry ? { expiry } : {}) }) }));
    } catch (e) { setError(e instanceof TypeError ? "Sem conexão com o servidor." : (e as Error).message); } finally { setBusy(false); }
  };
  const runBt = async () => {
    const st = res?.signal?.strategy ?? (strategy === "retracao" ? "retracao" : "reversao");
    setBtBusy(true); setError(null);
    try { setBt(await call(`/api/binary?action=backtest&symbol=${asset.id}&tf=${tf}&strategy=${st}&payout=${payoutPct / 100}${expiry ? `&expiry=${expiry}` : ""}`)); }
    catch (e) { setError((e as Error).message); } finally { setBtBusy(false); }
  };

  const s = res?.signal ?? null;
  return (
    <section className="card3d animate-fade mt-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Timer size={18} className="text-warn" />
        <h2 className="text-[15px] font-semibold">Operações rápidas · Binárias · {asset.label}</h2>
        <span className="ml-auto text-[11.5px] text-faint">1 a 15 minutos · só análise</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Estratégia">
        {STRATS.map((o) => (
          <button key={o.id} onClick={() => setStrategy(o.id)} aria-pressed={strategy === o.id}
            className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", strategy === o.id ? "border-warn bg-warn/15 text-ink" : "border-line bg-panel text-mute hover:border-line-2 hover:text-ink")}>
            <div className="text-[13.5px] font-extrabold">{o.title}</div>
            <div className="text-[11.5px] opacity-80">{o.sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Tempo gráfico</div>
          <div className="mt-1.5 flex gap-2" role="group" aria-label="Tempo gráfico">
            {TFS.map((t) => (
              <button key={t} onClick={() => setTf(t)} aria-pressed={tf === t}
                className={cx("num rounded-lg border px-3.5 py-1.5 text-[13px] font-bold", tf === t ? "border-info bg-info/15 text-ink" : "border-line bg-panel text-mute hover:text-ink")}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Expiração</div>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Expiração em velas">
            {EXPIRIES.map((x) => (
              <button key={x} onClick={() => setExpiry(x)} aria-pressed={expiry === x}
                className={cx("num rounded-lg border px-3 py-1.5 text-[13px] font-bold", expiry === x ? "border-info bg-info/15 text-ink" : "border-line bg-panel text-mute hover:text-ink")}>
                {x === 0 ? "Auto" : `${x} vela${x > 1 ? "s" : ""}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={run} disabled={busy}
        className="btn3d mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14.5px] font-extrabold tracking-[0.05em] text-[#03130a] disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <><Loader2 size={18} className="animate-spin" /> ANALISANDO {tf}…</> : "GERAR ENTRADA RÁPIDA"}
      </button>

      {error && <div className="mt-4 flex gap-2 rounded-xl border border-sell/30 bg-sell/10 p-3 text-[13px] text-sell"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}

      {res && !res.data.ok && <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn">Dados bloqueados: {res.data.issues.join(" | ")}</div>}

      {res && s && (
        <div className="animate-fade mt-4 space-y-3">
          <div className={cx("flex items-center gap-4 rounded-2xl border p-4", s.dir === "CALL" ? "border-buy/40 bg-buy/10" : "border-sell/40 bg-sell/10")}>
            <div className={cx("grid size-12 shrink-0 place-items-center rounded-2xl border", s.dir === "CALL" ? "border-buy/40 text-buy" : "border-sell/40 text-sell")}>
              {s.dir === "CALL" ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
            </div>
            <div className="min-w-0">
              <div className={cx("text-[24px] font-extrabold leading-none", s.dir === "CALL" ? "text-buy" : "text-sell")}>
                {s.dir}<span className={cx("ml-2 align-middle text-[11px] font-bold", LEVEL[s.level].c)}>{LEVEL[s.level].t}</span>
              </div>
              <div className="mt-1.5 text-[12.5px] text-mute">{res.label} · {res.tf} · {s.label} · {s.met}/{s.total} condições · preço <b className="num text-ink">{res.price?.toFixed(res.digits)}</b></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center">
            <Cell k="Entrada" v={hhmm(new Date(s.entryAt * 1000))} hint="abertura da próxima vela" />
            <Cell k="Expiração" v={hhmm(new Date(s.expiryAt * 1000))} hint={`${s.expiryCandles} vela${s.expiryCandles > 1 ? "s" : ""} · ${s.expiryMinutes} min`} />
            <Cell k="Empata com" v={pct(res.breakEven)} hint={`payout ${Math.round(res.payout * 100)}%`} tone="text-warn" />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Condições da estratégia</div>
            <ul className="mt-1.5 space-y-1">
              {s.conds.map((c) => (
                <li key={c.text} className="flex gap-2 text-[13px] text-mute">
                  {c.ok ? <Check size={13} className="mt-0.5 shrink-0 text-buy" /> : <X size={13} className="mt-0.5 shrink-0 text-sell" />}{c.text}
                </li>
              ))}
            </ul>
          </div>

          {res.signals && (
            <div className="text-[12px] text-faint">
              Comparativo: {Object.values(res.signals).map((x) => `${x.label} ${x.dir} (${x.level}, ${x.met}/${x.total})`).join(" · ")}
            </div>
          )}
          {res.warnings?.map((w) => <div key={w} className="flex gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{w}</div>)}

          <div className="flex flex-wrap gap-2">
            <button disabled={saved} onClick={() => { onRecord({ symbol: res.label, timeframe: res.tf, decision: s.dir, quality: s.level === "confirmada" ? "forte" : s.level === "parcial" ? "moderada" : "fraca", entryAt: s.entryAt * 1000, expiryAt: s.expiryAt * 1000 }); setSaved(true); }}
              className="rounded-lg border border-line-2 px-3 py-2 text-[12.5px] font-semibold text-mute hover:text-ink disabled:opacity-50">{saved ? "Registrada no seu desempenho" : "Registrar no meu desempenho"}</button>
            <button onClick={runBt} disabled={btBusy}
              className="rounded-lg border border-line-2 px-3 py-2 text-[12.5px] font-semibold text-mute hover:text-ink disabled:opacity-50">{btBusy ? "Medindo…" : "Ver desempenho medido desta estratégia"}</button>
          </div>
        </div>
      )}

      {!s && !res && !busy && (
        <div className="mt-3">
          <button onClick={runBt} disabled={btBusy} className="rounded-lg border border-line-2 px-3 py-2 text-[12.5px] font-semibold text-mute hover:text-ink disabled:opacity-50">
            {btBusy ? "Medindo…" : "Ver desempenho medido (backtest)"}
          </button>
        </div>
      )}

      {bt && <BacktestView bt={bt} />}

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Binária paga só se acertar: com payout de {payoutPct}% é preciso acertar {pct(1 / (1 + payoutPct / 100))} das entradas só para empatar. As duas estratégias usam regras técnicas objetivas, mas não preveem a próxima vela.
        A CVM alerta que corretoras de opções binárias que captam clientes no Brasil não têm autorização para isso.
      </p>
    </section>
  );
}

function BacktestView({ bt }: { bt: Backtest }) {
  const row = (k: string, st: Stats, val: Stats) => (
    <tr key={k} className="border-t border-line">
      <td className="py-1.5 pr-2 text-ink">{k}</td>
      <td className="num py-1.5 pr-2">{st.n}</td>
      <td className={cx("num py-1.5 pr-2 font-semibold", st.winRate === null ? "" : st.winRate >= st.breakEven ? "text-buy" : "text-sell")}>{pct(st.winRate)}</td>
      <td className="num py-1.5 pr-2 text-faint">{st.ci ? `${pct(st.ci[0])} a ${pct(st.ci[1])}` : "—"}</td>
      <td className={cx("num py-1.5 pr-2", st.expectancy === null ? "" : st.expectancy >= 0 ? "text-buy" : "text-sell")}>{st.expectancy === null ? "—" : `${st.expectancy >= 0 ? "+" : ""}${st.expectancy.toFixed(2).replace(".", ",")}`}</td>
      <td className="num py-1.5 text-faint">{val.n ? `${val.n} · ${pct(val.winRate)}` : "—"}</td>
    </tr>
  );
  return (
    <div className="animate-fade mt-4 rounded-2xl border border-line bg-panel p-4">
      <div className="text-[13px] font-semibold">Desempenho medido · {bt.strategyLabel} · {bt.tf} · {bt.expiry} vela{bt.expiry > 1 ? "s" : ""}</div>
      <div className="text-[11.5px] text-faint">{bt.period.candles} velas (~{bt.period.days} dias) · equilíbrio {pct(bt.breakEven)} com payout {Math.round(bt.payout * 100)}%</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-[12px] text-mute">
          <thead><tr className="text-[10.5px] uppercase tracking-wider text-faint"><th className="pb-1 pr-2 font-medium">Sinais</th><th className="pr-2 font-medium">N</th><th className="pr-2 font-medium">Acerto</th><th className="pr-2 font-medium">IC 95%</th><th className="pr-2 font-medium">Resultado/entrada</th><th className="font-medium">Validação</th></tr></thead>
          <tbody>{row("Só confirmados", bt.confirmada.all, bt.confirmada.validation)}{row("Confirmados + parciais", bt.parcial.all, bt.parcial.validation)}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-ink">{bt.verdict}</p>
      <p className="mt-1 text-[11px] text-faint">{bt.note}</p>
    </div>
  );
}

function Cell({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-panel px-2 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-faint">{k}</div>
      <div className={cx("num mt-1 text-[18px] font-bold", tone)}>{v}</div>
      {hint && <div className="text-[10.5px] text-faint">{hint}</div>}
    </div>
  );
}
