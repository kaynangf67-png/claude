import { beforeEach, describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, parseDate, parseNumber } from '@/lib/csv';
import { DemoRepository } from '@/services/data/demo-repository';
import { DemoStorage } from '@/services/storage/demo-storage';
import { MockTikTokService } from '@/services/tiktok/mock';
import { createServices } from '@/services/domain';
import { buildImportPlan, guessMapping, matchProduct, tiktokVideoId } from './importer';

describe('csv', () => {
  it('detecta separador e respeita aspas, BOM e quebras dentro de aspas', () => {
    const text = '﻿Data;Produto;Valor\n01/10/2026;"Fone ""Pro""; preto";"R$ 1.234,56"\n02/10/2026;"Linha\nquebrada";10\n';
    expect(detectDelimiter(text)).toBe(';');
    expect(parseCsv(text)).toEqual([
      ['Data', 'Produto', 'Valor'],
      ['01/10/2026', 'Fone "Pro"; preto', 'R$ 1.234,56'],
      ['02/10/2026', 'Linha\nquebrada', '10'],
    ]);
  });

  it('números BR e internacionais', () => {
    expect(parseNumber('R$ 1.234,56')).toBe(1234.56);
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('149,90')).toBe(149.9);
    expect(parseNumber('1.234')).toBe(1234);
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('1.234.567')).toBe(1234567);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('')).toBeNull();
  });

  it('datas', () => {
    expect(parseDate('07/10/2026 21:30')).toBe('2026-10-07');
    expect(parseDate('2026-10-07T21:30:00Z')).toBe('2026-10-07');
    expect(parseDate('7/1/26')).toBe('2026-01-07');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('ontem')).toBeNull();
  });
});

describe('mapeamento e plano', () => {
  it('adivinha colunas sem confundir comissão com valor nem views de vídeo com link', () => {
    const m = guessMapping(['Data do pedido', 'Nome do produto', 'SKU', 'Quantidade', 'Valor total (R$)', 'Comissão estimada', 'Visualizações do vídeo', 'Link do vídeo']);
    expect(m).toMatchObject({ date: 0, product: 1, sku: 2, units: 3, revenue: 4, commission: 5, views: 6, videoUrl: 7 });
  });

  it('casa produto por SKU, nome exato e nome contido (só se inequívoco)', () => {
    const products = [{ id: 'a', name: 'Fone Bluetooth Pro', sku: 'FON-1' }, { id: 'b', name: 'Mini Projetor', sku: null }, { id: 'c', name: 'Mini Projetor 4K', sku: null }];
    expect(matchProduct(products, 'qualquer', 'fon-1')).toBe('a');
    expect(matchProduct(products, 'fone bluetooth pró', null)).toBe('a');
    expect(matchProduct(products, 'Fone Bluetooth Pro - Preto', null)).toBe('a');
    expect(matchProduct(products, 'Mini', null)).toBeNull(); // ambíguo
    expect(tiktokVideoId('https://www.tiktok.com/@x/video/7400000000000000001?lang=pt')).toBe('7400000000000000001');
  });

  it('valida e reporta linhas ruins sem derrubar o resto', () => {
    const table = parseCsv('data,produto,pedidos,valor\n01/10/2026,Fone,2,"200,00"\nxx,Fone,1,10\n02/10/2026,,1,10\n');
    const plan = buildImportPlan(table, guessMapping(table[0]), { products: [{ id: 'p', name: 'Fone', sku: null, commission_rate: 10 }], posts: [] });
    expect(plan.rows).toHaveLength(1);
    expect(plan.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(plan.totals).toMatchObject({ orders: 2, revenue: 200, commission: 20 });
    expect(plan.commissionEstimated).toBe(true);
  });
});

describe('importação (modo demo)', () => {
  beforeEach(() => localStorage.clear());

  it('importa, cria produto ausente, liga à publicação e não duplica ao reimportar', async () => {
    const repo = new DemoRepository('u');
    const s = createServices({ userId: 'u', repo, storage: new DemoStorage('u'), tiktok: new MockTikTokService() }, { id: 'u', email: 'a@b.c', fullName: 'T' });
    const fone = await s.products.create({ name: 'Fone Bluetooth Pro', description: '', image_url: null, price: '100', promo_price: '', commission_rate: '10', category: '', product_url: '', sku: '', status: 'active' }, 'pro');
    const post = await repo.insert('posts', { video_id: null, product_id: fone.id, caption: '', hashtags: [], format: 'maos', scheduled_at: '2026-10-01T12:00:00Z', status: 'published', published_url: 'https://www.tiktok.com/@eu/video/7400000000000000001', published_at: '2026-10-01T12:00:00Z', notes: '' });

    const csv = [
      'Data;Produto;Pedidos;Faturamento;Link do vídeo',
      '01/10/2026;Fone Bluetooth Pro;2;200,00;https://www.tiktok.com/@eu/video/7400000000000000001',
      '01/10/2026;Fone Bluetooth Pro;1;100,00;',
      '02/10/2026;Garrafa Nova;3;"90,00";',
    ].join('\n');
    const table = parseCsv(csv);
    const ctx = { products: await s.products.list(), posts: await repo.list('posts') };
    const plan = buildImportPlan(table, guessMapping(table[0]), ctx);
    expect(plan.matchedPosts).toBe(1);
    expect(plan.products.find((p) => p.name === 'Garrafa Nova')?.productId).toBeNull();

    const r1 = await s.imports.apply(plan, { createMissing: true, replace: true, plan: 'pro' });
    expect(r1).toMatchObject({ inserted: 3, createdProducts: 1, skippedRows: 0 });
    const rows = await repo.list('analytics');
    expect(rows.find((r) => r.post_id === post.id)?.revenue).toBe(200);
    expect(rows.reduce((t, r) => t + Number(r.revenue), 0)).toBe(390);

    // reimportar o mesmo arquivo substitui em vez de somar
    const plan2 = buildImportPlan(table, guessMapping(table[0]), { products: await s.products.list(), posts: await repo.list('posts') });
    await s.imports.apply(plan2, { createMissing: true, replace: true, plan: 'pro' });
    const after = await repo.list('analytics');
    expect(after.reduce((t, r) => t + Number(r.revenue), 0)).toBe(390);
    expect((await s.products.list()).filter((p) => p.name === 'Garrafa Nova')).toHaveLength(1);
  });

  it('sem criar produtos, linhas sem correspondência são puladas', async () => {
    const repo = new DemoRepository('u2');
    const s = createServices({ userId: 'u2', repo, storage: new DemoStorage('u2'), tiktok: new MockTikTokService() }, { id: 'u2', email: 'a@b.c', fullName: 'T' });
    const table = parseCsv('data,produto,valor\n01/10/2026,Desconhecido,10\n');
    const plan = buildImportPlan(table, guessMapping(table[0]), { products: [], posts: [] });
    const r = await s.imports.apply(plan, { createMissing: false, replace: true, plan: 'free' });
    expect(r).toMatchObject({ inserted: 0, skippedRows: 1 });
  });
});
