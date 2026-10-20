import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Home, LogOut, NotebookPen, SunMoon, User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { DemoBanner } from './DemoBanner';
import { useBackend } from '../app/session';

const NAV = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/rotina', label: 'Minha rotina', short: 'Rotina', icon: SunMoon },
  { to: '/app/diario', label: 'Diário da pele', short: 'Diário', icon: NotebookPen },
  { to: '/app/aprender', label: 'Aprender', icon: BookOpen },
  { to: '/app/perfil', label: 'Perfil', icon: User },
];

export function AppLayout() {
  const { pathname } = useLocation();
  const { auth } = useBackend();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  // Troca de tela: volta ao topo e leva o foco do teclado/leitor de tela para o conteúdo novo.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <DemoBanner />
      <div className="app-frame">
        <aside className="sidebar" aria-label="Navegação principal">
          <div className="sidebar-brand"><Brand to="/app" /></div>
          <nav>
            <ul>
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end}>
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="sidebar-signout" onClick={() => void auth.signOut()}>
            <LogOut size={18} aria-hidden="true" /> Sair
          </button>
        </aside>

        <div className="app-column">
          <header className="app-header mobile-only">
            <div className="container"><Brand to="/app" /></div>
          </header>
          <main id="conteudo" className="app-main" tabIndex={-1} ref={mainRef}>
            <div className="container app-container">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <nav className="app-nav" aria-label="Navegação principal">
        <ul>
          {NAV.map(({ to, label, short, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} aria-label={label}>
                <Icon size={22} aria-hidden="true" />
                <span aria-hidden="true">{short ?? label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
