import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, LineChart, XCircle } from "lucide-react";
import type { Signal } from "../lib/types";
import { countdown, price, time } from "../lib/format";
import { useNow } from "../lib/live";
import { Badge, ScoreRing, SourceBadge, TimeframeTag, cx } from "./ui";

const STATUS: Record<Signal["status"], { label: string; tone: "buy" | "sell" | "info" | "mute" | "warn" }> = {
  ativo: { label: "Ativo", tone: "info" },
  executado: { label: "Executado (demo)", tone: "buy" },
  cancelado: { label: "Cancelado", tone: "sell" },
  expirado: { label: "Expirado", tone: "mute" },
};

export function OpportunityCard({ s, onExecute }: { s: Signal; onExecute?: (s: Signal) => void }) {
  const now = useNow();
  const long = s.direction === "long";
  const tone = long ? "buy" : "sell";
  const active = s.status === "ativo";
  const rows: [string, string, string][] = [
    ["Entrada", price(s.entry), "text-info"],
    ["Stop-loss", price(s.stop), "text-sell"],
    ["Alvo 1", price(s.tp1), "text-buy"],
    ["Alvo 2", price(s.tp2), "text-buy"],
  ];
  return (
    <article className={cx("group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card animate-fade transition-colors",
      active ? (long ? "border-buy/30 hover:border-buy/60" : "border-sell/30 hover:border-sell/60") : "border-line opacity-80")}>
      <div className={cx("absolute inset-x-0 top-0 h-[2px]", long ? "bg-buy" : "bg-sell", !active && "opacity-30")} />
      <header className="flex items-start gap-3 p-4 pb-3">
        <div className={cx("grid size-10 shrink-0 place-items-center rounded-xl", long ? "bg-buy-soft text-buy" : "bg-sell-soft text-sell")}>
          {long ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold">{s.symbol}</h3>
            <TimeframeTag />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-mute">{s.market_label}</span>
            <SourceBadge source={s.source} isLive={s.is_live} />
          </div>
        </div>
        <ScoreRing score={s.score} tone={tone} />
      </header>

      <div className="flex items-center justify-between px-4">
        <Badge tone={tone} className="px-2.5 py-1 text-[12.5px] tracking-[0.08em]">{s.decision}</Badge>
        <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
      </div>

      <dl className="mx-4 mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {rows.map(([k, v, c]) => (
          <div key={k} className="bg-panel px-3 py-2">
            <dt className="text-[10.5px] font-medium uppercase tracking-wider text-faint">{k}</dt>
            <dd className={cx("num mt-0.5 text-[14px] font-semibold", c)}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mx-4 mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
        <div><div className="text-faint">Risco/retorno</div><div className="num font-semibold">1:{s.rr1} · 1:{s.rr2}</div></div>
        <div><div className="text-faint">Identificado</div><div className="num font-semibold">{time(s.created_at, true)}</div></div>
        <div>
          <div className="text-faint">Validade</div>
          <div className={cx("num flex items-center gap-1 font-semibold", active ? "text-warn" : "text-mute")}>
            <Clock size={11} />{active ? countdown(s.valid_until, now) : time(s.valid_until)}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 text-[11.5px] text-mute">
        Região de entrada <span className="num text-ink">{price(s.zone_low)} – {price(s.zone_high)}</span>
      </div>

      <ul className="mx-4 mt-3 space-y-1">
        {s.reasons.slice(0, 4).map((r) => (
          <li key={r} className="flex gap-1.5 text-[12px] leading-snug text-mute">
            <CheckCircle2 size={13} className={cx("mt-px shrink-0", long ? "text-buy" : "text-sell")} />{r}
          </li>
        ))}
      </ul>

      <div className="mx-4 mt-3 flex items-start gap-1.5 rounded-lg bg-panel px-2.5 py-2 text-[11.5px] text-mute">
        {active ? <CheckCircle2 size={13} className="mt-px shrink-0 text-info" /> : <XCircle size={13} className="mt-px shrink-0 text-faint" />}
        <span>{active ? s.confirmation : s.status_reason || s.confirmation}</span>
      </div>

      <footer className="mt-auto flex gap-2 p-4">
        <Link to={`/analise/${encodeURIComponent(s.asset_key)}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-2 px-3 py-2 text-[12.5px] font-bold tracking-wide hover:bg-card-2">
          <LineChart size={14} /> VER ANÁLISE
        </Link>
        {onExecute && active && (
          <button onClick={() => onExecute(s)}
            className={cx("rounded-xl px-3 py-2 text-[12.5px] font-bold", long ? "bg-buy text-[#04130a]" : "bg-sell text-white")}>
            Executar demo
          </button>
        )}
      </footer>
    </article>
  );
}
