import sharp from 'sharp';
import { z } from 'zod';
import { AppError } from '../../lib/errors';

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
