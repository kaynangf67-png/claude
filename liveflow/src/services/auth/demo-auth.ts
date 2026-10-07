import { uuid } from '@/lib/utils';
import type { AuthService, AuthUser } from '@/services/data/types';

const USERS_KEY = 'liveflow:demo-users';
const SESSION_KEY = 'liveflow:demo-session';

interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

async function hash(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const DEMO_ACCOUNT = { email: 'demo@liveflow.app', password: 'liveflow-demo', fullName: 'Conta Demonstração' };

/**
 * Autenticação local para o modo demonstração (sem backend).
 * NÃO é segurança real: tudo vive no navegador. Serve para o app ser usável
 * offline e para demonstrar o fluxo. Com Supabase configurado, este serviço não é usado.
 */
export class DemoAuthService implements AuthService {
  readonly kind = 'demo' as const;
  private listeners = new Set<(u: AuthUser | null) => void>();

  private users(): StoredUser[] {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[];
    } catch {
      return [];
    }
  }

  private saveUsers(users: StoredUser[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  private setSession(user: AuthUser | null) {
    if (user) localStorage.setItem(SESSION_KEY, user.id);
    else localStorage.removeItem(SESSION_KEY);
    for (const l of this.listeners) l(user);
  }

  async getUser(): Promise<AuthUser | null> {
    const id = localStorage.getItem(SESSION_KEY);
    const u = this.users().find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, fullName: u.fullName } : null;
  }

  onChange(cb: (user: AuthUser | null) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    let u = this.users().find((x) => x.email === normalized);
    if (!u && normalized === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password) {
      await this.signUp(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password, DEMO_ACCOUNT.fullName);
      u = this.users().find((x) => x.email === normalized);
    }
    if (!u || (await hash(password, u.salt)) !== u.passwordHash) throw new Error('E-mail ou senha incorretos.');
    const user = { id: u.id, email: u.email, fullName: u.fullName };
    this.setSession(user);
    return user;
  }

  async signUp(email: string, password: string, fullName: string) {
    const normalized = email.trim().toLowerCase();
    const users = this.users();
    if (users.some((x) => x.email === normalized)) throw new Error('Já existe uma conta com este e-mail.');
    const salt = uuid();
    const stored: StoredUser = { id: uuid(), email: normalized, fullName, salt, passwordHash: await hash(password, salt) };
    this.saveUsers([...users, stored]);
    const user = { id: stored.id, email: stored.email, fullName };
    this.setSession(user);
    return { user, needsConfirmation: false };
  }

  async signOut() {
    this.setSession(null);
  }

  async sendPasswordReset(email: string) {
    // Sem servidor de e-mail no modo demo; o fluxo é apenas simulado na UI.
    void email;
  }

  async updatePassword(newPassword: string) {
    const current = await this.getUser();
    if (!current) throw new Error('Sessão expirada.');
    const users = this.users();
    const u = users.find((x) => x.id === current.id);
    if (!u) throw new Error('Usuário não encontrado.');
    u.salt = uuid();
    u.passwordHash = await hash(newPassword, u.salt);
    this.saveUsers(users);
  }
}
