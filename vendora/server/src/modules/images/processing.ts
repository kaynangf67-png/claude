import sharp, { type OverlayOptions } from 'sharp';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { cutoutPlainBackground } from './background';

sharp.cache(false);
// Limita a "bomba de descompressão": imagens com dimensões absurdas são recusadas.
const LIMIT_INPUT_PIXELS = 50_000_000;

export const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type ImageFormat = (typeof ACCEPTED_FORMATS)[number];
export const MIME: Record<ImageFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const EXT: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };

export interface ProbedImage {
  format: ImageFormat;
  width: number;
  height: number;
}

/** Valida pelo conteúdo (não pela extensão ou content-type informados). */
export async function probeImage(buffer: Buffer): Promise<ProbedImage> {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata();
  } catch {
    throw new AppError(415, 'invalid_image', 'O arquivo não é uma imagem válida.');
  }
  const format = meta.format as string;
  if (!ACCEPTED_FORMATS.includes(format as ImageFormat))
    throw new AppError(415, 'unsupported_image', 'Formato não suportado. Envie JPG, PNG ou WEBP.');
  if (!meta.width || !meta.height) throw new AppError(415, 'invalid_image', 'Não foi possível ler as dimensões da imagem.');
  return { format: format as ImageFormat, width: meta.width, height: meta.height };
}

/**
 * Normaliza a original: aplica a orientação EXIF e remove metadados (GPS, câmera).
 * Não redimensiona nem altera cores — a original fica fiel ao arquivo recebido.
 */
export async function normalizeOriginal(buffer: Buffer, format: ImageFormat): Promise<Buffer> {
  const img = sharp(buffer, { limitInputPixels: LIMIT_INPUT_PIXELS }).rotate();
  if (format === 'jpeg') return img.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  if (format === 'png') return img.png().toBuffer();
  return img.webp({ quality: 95 }).toBuffer();
}

export const EditOperations = z.object({
  crop: z
    .object({
      // Frações (0–1) da imagem, para independer da resolução da prévia.
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().gt(0).max(1),
      height: z.number().gt(0).max(1),
    })
    .optional(),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  flip: z.boolean().default(false),
  /** -100..100 (0 = sem alteração). */
  brightness: z.number().min(-100).max(100).default(0),
  contrast: z.number().min(-100).max(100).default(0),
  saturation: z.number().min(-100).max(100).default(0),
  /** Coloca o produto num quadrado com fundo branco (sem recortar o produto). */
  whiteBackground: z.boolean().default(false),
  output: z.object({
    size: z.number().int().min(100).max(4000).optional(),
    square: z.boolean().default(false),
    format: z.enum(ACCEPTED_FORMATS).default('jpeg'),
    quality: z.number().int().min(50).max(100).default(90),
  }),
});
export type EditOperations = z.infer<typeof EditOperations>;

/**
 * Aplica as edições numa CÓPIA. Somente transformações globais (recorte,
 * rotação, luz, contraste, saturação, fundo): nada é desenhado ou gerado
 * sobre o produto, então cor, formato e marca continuam os reais.
 */
