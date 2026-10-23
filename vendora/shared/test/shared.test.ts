import { describe, expect, it } from 'vitest';
import { effectiveRules, validateImage, validateListingText } from '../src/marketplaces';
import { findUnsupportedClaims, identityPreserved } from '../src/claims';

describe('regras por marketplace', () => {
  it('cada canal tem limites próprios', () => {
    const ml = effectiveRules('mercado_livre');
    const sh = effectiveRules('shopee');
    const tt = effectiveRules('tiktok_shop');
    expect(ml.titleMax).toBe(60);
    expect(sh.titleMax).not.toBe(ml.titleMax);
    expect(tt.imageMinSize).not.toBe(ml.imageMinSize);
  });

  it('aplica sobrescritas do usuário', () => {
    expect(effectiveRules('mercado_livre', { titleMaxLength: 80 }).titleMax).toBe(80);
  });

  it('acusa título longo, emoji, HTML e links', () => {
    const rules = effectiveRules('mercado_livre');
    const issues = validateListingText(rules, {
      title: 'Fone de Ouvido Bluetooth Marca X Modelo Y com Cancelamento de Ruído 🔥',
      description: '<b>Ótimo</b> veja em https://loja.com',
      keywords: [],
    });
    const msgs = issues.map((i) => i.message).join(' | ');
    expect(msgs).toMatch(/limite configurado é 60/);
    expect(msgs).toMatch(/emojis/);
    expect(msgs).toMatch(/HTML/);
    expect(msgs).toMatch(/links/);
  });

  it('valida imagem', () => {
    const rules = effectiveRules('mercado_livre');
    expect(validateImage(rules, { width: 400, height: 400, format: 'jpeg', sizeBytes: 1000 })[0]?.level).toBe('error');
    expect(validateImage(rules, { width: 1200, height: 1200, format: 'jpeg', sizeBytes: 1000 })).toEqual([]);
    expect(validateImage(rules, { width: 1200, height: 1200, format: 'gif', sizeBytes: 1000 })[0]?.level).toBe('error');
  });
});

describe('detecção de afirmações sem fonte', () => {
  const source = 'Garrafa térmica Inox 500ml. Mantém quente por 12 horas. Marca Termix modelo TX-500.';
  it('aceita medidas presentes na fonte', () => {
    expect(findUnsupportedClaims('Garrafa de 500 ml que mantém a bebida quente.', source)).toEqual([]);
  });
  it('acusa medidas, garantia e certificações inventadas', () => {
    const claims = findUnsupportedClaims(
      'Garrafa de 750ml, 30% mais leve, garantia de 2 anos, livre de BPA e aprovada pelo Inmetro.',
      source,
    );
    const kinds = claims.map((c) => c.kind).sort();
    expect(kinds).toEqual(['certification', 'certification', 'measure', 'percent', 'warranty']);
  });
  it('confere marca e modelo no título', () => {
    expect(identityPreserved('Garrafa Térmica Termix TX-500 500ml', 'Termix', 'TX-500')).toEqual([]);
    expect(identityPreserved('Garrafa Térmica 500ml', 'Termix', 'TX-500')).toHaveLength(2);
  });
});
