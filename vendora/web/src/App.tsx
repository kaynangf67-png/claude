import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Spinner } from './components/ui';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';

// Páginas internas carregadas sob demanda: a landing não baixa o editor nem o painel.
const Dashboard = lazy(() => import('./pages/app/Dashboard').then((m) => ({ default: m.Dashboard })));
const HistoryPage = lazy(() => import('./pages/app/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ListingPage = lazy(() => import('./pages/app/ListingPage').then((m) => ({ default: m.ListingPage })));
const NewListingPage = lazy(() => import('./pages/app/NewListingPage').then((m) => ({ default: m.NewListingPage })));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const fallback = (
  <div className="grid min-h-[40vh] place-items-center text-ink-400">
    <Spinner className="size-6" />
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={fallback}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/entrar" element={<AuthPage mode="login" />} />
            <Route path="/cadastro" element={<AuthPage mode="register" />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="novo" element={<NewListingPage />} />
              <Route path="anuncios/:id" element={<ListingPage />} />
              <Route path="historico" element={<HistoryPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
