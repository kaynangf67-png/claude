import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error" | "demo";

const styles: Record<Tone, string> = {
  info: "bg-fresh-50 border-fresh/30 text-forest-900",
  success: "bg-fresh-50 border-fresh/40 text-forest-900",
  error: "bg-danger-50 border-danger/25 text-danger",
  demo: "bg-amber-50 border-amber/30 text-[#6b4510]",
};

const icons: Record<Tone, ReactNode> = {
  info: <Info className="size-4 shrink-0" aria-hidden />,
  success: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
  error: <AlertCircle className="size-4 shrink-0" aria-hidden />,
  demo: <Info className="size-4 shrink-0" aria-hidden />,
};

export function Notice({ tone = "info", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed", styles[tone], className)}>
      <span className="mt-0.5">{icons[tone]}</span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
