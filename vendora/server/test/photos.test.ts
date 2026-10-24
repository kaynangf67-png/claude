import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/context';
import { AnthropicPhotoReader, photoToProduct, type PhotoAnalysis, type PhotoReader } from '../src/modules/ai/vision';
import { cutoutPlainBackground } from '../src/modules/images/background';
import { makeListingVariants, makeSalePhoto } from '../src/modules/images/processing';
import { makeApp, resetDb, sessionCookie } from './helpers';

// Leitura simulada: o que uma IA devolveria para uma garrafa fictícia de teste.
const analysis: PhotoAnalysis = {
  isProduct: true,
  productName: 'Garrafa térmica de inox',
  brand: 'Termix',
  model: null,
  color: 'Preta',
  material: null,
  visibleText: ['TERMIX', '500 ml'],
  visibleFeatures: ['Tampa rosqueável'],
  specifications: [{ name: 'Capacidade', value: '500 ml' }],
  uncertain: ['Peso', 'Dimensões'],
};

class FakeReader implements PhotoReader {
  readonly model = 'fake';
  calls = 0;
  constructor(private readonly result: PhotoAnalysis = analysis) {}
  async read() {
    this.calls++;
    return this.result;
  }
}

/** Foto de teste: produto azul num fundo cinza liso com borda larga. */
const photo = () =>
  sharp({ create: { width: 900, height: 700, channels: 3, background: '#d9d9d9' } })
    .composite([{ input: Buffer.from('<svg width="900" height="700"><rect x="380" y="150" width="140" height="400" rx="30" fill="#2f4fd8"/></svg>') }])
    .jpeg()
    .toBuffer();

describe('foto de venda automática', () => {
  it('recorta o fundo liso, centraliza num quadrado branco e não amplia', async () => {
    const out = await makeSalePhoto(await photo(), 1200);
    expect(out.width).toBe(out.height);
    expect(out.width).toBeLessThanOrEqual(1200);
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    expect(px(2, 2).every((v) => v > 240)).toBe(true); // canto branco
    const c = px(Math.floor(info.width / 2), Math.floor(info.height / 2));
    expect(c[2]).toBeGreaterThan(150); // produto continua azul
    expect(c[0]).toBeLessThan(100);
  });
});

describe('leitura de fotos', () => {
  it('tudo que vem da foto fica "a confirmar"', () => {
    const { data, fieldStatus } = photoToProduct(analysis, 'garrafa para café');
    expect(data.brand).toBe('Termix');
    expect(data.specifications).toEqual([
      { name: 'Cor', value: 'Preta' },
      { name: 'Capacidade', value: '500 ml' },
    ]);
    expect(fieldStatus.brand).toBe('inferred');
    expect(fieldStatus.model).toBe('missing');
    expect(data.description).toContain('garrafa para café');
  });

  it('envia as fotos ao Claude como imagem e valida a resposta', async () => {
    let body: { messages: Array<{ content: Array<{ type: string }> }>; model: string } | null = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: JSON.stringify(analysis) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    const reader = new AnthropicPhotoReader('sk-test', 'claude-opus-5-5', fetchImpl);
    const out = await reader.read([{ data: await photo(), mimeType: 'image/jpeg' }], 'garrafa');
    expect(out.brand).toBe('Termix');
    expect(body!.model).toBe('claude-opus-5-5');
    expect(body!.messages[0]!.content.map((b) => b.type)).toEqual(['image', 'text']);
  });
});

