import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../app/session';
import { Spinner } from './ui';
import { Brand } from './Brand';
import { AccessLocked } from './AccessLocked';

function FullPage({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card stack-lg">
        <Brand to="/" />
        {children}
      </div>
    </main>
  );
}

/** Build de produção sem Supabase e sem VITE_DEMO_MODE. */
export function Unconfigured() {
  return (
    <FullPage>
      <h1 className="h2">App em configuração</h1>
      <p className="muted">O servidor de contas ainda não foi conectado. Se você comprou o Pele em Foco, aguarde o e-mail com as instruções de acesso.</p>
    </FullPage>
  );
}

/** Rotas que exigem login. Sem sessão → /entrar (guardando o destino). */
export function RequireAuth() {
  const { backend, user, loadingUser, signedOut } = useSession();
  const location = useLocation();
  if (backend === 'unconfigured') return <Unconfigured />;
  if (!backend || loadingUser) return <FullPage><Spinner label="Abrindo o Pele em Foco…" /></FullPage>;
  if (!user) return <Navigate to="/entrar" replace state={signedOut ? undefined : { from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Telas de login/cadastro: quem já está logado vai direto ao app. */
export function GuestOnly() {
  const { backend, user, loadingUser, recoveringPassword } = useSession();
  const location = useLocation();
  if (backend === 'unconfigured') return <Unconfigured />;
  if (!backend || loadingUser) return <FullPage><Spinner /></FullPage>;
  if (user && !recoveringPassword) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/app') ? from : '/app'} replace />;
  }
  return <Outlet />;
}

/**
 * Bloqueia o conteúdo quando o acesso não está ativo. É só a camada visual:
 * quem realmente impede gravação e leitura é o RLS no banco.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const { access } = useSession();
  if (!access) return <Spinner label="Verificando seu acesso…" />;
  if (access.status !== 'active') return <AccessLocked />;
  return <>{children}</>;
}

/** Espera o backend e a sessão carregarem (ex.: página de redefinição de senha). */
export function RequireBackend() {
  const { backend, loadingUser } = useSession();
  if (backend === 'unconfigured') return <Unconfigured />;
  if (!backend || loadingUser) return <Spinner />;
  return <Outlet />;
}
