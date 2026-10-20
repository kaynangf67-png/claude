import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './app/session';
import { AppLayout } from './components/AppLayout';
import { SiteLayout } from './components/SiteLayout';
import { GuestOnly, RequireAuth, RequireBackend } from './components/guards';
import { Landing } from './pages/site/Landing';
import { Obrigado } from './pages/site/Obrigado';
import { NotFound, Privacidade, Termos } from './pages/site/Legal';
import { AuthLayout } from './pages/auth/AuthLayout';
import { SignIn } from './pages/auth/SignIn';
import { SignUp } from './pages/auth/SignUp';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { Home } from './pages/app/Home';
import { Routine } from './pages/app/Routine';
import { Journal } from './pages/app/Journal';
import { Learn } from './pages/app/Learn';
import { ArticlePage } from './pages/app/ArticlePage';
import { ProductGuide } from './pages/app/ProductGuide';
import { Profile } from './pages/app/Profile';

// Build de pré-visualização (página única, sem controle da URL) usa roteamento em memória.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <SessionProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Landing />} />
            <Route path="obrigado" element={<Obrigado />} />
            <Route path="privacidade" element={<Privacidade />} />
            <Route path="termos" element={<Termos />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route element={<AuthLayout />}>
            <Route element={<GuestOnly />}>
              <Route path="entrar" element={<SignIn />} />
              <Route path="criar-conta" element={<SignUp />} />
              <Route path="recuperar-senha" element={<ForgotPassword />} />
            </Route>
            <Route element={<RequireBackend />}>
              <Route path="redefinir-senha" element={<ResetPassword />} />
            </Route>
          </Route>

          <Route path="app" element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="rotina" element={<Routine />} />
              <Route path="diario" element={<Journal />} />
              <Route path="aprender" element={<Learn />} />
              <Route path="aprender/guia-de-produtos" element={<ProductGuide />} />
              <Route path="aprender/:slug" element={<ArticlePage />} />
              <Route path="perfil" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </SessionProvider>
    </Router>
  );
}
