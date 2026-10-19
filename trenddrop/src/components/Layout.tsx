import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell, Calculator, Crown, Flame, Heart, LayoutDashboard, LogOut, Menu, Radar, Settings, ShoppingBag, Store, X, Music2, FlaskConical, HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApp } from '@/state/app';
import { useAlertEvents } from '@/state/hooks';
import { useAlertRunner } from '@/state/useAlertRunner';
import { Button } from './ui';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Inteligência',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
      { to: '/em-alta', label: 'Produtos em alta', icon: <Flame className="h-4 w-4" /> },
      { to: '/mais-vendidos', label: 'Mais vendidos', icon: <Crown className="h-4 w-4" /> },
      { to: '/radar', label: 'Radar Google Trends', icon: <Radar className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Marketplaces',
    items: [
      { to: '/mercado-livre', label: 'Mercado Livre', icon: <Store className="h-4 w-4" /> },
      { to: '/tiktok-shop', label: 'TikTok Shop', icon: <Music2 className="h-4 w-4" /> },
      { to: '/shopee', label: 'Shopee', icon: <ShoppingBag className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Operação',
    items: [
      { to: '/calculadora', label: 'Calculadora de lucro', icon: <Calculator className="h-4 w-4" /> },
      { to: '/favoritos', label: 'Favoritos', icon: <Heart className="h-4 w-4" /> },
      { to: '/alertas', label: 'Alertas', icon: <Bell className="h-4 w-4" /> },
      { to: '/configuracoes', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

const BOTTOM: NavItem[] = [
  { to: '/', label: 'Painel', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: '/em-alta', label: 'Em alta', icon: <Flame className="h-5 w-5" /> },
  { to: '/radar', label: 'Radar', icon: <Radar className="h-5 w-5" /> },
  { to: '/calculadora', label: 'Lucro', icon: <Calculator className="h-5 w-5" /> },
  { to: '/favoritos', label: 'Favoritos', icon: <Heart className="h-5 w-5" /> },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/30">
        <span className="absolute h-5 w-5 rounded-full border border-brand/40" />
        <span className="absolute h-2.5 w-2.5 rounded-full border border-brand/70" />
        <span className="h-1 w-1 rounded-full bg-brand-2 shadow-[0_0_8px_2px_rgba(74,222,128,.7)]" />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-bold tracking-tight text-ink">TrendDrop</span>
        <span className="block text-[10px] font-semibold tracking-[.22em] text-brand-2 uppercase">Radar</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-5">
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[.14em] text-ink-3 uppercase">{s.title}</div>
          <ul className="space-y-0.5">
            {s.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-brand/10 font-medium text-ink before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-brand' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={isActive ? 'text-brand-2' : 'text-ink-3'}>{it.icon}</span>
                      {it.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ModeCard() {
  const { mode, setDemo, session, signOut } = useApp();
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-ink">
        {mode === 'demo' ? <FlaskConical className="h-3.5 w-3.5 text-warn" /> : mode === 'local' ? <HardDrive className="h-3.5 w-3.5 text-info" /> : <span className="h-2 w-2 rounded-full bg-brand shadow-[0_0_6px_rgba(34,197,94,.8)]" />}
        {mode === 'demo' ? 'Modo demonstração' : mode === 'local' ? 'Modo local' : 'Conta conectada'}
      </div>
      <p className="mt-1 text-ink-3">
        {mode === 'demo' ? 'Dados fictícios.' : mode === 'local' ? 'Dados só neste navegador.' : session?.user.email}
      </p>
      <div className="mt-2 flex gap-1.5">
        {mode === 'demo' ? (
          <Button size="sm" variant="secondary" onClick={() => setDemo(false)}>Sair da demo</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setDemo(true)}>Ver demo</Button>
        )}
        {mode === 'supabase' && session && (
          <Button size="sm" variant="ghost" onClick={signOut} title="Sair"><LogOut className="h-3.5 w-3.5" /></Button>
        )}
      </div>
    </div>
  );
}

function Bellbutton() {
  const events = useAlertEvents();
  const unread = events.data?.filter((e) => !e.read).length ?? 0;
  return (
    <Link to="/alertas" className="relative rounded-lg p-2 text-ink-2 hover:bg-surface-3 hover:text-ink" aria-label={`Alertas${unread ? ` (${unread} não lidos)` : ''}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}

function ModeBanner() {
  const { mode, setDemo } = useApp();
  if (mode === 'demo')
    return (
      <div className="border-b border-warn/25 bg-warn/10 px-4 py-2 text-center text-xs text-warn">
        <strong>DEMONSTRAÇÃO</strong> — todos os produtos e números são fictícios e servem apenas para conhecer a ferramenta.{' '}
        <button className="underline underline-offset-2 hover:text-ink" onClick={() => setDemo(false)}>Voltar aos dados reais</button>
      </div>
    );
  if (mode === 'local')
    return (
      <div className="border-b border-info/20 bg-info/5 px-4 py-2 text-center text-xs text-info">
        Modo local: sem Supabase configurado, seus dados ficam apenas neste navegador e sem login. Veja Configurações para ativar contas.
      </div>
    );
  return null;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useAlertRunner();
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/80 backdrop-blur lg:flex">
        <div className="px-6 pt-5 pb-6"><Logo /></div>
        <div className="flex-1 overflow-y-auto px-3"><NavList /></div>
        <div className="p-3"><ModeCard /></div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-line bg-surface animate-fade-in">
            <div className="flex items-center justify-between px-5 pt-4 pb-5">
              <Logo />
              <button className="rounded-lg p-2 text-ink-2 hover:bg-surface-3" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3"><NavList onNavigate={() => setOpen(false)} /></div>
            <div className="p-3"><ModeCard /></div>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <button className="-ml-2 rounded-lg p-2 text-ink-2 hover:bg-surface-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <Logo className="lg:hidden" />
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-xs text-ink-3 sm:inline">Brasil · R$</span>
            <Bellbutton />
          </div>
        </div>
        <ModeBanner />
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        <Outlet />
      </main>

      {/* Navegação inferior mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {BOTTOM.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={it.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-2' : 'text-ink-3')}>
                {it.icon}
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
