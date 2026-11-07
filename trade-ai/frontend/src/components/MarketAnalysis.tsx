import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Check, Clock, Loader2, Radar, X } from "lucide-react";
import type { Asset } from "../lib/markets";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type Horizon = "curto" | "swing";

/** Só os campos de /api/forex que esta tela usa. */
interface ForexView {
  label: string; price: number; atBrt?: string;
  decision: "BUY" | "SELL" | "NO_TRADE";
  state: "entrada_confirmada" | "entrada_antecipada" | "aguardando_confirmacao" | "sem_operacao";
  horizon?: Horizon;
  roleTf?: { ctx: string; struct: string; setup: string; trigger: string };
  watch: { dir: "BUY" | "SELL"; condition: string } | null;
  chosen: { name: string } | null;
  trade: { dir: "BUY" | "SELL"; entry: number; sl: number; tps: (number | null)[]; rr: (number | null)[]; riskPips: number; maxHoldMin: number } | null;
  score: { total: number } | null;
  data: { ok: boolean; issues: string[] };
  favor: string[]; contra: string[]; missing: string[]; invalidation: string;
}

const HZ: Record<Horizon, { title: string; sub: string; tfs: string }> = {
  curto: { title: "Day trade", sub: "minutos a ~1 hora", tfs: "H1 · M15 · M5 · M1" },
  swing: { title: "Swing trade", sub: "pode durar dias", tfs: "D1 · H4 · H1 · M15" },
};

