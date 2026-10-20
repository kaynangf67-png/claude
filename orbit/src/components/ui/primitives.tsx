import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
        <Icon className="h-5 w-5 text-muted" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const tones = {
  neutral: "border-border-strong bg-surface-2 text-muted",
  accent: "border-accent/40 bg-accent-soft text-blue-300",
  success: "border-success/40 bg-success/10 text-green-300",
  warning: "border-warning/40 bg-warning/10 text-amber-300",
  danger: "border-danger/40 bg-danger/10 text-red-300",
  info: "border-info/40 bg-info/10 text-sky-300",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function Alert({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral">; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cn(title && "mt-1", "text-fg/85")}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-subtle" aria-hidden /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-subtle">{k}</dt>
          <dd className="mt-0.5 break-words text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{children}</code>;
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-muted">{JSON.stringify(value, null, 2)}</pre>;
}
