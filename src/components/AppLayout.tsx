import { Gem, HandCoins, LayoutDashboard, LogOut, Store, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { computeMetrics, withAnalysis } from '../lib/metrics';
import { actions, useAppState } from '../lib/store';
import { Logo } from './ui';

const NAV = [
  { to: '/app', label: 'Painel', short: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/app/recuperar', label: 'Recuperar vendas', short: 'Recuperar', icon: HandCoins, badge: true },
  { to: '/app/leads', label: 'Leads', short: 'Leads', icon: Users },
  { to: '/app/empresa', label: 'Minha empresa', short: 'Empresa', icon: Store },
  { to: '/app/planos', label: 'Planos', short: 'Planos', icon: Gem },
];

export function AppLayout() {
  const { user, business, leads } = useAppState();
  const navigate = useNavigate();
  const pending = useMemo(
    () => (business ? computeMetrics(withAnalysis(leads, business)).pendingFollowups : 0),
    [leads, business],
  );

  if (!user) return <Navigate to="/" replace />;
  if (!business) return <Navigate to="/onboarding" replace />;

  function logout() {
    actions.logout();
    navigate('/');
  }

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink px-4 py-5 text-slate-300 lg:flex">
        <Link to="/app" className="px-2">
          <Logo light />
        </Link>
        <div className="mt-6 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Empresa</p>
          <p className="truncate text-sm font-semibold text-white">{business.name}</p>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white text-ink' : 'hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="size-[18px]" />
              <span className="flex-1">{item.label}</span>
              {item.badge && pending > 0 && (
                <span className="num rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-xl bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200 ring-1 ring-amber-300/20">
          <p className="font-semibold">Modo demonstração</p>
          <p className="mt-0.5 text-amber-100/70">Nenhuma mensagem real é enviada. Dados salvos neste navegador.</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 hover:bg-white/10" aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/app">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Demo
          </span>
          <button onClick={logout} className="btn-ghost p-2" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <Outlet />
      </main>

      {/* Navegação inferior mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive ? 'text-brand-700' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="size-5" />
            {item.short}
            {item.badge && pending > 0 && (
              <span className="num absolute right-[calc(50%-20px)] top-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