/** Analisar mercado: velas reais (sem print) pelo mesmo motor do escritório. Só indica a possível entrada; nada é executado. */
export function MarketAnalysis({ asset }: { asset: Asset }) {
  const [horizon, setHorizon] = useState<Horizon>(() => {
    try { return localStorage.getItem("ta-horizon") === "swing" ? "swing" : "curto"; } catch { return "curto"; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ForexView | null>(null);
  const forex = asset.group === "Forex";

  useEffect(() => { setRes(null); setError(null); }, [asset.id, horizon]);
  const pick = (h: Horizon) => { setHorizon(h); try { localStorage.setItem("ta-horizon", h); } catch { /* sem armazenamento */ } };

  const run = async () => {
    setBusy(true); setError(null); setRes(null);
    try {
      const r = await fetch("/api/forex", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: asset.id, horizon, explain: false }) });
      const body = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
      if (!r.ok) throw new Error(body.error ?? `Erro ${r.status}`);
      setRes(body as ForexView);
    } catch (e) {
      setError(e instanceof TypeError ? "Sem conexão com o servidor." : (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <section className="card3d animate-fade mt-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Radar size={18} className="text-info" />
        <h2 className="text-[15px] font-semibold">Analisar mercado · {asset.label}</h2>
        <span className="ml-auto text-[11.5px] text-faint">Velas reais · só análise, você opera na sua corretora</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de operação">
        {(Object.keys(HZ) as Horizon[]).map((h) => (
          <button key={h} onClick={() => pick(h)} aria-pressed={horizon === h}
            className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors",
              horizon === h ? "border-buy bg-buy/15 text-ink" : "border-line bg-panel text-mute hover:border-line-2 hover:text-ink")}>
            <div className="text-[14px] font-extrabold">{HZ[h].title}</div>
            <div className="text-[11.5px] opacity-80">{HZ[h].sub} · {HZ[h].tfs}</div>
          </button>
        ))}
      </div>

      <button onClick={run} disabled={!forex || busy}
        className="btn3d mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14.5px] font-extrabold tracking-[0.05em] text-[#03130a] disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <><Loader2 size={18} className="animate-spin" /> ANALISANDO {asset.label}…</> : "ANALISAR MERCADO PARA UMA POSSÍVEL ENTRADA"}
      </button>
      {!forex && <p className="mt-2 text-[12px] text-warn">A análise de mercado funciona só para os pares de Forex. Escolha um par na aba Forex.</p>}

      {error && <div className="mt-4 flex gap-2 rounded-xl border border-sell/30 bg-sell/10 p-3 text-[13px] text-sell"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {res && <Verdict r={res} />}
    </section>
  );
}

function Verdict({ r }: { r: ForexView }) {
  const f = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Number(v).toFixed(r.label.includes("JPY") ? 3 : 5));
  const entry = (r.state === "entrada_confirmada" || r.state === "entrada_antecipada") && r.trade;
  const buy = (r.trade?.dir ?? r.watch?.dir) === "BUY";
  const swing = r.horizon === "swing";
  const title = entry ? (buy ? "COMPRA" : "VENDA") : r.state === "aguardando_confirmacao" && r.watch ? `AGUARDANDO ${r.watch.dir === "BUY" ? "COMPRA" : "VENDA"}` : "SEM ENTRADA AGORA";
  const tone = entry ? (buy ? "buy" : "sell") : "wait";
  const hold = r.trade ? (swing ? `até ${Math.round(r.trade.maxHoldMin / 1440)} dias` : `até ${r.trade.maxHoldMin} min`) : null;

  return (
    <div className="animate-fade mt-4 space-y-3">
      <div className={cx("flex items-center gap-4 rounded-2xl border p-4",
        tone === "wait" ? "border-line-2 bg-card-2" : tone === "buy" ? "border-buy/40 bg-buy/10" : "border-sell/40 bg-sell/10")}>
        <div className={cx("grid size-12 shrink-0 place-items-center rounded-2xl border",
          tone === "wait" ? "border-line bg-panel text-mute" : tone === "buy" ? "border-buy/40 text-buy" : "border-sell/40 text-sell")}>
          {tone === "wait" ? (r.state === "aguardando_confirmacao" ? <Clock size={22} /> : <Ban size={22} />) : buy ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
        </div>
        <div className="min-w-0">
          <div className={cx("text-[22px] font-extrabold leading-none", tone === "wait" ? "text-mute" : tone === "buy" ? "text-buy" : "text-sell")}>
            {title}{r.state === "entrada_antecipada" && <span className="ml-2 text-[12px] text-warn">antecipada</span>}
          </div>
          <div className="mt-1.5 text-[12.5px] text-mute">
            {r.label} · {swing ? "Swing trade" : "Day trade"}{r.roleTf && ` (setup ${r.roleTf.setup})`} · preço {f(r.price)}
            {r.chosen && <> · {r.chosen.name}</>}{r.score && <> · confluência {r.score.total}/100</>}
          </div>
          {r.atBrt && <div className="text-[11px] text-faint">{r.atBrt} (Brasília)</div>}
        </div>
      </div>

      {!r.data.ok && <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn">Dados bloqueados: {r.data.issues.join(" | ")}</div>}

      {entry && r.trade && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center sm:grid-cols-4">
          <Cell k="Entrada" v={f(r.trade.entry)} />
          <Cell k="Stop" v={f(r.trade.sl)} hint={`${r.trade.riskPips} pips`} tone="text-sell" />
          <Cell k="Alvo 1" v={f(r.trade.tps[0])} hint={r.trade.rr[0] ? `R:R ${r.trade.rr[0]}` : undefined} tone="text-buy" />
          <Cell k="Duração" v={hold ?? "—"} hint={r.trade.tps[1] ? `alvo 2: ${f(r.trade.tps[1])}` : undefined} />
        </div>
      )}
      {r.state === "aguardando_confirmacao" && r.watch && <p className="text-[12.5px] text-mute"><b className="text-ink">Esperar:</b> {r.watch.condition}</p>}

      <List title="A favor" items={r.favor.slice(0, 5)} icon={<Check size={13} className="mt-0.5 shrink-0 text-buy" />} />
      <List title="Contra" items={r.contra.slice(0, 5)} icon={<X size={13} className="mt-0.5 shrink-0 text-sell" />} />
      {!entry && <List title="Falta para liberar" items={r.missing.slice(0, 4)} icon={<Clock size={13} className="mt-0.5 shrink-0 text-warn" />} />}
      {entry && r.invalidation && <p className="text-[12.5px] text-mute"><b className="text-ink">Invalidação:</b> {r.invalidation}</p>}
      <p className="text-[11px] text-faint">Pontuação é confluência técnica, não chance de acerto. Confira na sua corretora antes de operar: os preços (Yahoo) podem diferir alguns pips.</p>
    </div>
  );
}

function Cell({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-panel px-2 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-faint">{k}</div>
      <div className={cx("num mt-1 text-[17px] font-bold", tone)}>{v}</div>
      {hint && <div className="text-[10.5px] text-faint">{hint}</div>}
    </div>
  );
}

function List({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      <ul className="mt-1.5 space-y-1">{items.map((t) => <li key={t} className="flex gap-2 text-[13px] text-mute">{icon}{t}</li>)}</ul>
    </div>
  );
}
