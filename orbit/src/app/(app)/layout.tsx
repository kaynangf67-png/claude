import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand";
import { MobileNavToggle } from "@/components/ui/client";
import { Badge } from "@/components/ui/primitives";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { ROLE_LABEL } from "@/lib/domain/permissions";
import { signOutAction } from "../(auth)/actions";
import { switchOrgAction } from "./actions";
import { Nav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const db = await createUserClient();
  const [{ count }, { data: policy }] = await Promise.all([
    db.from("approvals").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("status", "pending").throwOnError(),
    db.from("org_policies").select("execution_paused").eq("org_id", ctx.orgId).maybeSingle().throwOnError(),
  ]);
  const pending = count ?? 0;

  const orgSwitcher =
    ctx.orgs.length > 1 ? (
      <form action={switchOrgAction} className="flex gap-2">
        <label htmlFor="org" className="sr-only">Organização</label>
        <select id="org" name="org_id" defaultValue={ctx.orgId} className="input h-8 py-0 text-xs">
          {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="text-xs text-accent hover:underline" type="submit">Trocar</button>
      </form>
    ) : (
      <p className="truncate text-sm font-medium text-fg">{ctx.orgName}</p>
    );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-surface/60 lg:flex lg:flex-col">
        <div className="flex h-14 items-center border-b border-border px-5"><Logo href="/dashboard" /></div>
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs text-subtle">Organização</p>
          <div className="mt-1">{orgSwitcher}</div>
          <p className="mt-1 text-xs text-muted">{ROLE_LABEL[ctx.role]}</p>
        </div>
        <div className="flex-1 p-3"><Nav pendingApprovals={pending} /></div>
        <div className="border-t border-border p-3">
          <p className="truncate px-3 text-xs text-subtle">{ctx.user.email}</p>
          <form action={signOutAction}>
            <button type="submit" className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="relative flex h-14 items-center justify-between border-b border-border bg-surface/60 px-4 lg:hidden">
          <Logo href="/dashboard" />
          <MobileNavToggle>
            <div className="mb-3 border-b border-border pb-3">{orgSwitcher}</div>
            <Nav pendingApprovals={pending} />
            <form action={signOutAction} className="mt-3 border-t border-border pt-3">
              <button type="submit" className="flex items-center gap-2 px-3 text-sm text-muted"><LogOut className="h-4 w-4" aria-hidden /> Sair</button>
            </form>
          </MobileNavToggle>
        </header>
        {policy?.execution_paused ? (
          <div role="alert" className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-center text-sm text-red-200">
            <Badge tone="danger">Parada de emergência ativa</Badge> <span className="ml-2">Nenhuma tarefa será executada até a retomada em Configurações.</span>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
