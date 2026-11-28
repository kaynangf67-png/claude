"use client";

import { House, Images, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Início", icon: House },
  { href: "/criar", label: "Criar", icon: Plus },
  { href: "/minhas-figurinhas", label: "Minhas figurinhas", short: "Minhas", icon: Images },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="glass pt-safe sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6">
          <Link href="/" aria-label="ZapSticker AI — início">
            <Logo />
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Principal">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active(n.href) ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto md:ml-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-12">{children}</main>
      <nav aria-label="Navegação" className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${on ? "text-brand" : "text-muted"}`}
              >
                {n.href === "/criar" ? (
                  <span className={`flex size-9 items-center justify-center rounded-full ${on ? "bg-brand text-[#04230f]" : "bg-surface-2 text-fg"}`}>
                    <Icon className="size-5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon className="size-6" strokeWidth={on ? 2.4 : 2} />
                )}
                {n.short ?? n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