describe('fluxo por foto', () => {
  let app: FastifyInstance;
  let ctx: AppContext;
  let cookie: string;
  const reader = new FakeReader();

  beforeAll(async () => {
    ({ app, ctx } = await makeApp({ photoReader: reader }));
    await resetDb(ctx);
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Vendedor Foto', email: 'foto@vendora.test', password: 'senha-forte-123' },
    });
    cookie = sessionCookie(reg);
  });
  afterAll(async () => {
    await app.close();
    await ctx.db.$disconnect();
  });

  const upload = async (productId: string, buf: Buffer, target = app, as = cookie) => {
    const boundary = '----vendora';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      buf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return target.inject({
      method: 'POST',
      url: `/api/products/${productId}/images/upload`,
      payload,
      headers: { cookie: as, 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
  };

  it('foto → leitura pela IA → fotos de venda → anúncio', async () => {
    const draft = await app.inject({ method: 'POST', url: '/api/products/photo-draft', payload: {}, headers: { cookie } });
    expect(draft.statusCode).toBe(201);
    const pid = draft.json().product.id;

    const noPhoto = await app.inject({ method: 'POST', url: `/api/products/${pid}/read-photos`, payload: {}, headers: { cookie } });
    expect(noPhoto.json().error.code).toBe('no_photos');

    expect((await upload(pid, await photo())).statusCode).toBe(201);
    const read = await app.inject({
      method: 'POST',
      url: `/api/products/${pid}/read-photos`,
      payload: { hint: 'garrafa para café', marketplace: 'shopee' },
      headers: { cookie },
    });
    expect(read.statusCode).toBe(200);
    const body = read.json();
    expect(body.product.data.title).toBe('Garrafa térmica de inox');
    expect(body.product.fieldStatus.title).toBe('inferred');
    expect(body.analysis.uncertain).toContain('Peso');
    const sale = body.assets.filter((a: { kind: string }) => a.kind === 'edited');
    expect(sale).toHaveLength(1);
    expect(sale[0]).toMatchObject({ isMain: true, width: sale[0].height });
    expect(body.assets.filter((a: { kind: string }) => a.kind === 'original')).toHaveLength(1);

    // Ler de novo substitui as fotos automáticas em vez de acumular.
    await app.inject({ method: 'POST', url: `/api/products/${pid}/read-photos`, payload: {}, headers: { cookie } });
    expect(await ctx.db.asset.count({ where: { productId: pid, kind: 'edited' } })).toBe(1);

    const listing = await app.inject({
      method: 'POST',
      url: '/api/listings',
      payload: { productId: pid, marketplace: 'shopee' },
      headers: { cookie },
    });
    expect(listing.statusCode).toBe(201);
    expect(listing.json().listing.content.title).toContain('Termix');
  });

  it('sugere um título a partir da foto e gera 5 imagens para o anúncio', async () => {
    const pid = (await app.inject({ method: 'POST', url: '/api/products/photo-draft', payload: {}, headers: { cookie } })).json().product.id;
    const noPhoto = await app.inject({ method: 'POST', url: `/api/products/${pid}/suggest-title`, payload: {}, headers: { cookie } });
    expect(noPhoto.json().error.code).toBe('no_photos');

    const big = await sharp({ create: { width: 2000, height: 1600, channels: 3, background: '#d9d9d9' } })
      .composite([{ input: Buffer.from('<svg width="2000" height="1600"><rect x="600" y="200" width="800" height="1200" rx="60" fill="#2f4fd8"/></svg>') }])
      .jpeg()
      .toBuffer();
    const up = await upload(pid, big);
    const assetId = up.json().asset.id;
    const t = await app.inject({ method: 'POST', url: `/api/products/${pid}/suggest-title`, payload: {}, headers: { cookie } });
    expect(t.statusCode).toBe(200);
    expect(t.json().title).toBe('Garrafa térmica de inox Termix preta');

    const gen = () =>
      app.inject({ method: 'POST', url: `/api/assets/${assetId}/variants`, payload: { marketplace: 'mercado_livre' }, headers: { cookie } });
    const v = await gen();
    expect(v.statusCode).toBe(201);
    const { assets, note } = v.json();
    expect(note).toBeNull();
    expect(assets).toHaveLength(5);
    expect(assets.map((a: { edits: { variant: string } }) => a.edits.variant)).toEqual(['principal', 'estudio', 'detalhe', 'vertical', 'ambiente']);
    expect(assets[0].isMain).toBe(true);

    // Gerar de novo substitui, não acumula.
    expect((await gen()).statusCode).toBe(201);
    expect(await ctx.db.asset.count({ where: { productId: pid, kind: 'edited' } })).toBe(5);

    // Com as versões prontas, a leitura não cria outra foto de venda.
    await app.inject({ method: 'POST', url: `/api/products/${pid}/read-photos`, payload: { salePhotos: false }, headers: { cookie } });
    expect(await ctx.db.asset.count({ where: { productId: pid, kind: 'edited' } })).toBe(5);

    const edited = (await ctx.db.asset.findFirstOrThrow({ where: { productId: pid, kind: 'edited' } })).id;
    const bad = await app.inject({ method: 'POST', url: `/api/assets/${edited}/variants`, payload: { marketplace: 'shopee' }, headers: { cookie } });
    expect(bad.json().error.code).toBe('not_original');

    // Remover a foto original leva junto as versões feitas dela.
    expect((await app.inject({ method: 'DELETE', url: `/api/assets/${assetId}`, headers: { cookie } })).statusCode).toBe(200);
    expect(await ctx.db.asset.count({ where: { productId: pid } })).toBe(0);
  });

  it('recusa fotos que não mostram um produto', async () => {
    const other = await makeApp({ photoReader: new FakeReader({ ...analysis, isProduct: false }) });
    const reg = await other.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Outro', email: 'foto2@vendora.test', password: 'senha-forte-123' },
    });
    const c = sessionCookie(reg);
    const draft = await other.app.inject({ method: 'POST', url: '/api/products/photo-draft', payload: {}, headers: { cookie: c } });
    const pid = draft.json().product.id;
    expect((await upload(pid, await photo(), other.app, c)).statusCode).toBe(201);
    const read = await other.app.inject({ method: 'POST', url: `/api/products/${pid}/read-photos`, payload: {}, headers: { cookie: c } });
    expect(read.json().error.code).toBe('not_a_product');
    await other.app.close();
    await other.ctx.db.$disconnect();
  });

  it('sem IA configurada, avisa claramente', async () => {
    const noAi = await makeApp({ photoReader: null });
    const reg = await noAi.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Sem IA', email: 'foto3@vendora.test', password: 'senha-forte-123' },
    });
    const c = sessionCookie(reg);
    const pid = (await noAi.app.inject({ method: 'POST', url: '/api/products/photo-draft', payload: {}, headers: { cookie: c } })).json().product.id;
    await upload(pid, await photo(), noAi.app, c);
    const read = await noAi.app.inject({ method: 'POST', url: `/api/products/${pid}/read-photos`, payload: {}, headers: { cookie: c } });
    expect(read.statusCode).toBe(503);
    expect(read.json().error.code).toBe('vision_not_configured');
    const title = await noAi.app.inject({ method: 'POST', url: `/api/products/${pid}/suggest-title`, payload: {}, headers: { cookie: c } });
    expect(title.statusCode).toBe(503);
    expect(title.json().error.code).toBe('vision_not_configured');
    await noAi.app.close();
    await noAi.ctx.db.$disconnect();
  });
});

