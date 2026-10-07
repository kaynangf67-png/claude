import { addDays, addMinutes, format, setHours, setMinutes, startOfDay, subDays } from 'date-fns';
import type { DataRepository, Insert, TableName } from '@/services/data/types';
import type { LiveStatus, Product, Video } from '@/types/domain';
import { uuid } from '@/lib/utils';

/** PRNG determinístico (mulberry32): mesmos dados a cada seed. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_PRODUCTS = [
  { name: 'Fone Bluetooth Pro ANC', short: 'Fone ANC', category: 'Eletrônicos', price: 189.9, promo: 149.9, commission: 12, sku: 'FON-ANC-01', status: 'active', popularity: 1.0,
    description: 'Fone sem fio com cancelamento ativo de ruído, 30h de bateria com o estojo e conexão multiponto. Resistente a suor (IPX4).' },
  { name: 'Mini Projetor Portátil HD', short: 'Mini Projetor', category: 'Eletrônicos', price: 459.0, promo: 399.0, commission: 8, sku: 'PRJ-MINI-02', status: 'active', popularity: 0.55,
    description: 'Projetor compacto 720p nativo com suporte a 1080p, tela de até 120", Wi-Fi e espelhamento de celular. Ideal para cinema em casa.' },
  { name: 'Luminária LED de Mesa Touch', short: 'Luminária Touch', category: 'Casa', price: 79.9, promo: null, commission: 15, sku: 'LUM-TCH-03', status: 'active', popularity: 0.8,
    description: '3 temperaturas de cor, 5 níveis de brilho, braço articulado e base com carregador por indução.' },
  { name: 'Microfone Sem Fio Lapela Duplo', short: 'Microfone Lapela', category: 'Criadores', price: 129.9, promo: 99.9, commission: 18, sku: 'MIC-LAP-04', status: 'active', popularity: 0.9,
    description: 'Kit com 2 transmissores, redução de ruído e conexão USB-C/Lightning. Alcance de 20m e 6h de bateria.' },
  { name: 'Ring Light 26cm com Tripé', short: 'Ring Light', category: 'Criadores', price: 119.9, promo: null, commission: 14, sku: 'RNG-26-05', status: 'paused', popularity: 0.35,
    description: 'Ring light com tripé de 2,1m, suporte para celular e controle remoto Bluetooth.' },
  { name: 'Garrafa Térmica Inox 1L', short: 'Garrafa Térmica', category: 'Casa', price: 89.9, promo: 69.9, commission: 20, sku: 'GRF-INX-06', status: 'archived', popularity: 0.2,
    description: 'Mantém gelado por 24h e quente por 12h. Aço inox 304, tampa à prova de vazamento.' },
] as const;

const DEMO_VIDEOS: { name: string; product: number; duration: number }[] = [
  { name: 'Teste de cancelamento de ruído no metrô', product: 0, duration: 1820 },
  { name: 'Unboxing fone ANC + comparativo', product: 0, duration: 2460 },
  { name: 'Cinema no quarto com mini projetor', product: 1, duration: 3120 },
  { name: 'Setup de mesa: luminária touch', product: 2, duration: 1500 },
  { name: 'Microfone lapela: teste de áudio na rua', product: 3, duration: 2100 },
  { name: 'Live de criadores: kit áudio + luz', product: 3, duration: 3600 },
  { name: 'Ring light: antes e depois', product: 4, duration: 900 },
  { name: 'Corte rápido — oferta do dia', product: 2, duration: 420 },
];

export interface SeedResult {
  products: number;
  videos: number;
  lives: number;
  analytics: number;
}

/**
 * Popula a conta com dados fictícios realistas.
 * Apaga os dados atuais do usuário antes (a UI pede confirmação).
 * Volumes respeitam o plano Free para também funcionar no Supabase.
 */
