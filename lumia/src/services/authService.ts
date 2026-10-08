/**
 * AUTH SERVICE — MOCK LOCAL.
 *
 * ⚠️ Não é autenticação real: contas ficam no localStorage deste navegador e
 * a senha é guardada como hash SHA-256 apenas para não ficar em texto puro.
 * Serve para demonstrar o fluxo (entrar, criar conta, perfil, preferências).
 *
 * TODO: FUTURE BACKEND INTEGRATION
 *   - Provedor de identidade real (OAuth 2.0 / OIDC) com "Continuar com Google"
 *     usando um VITE_GOOGLE_CLIENT_ID configurado;
 *   - sessões no servidor, verificação de e-mail, recuperação de senha.
 */
import type { PlanTier } from '@/business/plans';
import { loadRaw, remove, save } from './storage';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  plan: PlanTier;
  provider: 'local' | 'demo';
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
}

const COLORS = ['#ffb86b', '#7aa2ff', '#ff7aa8', '#5fe0c8', '#b18cff', '#ffd166'];

async function sha256(s: string) {
  if (!crypto?.subtle) return s.split('').reverse().join(''); // contexto inseguro (http): só ofusca
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function users(): StoredUser[] {
  return loadRaw<StoredUser[]>('auth:users', []);
}

export function currentUser(): User | null {
  const id = loadRaw<string | null>('auth:session', null);
  if (!id) return null;
  if (id === 'demo') return demoUser();
  const u = users().find((x) => x.id === id);
  if (!u) return null;
  const { passwordHash: _p, ...pub } = u;
  void _p;
  return pub;
}

export function demoUser(): User {
  return { id: 'demo', name: 'Visitante Demo', email: 'demo@lumia.local', avatarColor: '#7aa2ff', plan: 'FREE', provider: 'demo', createdAt: new Date(0).toISOString() };
}

export async function signUp(name: string, email: string, password: string): Promise<User> {
  email = email.trim().toLowerCase();
  if (name.trim().length < 2) throw new Error('Informe seu nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
  if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
  const all = users();
  if (all.some((u) => u.email === email)) throw new Error('Já existe uma conta com este e-mail neste navegador.');
  const u: StoredUser = {
    id: `u_${Date.now().toString(36)}`,
    name: name.trim(),
    email,
    avatarColor: COLORS[all.length % COLORS.length],
    plan: 'FREE',
    provider: 'local',
    createdAt: new Date().toISOString(),
    passwordHash: await sha256(password),
  };
  save('auth:users', [...all, u]);
  save('auth:session', u.id);
  const { passwordHash: _p, ...pub } = u;
  void _p;
  return pub;
}

export async function signIn(email: string, password: string): Promise<User> {
  email = email.trim().toLowerCase();
  const u = users().find((x) => x.email === email);
  if (!u || u.passwordHash !== (await sha256(password))) throw new Error('E-mail ou senha incorretos.');
  save('auth:session', u.id);
  const { passwordHash: _p, ...pub } = u;
  void _p;
  return pub;
}

export function signInDemo(): User {
  save('auth:session', 'demo');
  return demoUser();
}

export function signOut() {
  remove('auth:session');
}

export function updateProfile(id: string, patch: Partial<Pick<User, 'name' | 'avatarColor'>>): User | null {
  if (id === 'demo') return { ...demoUser(), ...patch };
  const all = users();
  const i = all.findIndex((u) => u.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  save('auth:users', all);
  const { passwordHash: _p, ...pub } = all[i];
  void _p;
  return pub;
}

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
export const AVATAR_COLORS = COLORS;