describe('foto de venda com produto pequeno no quadro', () => {
  it('ainda remove o fundo liso em volta', async () => {
    const small = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#cfcfcf' } })
      .composite([{ input: Buffer.from('<svg width="1600" height="1200"><rect x="740" y="400" width="120" height="400" fill="#2f6bff"/></svg>') }])
      .jpeg()
      .toBuffer();
    const out = await makeSalePhoto(small, 1200);
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    // Linha que passa pelo meio: à esquerda do produto deve ser branco, não cinza.
    const y = Math.floor(info.height / 2);
    const left = [...data.subarray((y * info.width + 5) * 3, (y * info.width + 5) * 3 + 3)];
    expect(left.every((v) => v > 240)).toBe(true);
  });
});

describe('recorte de fundo sem IA', () => {
  it('fundo liso: o produto fica opaco e o fundo transparente', async () => {
    const out = (await cutoutPlainBackground(await photo()))!;
    expect(out).not.toBeNull();
    const { data, info } = await sharp(out.png).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3]!;
    expect(alpha(10, 10)).toBe(0);
    expect(alpha(450, 350)).toBe(255);
  });

  it('fundo com textura: desiste em vez de recortar errado', async () => {
    const noisy = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 60 } } })
      .jpeg()
      .toBuffer();
    expect(await cutoutPlainBackground(noisy)).toBeNull();
    const { variants, cutout } = await makeListingVariants(noisy, 1200);
    expect(cutout).toBe(false);
    expect(variants.map((v) => v.key)).not.toContain('estudio');
  });
});
