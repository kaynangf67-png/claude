import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Home, NotebookPen, ShoppingBag, SunMoon, User } from 'lucide-react';
import { useEffect } from 'react';
import { Brand } from './Brand';
import { Notice } from './ui';
import { useStore } from '../lib/store';

const NAV = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/rotina', label: 'Rotina', icon: SunMoon },
  { to: '/app/diario', label: 'Diário', icon: NotebookPen },
  { to: '/app/biblioteca', label: 'Aprender', icon: BookOpen },
  { to: '/app/produtos', label: 'Produtos', icon: ShoppingBag, desktopOnly: true },
  { to: '/app/perfil', label: 'Perfil', icon: User },
];

export function AppLayout() {
  const { data, persistent } = useStore();
  const { pathname } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  if (!data.onboardedAt) return <Navigate to="/app/boas-vindas" replace />;

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="app-header">
        <div className="container">
          <Brand to="/app" />
          <nav className="desktop-nav" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="conteudo" className="app-main">
        <div className="container">
          {!persistent && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <Notice tone="alert">Este navegador está bloqueando o armazenamento local (modo privado?). Suas marcações valem só até fechar a página.</Notice>
            </div>
          )}
          <Outlet />
        </div>
      </main>
      <nav className="app-nav" aria-label="Principal">
        <ul>
          {NAV.filter((n) => !n.desktopOnly).map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                <Icon size={22} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
