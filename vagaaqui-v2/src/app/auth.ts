import { config, hasBackend } from '../config';

/**
 * Login opcional com Google via Supabase Auth (fluxo OAuth com redirecionamento).
 * Sem Supabase configurado, o app funciona com conta local anônima neste aparelho.
 */
export interface Session {
  access_token: string;
  email?: string;
  expires_at: number;
}

const KEY = 'vq2.session';

export function currentSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Session | null;
    return s && s.expires_at > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function emailFromJwt(token: string) {
  try {
    return (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { email?: string }).email;
  } catch {
    return undefined;
  }
}

/** Lê o token que o Supabase devolve no #hash após o login. */
export function captureAuthRedirect() {
  if (!location.hash.includes('access_token=')) return;
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('access_token');
  if (token) {
    const s: Session = { access_token: token, email: emailFromJwt(token), expires_at: Date.now() + Number(h.get('expires_in') || 3600) * 1000 };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }
  history.replaceState(null, '', location.pathname + location.search);
}

export function signInWithGoogle() {
  if (!hasBackend()) return;
  const redirect = location.origin + location.pathname;
  location.href = `${config.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
