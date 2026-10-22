import { cn } from "@/lib/cn";

export function ProgressBar({ value, label, className, tone = "forest" }: { value: number; label: string; className?: string; tone?: "forest" | "fresh" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-sand", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tone === "forest" ? "bg-forest" : "bg-fresh")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 96, stroke = 8, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sand)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-fresh)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
