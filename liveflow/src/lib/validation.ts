import { z } from 'zod';

/**
 * Sanitização de texto livre: remove caracteres de controle e tags HTML.
 * O React já escapa tudo ao renderizar; isto evita que lixo/markup chegue ao banco
 * e seja reaproveitado em outros contextos (ex.: e-mail, export, prompt de IA).
 */
export function sanitizeText(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

const text = (max: number) => z.string().transform(sanitizeText).pipe(z.string().max(max, `Máximo de ${max} caracteres`));
const requiredText = (max: number, label: string) =>
  z.string().transform(sanitizeText).pipe(z.string().min(1, `${label} é obrigatório`).max(max, `Máximo de ${max} caracteres`));

const optionalUrl = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Informe uma URL válida (http/https)')
  .transform((v) => (v === '' ? null : v));

const money = z.coerce.number({ message: 'Valor inválido' }).min(0, 'Não pode ser negativo').max(1_000_000, 'Valor muito alto');

export const productSchema = z
  .object({
    name: requiredText(160, 'Nome'),
    description: text(5000),
    image_url: z.string().nullable(),
    price: money,
    promo_price: z.union([z.literal(''), money]).transform((v) => (v === '' ? null : v)),
    commission_rate: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
    category: text(80),
    product_url: optionalUrl,
    sku: z.string().transform(sanitizeText).pipe(z.string().max(80)).transform((v) => (v === '' ? null : v)),
    status: z.enum(['active', 'paused', 'archived']),
  })
  .refine((p) => p.promo_price == null || p.promo_price <= p.price, {
    message: 'Preço promocional deve ser menor ou igual ao preço',
    path: ['promo_price'],
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductOutput = z.output<typeof productSchema>;

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const recurrenceSchema = z
  .object({
    frequency: z.enum(['none', 'daily', 'weekdays', 'weekly', 'interval']),
    time: z.string().regex(timeRe, 'Horário inválido'),
    startDate: z.string().regex(dateRe, 'Data inválida'),
    endDate: z.string().regex(dateRe).nullable().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    intervalDays: z.number().int().min(1).max(90).optional(),
  })
  .refine((r) => r.frequency !== 'weekly' || (r.weekdays && r.weekdays.length > 0), {
    message: 'Escolha ao menos um dia da semana',
    path: ['weekdays'],
  })
  .refine((r) => r.frequency !== 'interval' || (r.intervalDays ?? 0) >= 1, {
    message: 'Informe o intervalo em dias',
    path: ['intervalDays'],
  })
  .refine((r) => !r.endDate || r.endDate >= r.startDate, {
    message: 'Data final deve ser após a inicial',
    path: ['endDate'],
  });

export const liveSchema = z.object({
  video_id: z.string().min(1, 'Selecione um vídeo'),
  product_id: z.string().min(1, 'Selecione um produto'),
  title: requiredText(160, 'Título'),
  description: text(5000),
  duration_minutes: z.coerce.number().int().min(5, 'Mínimo 5 minutos').max(720, 'Máximo 12 horas'),
  recurrence: recurrenceSchema,
});

export type LiveInput = z.input<typeof liveSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(72),
});

export const registerSchema = credentialsSchema.extend({
  fullName: requiredText(120, 'Nome'),
});

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB (igual ao bucket)
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateVideoFile(file: File): string | null {
  if (!(VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) return 'Formato não suportado. Use MP4, MOV ou WebM.';
  if (file.size > MAX_VIDEO_BYTES) return 'Arquivo acima de 2 GB.';
  return null;
}

export function validateImageFile(file: File, maxBytes = MAX_IMAGE_BYTES): string | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return 'Use PNG, JPG ou WebP.';
  if (file.size > maxBytes) return `Imagem acima de ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

/** Primeiro erro por campo, no formato { campo: mensagem }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