export async function applyEdits(buffer: Buffer, ops: EditOperations): Promise<{ buffer: Buffer; width: number; height: number; format: ImageFormat }> {
  const base = sharp(buffer, { limitInputPixels: LIMIT_INPUT_PIXELS }).rotate();
  const meta = await base.metadata();
  let width = meta.autoOrient?.width ?? meta.width!;
  let height = meta.autoOrient?.height ?? meta.height!;
  let img = sharp(await base.toBuffer(), { limitInputPixels: LIMIT_INPUT_PIXELS });

  if (ops.crop) {
    const left = Math.round(ops.crop.x * width);
    const top = Math.round(ops.crop.y * height);
    const w = Math.max(1, Math.min(width - left, Math.round(ops.crop.width * width)));
    const h = Math.max(1, Math.min(height - top, Math.round(ops.crop.height * height)));
    img = img.extract({ left, top, width: w, height: h });
    width = w;
    height = h;
  }
  if (ops.rotate) {
    img = img.rotate(ops.rotate);
    if (ops.rotate === 90 || ops.rotate === 270) [width, height] = [height, width];
  }
  if (ops.flip) img = img.flop();

  if (ops.brightness || ops.saturation)
    img = img.modulate({ brightness: 1 + ops.brightness / 100, saturation: 1 + ops.saturation / 100 });
  if (ops.contrast) {
    // Contraste em torno do cinza médio: out = a*in + b, com b mantendo 128 fixo.
    const a = 1 + ops.contrast / 100;
    img = img.linear(a, 128 * (1 - a));
  }

  const target = ops.output.size;
  const square = ops.output.square || ops.whiteBackground;
  if (square) {
    const side = target ?? Math.max(width, height);
    // Não ampliamos além do tamanho real: isso só perde nitidez. O excesso vira borda branca.
    const fit = Math.min(side, Math.max(width, height));
    img = sharp(await img.toBuffer())
      .resize({ width: fit, height: fit, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' });
    const resized = await img.toBuffer({ resolveWithObject: true });
    const padX = side - resized.info.width;
    const padY = side - resized.info.height;
    img = sharp(resized.data).extend({
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      background: '#ffffff',
    });
  } else if (target) {
    img = img.resize({ width: target, height: target, fit: 'inside', withoutEnlargement: true });
  }

  if (ops.output.format !== 'png' || ops.whiteBackground) img = img.flatten({ background: '#ffffff' });
  const fmt = ops.output.format;
  if (fmt === 'jpeg') img = img.jpeg({ quality: ops.output.quality, mozjpeg: true });
  else if (fmt === 'png') img = img.png({ compressionLevel: 9 });
  else img = img.webp({ quality: ops.output.quality });

  const out = await img.toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height, format: fmt };
}

/**
 * Foto pronta para venda: corta bordas de fundo uniforme, centraliza o produto
 * num quadrado branco com margem e entrega no tamanho recomendado do canal.
 * Só operações globais — nada é desenhado ou inventado sobre o produto.
 * Se o fundo original não for liso, ele continua na foto (use a remoção de fundo).
 */
export async function makeSalePhoto(
  buffer: Buffer,
  targetSize: number,
): Promise<{ buffer: Buffer; width: number; height: number; format: ImageFormat }> {
  let base = await sharp(buffer, { limitInputPixels: LIMIT_INPUT_PIXELS }).rotate().flatten({ background: '#ffffff' }).toBuffer();
  try {
    // trim remove bordas da cor do canto superior esquerdo (fundo liso); falha silenciosa em fundos complexos.
    const trimmed = await sharp(base).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
    const meta = await sharp(base).metadata();
    // trim só remove linhas/colunas inteiras da cor do fundo, então não corta o produto;
    // descarta apenas resultados degenerados (ruído ou foto praticamente vazia).
    if (trimmed.info.width >= 32 && trimmed.info.height >= 32 && trimmed.info.width * trimmed.info.height > 0.005 * meta.width! * meta.height!)
      base = trimmed.data;
  } catch {
    // imagem uniforme demais para recortar: mantém a original
  }
  // Quadro sempre no tamanho do canal; o produto ocupa até ~88% dele e nunca é ampliado
  // (foto pequena fica com mais margem branca, sem perder nitidez).
  const side = targetSize;
  const inner = Math.round(side * 0.88);
  const resized = await sharp(base)
    .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const padX = side - resized.info.width;
  const padY = side - resized.info.height;
  const out = await sharp(resized.data)
    .extend({
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      background: '#ffffff',
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height, format: 'jpeg' };
}

export interface PhotoVariant {
  key: 'principal' | 'estudio' | 'detalhe' | 'vertical' | 'ambiente';
  label: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: ImageFormat;
}

const VARIANT_LABELS: Record<PhotoVariant['key'], string> = {
  principal: 'Fundo branco (foto principal)',
  estudio: 'Estúdio com sombra',
  detalhe: 'Detalhe ampliado',
  vertical: 'Vertical 3:4',
  ambiente: 'Fundo neutro quente',
};

const MAX_UPSCALE = 2.5;

async function placeOn(
  product: Buffer,
  canvasW: number,
  canvasH: number,
  background: { color: string } | { svg: string },
  opts: { fill?: number; shadow?: boolean } = {},
) {
  const fill = opts.fill ?? 0.84;
  // Produto pequeno na foto ficava minúsculo no quadro. Ampliamos até 2,5x:
  // mais que isso a imagem borra a ponto de enganar sobre a qualidade.
  const m = await sharp(product).metadata();
  const scale = Math.min((canvasW * fill) / m.width!, (canvasH * fill) / m.height!, MAX_UPSCALE);
  const p = await sharp(product)
    .resize({ width: Math.max(1, Math.round(m.width! * scale)), height: Math.max(1, Math.round(m.height! * scale)), kernel: 'lanczos3' })
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((canvasW - p.info.width) / 2);
  // Com sombra, o produto sobe um pouco para "apoiar" nela.
  const top = Math.round((canvasH - p.info.height) / 2 - (opts.shadow ? canvasH * 0.02 : 0));
  const layers: OverlayOptions[] = [];
  if (opts.shadow) {
    const sw = Math.round(p.info.width * 0.9);
    const sh = Math.max(12, Math.round(p.info.width * 0.12));
    const cy = Math.min(canvasH - sh, top + p.info.height - Math.round(sh * 0.35));
    layers.push({
      input: Buffer.from(
        `<svg width="${canvasW}" height="${canvasH}"><defs><filter id="b"><feGaussianBlur stdDeviation="${Math.round(sh / 2.5)}"/></filter></defs><ellipse cx="${canvasW / 2}" cy="${cy}" rx="${sw / 2}" ry="${sh / 2}" fill="rgba(20,20,30,0.3)" filter="url(#b)"/></svg>`,
      ),
      top: 0,
      left: 0,
    });
  }
  layers.push({ input: p.data, top: Math.max(0, top), left: Math.max(0, left) });
  const bg =
    'color' in background
      ? sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: background.color } })
      : sharp(Buffer.from(background.svg));
  const out = await bg.composite(layers).flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height, format: 'jpeg' as const };
}

