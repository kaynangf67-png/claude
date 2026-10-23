import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import sharp from 'sharp';
import { z } from 'zod';
import { emptyProduct, type FieldStatusMap, type ProductData } from '@vendora/shared';
import { AppError } from '../../lib/errors';

/** O que a IA consegue afirmar olhando as fotos. Tudo aqui é "a confirmar" pelo vendedor. */
export const PhotoAnalysis = z.object({
  isProduct: z.boolean().describe('false se as fotos não mostram um produto à venda (paisagem, pessoa, documento etc.).'),
  productName: z.string().describe('Nome descritivo do produto como ele aparece, sem inventar marca ou modelo.'),
  brand: z.string().nullable().describe('Só se a marca estiver legível na foto (logotipo, etiqueta, embalagem).'),
  model: z.string().nullable().describe('Só se o modelo estiver escrito na foto.'),
  color: z.string().nullable(),
  material: z.string().nullable().describe('Só se for visualmente evidente; senão null.'),
  visibleText: z.array(z.string()).describe('Textos legíveis no produto ou embalagem, transcritos literalmente.'),
  visibleFeatures: z.array(z.string()).describe('Características que dá para ver (ex.: "alça lateral", "tampa rosqueável").'),
  specifications: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe('Somente especificações impressas e legíveis na foto (ex.: "Capacidade: 500 ml").'),
  uncertain: z.array(z.string()).describe('O que não dá para confirmar pela foto e o vendedor precisa informar.'),
});
export type PhotoAnalysis = z.infer<typeof PhotoAnalysis>;

export interface PhotoImage {
  data: Buffer;
  mimeType: string;
}

export interface PhotoReader {
  readonly model: string;
  read(images: PhotoImage[], hint?: string): Promise<PhotoAnalysis>;
}

const SYSTEM = `Você analisa fotos de produtos para um vendedor que vai anunciar em marketplaces brasileiros.

Descreva apenas o que é visível. Regras:
1. Marca e modelo só se estiverem escritos ou com logotipo legível na foto. Nunca deduza marca pelo formato.
2. Especificações (capacidade, voltagem, medidas, peso) só se estiverem impressas e legíveis. Não estime tamanho pela imagem.
3. Transcreva textos visíveis literalmente em "visibleText".
4. Liste em "uncertain" o que o comprador vai querer saber e a foto não mostra (dimensões, peso, material interno, voltagem, conteúdo da embalagem, garantia).
5. A dica do vendedor, se houver, ajuda a entender o produto, mas não transforma suposição em fato visível.
6. Responda em português do Brasil.`;

/** Reduz a foto para o tamanho que o modelo de visão aproveita (lado máx. ~1568 px). */
async function prepare(img: PhotoImage) {
  const data = await sharp(img.data).rotate().resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return data.toString('base64');
}

export class AnthropicPhotoReader implements PhotoReader {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    fetchImpl?: typeof fetch,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000, ...(fetchImpl ? { fetch: fetchImpl, maxRetries: 0 } : {}) });
  }

  async read(images: PhotoImage[], hint?: string): Promise<PhotoAnalysis> {
    const blocks = await Promise.all(images.slice(0, 6).map(prepare));
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(PhotoAnalysis) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              ...blocks.map((data) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data } })),
              {
                type: 'text' as const,
                text: hint?.trim()
                  ? `<dica_do_vendedor>${hint.trim()}</dica_do_vendedor>\nAnalise as fotos do produto.`
                  : 'Analise as fotos do produto.',
              },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal')
        throw new AppError(422, 'ai_refused', 'A IA não analisou estas fotos. Tente outras fotos do produto.');
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AppError(502, 'ai_invalid', 'A IA devolveu um formato inválido. Tente novamente.');
      }
      const parsed = PhotoAnalysis.safeParse(json);
      if (!parsed.success) throw new AppError(502, 'ai_invalid', 'A IA devolveu um formato inválido. Tente novamente.');
      return parsed.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Anthropic.RateLimitError) throw new AppError(429, 'ai_rate_limited', 'Limite de uso da IA atingido. Tente em instantes.');
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
        throw new AppError(503, 'ai_auth', 'A chave da IA é inválida ou não tem permissão. Verifique ANTHROPIC_API_KEY.');
      if (err instanceof Anthropic.APIError) throw new AppError(502, 'ai_error', 'Falha temporária na IA. Tente novamente.');
      throw err;
    }
  }
}

/**
 * Converte a leitura da foto em dados do produto. Tudo que veio da foto fica
 * "inferred" (a confirmar); nada vira "confirmed" sem o vendedor revisar.
 */
export function photoToProduct(a: PhotoAnalysis, hint?: string): { data: ProductData; fieldStatus: FieldStatusMap } {
  const data = emptyProduct();
  data.title = a.productName.trim().slice(0, 500) || hint?.trim().slice(0, 500) || null;
  data.brand = a.brand?.trim() || null;
  data.model = a.model?.trim() || null;
  const specs = [...a.specifications];
  if (a.color) specs.unshift({ name: 'Cor', value: a.color });
  if (a.material) specs.push({ name: 'Material', value: a.material });
  data.specifications = specs
    .filter((s) => s.name.trim() && s.value.trim())
    .slice(0, 100)
    .map((s) => ({ name: s.name.trim().slice(0, 120), value: s.value.trim().slice(0, 500) }));
  data.features = a.visibleFeatures.map((f) => f.trim()).filter(Boolean).slice(0, 50);
  const lines: string[] = [];
  if (hint?.trim()) lines.push(`Informado pelo vendedor: ${hint.trim()}`);
  if (a.visibleText.length) lines.push(`Texto visível nas fotos: ${a.visibleText.join(' | ')}`);
  data.description = lines.length ? lines.join('\n').slice(0, 20000) : null;

  const fieldStatus: FieldStatusMap = {};
  for (const k of ['title', 'brand', 'model', 'gtin', 'sku', 'description', 'price', 'features', 'specifications', 'images'] as const) {
    const v = data[k];
    fieldStatus[k] = (Array.isArray(v) ? v.length > 0 : v !== null) ? 'inferred' : 'missing';
  }
  return { data, fieldStatus };
}
