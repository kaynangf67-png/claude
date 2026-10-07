import type { DataRepository, FileStorage } from '@/services/data/types';
import type { TikTokService } from '@/services/tiktok';
import type { NotificationType } from '@/types/domain';

export interface ServiceContext {
  userId: string;
  repo: DataRepository;
  storage: FileStorage;
  tiktok: TikTokService;
}

export async function notify(
  ctx: ServiceContext,
  type: NotificationType,
  title: string,
  body = '',
  entity?: { type: string; id: string },
) {
  await ctx.repo.insert('notifications', {
    type,
    title,
    body,
    entity_type: entity?.type ?? null,
    entity_id: entity?.id ?? null,
    read_at: null,
  });
}
