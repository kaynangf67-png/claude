import type { ReactNode } from 'react';
import { LayoutGrid, LogOut, Plus, Settings, UtensilsCrossed } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/env';

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutGrid, end: true },
  { to: '/projetos/novo', label: 'Novo cardápio', icon: Plus, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
];

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
        <UtensilsCrossed className="size-4" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-ink">Web Company</span>
        {!compact && <span className="block text-xs text-ink-faint">Menu Builder</span>}
      </span>
    </div>
  );
}

export function DemoBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="bg-warn-soft px-4 py-2 text-center text-[13px] text-warn">
      <strong className="font-semibold">Modo demonstração:</strong> dados salvos só neste navegador e extração por IA desativada.{' '}
      <NavLink to="/configuracoes" className="font-medium underline">Ver o que configurar</NavLink>
    </div>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-panel lg:flex" aria-label="Navegação principal">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-canvas hover:text-ink',
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <p className="truncate text-[13px] text-ink-soft" title={user?.email}>{user?.isDemo ? 'Usuário de demonstração' : user?.email}</p>
          {!user?.isDemo && (
            <button type="button" onClick={signOut} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink">
              <LogOut className="size-3.5" aria-hidden="true" /> Sair
            </button>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-4 backdrop-blur lg:hidden">
        <Brand compact />
        {!user?.isDemo && (
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft" aria-label="Sair">
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        )}
      </header>

      <DemoBanner />
      <main className="pb-24 lg:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-accent' : 'text-ink-faint')}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-5 sm:px-8 sm:pt-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
