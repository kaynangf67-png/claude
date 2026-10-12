import { isSupabaseConfigured } from '@/lib/env';
import { LocalRepository } from './local';
import type { MenuRepository } from './repository';
import { SupabaseRepository } from './supabaseRepo';

let repo: MenuRepository | null = null;

export function getRepository(): MenuRepository {
  repo ??= isSupabaseConfigured ? new SupabaseRepository() : new LocalRepository();
  return repo;
}

export { RepositoryError, DEFAULT_PROJECT } from './repository';
export type { MenuRepository, ProjectInput, ProjectPatch } from './repository';