/**
 * Cinco imagens para o anúncio a partir de UMA foto real do produto.
 * Nada é gerado por IA: o produto é sempre o da foto (sem redesenhar, sem
 * ampliar). Só o fundo, o enquadramento e a sombra mudam. As versões de
 * estúdio dependem de separar o produto do fundo, o que só é feito com
 * segurança em fundo liso; em fundo complexo elas não são geradas.
 */
export async function makeListingVariants(
  buffer: Buffer,
  size: number,
): Promise<{ variants: PhotoVariant[]; cutout: boolean }> {
  const cut = await cutoutPlainBackground(buffer);
  let product: Buffer;
  if (cut) {
    product = await sharp(cut.png).trim().png().toBuffer();
  } else {
    let base = await sharp(buffer, { limitInputPixels: LIMIT_INPUT_PIXELS }).rotate().flatten({ background: '#ffffff' }).toBuffer();
    try {
      const t = await sharp(base).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
      if (t.info.width >= 32 && t.info.height >= 32) base = t.data;
    } catch {
      // mantém a foto inteira
    }
    product = base;
  }
  const meta = await sharp(product).metadata();
  const pw = meta.width!;
  const ph = meta.height!;

  const variants: PhotoVariant[] = [];
  const push = (key: PhotoVariant['key'], v: { buffer: Buffer; width: number; height: number; format: ImageFormat }) =>
    variants.push({ key, label: VARIANT_LABELS[key], ...v });

  push('principal', await placeOn(product, size, size, { color: '#ffffff' }, { fill: 0.86 }));
  if (cut)
    push(
      'estudio',
      await placeOn(
        product,
        size,
        size,
        {
          svg: `<svg width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6e8ee"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
        },
        { fill: 0.78, shadow: true },
      ),
    );
  // Detalhe: recorte quadrado no centro do próprio produto. Ampliação limitada a 1,5x
  // (mais que isso borra e passa a enganar sobre a qualidade real).
  const side = Math.max(16, Math.round(Math.min(pw, ph) * 0.75));
  const detailSize = Math.min(size, Math.round(side * 1.5));
  const detail = await sharp(product)
    .extract({ left: Math.round((pw - side) / 2), top: Math.round((ph - side) / 2), width: side, height: side })
    .flatten({ background: '#ffffff' })
    .resize({ width: detailSize, height: detailSize })
    .toBuffer();
  // Abaixo de 500 px nenhum marketplace aceita: melhor não gerar do que entregar uma imagem ruim.
  if (detailSize >= 500) push('detalhe', await placeOn(detail, detailSize, detailSize, { color: '#ffffff' }, { fill: 1 }));
  push('vertical', await placeOn(product, Math.round(size * 0.75), size, { color: '#ffffff' }, { fill: 0.86 }));
  if (cut) push('ambiente', await placeOn(product, size, size, { color: '#f3eee7' }, { fill: 0.78, shadow: true }));
  return { variants, cutout: Boolean(cut) };
}
