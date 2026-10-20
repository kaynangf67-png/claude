"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CheckSquare, Database, Gauge, History, Plug, Rocket, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Painel", icon: Gauge },
  { href: "/missions", label: "Missões", icon: Rocket },
  { href: "/tasks", label: "Tarefas", icon: CheckSquare },
  { href: "/approvals", label: "Aprovações", icon: ShieldCheck, badge: "approvals" as const },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/data", label: "Dados", icon: Database },
  { href: "/integrations", label: "Integrações", icon: Plug },
  { href: "/audit", label: "Auditoria", icon: History },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Nav({ pendingApprovals }: { pendingApprovals: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-accent-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <i.icon className={cn("h-4 w-4", active ? "text-accent" : "text-subtle")} aria-hidden />
            <span className="flex-1">{i.label}</span>
            {i.badge && pendingApprovals > 0 ? (
              <span className="rounded-full bg-warning/15 px-2 text-xs font-medium text-amber-300" aria-label={`${pendingApprovals} pendentes`}>
                {pendingApprovals}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
