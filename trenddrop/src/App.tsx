import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Skeleton } from './components/ui';
import { useApp } from './state/app';
import LoginPage from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trending = lazy(() => import('./pages/Trending'));
const BestSellers = lazy(() => import('./pages/BestSellers'));
const TrendsRadar = lazy(() => import('./pages/TrendsRadar'));
const MercadoLivre = lazy(() => import('./pages/MercadoLivre'));
const TikTok = lazy(() => import('./pages/TikTok'));
const Shopee = lazy(() => import('./pages/Shopee'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const CalculatorPage = lazy(() => import('./pages/Calculator'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Alerts = lazy(() => import('./pages/Alerts'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function App() {
  const { repo, authReady } = useApp();
  if (!authReady) return <div className="flex min-h-screen items-center justify-center"><Skeleton className="h-10 w-48" /></div>;
  if (!repo) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
        <Route path="em-alta" element={<Suspense fallback={<PageFallback />}><Trending /></Suspense>} />
        <Route path="mais-vendidos" element={<Suspense fallback={<PageFallback />}><BestSellers /></Suspense>} />
        <Route path="radar" element={<Suspense fallback={<PageFallback />}><TrendsRadar /></Suspense>} />
        <Route path="mercado-livre" element={<Suspense fallback={<PageFallback />}><MercadoLivre /></Suspense>} />
        <Route path="tiktok-shop" element={<Suspense fallback={<PageFallback />}><TikTok /></Suspense>} />
        <Route path="shopee" element={<Suspense fallback={<PageFallback />}><Shopee /></Suspense>} />
        <Route path="produto/:id" element={<Suspense fallback={<PageFallback />}><ProductDetail /></Suspense>} />
        <Route path="calculadora" element={<Suspense fallback={<PageFallback />}><CalculatorPage /></Suspense>} />
        <Route path="favoritos" element={<Suspense fallback={<PageFallback />}><Favorites /></Suspense>} />
        <Route path="alertas" element={<Suspense fallback={<PageFallback />}><Alerts /></Suspense>} />
        <Route path="configuracoes" element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
