import { describe, expect, it } from 'vitest';
import { liveSchema, productSchema, sanitizeText } from './validation';

const base = { name: 'Fone', description: '', image_url: null, price: '100', promo_price: '', commission_rate: '10', category: '', product_url: '', sku: '', status: 'active' as const };

describe('validação', () => {
  it('sanitiza HTML e caracteres de controle', () => {
    expect(sanitizeText('  <script>alert(1)</script>Olá\u0007 ')).toBe('alert(1)Olá');
  });

  it('produto válido normaliza campos opcionais', () => {
    const p = productSchema.parse(base);
    expect(p.price).toBe(100);
    expect(p.promo_price).toBeNull();
    expect(p.product_url).toBeNull();
    expect(p.sku).toBeNull();
  });

  it('rejeita promo maior que preço, URL inválida e nome vazio', () => {
    expect(productSchema.safeParse({ ...base, promo_price: '120' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, product_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, name: '<b></b>' }).success).toBe(false);
  });

  it('live semanal exige dias', () => {
    const live = { video_id: 'v', product_id: 'p', title: 'Live', description: '', duration_minutes: 30, recurrence: { frequency: 'weekly' as const, time: '20:00', startDate: '2026-10-10', weekdays: [] } };
    expect(liveSchema.safeParse(live).success).toBe(false);
    expect(liveSchema.safeParse({ ...live, recurrence: { ...live.recurrence, weekdays: [1] } }).success).toBe(true);
  });
});
