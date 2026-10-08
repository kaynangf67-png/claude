import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, User, X, LogIn, LogOut, Settings2, ClipboardCheck, Sparkles, Accessibility, Heart, ListPlus } from 'lucide-react';
import { Logo } from './Logo';
import { useApp } from '@/context/AppContext';

const LINKS = [
  { to: '/', label: 'Início', end: true },
  { to: '/filmes', label: 'Filmes' },
  { to: '/series', label: 'Séries' },
  { to: '/documentarios', label: 'Documentários' },
  { to: '/categorias', label: 'Categorias' },
  { to: '/minha-lista', label: 'Minha Lista' },
];

export function Navbar() {
  const { user, prefs, setPrefs, signOut, toast } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    setMenu(false);
    setDrawer(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) {
      setSearchOpen(false);
      return;
    }
    nav(`/busca?q=${encodeURIComponent(q.trim())}`);
  };

  const toggleLibras = () => {
    setPrefs({ interpreterEnabled: !prefs.interpreterEnabled });
    toast(!prefs.interpreterEnabled ? 'Intérprete de Libras ligado em todos os títulos compatíveis.' : 'Intérprete de Libras desligado por padrão.', 'success');
  };

  return (
    <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <button className="icon-btn nav-burger" aria-label="Abrir menu" onClick={() => setDrawer(true)}>
        <Menu size={20} />
      </button>
      <Link to="/" aria-label="LUMIA — início">
        <Logo />
      </Link>
      <nav className="nav-links" aria-label="Principal">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-right">
        <form className={`nav-search ${searchOpen ? 'open' : ''}`} role="search" onSubmit={submit}>
          <button
            type="button"
            aria-label={searchOpen ? 'Buscar' : 'Abrir busca'}
            onClick={() => {
              if (searchOpen && q.trim()) nav(`/busca?q=${encodeURIComponent(q.trim())}`);
              setSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <Search size={18} />
          </button>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Títulos, gêneros, países…" aria-label="Buscar no catálogo" onBlur={() => !q && setSearchOpen(false)} tabIndex={searchOpen ? 0 : -1} />
          {searchOpen && (
            <button type="button" aria-label="Fechar busca" onClick={() => (setQ(''), setSearchOpen(false))}>
              <X size={16} />
            </button>
          )}
        </form>
        <button className="nav-libras" aria-pressed={prefs.interpreterEnabled} onClick={toggleLibras} title="Intérprete de Libras ligado por padrão">
          <span aria-hidden>🤟</span>
          <span className="txt">Libras</span>
          <span className="dot" aria-hidden />
        </button>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="icon-btn" aria-label="Perfil" aria-expanded={menu} onClick={() => setMenu((m) => !m)} style={user ? { padding: 0, border: 0 } : undefined}>
            {user ? (
              <span className="avatar-dot" style={{ background: user.avatarColor }}>
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <User size={19} />
            )}
          </button>
          {menu && (
            <div className="menu" role="menu">
              {user ? (
                <div style={{ padding: '8px 12px 10px' }}>
                  <strong style={{ display: 'block' }}>{user.name}</strong>
                  <small className="muted">{user.provider === 'demo' ? 'Conta de demonstração' : user.email}</small>
                </div>
              ) : (
                <Link to="/entrar" role="menuitem">
                  <LogIn size={16} /> Entrar ou criar conta
                </Link>
              )}
              <hr />
              <Link to="/perfil" role="menuitem">
                <Settings2 size={16} /> Perfil e preferências
              </Link>
              <Link to="/minha-lista" role="menuitem">
                <ListPlus size={16} /> Minha Lista
              </Link>
              <Link to="/minha-lista#favoritos" role="menuitem">
                <Heart size={16} /> Favoritos
              </Link>
              <Link to="/acessibilidade" role="menuitem">
                <Accessibility size={16} /> Acessibilidade
              </Link>
              <Link to="/como-funciona" role="menuitem">
                <Sparkles size={16} /> Como funciona
              </Link>
              <Link to="/estudio" role="menuitem">
                <ClipboardCheck size={16} /> Estúdio de validação
              </Link>
              {user && (
                <>
                  <hr />
                  <button role="menuitem" onClick={() => (signOut(), toast('Você saiu da conta.'))}>
                    <LogOut size={16} /> Sair
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {drawer && (
        <>
          <div className="sheet-backdrop" onClick={() => setDrawer(false)} />
          <aside className="sheet" style={{ left: 0, right: 'auto', borderLeft: 0, borderRight: '1px solid var(--line-2)' }} aria-label="Menu">
            <div className="sheet-head">
              <Logo tagline />
              <button className="icon-btn" aria-label="Fechar menu" onClick={() => setDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <nav className="sheet-body menu" style={{ position: 'static', border: 0, background: 'none', boxShadow: 'none', animation: 'none' }}>
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}>
                  {l.label}
                </NavLink>
              ))}
              <hr />
              <Link to="/como-funciona">Como funciona</Link>
              <Link to="/acessibilidade">Acessibilidade</Link>
              <Link to="/estudio">Estúdio de validação</Link>
              <Link to="/perfil">Perfil</Link>
            </nav>
          </aside>
        </>
      )}
    </header>
  );
}
