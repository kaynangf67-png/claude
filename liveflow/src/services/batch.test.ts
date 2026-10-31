import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import { DemoRepository } from '@/services/data/demo-repository';
import { DemoStorage } from '@/services/storage/demo-storage';
import { MockTikTokService } from '@/services/tiktok/mock';
import { createServices } from '@/services/domain';
import { PlanLimitError } from '@/services/plans';
import { FORMAT_KEYS } from '@/services/formats';
import { formatFor, MAX_BATCH, parseTimes, planSlots } from './batch';

const at = (d: string, t: string) => new Date(`${d}T${t}:00`);

describe('parseTimes', () => {
  it('aceita 12h, 9:30 e 18:00, ordena e remove repetidos', () => {
    expect(parseTimes('18:00, 12h 9:30 12:00')).toEqual({ times: ['09:30', '12:00', '18:00'], invalid: [] });
  });
  it('separa os inválidos', () => {
    expect(parseTimes('25:00 abc 7')).toEqual({ times: ['07:00'], invalid: ['25:00', 'abc'] });
  });
});

describe('planSlots', () => {
  const now = at('2026-11-02', '08:00'); // segunda-feira

  it('preenche os horários do dia antes de ir para o próximo', () => {
    const slots = planSlots({ count: 5, startDate: '2026-11-02', times: ['18:00', '12:00'], now });
    expect(slots.map((d) => format(d, 'dd HH:mm'))).toEqual(['02 12:00', '02 18:00', '03 12:00', '03 18:00', '04 12:00']);
  });

  it('pula horários que já passaram', () => {
    const slots = planSlots({ count: 2, startDate: '2026-11-02', times: ['07:00', '12:00'], now });
    expect(slots.map((d) => format(d, 'dd HH:mm'))).toEqual(['02 12:00', '03 07:00']);
  });

  it('pula fim de semana quando pedido', () => {
    const slots = planSlots({ count: 3, startDate: '2026-11-06', times: ['12:00'], skipWeekends: true, now });
    expect(slots.map((d) => format(d, 'EEE dd'))).toEqual(['Fri 06', 'Mon 09', 'Tue 10']);
  });

  it('não programa a menos de 30 min de uma publicação existente', () => {
    const slots = planSlots({ count: 2, startDate: '2026-11-02', times: ['12:00', '18:00'], busy: [at('2026-11-02', '12:20')], now });
    expect(slots.map((d) => format(d, 'dd HH:mm'))).toEqual(['02 18:00', '03 12:00']);
  });

  it('limita o tamanho do lote e lida com entrada vazia', () => {
    expect(planSlots({ count: 500, startDate: '2026-11-02', times: ['12:00'], now })).toHaveLength(MAX_BATCH);
    expect(planSlots({ count: 3, startDate: '2026-11-02', times: [], now })).toEqual([]);
  });

  it('alterna formatos', () => {
    expect(formatFor(0, 'alternar')).toBe(FORMAT_KEYS[0]);
    expect(formatFor(FORMAT_KEYS.length + 1, 'alternar')).toBe(FORMAT_KEYS[1]);
    expect(formatFor(3, 'unboxing')).toBe('unboxing');
  });
});

describe('posts.createBatch', () => {
  beforeEach(() => localStorage.clear());

  async function setup() {
    const repo = new DemoRepository('u1');
    const services = createServices({ userId: 'u1', repo, storage: new DemoStorage('u1'), tiktok: new MockTikTokService() }, { id: 'u1', email: 'a@b.c', fullName: 'T' });
    const product = await services.products.create({ name: 'Fone Bluetooth', description: '', image_url: null, price: '100', promo_price: '', commission_rate: '10', category: 'Eletrônicos', product_url: '', sku: '', status: 'active' }, 'pro');
    const video = await repo.insert('videos', { product_id: product.id, name: 'V', storage_path: null, thumbnail_path: null, duration_seconds: 30, size_bytes: 1, mime_type: 'video/mp4', status: 'available', usage_count: 0, processing_status: 'ready' });
    return { repo, services, product, video };
  }

  it('cria publicações programadas com legenda do produto', async () => {
    const { services, product, video } = await setup();
    const when = addDays(new Date(), 1);
    const created = await services.posts.createBatch(
      [0, 1, 2].map((i) => ({ video_id: video.id, product_id: product.id, format: formatFor(i, 'alternar'), scheduled_at: new Date(when.getTime() + i * 3_600_000).toISOString() })),
      'pro',
    );
    expect(created).toHaveLength(3);
    expect(created.every((p) => p.status === 'scheduled')).toBe(true);
    expect(created[0].caption).toContain('Fone Bluetooth');
    expect(created[0].hashtags).toContain('tiktokshop');
    expect(new Set(created.map((p) => p.format)).size).toBe(3);
  });

  it('é tudo ou nada: um item inválido não grava nenhum', async () => {
    const { services, product, video, repo } = await setup();
    const ok = { video_id: video.id, product_id: product.id, format: 'maos' as const, scheduled_at: addDays(new Date(), 1).toISOString() };
    await expect(services.posts.createBatch([ok, { ...ok, product_id: 'nao-existe' }], 'pro')).rejects.toThrow('Item 2');
    await expect(services.posts.createBatch([ok, { ...ok, scheduled_at: addDays(new Date(), -1).toISOString() }], 'pro')).rejects.toThrow('passado');
    expect(await repo.count('posts')).toBe(0);
  });

  it('respeita o limite mensal do plano somando o lote', async () => {
    const { services, product, video, repo } = await setup();
    // Free = 60/mês. Tudo num mesmo mês futuro para o teste não depender da data de hoje.
    const month = format(addDays(new Date(), 400), 'yyyy-MM');
    const sameMonth = Array.from({ length: 59 }, (_, i) => ({ video_id: video.id, product_id: product.id, format: 'maos' as const, scheduled_at: new Date(new Date(`${month}-10T10:00:00`).getTime() + i * 60_000).toISOString() }));
    await services.posts.createBatch(sameMonth, 'free');
    await expect(services.posts.createBatch(sameMonth.slice(0, 2), 'free')).rejects.toBeInstanceOf(PlanLimitError);
    expect(await repo.count('posts')).toBe(59);
  });
});
