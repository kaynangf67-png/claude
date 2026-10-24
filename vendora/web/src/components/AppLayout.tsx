import { History, LayoutDashboard, LogOut, Menu, Plus, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Logo, Spinner } from './ui';

const NAV = [
  { to: '/app', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/app/novo', label: 'Novo anúncio', icon: Plus },
  { to: '/app/historico', label: 'Histórico', icon: History },
  { to: '/app/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppLayout() {
  const { user, loading, logout, meta } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center text-ink-500">
        <Spinner className="size-6" />
      </div>
    );
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
              isActive ? 'bg-white text-ink-950 shadow-[var(--shadow-soft)]' : 'text-ink-500 hover:bg-white/60 hover:text-ink-900'
            }`
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-ink-200/70 bg-ink-50 px-4 py-6 lg:flex lg:flex-col">
        <div className="px-2">
          <Logo to="/app" />
        </div>
        <div className="mt-8 flex-1">{nav}</div>
        {meta?.ai.provider === 'basic' && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            IA não configurada neste servidor. Os textos usam o gerador básico, que só reorganiza os dados.
          </p>
        )}
        <div className="flex items-center justify-between rounded-xl px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <button
            className="btn-ghost px-2"
            aria-label="Sair"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200/70 bg-ink-50/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo to="/app" />
        <button className="btn-ghost px-2" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && <div className="border-b border-ink-200 bg-ink-50 px-4 py-3 lg:hidden">{nav}</div>}

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
