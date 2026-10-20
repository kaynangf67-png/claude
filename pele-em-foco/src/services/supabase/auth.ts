import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthService, AuthUser, SignUpInput } from '../types';
import { translateError } from './errors';

const toUser = (u: User): AuthUser => ({ id: u.id, email: u.email ?? '', emailConfirmed: Boolean(u.email_confirmed_at) });

export class SupabaseAuthService implements AuthService {
  readonly kind = 'supabase' as const;
  constructor(private readonly db: SupabaseClient) {}

  async getUser() {
    const { data } = await this.db.auth.getSession();
    return data.session?.user ? toUser(data.session.user) : null;
  }

  onChange(cb: (user: AuthUser | null, event?: string) => void) {
    const { data } = this.db.auth.onAuthStateChange((event, session) => cb(session?.user ? toUser(session.user) : null, event));
    return () => data.subscription.unsubscribe();
  }

  async signUp({ email, password, displayName, acceptedDisclaimer }: SignUpInput) {
    const { data, error } = await this.db.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim(), accepted_disclaimer: acceptedDisclaimer ? 'true' : 'false' },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (error) throw translateError(error);
    // Com "confirmar e-mail" ligado, o Supabase não devolve sessão e, por segurança, não diz se o e-mail já existe.
    return { needsConfirmation: !data.session };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw translateError(error);
    return toUser(data.user);
  }

  async signOut() {
    const { error } = await this.db.auth.signOut();
    if (error) throw translateError(error);
  }

  async sendPasswordReset(email: string) {
    const { error } = await this.db.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (error) throw translateError(error);
  }

  async updatePassword(newPassword: string) {
    const { error } = await this.db.auth.updateUser({ password: newPassword });
    if (error) throw translateError(error);
  }
}
