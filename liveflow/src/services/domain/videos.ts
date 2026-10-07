import { sanitizeText, validateVideoFile } from '@/lib/validation';
import { checkLimit, PlanLimitError } from '@/services/plans';
import type { PlanTier, Video } from '@/types/domain';
import { stripBase } from '@/lib/utils';
import { notify, type ServiceContext } from './context';

export interface VideoUploadMeta {
  durationSeconds: number;
  thumbnail: Blob | null;
}

export function videosService(ctx: ServiceContext) {
  const { repo, storage } = ctx;

  return {
    list: () => repo.list('videos', { orderBy: { column: 'created_at', ascending: false } }),
    get: (id: string) => repo.get('videos', id),

    async upload(
      file: File,
      opts: { name: string; productId: string | null; meta: VideoUploadMeta; plan: PlanTier; onProgress?: (pct: number) => void },
    ): Promise<Video> {
      const invalid = validateVideoFile(file);
      if (invalid) throw new Error(invalid);
      const count = await repo.count('videos');
      const { allowed, limit } = checkLimit(opts.plan, 'videos', count);
      if (!allowed && limit != null) throw new PlanLimitError('videos', limit);

      const storagePath = await storage.upload('video-files', file, { name: file.name, onProgress: opts.onProgress });
      const thumbPath = opts.meta.thumbnail
        ? await storage.upload('thumbnails', opts.meta.thumbnail, { name: 'thumb.jpg' }).catch(() => null)
        : null;

      const video = await repo.insert('videos', {
        product_id: opts.productId,
        name: sanitizeText(opts.name).slice(0, 160) || 'Vídeo sem nome',
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        duration_seconds: Math.round(opts.meta.durationSeconds),
        size_bytes: file.size,
        mime_type: file.type,
        status: 'available',
        usage_count: 0,
        // Ponto de integração: um job externo de transcodificação mudaria isto para
        // 'pending' e depois 'ready' via webhook.
        processing_status: 'ready',
      });
      await notify(ctx, 'video_uploaded', 'Vídeo enviado', video.name, { type: 'video', id: video.id });
      return video;
    },

    async rename(id: string, name: string) {
      const clean = sanitizeText(name).slice(0, 160);
      if (!clean) throw new Error('Informe um nome');
      return repo.update('videos', id, { name: clean });
    },

    async setProduct(id: string, productId: string | null) {
      return repo.update('videos', id, { product_id: productId });
    },

    async setStatus(id: string, status: Video['status']) {
      return repo.update('videos', id, { status });
    },

    /** Duplica a configuração (nome, produto) reaproveitando o mesmo arquivo. */
    async duplicate(id: string, plan: PlanTier) {
      const source = await repo.get('videos', id);
      if (!source) throw new Error('Vídeo não encontrado');
      const count = await repo.count('videos');
      const { allowed, limit } = checkLimit(plan, 'videos', count);
      if (!allowed && limit != null) throw new PlanLimitError('videos', limit);
      const rest = stripBase(source);
      return repo.insert('videos', { ...rest, name: `${source.name} (cópia)`.slice(0, 160), usage_count: 0, status: 'available' });
    },

    async remove(id: string) {
      const video = await repo.get('videos', id);
      if (!video) return;
      await repo.remove('videos', id);
      if (repo.kind === 'demo') {
        for (const table of ['lives', 'live_schedules'] as const) {
          const rows = await repo.list(table, { eq: { video_id: id } });
          for (const r of rows) await repo.update(table, r.id, { video_id: null });
        }
      }
      // Só apaga o arquivo se nenhuma cópia de configuração ainda o usa.
      const others = await repo.list('videos');
      if (video.storage_path && !others.some((v) => v.storage_path === video.storage_path)) {
        await storage.remove('video-files', video.storage_path).catch(() => undefined);
      }
      if (video.thumbnail_path && !others.some((v) => v.thumbnail_path === video.thumbnail_path)) {
        await storage.remove('thumbnails', video.thumbnail_path).catch(() => undefined);
      }
    },
  };
}
