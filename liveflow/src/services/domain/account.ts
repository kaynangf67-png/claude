import { sanitizeText, validateImageFile } from '@/lib/validation';
import type { Profile, UserPreferences } from '@/types/domain';
import type { ServiceContext } from './context';

export function accountService(ctx: ServiceContext, identity: { email: string; fullName: string }) {
  const { repo, storage, tiktok } = ctx;
  // Modo demonstração local não tem cobrança: simula o plano Pro para a demo ser explorável.
  const initialPlan = repo.kind === 'demo' ? 'pro' : 'free';

  return {
    /** No Supabase o profile nasce via trigger; no demo criamos sob demanda. */
    async getProfile(): Promise<Profile> {
      const [existing] = await repo.list('profiles', { limit: 1 });
      if (existing) return existing;
      return repo.insert('profiles', {
        full_name: identity.fullName,
        email: identity.email,
        avatar_url: null,
        plan: initialPlan,
        onboarding_completed: false,
        preferences: { notifyBeforeLive: true, notifyDailySummary: false, notifyErrors: true, defaultLiveDuration: 60 },
      });
    },

    async updateProfile(id: string, patch: { full_name?: string; avatar_url?: string | null; preferences?: UserPreferences; onboarding_completed?: boolean }) {
      const clean = { ...patch };
      if (clean.full_name != null) clean.full_name = sanitizeText(clean.full_name).slice(0, 120);
      return repo.update('profiles', id, clean);
    },

    async uploadAvatar(file: File): Promise<string> {
      const invalid = validateImageFile(file, 2 * 1024 * 1024);
      if (invalid) throw new Error(invalid);
      return storage.upload('avatars', file, { name: file.name });
    },

    listNotifications: (limit = 20) => repo.list('notifications', { orderBy: { column: 'created_at', ascending: false }, limit }),

    async markAllRead() {
      const unread = await repo.list('notifications', { eq: { read_at: null } });
      const now = new Date().toISOString();
      for (const n of unread) await repo.update('notifications', n.id, { read_at: now });
    },

    async getIntegration() {
      const [row] = await repo.list('integrations', { eq: { provider: 'tiktok' } });
      return row ?? null;
    },

    async connectTikTok() {
      const account = await tiktok.authenticate();
      const existing = await this.getIntegration();
      const data = {
        provider: 'tiktok' as const,
        status: 'connected' as const,
        account_name: account.displayName,
        scopes: account.scopes,
        connected_at: new Date().toISOString(),
      };
      return existing ? repo.update('integrations', existing.id, data) : repo.insert('integrations', data);
    },

    async disconnectTikTok() {
      await tiktok.disconnect();
      const existing = await this.getIntegration();
      if (existing) await repo.update('integrations', existing.id, { status: 'disconnected', account_name: null, scopes: [], connected_at: null });
    },
  };
}
