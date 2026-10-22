import Link from "next/link";
import { cn } from "@/lib/cn";

/** Marca: um grão (gota) cortado por uma linha descendente — "menos". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-forest)" />
      <path d="M16 6.5c3.6 4.4 6.5 8.2 6.5 11.6a6.5 6.5 0 1 1-13 0c0-3.4 2.9-7.2 6.5-11.6Z" fill="var(--color-paper)" />
      <path d="M11.5 19.5h9" stroke="var(--color-fresh)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md", className)} aria-label="Desafio Menos Açúcar — página inicial">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] text-muted uppercase">Desafio</span>
          <span className="font-display block text-lg font-semibold tracking-tight text-forest">Menos Açúcar</span>
        </span>
      )}
    </Link>
  );
}
