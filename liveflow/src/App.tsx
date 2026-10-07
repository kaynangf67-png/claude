import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { ServicesProvider } from '@/contexts/services';
import { useProfile } from '@/hooks/queries';
import { AppLayout } from '@/layouts/AppLayout';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/products/ProductDetailPage'));
const VideosPage = lazy(() => import('@/pages/videos/VideosPage'));
const LivesPage = lazy(() => import('@/pages/lives/LivesPage'));
const LiveWizardPage = lazy(() => import('@/pages/lives/LiveWizardPage'));
const LiveDetailPage = lazy(() => import('@/pages/lives/LiveDetailPage'));
const SchedulePage = lazy(() => import('@/pages/SchedulePage'));
const AutomationsPage = lazy(() => import('@/pages/AutomationsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const ScriptGeneratorPage = lazy(() => import('@/pages/ScriptGeneratorPage'));
const CopilotPage = lazy(() => import('@/pages/CopilotPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Rota protegida: sem sessão → login (guardando o destino). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <ServicesProvider user={user}>{children}</ServicesProvider>;
}

/** Envia o usuário ao onboarding na primeira vez. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <FullScreenLoader />;
  if (profile && !profile.onboarding_completed) return <Navigate to="/boas-vindas" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/entrar" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/cadastro" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="/recuperar-senha" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/boas-vindas" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
          <Route
            element={
              <RequireAuth>
                <OnboardingGate>
                  <AppLayout />
                </OnboardingGate>
              </RequireAuth>
            }
          >
            <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
            <Route path="produtos" element={<Suspense fallback={<PageLoader />}><ProductsPage /></Suspense>} />
            <Route path="produtos/:id" element={<Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense>} />
            <Route path="videos" element={<Suspense fallback={<PageLoader />}><VideosPage /></Suspense>} />
            <Route path="lives" element={<Suspense fallback={<PageLoader />}><LivesPage /></Suspense>} />
            <Route path="lives/nova" element={<Suspense fallback={<PageLoader />}><LiveWizardPage /></Suspense>} />
            <Route path="lives/:id" element={<Suspense fallback={<PageLoader />}><LiveDetailPage /></Suspense>} />
            <Route path="agenda" element={<Suspense fallback={<PageLoader />}><SchedulePage /></Suspense>} />
            <Route path="automacoes" element={<Suspense fallback={<PageLoader />}><AutomationsPage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
            <Route path="ia/roteiros" element={<Suspense fallback={<PageLoader />}><ScriptGeneratorPage /></Suspense>} />
            <Route path="ia/copiloto" element={<Suspense fallback={<PageLoader />}><CopilotPage /></Suspense>} />
            <Route path="configuracoes" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
