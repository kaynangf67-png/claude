import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Toasts } from '@/components/Toasts';
import HomePage from '@/pages/HomePage';

const BrowsePage = lazy(() => import('@/pages/BrowsePage'));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'));
const MyListPage = lazy(() => import('@/pages/MyListPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const TitlePage = lazy(() => import('@/pages/TitlePage'));
const WatchPage = lazy(() => import('@/pages/WatchPage'));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'));
const AccessibilityPage = lazy(() => import('@/pages/AccessibilityPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const StudioPage = lazy(() => import('@/pages/StudioPage'));

function NotFound() {
  return (
    <main className="page container">
      <div className="empty">
        <h1 className="serif" style={{ fontSize: 48 }}>
          Cena não encontrada
        </h1>
        <p>Essa página não existe.</p>
        <Link className="btn btn-ghost" to="/" style={{ marginTop: 14 }}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  const loc = useLocation();
  const watching = loc.pathname.startsWith('/assistir/');
  useEffect(() => {
    if (!loc.hash) window.scrollTo(0, 0);
    else setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 120);
  }, [loc.pathname, loc.hash]);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {!watching && <Navbar />}
      <Suspense fallback={<div className="page" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/filmes" element={<BrowsePage section="filmes" />} />
          <Route path="/series" element={<BrowsePage section="series" />} />
          <Route path="/documentarios" element={<BrowsePage section="documentarios" />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/categorias/:genre" element={<BrowsePage />} />
          <Route path="/minha-lista" element={<MyListPage />} />
          <Route path="/busca" element={<SearchPage />} />
          <Route path="/titulo/:slug" element={<TitlePage />} />
          <Route path="/assistir/:slug" element={<WatchPage />} />
          <Route path="/como-funciona" element={<HowItWorksPage />} />
          <Route path="/acessibilidade" element={<AccessibilityPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/estudio" element={<StudioPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toasts />
    </>
  );
}
