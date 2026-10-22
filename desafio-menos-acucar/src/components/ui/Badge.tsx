import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "green" | "amber" | "forest";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink/80",
  green: "bg-fresh-100 text-forest-900",
  amber: "bg-amber-50 text-[#7a4f12]",
  forest: "bg-forest text-paper",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
