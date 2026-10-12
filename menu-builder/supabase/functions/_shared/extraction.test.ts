import { describe, expect, it } from 'vitest';
import { estimateCostUsd, parseBRL, parseExtraction, postProcess, type RawExtraction, type RawItem } from './extraction.ts';

const item = (over: Partial<RawItem> = {}): RawItem => ({
  name: 'Picanha',
  category: 'Churrasco',
  description: null,
  price_text: 'R$ 95,90',
  price: 95.9,
  variations: [],
  confidence: 0.97,
  needs_review: false,
  review_reason: null,
  image_index: 0,
  ...over,
});
const raw = (items: RawItem[], over: Partial<RawExtraction> = {}): RawExtraction => ({ pages: [], items, warnings: [], ...over });

describe('parseBRL', () => {
  it('lê formatos brasileiros', () => {
    expect(parseBRL('R$ 32,90')).toBe(32.9);
    expect(parseBRL('R$1.234,50')).toBe(1234.5);
    expect(parseBRL('25')).toBe(25);
    expect(parseBRL('R$ 7,5')).toBe(7.5);
    expect(parseBRL('consulte')).toBeNull();
    expect(parseBRL(null)).toBeNull();
  });
});

describe('parseExtraction', () => {
  it('aceita a forma esperada', () => {
    expect(parseExtraction(raw([item()])).items).toHaveLength(1);
  });
  it('rejeita formas inválidas', () => {
    expect(() => parseExtraction({ items: [] })).toThrow();
    expect(() => parseExtraction(raw([{ ...item(), price: '95,90' as unknown as number }]))).toThrow(/preço/);
  });
});

describe('postProcess', () => {
  it('item limpo e confiável não pede revisão', () => {
    const { items } = postProcess(raw([item()]), 1);
    expect(items[0]).toMatchObject({ name: 'Picanha', price: 95.9, reviewRequired: false });
  });

  it('nunca inventa preço: ausente fica null e vai para revisão', () => {
    const { items } = postProcess(raw([item({ price: null, price_text: null })]), 1);
    expect(items[0].price).toBeNull();
    expect(items[0].reviewRequired).toBe(true);
  });

  it('texto e número divergentes: não escolhe, pede revisão', () => {
    const { items } = postProcess(raw([item({ price_text: 'R$ 98,90', price: 98.1 })]), 1);
    expect(items[0].price).toBeNull();
    expect(items[0].reviewNotes.join(' ')).toMatch(/divergente/);
  });

  it('confiança baixa pede revisão', () => {
    const { items } = postProcess(raw([item({ confidence: 0.5 })]), 1);
    expect(items[0].reviewRequired).toBe(true);
  });

  it('variações: preço base vira null e cada variação é conferida', () => {
    const { items } = postProcess(
      raw([item({ price: 20, price_text: null, variations: [{ label: 'Pequena', price: 20, price_text: 'R$ 20,00' }, { label: 'Grande', price: null, price_text: null }] })]),
      1,
    );
    expect(items[0].price).toBeNull();
    expect(items[0].variations).toEqual([{ label: 'Pequena', price: 20 }, { label: 'Grande', price: null }]);
    expect(items[0].reviewRequired).toBe(true);
  });

  it('mesmo item em duas imagens com preços diferentes: conflito', () => {
    const { items } = postProcess(raw([item(), item({ price: 99.9, price_text: 'R$ 99,90', image_index: 1 })]), 2);
    expect(items).toHaveLength(1);
    expect(items[0].reviewRequired).toBe(true);
    expect(items[0].reviewNotes.join(' ')).toMatch(/conflitante/);
  });

  it('item que já existe no projeto: possível duplicidade', () => {
    const { items } = postProcess(raw([item()]), 1, ['PICANHA']);
    expect(items[0].reviewNotes.join(' ')).toMatch(/duplicidade/);
  });

  it('avisa páginas ilegíveis e corrige image_index inválido', () => {
    const out = postProcess(raw([item({ image_index: 7 })], { pages: [{ image_index: 0, legibility: 'ilegivel', notes: 'borrada' }] }), 1);
    expect(out.warnings[0]).toMatch(/ilegível/);
    expect(out.items[0].imageIndex).toBe(0);
  });
});

describe('estimateCostUsd', () => {
  it('calcula pelo preço do modelo', () => {
    expect(estimateCostUsd('claude-opus-5-5', 1_000_000, 100_000)).toBe(6);
    expect(estimateCostUsd('modelo-x', 1, 1)).toBeNull();
  });
});
