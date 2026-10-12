import { lazy, Suspense, type ReactNode } from 'react';
import type React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/ui';
import { ToastProvider } from '@/components/ui/toast';
// Cada área carrega sob demanda: quem abre um cardápio público não baixa o painel.
const PublicMenuPage = lazy(() => import('@/pages/PublicMenuPage'));
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));
const AppShell = named(() => import('@/components/layout/AppShell'), 'AppShell');
const LoginPage = named(() => import('@/pages/LoginPage'), 'LoginPage');
const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage');
const NewProjectPage = named(() => import('@/pages/NewProjectPage'), 'NewProjectPage');
const SettingsPage = named(() => import('@/pages/SettingsPage'), 'SettingsPage');
const NotFoundPage = named(() => import('@/pages/NotFoundPage'), 'NotFoundPage');
const ProjectLayout = named(() => import('@/pages/project/ProjectLayout'), 'ProjectLayout');
const InfoStep = named(() => import('@/pages/project/InfoStep'), 'InfoStep');
const AssetsStep = named(() => import('@/pages/project/AssetsStep'), 'AssetsStep');
const ExtractionStep = named(() => import('@/pages/project/ExtractionStep'), 'ExtractionStep');
const EditorStep = named(() => import('@/pages/project/EditorStep'), 'EditorStep');
const DesignStep = named(() => import('@/pages/project/DesignStep'), 'DesignStep');
const PublishStep = named(() => import('@/pages/project/PublishStep'), 'PublishStep');
const PreviewPage = named(() => import('@/pages/project/PreviewPage'), 'PreviewPage');

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/m/:slug" element={<PublicMenuPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projetos/:projectId/previa" element={<RequireAuth><PreviewPage /></RequireAuth>} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<DashboardPage />} />
              <Route path="projetos/novo" element={<NewProjectPage />} />
              <Route path="projetos/:projectId" element={<ProjectLayout />}>
                <Route index element={<Navigate to="dados" replace />} />
                <Route path="dados" element={<InfoStep />} />
                <Route path="materiais" element={<AssetsStep />} />
                <Route path="extracao" element={<ExtractionStep />} />
                <Route path="cardapio" element={<EditorStep />} />
                <Route path="aparencia" element={<DesignStep />} />
                <Route path="publicacao" element={<PublishStep />} />
              </Route>
              <Route path="configuracoes" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
