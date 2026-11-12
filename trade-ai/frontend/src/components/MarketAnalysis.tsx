import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Check, Clock, Loader2, Radar, X } from "lucide-react";
import type { Asset } from "../lib/markets";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type Horizon = "curto" | "swing";
export type SetupTf = "M1" | "M5" | "M15" | "H1" | "H4";
/** Tempos gráficos de cada tipo de operação e o que cada um usa de contexto. */
export const TF_OPTIONS: Record<Horizon, { tf: SetupTf; hint: string }[]> = {
  curto: [{ tf: "M1", hint: "M15 · M5 · M1" }, { tf: "M5", hint: "H1 · M15 · M5 · M1" }, { tf: "M15", hint: "H4 · H1 · M15 · M5" }],
  swing: [{ tf: "H1", hint: "D1 · H4 · H1 · M15" }, { tf: "H4", hint: "D1 · H4 · H1" }],
};
export const horizonOf = (tf: SetupTf): Horizon => (tf === "H1" || tf === "H4" ? "swing" : "curto");
/** "auto" = a IA compara os tempos do tipo de operação e recomenda o de setup mais forte agora. */
export type TfChoice = SetupTf | "auto";
export const DEFAULT_TF: Record<Horizon, SetupTf> = { curto: "M5", swing: "H1" };

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
  suggested?: { dir: "BUY" | "SELL"; entry: number; sl: number; tps: number[]; rr: number[]; riskPips: number; basis: string[] } | null;
  candle?: CandleLayer | { error: string } | null;
  autoPick?: { tf: SetupTf; reason: string; ranking: { tf: SetupTf; decision: string; state: ForexView["state"]; score: number | null; rr: number | null; dataOk: boolean }[] } | null;
}

interface CsStatsV { n: number; winRate: number | null; expR: number | null; pf: number | null }
/** Estratégias de vela (as 7 das operações rápidas) aplicadas ao tempo da entrada, com validação no histórico do par. */
interface CandleLayer {
  tf: "M15" | "H1" | "H4"; price: number; lastCandleBrt: string | null; ageMin: number | null;
  period: { from: string | null; to: string | null; days: number; candles: number }; costPips: number;
  rules: { targetR: number; maxHold: number };
  entry: { dir: "BUY" | "SELL"; entry: number; sl: number; tp: number; rr: number; riskPips: number; strategy: string; label: string; stats: CsStatsV; validation: CsStatsV & { n: number }; conds: string[] } | null;
  signals: { strategy: string; label: string; dir: "BUY" | "SELL"; validated: boolean }[];
  strategies: { strategy: string; label: string; validated: boolean; reason: string; n: number; winRate: number | null; expR: number | null; pf: number | null; devExpR: number | null; valExpR: number | null; valN: number }[];
}

const HZ: Record<Horizon, { title: string; sub: string }> = {
  curto: { title: "Day trade", sub: "minutos a horas · M1, M5, M15" },
  swing: { title: "Swing trade", sub: "pode durar dias · H1, H4" },
};