export async function seedDemoData(repo: DataRepository, now = new Date()): Promise<SeedResult> {
  const rand = rng(20261007);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const today = startOfDay(now);

  // Ordem respeita as FKs.
  const wipe: TableName[] = ['analytics', 'notifications', 'ai_generations', 'automations', 'lives', 'live_schedules', 'videos', 'products', 'integrations'];
  for (const t of wipe) await repo.removeWhere(t, {});

  const products: Product[] = await repo.insertMany(
    'products',
    DEMO_PRODUCTS.map((p, i) => ({
      created_at: subDays(now, 95 - i * 9).toISOString(),
      name: p.name,
      description: p.description,
      image_url: null,
      price: p.price,
      promo_price: p.promo,
      commission_rate: p.commission,
      category: p.category,
      product_url: null,
      sku: p.sku,
      status: p.status,
    })),
  );

  const videos: Video[] = await repo.insertMany(
    'videos',
    DEMO_VIDEOS.map((v, i) => ({
      created_at: subDays(now, 60 - i * 7).toISOString(),
      product_id: products[v.product].id,
      name: v.name,
      storage_path: null, // demo: sem arquivo real
      thumbnail_path: null,
      duration_seconds: v.duration,
      size_bytes: Math.round(v.duration * 1_200_000 / 8),
      mime_type: 'video/mp4',
      status: i === 6 ? 'archived' : 'available',
      usage_count: 0,
      processing_status: 'ready',
    })),
  );

  const at = (day: Date, h: number, m = 0) => setMinutes(setHours(day, h), m);
  const liveRows: Insert<'lives'>[] = [];
  const usage = new Map<string, number>();
  const addLive = (videoIdx: number, start: Date, status: LiveStatus, extra: Partial<Insert<'lives'>> = {}) => {
    const v = DEMO_VIDEOS[videoIdx];
    const id = uuid();
    liveRows.push({
      id,
      video_id: videos[videoIdx].id,
      product_id: products[v.product].id,
      schedule_id: null,
      title: `${DEMO_PRODUCTS[v.product].short} — oferta ao vivo ${format(start, 'dd/MM')}`,
      description: `Transmissão com ${v.name.toLowerCase()}. Oferta especial no carrinho.`,
      starts_at: start.toISOString(),
      duration_minutes: Math.max(15, Math.round(v.duration / 60)),
      status,
      external_id: status === 'draft' ? null : `mock_${id.slice(0, 8)}`,
      error_message: null,
      ...extra,
    });
    if (status !== 'draft' && status !== 'cancelled') usage.set(videos[videoIdx].id, (usage.get(videos[videoIdx].id) ?? 0) + 1);
    return id;
  };

  // Passado: 10 lives finalizadas nas últimas 3 semanas.
  const pastLives: { id: string; date: string; videoIdx: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const videoIdx = [0, 2, 3, 4, 5, 0, 1, 4, 7, 2][i];
    const day = subDays(today, 2 + i * 2);
    const id = addLive(videoIdx, at(day, i % 2 ? 20 : 19, 30), 'finished');
    pastLives.push({ id, date: format(day, 'yyyy-MM-dd'), videoIdx });
  }
  // Uma com erro e uma cancelada (realismo).
  addLive(3, at(subDays(today, 5), 21), 'error', { error_message: 'Falha simulada: conexão encerrada pela plataforma.' });
  addLive(1, at(subDays(today, 1), 18), 'cancelled');

  // Agora: uma em execução.
  addLive(5, addMinutes(now, -20), 'running');

  // Futuro: avulsas + rascunho.
  addLive(1, at(addDays(today, 1), 21), 'scheduled');
  addLive(3, at(addDays(today, 2), 19), 'scheduled');
  addLive(4, at(addDays(today, 4), 20, 30), 'scheduled');
  addLive(2, at(addDays(today, 6), 21), 'scheduled');
  addLive(7, at(addDays(today, 3), 12), 'draft');

  // Automação: fone ANC toda seg/qua/sex às 20:00.
  const schedule = await repo.insert('live_schedules', {
    video_id: videos[0].id,
    product_id: products[0].id,
    title: 'Live diária — Fone ANC',
    description: 'Transmissão recorrente com o vídeo de teste no metrô.',
    duration_minutes: 30,
    recurrence: { frequency: 'weekly', weekdays: [1, 3, 5], time: '20:00', startDate: format(today, 'yyyy-MM-dd'), endDate: null },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    generated_until: null,
  });
  await repo.insert('automations', { schedule_id: schedule.id, name: 'Fone ANC — Seg/Qua/Sex 20h', is_active: true, next_run_at: null, last_run_at: null });

  const lives = await repo.insertMany('lives', liveRows);
  for (const [videoId, count] of usage) await repo.update('videos', videoId, { usage_count: count, status: 'scheduled' });

  // Analytics: 90 dias por produto, com tendência e sazonalidade semanal.
  const rows: Insert<'analytics'>[] = [];
  for (let d = 89; d >= 0; d--) {
    const day = subDays(today, d);
    const date = format(day, 'yyyy-MM-dd');
    const weekend = day.getDay() === 0 || day.getDay() === 6 ? 1.25 : 1;
    const trend = 0.7 + ((89 - d) / 89) * 0.6;
    products.forEach((p, i) => {
      const meta = DEMO_PRODUCTS[i];
      if (meta.status === 'archived' && d < 30) return;
      if (meta.status === 'paused' && d < 12) return;
      const views = Math.round(between(900, 1600) * meta.popularity * weekend * trend);
      const clicks = Math.round(views * between(0.035, 0.07));
      const conversions = Math.round(clicks * between(0.05, 0.11));
      const units = conversions + Math.round(conversions * between(0, 0.25));
      const unitPrice = meta.promo ?? meta.price;
      const revenue = +(units * unitPrice).toFixed(2);
      rows.push({
        date,
        product_id: p.id,
        video_id: videos[DEMO_VIDEOS.findIndex((v) => v.product === i)]?.id ?? null,
        live_id: null,
        views,
        clicks,
        conversions,
        units_sold: units,
        revenue,
        commission: +(revenue * (meta.commission / 100)).toFixed(2),
        // investimento diário (tráfego pago/amostras) ~4–9% do faturamento
        cost: +(revenue * between(0.04, 0.09)).toFixed(2),
        source: 'demo',
      });
    });
  }
  // Métricas atribuídas às lives finalizadas.
  for (const pl of pastLives) {
    const v = DEMO_VIDEOS[pl.videoIdx];
    const meta = DEMO_PRODUCTS[v.product];
    const views = Math.round(between(1800, 5200) * meta.popularity);
    const clicks = Math.round(views * between(0.05, 0.09));
    const conversions = Math.round(clicks * between(0.07, 0.14));
    const revenue = +(conversions * (meta.promo ?? meta.price)).toFixed(2);
    rows.push({
      date: pl.date,
      product_id: products[v.product].id,
      video_id: videos[pl.videoIdx].id,
      live_id: pl.id,
      views,
      clicks,
      conversions,
      units_sold: conversions,
      revenue,
      commission: +(revenue * (meta.commission / 100)).toFixed(2),
      cost: 0,
      source: 'demo',
    });
  }
  await repo.insertMany('analytics', rows);

  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  await repo.insertMany('notifications', [
    { type: 'live_scheduled', title: 'Live programada', body: liveRows[13].title, entity_type: 'live', entity_id: liveRows[13].id ?? null, read_at: null, created_at: ago(12) },
    { type: 'video_uploaded', title: 'Vídeo enviado', body: videos[7].name, entity_type: 'video', entity_id: videos[7].id, read_at: null, created_at: ago(95) },
    { type: 'automation_created', title: 'Automação criada', body: 'Fone ANC — Seg/Qua/Sex 20h', entity_type: 'automation', entity_id: null, read_at: ago(60), created_at: ago(240) },
    { type: 'product_created', title: 'Produto cadastrado', body: products[3].name, entity_type: 'product', entity_id: products[3].id, read_at: ago(60), created_at: ago(60 * 26) },
    { type: 'live_error', title: 'Live com erro', body: 'Falha simulada na transmissão de 5 dias atrás', entity_type: 'live', entity_id: null, read_at: ago(60), created_at: ago(60 * 24 * 5) },
    { type: 'live_created', title: 'Live criada', body: liveRows[16].title, entity_type: 'live', entity_id: liveRows[16].id ?? null, read_at: ago(60), created_at: ago(60 * 30) },
  ]);

  return { products: products.length, videos: videos.length, lives: lives.length, analytics: rows.length };
}
