import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import { DemoRepository } from '@/services/data/demo-repository';
import { DemoStorage } from '@/services/storage/demo-storage';
import { MockTikTokService } from '@/services/tiktok/mock';
import { seedDemoData } from '@/services/demo/seed';
import { PlanLimitError } from '@/services/plans';
import { createServices } from './index';

function setup(userId = 'user-1') {
  const repo = new DemoRepository(userId);
  const services = createServices({ userId, repo, storage: new DemoStorage(userId), tiktok: new MockTikTokService() }, { id: userId, email: 'a@b.c', fullName: 'Teste' });
  return { repo, services };
}

const productInput = { name: 'Fone', description: '', image_url: null, price: '100', promo_price: '', commission_rate: '10', category: '', product_url: '', sku: '', status: 'active' as const };

describe('serviços de domínio (modo demo)', () => {
  beforeEach(() => localStorage.clear());

  it('isola dados por usuário', async () => {
    const a = setup('a');
    const b = setup('b');
    await a.services.products.create(productInput, 'free');
    expect(await a.services.products.list()).toHaveLength(1);
    expect(await b.services.products.list()).toHaveLength(0);
  });

  it('aplica limite do plano Free para produtos', async () => {
    const { services } = setup();
    for (let i = 0; i < 10; i++) await services.products.create({ ...productInput, name: `P${i}` }, 'free');
    await expect(services.products.create(productInput, 'free')).rejects.toBeInstanceOf(PlanLimitError);
    await expect(services.products.create(productInput, 'pro')).resolves.toBeTruthy();
  });

  it('duplica produto sem SKU e pausado', async () => {
    const { services } = setup();
    const p = await services.products.create({ ...productInput, sku: 'ABC' }, 'free');
    const copy = await services.products.duplicate(p.id, 'free');
    expect(copy.name).toBe('Fone (cópia)');
    expect(copy.sku).toBeNull();
    expect(copy.status).toBe('paused');
  });

  it('cria live única, recorrente e pausa automação', async () => {
    const { services, repo } = setup();
    const p = await services.products.create(productInput, 'free');
    const video = await repo.insert('videos', { product_id: p.id, name: 'V', storage_path: null, thumbnail_path: null, duration_seconds: 60, size_bytes: 1, mime_type: 'video/mp4', status: 'available', usage_count: 0, processing_status: 'ready' });
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const single = await services.lives.create(
      { video_id: video.id, product_id: p.id, title: 'Única', description: '', duration_minutes: 30, recurrence: { frequency: 'none', time: '20:00', startDate: tomorrow } },
      { plan: 'free' },
    );
    expect(single.lives).toHaveLength(1);
    expect(single.lives[0].status).toBe('scheduled');
    expect(single.lives[0].external_id).toMatch(/^mock_/);

    const rec = await services.lives.create(
      { video_id: video.id, product_id: p.id, title: 'Diária', description: '', duration_minutes: 30, recurrence: { frequency: 'weekly', weekdays: [1, 3], time: '20:00', startDate: tomorrow } },
      { plan: 'pro' },
    );
    expect(rec.automation?.is_active).toBe(true);
    expect(rec.automation?.next_run_at).toBeTruthy();
    expect(rec.lives.length).toBeGreaterThanOrEqual(7);
    expect((await repo.get('videos', video.id))?.usage_count).toBe(1 + rec.lives.length);

    // sync não duplica ocorrências
    await services.lives.sync();
    expect((await services.lives.list()).filter((l) => l.schedule_id).length).toBe(rec.lives.length);

    await services.lives.setAutomationActive(rec.automation!.id, false);
    const after = await services.lives.list();
    expect(after.filter((l) => l.schedule_id && l.status === 'scheduled')).toHaveLength(0);
  });

  it('limite mensal de lives é por mês-calendário (igual ao banco)', async () => {
    const { services, repo } = setup();
    const p = await services.products.create(productInput, 'free');
    const base = new Date();
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 10, 12);
    const rows = Array.from({ length: 30 }, (_, i) => ({ video_id: null, product_id: p.id, schedule_id: null, title: `L${i}`, description: '', starts_at: new Date(nextMonth.getTime() + i * 3600_000).toISOString(), duration_minutes: 30, status: 'scheduled' as const, external_id: null, error_message: null }));
    await repo.insertMany('lives', rows);
    const video = await repo.insert('videos', { product_id: p.id, name: 'V', storage_path: null, thumbnail_path: null, duration_seconds: 60, size_bytes: 1, mime_type: 'video/mp4', status: 'available', usage_count: 0, processing_status: 'ready' });
    const input = (date: Date) => ({ video_id: video.id, product_id: p.id, title: 'X', description: '', duration_minutes: 30, recurrence: { frequency: 'none' as const, time: '20:00', startDate: format(date, 'yyyy-MM-dd') } });
    // mês seguinte está cheio no Free…
    await expect(services.lives.create(input(nextMonth), { plan: 'free' })).rejects.toBeInstanceOf(PlanLimitError);
    // …mas o mês atual não é afetado por ele
    const tomorrow = addDays(new Date(), 1);
    if (tomorrow.getMonth() === base.getMonth()) await expect(services.lives.create(input(tomorrow), { plan: 'free' })).resolves.toBeTruthy();
  });

  it('sync marca lives passadas como finalizadas', async () => {
    const { services, repo } = setup();
    await repo.insert('lives', { video_id: null, product_id: null, schedule_id: null, title: 'Old', description: '', starts_at: new Date(Date.now() - 3 * 3600_000).toISOString(), duration_minutes: 30, status: 'scheduled', external_id: null, error_message: null });
    const res = await services.lives.sync();
    expect(res.updated).toBe(1);
    expect((await services.lives.list())[0].status).toBe('finished');
  });

  it('seed de demonstração cria uma conta completa e é idempotente', async () => {
    const { services, repo } = setup();
    const r1 = await seedDemoData(repo);
    const r2 = await seedDemoData(repo);
    expect(r2).toEqual(r1);
    expect((await services.products.list()).length).toBe(6);
    const lives = await services.lives.list();
    expect(lives.some((l) => l.status === 'running')).toBe(true);
    expect(lives.some((l) => l.status === 'scheduled')).toBe(true);
    // ainda dentro do limite mensal do Free (30) mesmo após materializar a automação
    await services.lives.sync();
    const byMonth = new Map<string, number>();
    for (const l of await services.lives.list()) byMonth.set(l.starts_at.slice(0, 7), (byMonth.get(l.starts_at.slice(0, 7)) ?? 0) + 1);
    expect(Math.max(...byMonth.values())).toBeLessThanOrEqual(30);
  });

  it('copiloto local responde usando os dados', async () => {
    const { services, repo } = setup();
    await seedDemoData(repo);
    const best = await services.ai.chat([{ role: 'user', content: 'Qual produto está performando melhor?' }], 'free');
    const ctx = await services.ai.buildContext();
    const top = [...ctx.products].sort((a, b) => b.last30d.revenue - a.last30d.revenue)[0];
    expect(best).toContain(`**${top.name}** lidera`);
    const hooks = await services.ai.chat([{ role: 'user', content: 'Crie 10 ganchos' }], 'free');
    expect(hooks.match(/^\d+\. /gm)?.length).toBe(10);
    const vars = await services.ai.generateVariations({ productName: 'Fone', price: 100, benefits: 'a, b', audience: 'gamers', objective: 'vender' }, 'free');
    expect(new Set(vars.map((v) => v.hook)).size).toBe(5);
  });
});
