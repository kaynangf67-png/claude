import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Radio, Wifi, WifiOff } from "lucide-react";
import type { Decision } from "../lib/types";
import { SOURCE_LABEL, ago } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, action, pad = true }: {
  children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean;
}) {
  return (
    <section className={cx("min-w-0 rounded-2xl border border-line bg-card shadow-card animate-fade", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: "buy" | "sell" | "info" | "warn"; icon?: ReactNode;
}) {
  const toneCls = { buy: "text-buy", sell: "text-sell", info: "text-info", warn: "text-warn" }[tone ?? "info"];
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card animate-fade">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-mute">{label}</span>
        {icon && <span className={cx("grid size-7 place-items-center rounded-lg bg-card-2", toneCls)}>{icon}</span>}
      </div>
      <div className="num mt-2 text-[22px] font-semibold leading-none">{value}</div>
      {hint && <div className="mt-2 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "buy" | "sell" | "ghost" | "outline" | "danger";
export function Button({ variant = "outline", className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-info text-white hover:bg-info/90",
    buy: "bg-buy text-[#04130a] hover:bg-buy/90",
    sell: "bg-sell text-white hover:bg-sell/90",
    danger: "bg-sell/15 text-sell border border-sell/40 hover:bg-sell/25",
    ghost: "text-mute hover:text-ink hover:bg-card-2",
    outline: "border border-line-2 text-ink hover:bg-card-2",
  };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        v[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "mute", className }: {
  children: ReactNode; tone?: "buy" | "sell" | "info" | "warn" | "mute"; className?: string;
}) {
  const t = {
    buy: "bg-buy-soft text-buy border-buy/25",
    sell: "bg-sell-soft text-sell border-sell/25",
    info: "bg-info-soft text-info border-info/25",
    warn: "bg-warn-soft text-warn border-warn/30",
    mute: "bg-card-2 text-mute border-line-2",
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", t, className)}>
      {children}
    </span>
  );
}

export function DecisionPill({ decision, size = "md" }: { decision: Decision | null; size?: "md" | "lg" }) {
  if (!decision) return <Badge>—</Badge>;
  const tone = decision === "COMPRA" ? "buy" : decision === "VENDA" ? "sell" : "mute";
  return <Badge tone={tone} className={size === "lg" ? "px-2.5 py-1 text-[13px] tracking-wide" : "tracking-wide"}>{decision}</Badge>;
}

export function TimeframeTag() {
  return (
    <span className="num inline-flex items-center rounded-md border border-info/40 bg-info-soft px-1.5 py-0.5 text-[11px] font-bold text-info">
      M5
    </span>
  );
}

/** Fonte do dado e se é ao vivo. Dado simulado NUNCA aparece como ao vivo. */
export function SourceBadge({ source, isLive, stale }: { source: string; isLive: boolean; stale?: boolean }) {
  if (!isLive) return <Badge tone="warn"><AlertTriangle size={11} /> SIMULADO</Badge>;
  if (stale) return <Badge tone="warn"><WifiOff size={11} /> {SOURCE_LABEL[source] ?? source} · sem dados</Badge>;
  return <Badge tone="info"><Radio size={11} /> {SOURCE_LABEL[source] ?? source}</Badge>;
}

export function ScoreBar({ score, tone }: { score: number | null; tone?: "buy" | "sell" | "mute" }) {
  const s = score ?? 0;
  const color = tone === "buy" ? "bg-buy" : tone === "sell" ? "bg-sell" : "bg-faint";
  return (
    <div className="flex items-center gap-2" title="Confluência técnica (não é probabilidade de lucro)">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${s}%` }} />
      </div>
      <span className="num text-[12px] text-mute">{score ?? "—"}</span>
    </div>
  );
}

export function ScoreRing({ score, tone }: { score: number; tone: "buy" | "sell" | "mute" }) {
  const r = 22, c = 2 * Math.PI * r;
  const color = tone === "buy" ? "var(--color-buy)" : tone === "sell" ? "var(--color-sell)" : "var(--color-faint)";
  return (
    <div className="relative grid size-14 place-items-center" title="Confluência técnica (0–100). Não é probabilidade de lucro.">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <span className="num text-[15px] font-bold">{score}</span>
    </div>
  );
}

export function ConnDot({ state }: { state: "online" | "offline" | "conectando" }) {
  const map = {
    online: ["bg-buy text-buy", "Tempo real"],
    conectando: ["bg-warn text-warn", "Conectando"],
    offline: ["bg-sell text-sell", "Sem conexão"],
  } as const;
  const [cls, label] = map[state];
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-mute">
      <span className={cx("size-2 rounded-full", cls, state === "online" && "animate-pulse-dot")} />
      {state === "online" ? <Wifi size={13} /> : <WifiOff size={13} />}
      {label}
    </span>
  );
}

export function Freshness({ ts, now }: { ts: number | null; now: number }) {
  return <span className="num text-[11.5px] text-faint">{ago(ts, now)}</span>;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-line bg-card-2 text-mute">{icon}</div>
      <div className="text-[15px] font-semibold">{title}</div>
      {text && <div className="max-w-md text-[13px] leading-relaxed text-mute">{text}</div>}
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-mute">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line-2 bg-panel px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-info focus:outline-none";

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-panel p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx("rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors",
            value === o.value ? "bg-card-2 text-ink shadow-card" : "text-mute hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