/** Analisar mercado: velas reais (sem print) pelo mesmo motor do escritório. Só indica a possível entrada; nada é executado. */
export function MarketAnalysis({ asset, horizon, tf, onChange, onPicked }: {
  asset: Asset; horizon: Horizon; tf: TfChoice;
  onChange: (h: Horizon, tf: TfChoice) => void;
  /** Tempo que a IA recomendou (para o gráfico acompanhar); null ao limpar. */
  onPicked: (tf: SetupTf | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ForexView | null>(null);
  const forex = asset.group === "Forex";

  useEffect(() => { setRes(null); setError(null); onPicked(null); }, [asset.id, tf, horizon]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (h: Horizon) => { if (h !== horizon) onChange(h, tf === "auto" ? "auto" : DEFAULT_TF[h]); };

  const run = async () => {
    setBusy(true); setError(null); setRes(null);
    try {
      const r = await fetch("/api/forex", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: asset.id, tf, horizon, explain: false, entry: true }) });
      const body = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
      if (!r.ok) throw new Error(body.error ?? `Erro ${r.status}`);
      setRes(body as ForexView);
      if ((body as ForexView).autoPick) onPicked((body as ForexView).autoPick!.tf);
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
            <div className="text-[11.5px] opacity-80">{HZ[h].sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Tempo gráfico da entrada</div>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Tempo gráfico">
          <button onClick={() => onChange(horizon, "auto")} aria-pressed={tf === "auto"} title="A IA analisa todos os tempos e recomenda o de setup mais forte agora"
            className={cx("rounded-lg border px-3.5 py-1.5 text-[13px] font-bold transition-colors",
              tf === "auto" ? "border-info bg-info/15 text-ink" : "border-line bg-panel text-mute hover:border-line-2 hover:text-ink")}>
            ✦ IA escolhe
          </button>
          {TF_OPTIONS[horizon].map((o) => (
            <button key={o.tf} onClick={() => onChange(horizon, o.tf)} aria-pressed={tf === o.tf} title={`Analisa com ${o.hint}`}
              className={cx("num rounded-lg border px-3.5 py-1.5 text-[13px] font-bold transition-colors",
                tf === o.tf ? "border-info bg-info/15 text-ink" : "border-line bg-panel text-mute hover:border-line-2 hover:text-ink")}>
              {o.tf}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[11.5px] text-faint">{tf === "auto"
          ? `A IA compara ${TF_OPTIONS[horizon].map((o) => o.tf).join(", ")} e recomenda o de setup mais forte agora (não é garantia de acerto).`
          : `Analisa com ${TF_OPTIONS[horizon].find((o) => o.tf === tf)?.hint}. O gráfico acima muda junto.`}</div>
      </div>

      <button onClick={run} disabled={!forex || busy}
        className="btn3d mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14.5px] font-extrabold tracking-[0.05em] text-[#03130a] disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <><Loader2 size={18} className="animate-spin" /> {tf === "auto" ? `COMPARANDO ${TF_OPTIONS[horizon].map((o) => o.tf).join(", ")}…` : `ANALISANDO ${asset.label}…`}</> : "GERAR ENTRADA · STOP E ALVO"}
      </button>
      {!forex && <p className="mt-2 text-[12px] text-warn">A análise de mercado funciona só para os pares de Forex. Escolha um par na aba Forex.</p>}

      {error && <div className="mt-4 flex gap-2 rounded-xl border border-sell/30 bg-sell/10 p-3 text-[13px] text-sell"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {res && <Verdict r={res} />}
    </section>
  );
}

function Verdict({ r }: { r: ForexView }) {
  const f = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Number(v).toFixed(r.label.includes("JPY") ? 3 : 5));
  const sg = r.suggested ?? null;
  const entry = (r.state === "entrada_confirmada" || r.state === "entrada_antecipada") && r.trade;
  const buy = (entry ? r.trade!.dir : sg ? sg.dir : r.watch?.dir) === "BUY";
  const swing = r.horizon === "swing";
  const title = entry || sg ? (buy ? "COMPRA" : "VENDA") : r.state === "aguardando_confirmacao" && r.watch ? `AGUARDANDO ${r.watch.dir === "BUY" ? "COMPRA" : "VENDA"}` : "SEM ENTRADA AGORA";
  const tone = entry || sg ? (buy ? "buy" : "sell") : "wait";
  const level = entry ? (r.state === "entrada_confirmada" ? "CONFIRMADA" : "ANTECIPADA") : sg ? "BAIXA CONVICÇÃO" : null;
  const m = r.trade?.maxHoldMin ?? 0;
  const hold = r.trade ? (swing ? `até ${Math.round(m / 1440)} dias` : m >= 60 ? `até ${String(m / 60).replace(".", ",")} h` : `até ${m} min`) : null;

  const ap = r.autoPick;
  const stTxt: Record<ForexView["state"], string> = { entrada_confirmada: "entrada", entrada_antecipada: "antecipada", aguardando_confirmacao: "aguardando", sem_operacao: "sem setup" };
  const cl = r.candle && !("error" in r.candle) ? r.candle : null;
  const engine = (
    <>
      {ap && (
        <div className="rounded-2xl border border-info/40 bg-info/10 p-3">
          <div className="text-[13.5px] font-bold text-ink">✦ Tempo recomendado pela IA: <span className="num">{ap.tf}</span></div>
          <div className="mt-0.5 text-[12px] text-mute">{ap.reason}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ap.ranking.map((x, i) => (
              <span key={x.tf} className={cx("num rounded-md border px-2 py-0.5 text-[11.5px]", i === 0 ? "border-info text-ink" : "border-line text-faint")}>
                {i + 1}º {x.tf} · {x.dataOk ? stTxt[x.state] : "sem dados"}{x.score !== null ? ` · ${x.score}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className={cx("flex items-center gap-4 rounded-2xl border p-4",
        tone === "wait" ? "border-line-2 bg-card-2" : tone === "buy" ? "border-buy/40 bg-buy/10" : "border-sell/40 bg-sell/10")}>
        <div className={cx("grid size-12 shrink-0 place-items-center rounded-2xl border",
          tone === "wait" ? "border-line bg-panel text-mute" : tone === "buy" ? "border-buy/40 text-buy" : "border-sell/40 text-sell")}>
          {tone === "wait" ? (r.state === "aguardando_confirmacao" ? <Clock size={22} /> : <Ban size={22} />) : buy ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
        </div>
        <div className="min-w-0">
          <div className={cx("text-[22px] font-extrabold leading-none", tone === "wait" ? "text-mute" : tone === "buy" ? "text-buy" : "text-sell")}>
            {title}{level && <span className={cx("ml-2 align-middle text-[11px] font-bold", level === "CONFIRMADA" ? "text-buy" : "text-warn")}>{level}</span>}
          </div>
          <div className="mt-1.5 text-[12.5px] text-mute">
            {r.label} · {swing ? "Swing trade" : "Day trade"}{r.roleTf && ` · ${r.roleTf.setup}`} · preço {f(r.price)}
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
      {!entry && sg && (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center sm:grid-cols-4">
            <Cell k="Entrada" v={f(sg.entry)} />
            <Cell k="Stop" v={f(sg.sl)} hint={`${sg.riskPips} pips`} tone="text-sell" />
            <Cell k="Alvo 1" v={f(sg.tps[0])} hint={`R:R ${sg.rr[0]}`} tone="text-buy" />
            <Cell k="Alvo 2" v={f(sg.tps[1])} hint={`R:R ${sg.rr[1]}`} tone="text-buy" />
          </div>
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn">
            Entrada de baixa convicção: nenhuma estratégia confirmou. Direção, stop e alvo vêm só da leitura do gráfico agora. Use valor pequeno.
          </div>
          <List title="Como foi definida" items={sg.basis} icon={<Check size={13} className="mt-0.5 shrink-0 text-mute" />} />
        </>
      )}
      {r.state === "aguardando_confirmacao" && r.watch && <p className="text-[12.5px] text-mute"><b className="text-ink">Esperar:</b> {r.watch.condition}</p>}

      <List title="A favor" items={r.favor.slice(0, 5)} icon={<Check size={13} className="mt-0.5 shrink-0 text-buy" />} />
      <List title="Contra" items={r.contra.slice(0, 5)} icon={<X size={13} className="mt-0.5 shrink-0 text-sell" />} />
      {!entry && <List title={sg ? "O que faltou para confirmar" : "Falta para liberar"} items={r.missing.slice(0, 4)} icon={<Clock size={13} className="mt-0.5 shrink-0 text-warn" />} />}
      {entry && r.invalidation && <p className="text-[12.5px] text-mute"><b className="text-ink">Invalidação:</b> {r.invalidation}</p>}
      <p className="text-[11px] text-faint">Pontuação é confluência técnica, não chance de acerto. Confira na sua corretora antes de operar: os preços (Yahoo) podem diferir alguns pips.</p>
    </>
  );
  return (
    <div className="animate-fade mt-4 space-y-3">
      {r.candle && "error" in r.candle && <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn">Estratégias de vela indisponíveis agora: {r.candle.error}</div>}
      {cl ? (
        <>
          <CandleBlock c={cl} digits={r.label.includes("JPY") ? 3 : 5} label={r.label} />
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-faint">Leitura do motor de confluência (não validada; só para consulta)</summary>
            <div className="mt-3 space-y-3">{engine}</div>
          </details>
        </>
      ) : engine}
      {!cl && r.roleTf && (r.roleTf.setup === "M1" || r.roleTf.setup === "M5") && <p className="text-[11.5px] text-warn">As estratégias validadas funcionam em M15, H1 e H4. Em {r.roleTf.setup} só existe a leitura do motor, sem validação.</p>}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const rr = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`);
const holdOf = (tf: CandleLayer["tf"], n: number) => (tf === "M15" ? `até ${n / 4} h` : tf === "H1" ? `até ${n} h` : `até ${(n * 4) / 24} dias`);

function CandleBlock({ c, digits, label }: { c: CandleLayer; digits: number; label: string }) {
  const f = (v: number) => v.toFixed(digits), e = c.entry, buy = e?.dir === "BUY";
  const ok = c.strategies.filter((s) => s.validated);
  return (
    <div className="space-y-3">
      {e ? (
        <>
          <div className={cx("flex items-center gap-4 rounded-2xl border p-4", buy ? "border-buy/40 bg-buy/10" : "border-sell/40 bg-sell/10")}>
            <div className={cx("grid size-12 shrink-0 place-items-center rounded-2xl border", buy ? "border-buy/40 text-buy" : "border-sell/40 text-sell")}>
              {buy ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
            </div>
            <div className="min-w-0">
              <div className={cx("text-[22px] font-extrabold leading-none", buy ? "text-buy" : "text-sell")}>
                {buy ? "COMPRA" : "VENDA"}<span className="ml-2 align-middle text-[11px] font-bold text-warn">PASSOU NO BACKTEST</span>
              </div>
              <div className="mt-1.5 text-[12.5px] text-mute">{label} · {c.tf} · {e.label} · vela fechada {c.lastCandleBrt}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center sm:grid-cols-4">
            <Cell k="Entrada" v={f(e.entry)} />
            <Cell k="Stop" v={f(e.sl)} hint={`${e.riskPips} pips`} tone="text-sell" />
            <Cell k="Alvo" v={f(e.tp)} hint={`R:R ${e.rr}`} tone="text-buy" />
            <Cell k="Prazo" v={holdOf(c.tf, c.rules.maxHold)} hint="sai no fechamento" />
          </div>
          <div className="rounded-xl border border-line bg-panel p-3 text-[12.5px] text-mute">
            <b className="text-ink">No histórico de {label} {c.tf}</b> ({c.period.days} dias, custo de {c.costPips} pips descontado):{" "}
            {e.stats.n} operações, {pct(e.stats.winRate)} positivas, média {rr(e.stats.expR)} por operação, fator de lucro {e.stats.pf?.toFixed(2) ?? "—"}.
            No período de validação (os 40% mais recentes, não usados para nada): {e.validation.n} operações, {rr(e.validation.expR)} por operação.
          </div>
          <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12px] text-warn">
            Atenção: nos 12 pares, em H1 e H4, só 3 de 168 combinações (estratégia × par × tempo) passaram no filtro, e a média geral foi negativa.
            Esse número de aprovações é o que se espera por sorte. Trate como hipótese a testar em conta demo, não como vantagem comprovada.
          </div>
          <List title="O que a estratégia viu" items={e.conds.slice(0, 5)} icon={<Check size={13} className="mt-0.5 shrink-0 text-buy" />} />
        </>
      ) : (
        <div className="rounded-2xl border border-line-2 bg-card-2 p-4">
          <div className="flex items-center gap-2 text-[15px] font-extrabold text-mute"><Ban size={18} /> Nenhuma estratégia validada confirmou agora no {c.tf}</div>
          <div className="mt-1 text-[12.5px] text-mute">
            {ok.length ? `Validadas em ${label} ${c.tf}: ${ok.map((s) => s.label).join(", ")}. Nenhuma delas confirmou na última vela fechada (${c.lastCandleBrt}).`
              : `Nenhuma das 7 estratégias passou no backtest de ${label} ${c.tf}. Entrar por elas aqui seria apostar sem vantagem medida.`}
            {c.signals.length > 0 && ` Confirmaram agora, mas sem validação: ${c.signals.map((s) => `${s.label} (${s.dir === "BUY" ? "compra" : "venda"})`).join(", ")}.`}
          </div>
        </div>
      )}
      <details className="rounded-xl border border-line bg-panel p-3 text-[12px]">
        <summary className="cursor-pointer font-semibold text-ink">Backtest das 7 estratégias em {label} {c.tf} ({c.period.days} dias)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="num w-full text-left">
            <thead className="text-faint"><tr><th className="py-1 pr-2">Estratégia</th><th className="pr-2">Ops</th><th className="pr-2">Positivas</th><th className="pr-2">Média</th><th className="pr-2">Validação</th><th>Situação</th></tr></thead>
            <tbody>
              {c.strategies.map((s) => (
                <tr key={s.strategy} className="border-t border-line">
                  <td className="py-1 pr-2">{s.label}</td><td className="pr-2">{s.n}</td><td className="pr-2">{pct(s.winRate)}</td>
                  <td className={cx("pr-2", (s.expR ?? 0) > 0 ? "text-buy" : "text-sell")}>{rr(s.expR)}</td>
                  <td className={cx("pr-2", (s.valExpR ?? 0) > 0 ? "text-buy" : "text-sell")}>{rr(s.valExpR)}</td>
                  <td className={s.validated ? "text-buy" : "text-faint"}>{s.validated ? "validada" : s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-faint">Regras fixas: entrada no fechamento da vela, stop além das últimas 5 velas (mín. 0,7 ATR), alvo {c.rules.targetR}R, prazo {c.rules.maxHold} velas. Com 7 estratégias testadas, uma pode passar por sorte: resultado passado não garante o futuro.</p>
      </details>
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
