import { describe, expect, it } from 'vitest';
import { decideCaktoEvent, safeEqual } from '../../supabase/functions/_shared/cakto';

const base = (over: Record<string, unknown> = {}) => ({
  secret: 's3cr3t',
  event: 'purchase_approved',
  data: { id: 'ord_1', customer: { email: ' Ana@Exemplo.com ' }, product: { id: 'prod_1' } },
  ...over,
});

describe('webhook Cakto', () => {
  it('registra compra aprovada com e-mail normalizado', () => {
    expect(decideCaktoEvent(base(), 's3cr3t', 'prod_1')).toEqual({
      action: 'record', email: 'ana@exemplo.com', orderId: 'ord_1', productId: 'prod_1', status: 'approved', event: 'purchase_approved',
    });
  });
  it('mapeia reembolso e chargeback para revogação', () => {
    expect(decideCaktoEvent(base({ event: 'refund' }), 's3cr3t', null)).toMatchObject({ action: 'record', status: 'refunded' });
    expect(decideCaktoEvent(base({ event: 'chargeback' }), 's3cr3t', null)).toMatchObject({ action: 'record', status: 'chargeback' });
  });
  it('recusa segredo errado, ausente ou não configurado', () => {
    expect(decideCaktoEvent(base({ secret: 'errado' }), 's3cr3t', null)).toMatchObject({ action: 'reject', httpStatus: 401 });
    expect(decideCaktoEvent(base({ secret: undefined }), 's3cr3t', null)).toMatchObject({ action: 'reject', httpStatus: 401 });
    expect(decideCaktoEvent(base(), '', null)).toMatchObject({ action: 'reject', httpStatus: 401 });
  });
  it('ignora eventos que não mudam acesso e outros produtos', () => {
    expect(decideCaktoEvent(base({ event: 'purchase_refused' }), 's3cr3t', null).action).toBe('ignore');
    expect(decideCaktoEvent(base(), 's3cr3t', 'outro').action).toBe('ignore');
  });
  it('recusa pedido sem id ou sem e-mail', () => {
    expect(decideCaktoEvent(base({ data: { customer: { email: 'a@b.c' } } }), 's3cr3t', null)).toMatchObject({ action: 'reject', httpStatus: 400 });
    expect(decideCaktoEvent(base({ data: { id: 'x', customer: {} } }), 's3cr3t', null)).toMatchObject({ action: 'reject', httpStatus: 400 });
    expect(decideCaktoEvent('lixo', 's3cr3t', null)).toMatchObject({ action: 'reject', httpStatus: 400 });
  });
  it('compara segredo em tempo constante', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
