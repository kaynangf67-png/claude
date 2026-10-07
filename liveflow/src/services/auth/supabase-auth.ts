import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthService, AuthUser } from '@/services/data/types';

const toUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email ?? '',
  fullName: (u.user_metadata?.full_name as string | undefined) ?? '',
});

function translate(message: string): string {
  if (/invalid login/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(message)) return 'Já existe uma conta com este e-mail.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/rate limit/i.test(message)) return 'Muitas tentativas. Aguarde alguns minutos.';
  return message;
}

export class SupabaseAuthService implements AuthService {
  readonly kind = 'supabase' as const;

  constructor(private readonly db: SupabaseClient) {}

  async getUser() {
    const { data } = await this.db.auth.getSession();
    return data.session?.user ? toUser(data.session.user) : null;
  }

  onChange(cb: (user: AuthUser | null) => void) {
    const { data } = this.db.auth.onAuthStateChange((_event, session) => cb(session?.user ? toUser(session.user) : null));
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translate(error.message));
    return toUser(data.user);
  }

  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await this.db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw new Error(translate(error.message));
    return { user: data.user ? toUser(data.user) : null, needsConfirmation: !data.session };
  }

  async signOut() {
    await this.db.auth.signOut();
  }

  async sendPasswordReset(email: string) {
    const { error } = await this.db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw new Error(translate(error.message));
  }

  async updatePassword(newPassword: string) {
    const { error } = await this.db.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translate(error.message));
  }
}
