import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-white shadow-card", className)} {...rest} />;
}

export function SectionTitle({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[0.8125rem] font-semibold tracking-[0.08em] text-muted uppercase">
        {title}
      </h2>
      {action}
    </div>
  );
}
