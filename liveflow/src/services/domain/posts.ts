import { addDays, format } from 'date-fns';
import { z } from 'zod';
import { sanitizeText } from '@/lib/validation';
import { normalizeHashtags } from '@/services/caption';
import { checkLimit, PlanLimitError } from '@/services/plans';
import { stripBase } from '@/lib/utils';
import type { PlanTier, Post } from '@/types/domain';
import { notify, type ServiceContext } from './context';

export const TIKTOK_URL_RE = /^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/\S+$/i;

export const postSchema = z.object({
  video_id: z.string().min(1, 'Selecione um vídeo'),
  product_id: z.string().min(1, 'Selecione um produto'),
  caption: z.string().transform(sanitizeText).pipe(z.string().max(2200, 'Legenda acima de 2.200 caracteres')),
  hashtags: z.union([z.string(), z.array(z.string())]).transform((v) => normalizeHashtags(v)),
  format: z.enum(['maos', 'unboxing', 'antes_depois', 'comparativo', 'pov_texto', 'narracao']),
  scheduled_at: z.string().nullable(),
  notes: z.string().transform(sanitizeText).pipe(z.string().max(2000)).default(''),
});

export type PostInput = z.input<typeof postSchema>;

/** Publicação programada cujo horário já passou e ainda não foi marcada como publicada. */
export function isOverdue(post: Pick<Post, 'status' | 'scheduled_at'>, now = new Date()): boolean {
  return post.status === 'scheduled' && post.scheduled_at != null && new Date(post.scheduled_at) <= now;
}

export function postsService(ctx: ServiceContext) {
  const { repo } = ctx;

  async function ensureCapacity(plan: PlanTier, when: Date) {
    const { limit } = checkLimit(plan, 'postsPerMonth', 0);
    if (limit == null) return;
    const month = format(when, 'yyyy-MM');
    const all = await repo.list('posts');
    const count = all.filter((p) => (p.scheduled_at ?? p.created_at).startsWith(month)).length;
    if (count >= limit) throw new PlanLimitError('postsPerMonth', limit);
  }

  return {
    list: () => repo.list('posts', { orderBy: { column: 'scheduled_at', ascending: true } }),
    get: (id: string) => repo.get('posts', id),

    async create(input: PostInput, plan: PlanTier, opts: { asDraft?: boolean } = {}): Promise<Post> {
      const data = postSchema.parse(input);
      const scheduled = !opts.asDraft && data.scheduled_at != null;
      if (scheduled && new Date(data.scheduled_at!) < new Date(Date.now() - 60_000)) throw new Error('Escolha um horário futuro.');
      await ensureCapacity(plan, data.scheduled_at ? new Date(data.scheduled_at) : new Date());
      const post = await repo.insert('posts', {
        ...data,
        status: scheduled ? 'scheduled' : 'draft',
        published_url: null,
        published_at: null,
      });
      if (scheduled) await notify(ctx, 'post_scheduled', 'Publicação programada', data.caption.split('\n')[0].slice(0, 80), { type: 'post', id: post.id });
      return post;
    },

    async update(id: string, input: PostInput): Promise<Post> {
      const current = await repo.get('posts', id);
      if (!current) throw new Error('Publicação não encontrada');
      if (current.status === 'published') throw new Error('Publicações já feitas não podem ser editadas.');
      const data = postSchema.parse(input);
      const status = data.scheduled_at && current.status !== 'cancelled' ? 'scheduled' : current.status === 'scheduled' ? 'draft' : current.status;
      return repo.update('posts', id, { ...data, status });
    },

    async reschedule(id: string, when: Date) {
      return repo.update('posts', id, { scheduled_at: when.toISOString(), status: 'scheduled' });
    },

    /** Usuário confirma que postou no TikTok (com o link do produto). */
    async markPublished(id: string, url: string) {
      const clean = url.trim();
      if (!TIKTOK_URL_RE.test(clean)) throw new Error('Cole o link do vídeo no TikTok (https://www.tiktok.com/…).');
      const post = await repo.update('posts', id, { status: 'published', published_url: clean, published_at: new Date().toISOString() });
      if (post.video_id) {
        const video = await repo.get('videos', post.video_id);
        if (video) await repo.update('videos', video.id, { usage_count: video.usage_count + 1 });
      }
      await notify(ctx, 'post_published', 'Vídeo publicado', clean, { type: 'post', id });
      return post;
    },

    async cancel(id: string) {
      return repo.update('posts', id, { status: 'cancelled' });
    },

    async duplicate(id: string, plan: PlanTier) {
      const source = await repo.get('posts', id);
      if (!source) throw new Error('Publicação não encontrada');
      await ensureCapacity(plan, new Date());
      return repo.insert('posts', {
        ...stripBase(source),
        status: 'draft',
        scheduled_at: addDays(new Date(), 1).toISOString(),
        published_url: null,
        published_at: null,
      });
    },

    remove: (id: string) => repo.remove('posts', id),
  };
}
