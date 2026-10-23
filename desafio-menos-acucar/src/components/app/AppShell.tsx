"use client";

import { BookOpenText, ChartNoAxesColumn, Footprints, House, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { RequireSession } from "./RequireSession";
import { useSession } from "./SessionProvider";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/desafio", label: "Desafio", icon: Footprints },
  { href: "/guia", label: "Guia", icon: BookOpenText },
  { href: "/progresso", label: "Progresso", icon: ChartNoAxesColumn },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/progresso" && pathname.startsWith("/relatorio"));
}

function ModeBanner() {
  const { backend, data } = useSession();
  if (data?.profile.isSample) {
    return (
      <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-[#6b4510]">
        Você está vendo uma <strong>conta de exemplo</strong>. Os registros foram criados para demonstração.
      </div>
    );
  }
  if (backend?.mode === "demo") {
    return (
      <div className="bg-sand px-4 py-1.5 text-center text-xs text-muted">
        Modo demonstração: seus dados ficam salvos só neste navegador.
      </div>
    );
  }
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Navegação lateral (tablet/desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white px-4 py-6 md:flex">
        <Logo href="/inicio" className="px-2" />
        <nav aria-label="Principal" className="mt-10 grid gap-1">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors",
                  active ? "bg-fresh-50 text-forest" : "text-muted hover:bg-paper hover:text-ink",
                )}
              >
                <n.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">Conteúdo educativo. Não substitui orientação profissional.</p>
      </aside>

      <div className="min-w-0">
        <ModeBanner />
        <header className="flex h-14 items-center border-b border-line/70 bg-paper px-4 md:hidden">
          <Logo href="/inicio" />
        </header>
        <main id="conteudo" className="pb-safe-nav mx-auto w-full max-w-3xl px-4 pt-6 md:px-8 md:pt-10 md:pb-16">
          <RequireSession needsOnboarding={!pathname.startsWith("/admin")}>{() => children}</RequireSession>
        </main>
      </div>

      {/* Navegação inferior (celular) */}
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors", active ? "text-forest" : "text-muted")}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-fresh-100")}>
                    <n.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  </span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
