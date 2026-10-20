// Interpretação do webhook da Cakto, sem dependências (testada com Vitest em src/lib/cakto.test.ts).
//
// Formato esperado (documentação da Cakto, conferir com um evento de teste real da sua conta):
//   { "secret": "...", "event": "purchase_approved", "data": { "id": "...", "customer": { "email": "..." }, "product": { "id": "..." } } }
// A Cakto envia o segredo no corpo (não há cabeçalho HMAC).

export type PurchaseStatus = 'approved' | 'refunded' | 'chargeback';

export type CaktoDecision =
  | { action: 'record'; email: string; orderId: string; productId: string | null; status: PurchaseStatus; event: string }
  | { action: 'ignore'; reason: string }
  | { action: 'reject'; reason: string; httpStatus: 401 | 400 };

const EVENT_STATUS: Record<string, PurchaseStatus> = {
  purchase_approved: 'approved',
  refund: 'refunded',
  chargeback: 'chargeback',
};

/** Comparação em tempo constante para não vazar o segredo por tempo de resposta. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
}

export function decideCaktoEvent(body: unknown, expectedSecret: string, expectedProductId: string | null): CaktoDecision {
  if (!expectedSecret) return { action: 'reject', reason: 'CAKTO_WEBHOOK_SECRET não configurado', httpStatus: 401 };
  if (!body || typeof body !== 'object') return { action: 'reject', reason: 'corpo inválido', httpStatus: 400 };
  const b = body as Record<string, unknown>;
  const secret = str(b.secret);
  if (!secret || !safeEqual(secret, expectedSecret)) return { action: 'reject', reason: 'segredo inválido', httpStatus: 401 };

  const event = str(b.event) ?? '';
  const status = EVENT_STATUS[event];
  if (!status) return { action: 'ignore', reason: `evento ${event || '(vazio)'} não altera acesso` };

  const data = (b.data ?? {}) as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const product = (data.product ?? {}) as Record<string, unknown>;
  const orderId = str(data.id) ?? str(data.refId);
  const email = str(customer.email)?.toLowerCase() ?? null;
  const productId = str(product.id);

  if (!orderId || !email || !email.includes('@')) return { action: 'reject', reason: 'pedido sem id ou e-mail', httpStatus: 400 };
  if (expectedProductId && productId !== expectedProductId) return { action: 'ignore', reason: 'outro produto' };

  return { action: 'record', email, orderId, productId, status, event };
}
