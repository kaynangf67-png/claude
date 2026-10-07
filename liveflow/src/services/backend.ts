import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { DemoAuthService } from '@/services/auth/demo-auth';
import { SupabaseAuthService } from '@/services/auth/supabase-auth';
import { DemoRepository } from '@/services/data/demo-repository';
import { SupabaseRepository } from '@/services/data/supabase-repository';
import type { AuthService, AuthUser } from '@/services/data/types';
import { createServices, type AppServices } from '@/services/domain';
import { DemoStorage } from '@/services/storage/demo-storage';
import { SupabaseStorage } from '@/services/storage/supabase-storage';
import { getTikTokService } from '@/services/tiktok';

/** Único lugar que decide entre modo demonstração (local) e Supabase. */
export const backendMode: 'demo' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'demo';

let auth: AuthService | null = null;

export function getAuth(): AuthService {
  auth ??= isSupabaseConfigured ? new SupabaseAuthService(getSupabase()) : new DemoAuthService();
  return auth;
}

export function servicesFor(user: AuthUser): AppServices {
  const tiktok = getTikTokService();
  if (isSupabaseConfigured) {
    const db = getSupabase();
    return createServices({ userId: user.id, repo: new SupabaseRepository(db, user.id), storage: new SupabaseStorage(db, user.id), tiktok }, user);
  }
  return createServices({ userId: user.id, repo: new DemoRepository(user.id), storage: new DemoStorage(user.id), tiktok }, user);
}
