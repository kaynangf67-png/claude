import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { DemoRepository } from '@/services/data/demo-repository';
import { DemoStorage } from '@/services/storage/demo-storage';
import { MockTikTokService } from '@/services/tiktok/mock';
import { buildCaption, composeCaption, normalizeHashtags } from '@/services/caption';
import { buildScript } from '@/services/ai/local';
import { PlanLimitError } from '@/services/plans';
import { seedDemoData } from '@/services/demo/seed';
import { createServices } from './index';
import { isOverdue } from './posts';

function setup(userId = 'u1') {
  const repo = new DemoRepository(userId);
  const services = createServices({ userId, repo, storage: new DemoStorage(userId), tiktok: new MockTikTokService() }, { id: userId, email: 'a@b.c', fullName: 'T' });
  return { repo, services };
}

async function fixtures(services: ReturnType<typeof setup>['services'], repo: DemoRepository) {
  const product = await services.products.create({ name: 'Fone', description: '', image_url: null, price: '100', promo_price: '', commission_rate: '10', category: 'Eletrônicos', product_url: '', sku: '', status: 'active' }, 'pro');
  const video = await repo.insert('videos', { product_id: product.id, name: 'V', storage_path: null, thumbnail_path: null, duration_seconds: 30, size_bytes: 1, mime_type: 'video/mp4', status: 'available', usage_count: 0, processing_status: 'ready' });
  return { product, video };
}

describe('legenda e hashtags', () => {
  it('normaliza hashtags', () => {
    expect(normalizeHashtags('#TikTokShop  #achadinhos, #Promoção #achadinhos')).toEqual(['tiktokshop', 'achadinhos', 'promocao']);
    expect(normalizeHashtags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
  });

  it('gera legenda com produto, preço e hashtags da categoria', () => {
    const { caption, hashtags } = buildCaption({ productName: 'Fone Bluetooth Pro', price: 149.9, category: 'Eletrônicos', format: 'unboxing' });
    expect(caption).toContain('Fone Bluetooth Pro');
    expect(caption).toContain('149,90');
    expect(hashtags).toContain('tiktokshop');
    expect(hashtags).toContain('tecnologia');
    expect(composeCaption(caption, hashtags)).toMatch(/#tiktokshop/);
  });

  it('roteiro sem rosto descreve cenas e não pede para falar para a câmera', () => {
    const s = buildScript({ productName: 'Fone', price: 100, benefits: 'a, b', audience: 'gamers', objective: 'vender', format: 'maos' });
    expect(s.script).toContain('Você não aparece');
    expect(s.script).not.toMatch(/pra câmera/i);
  });
});

describe('publicações', () => {
  beforeEach(() => localStorage.clear());

  it('programa, detecta atraso e registra publicação com link válido', async () => {
    const { services, repo } = setup();
    const { product, video } = await fixtures(services, repo);
    const post = await services.posts.create(
      { video_id: video.id, product_id: product.id, format: 'maos', caption: '<b>Olha</b> isso', hashtags: '#TikTokShop #achados', notes: '', scheduled_at: addDays(new Date(), 1).toISOString() },
      'free',
    );
    expect(post.status).toBe('scheduled');
    expect(post.caption).toBe('Olha isso');
    expect(post.hashtags).toEqual(['tiktokshop', 'achados']);
    expect(isOverdue(post)).toBe(false);
    expect(isOverdue({ ...post, scheduled_at: new Date(Date.now() - 1000).toISOString() })).toBe(true);

    await expect(services.posts.markPublished(post.id, 'https://evil.com/x')).rejects.toThrow(/link do vídeo/);
    const done = await services.posts.markPublished(post.id, 'https://www.tiktok.com/@eu/video/123');
    expect(done.status).toBe('published');
    expect((await repo.get('videos', video.id))?.usage_count).toBe(1);
    await expect(services.posts.update(post.id, { video_id: video.id, product_id: product.id, format: 'maos', caption: 'x', hashtags: [], notes: '', scheduled_at: null })).rejects.toThrow(/já feitas/);
  });

  it('rascunho sem horário e horário passado rejeitado', async () => {
    const { services, repo } = setup();
    const { product, video } = await fixtures(services, repo);
    const base = { video_id: video.id, product_id: product.id, format: 'maos' as const, caption: '', hashtags: [], notes: '' };
    expect((await services.posts.create({ ...base, scheduled_at: null }, 'free')).status).toBe('draft');
    await expect(services.posts.create({ ...base, scheduled_at: new Date(Date.now() - 3600_000).toISOString() }, 'free')).rejects.toThrow(/futuro/);
  });

  it('limite mensal do Free', async () => {
    const { services, repo } = setup();
    const { product, video } = await fixtures(services, repo);
    const when = addDays(new Date(), 1);
    await repo.insertMany('posts', Array.from({ length: 60 }, () => ({ video_id: video.id, product_id: product.id, format: 'maos' as const, caption: '', hashtags: [], notes: '', scheduled_at: when.toISOString(), status: 'scheduled' as const, published_url: null, published_at: null })));
    await expect(services.posts.create({ video_id: video.id, product_id: product.id, format: 'maos', caption: '', hashtags: [], notes: '', scheduled_at: when.toISOString() }, 'free')).rejects.toBeInstanceOf(PlanLimitError);
  });

  it('seed cria publicações publicadas, programadas, atrasada e métricas por publicação', async () => {
    const { services, repo } = setup();
    const r = await seedDemoData(repo);
    const posts = await services.posts.list();
    expect(posts).toHaveLength(r.posts);
    expect(posts.some((p) => p.status === 'published' && p.published_url)).toBe(true);
    expect(posts.filter((p) => isOverdue(p))).toHaveLength(1);
    const rows = await repo.list('analytics');
    expect(rows.some((x) => x.post_id)).toBe(true);
    const plan = await services.ai.chat([{ role: 'user', content: 'Monte meu plano de publicações da semana' }], 'pro');
    expect(plan).toContain('Plano de publicações');
  });
});
