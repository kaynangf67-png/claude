import { describe, expect, it } from 'vitest';
import type { Product } from '../content/products';
import { buildTesteResult, emptyTeste, stepDone, steps, TESTE_ALERTS, type TesteAnswers } from './teste';

const leve: TesteAnswers = { ...emptyTeste(), skin: 'oleosa', lesions: ['cravos'], amount: 'poucas', marks: 'nao', sensitivity: 'nao', noAlerts: true };
const kit = (id: string, forSkin: Product['forSkin']): Product => ({ id, name: id, brand: 'X', category: 'kit', purpose: '', keyIngredients: ['a'], url: 'https://meli.la/x', affiliate: true, forSkin });
const KITS = [kit('oleosa', ['oleosa', 'mista']), kit('sensivel', ['sensivel']), kit('sem-perfil', undefined)];

describe('teste público', () => {
  it('pula a pergunta de quantidade quando quase não aparece nada', () => {
    expect(steps(emptyTeste())).toContain('amount');
    expect(steps({ ...emptyTeste(), noLesions: true })).not.toContain('amount');
  });

  it('cada etapa só libera com resposta', () => {
    const a = emptyTeste();
    for (const s of steps(a)) expect(stepDone(a, s)).toBe(false);
    for (const s of steps(leve)) expect(stepDone(leve, s)).toBe(true);
  });

  it('pele leve recebe rotina básica e o kit do tipo de pele', () => {
    const r = buildTesteResult(leve, KITS);
    expect(r.profile).toBe('basico');
    expect(r.kits.map((k) => k.id)).toEqual(['oleosa']);
  });

  it('pele sensível recebe só kit marcado para pele sensível', () => {
    expect(buildTesteResult({ ...leve, sensitivity: 'as-vezes' }, KITS).kits.map((k) => k.id)).toEqual(['sensivel']);
  });

  it('kit sem perfil de pele nunca é sugerido', () => {
    expect(buildTesteResult({ ...leve, skin: 'normal' }, KITS).kits).toEqual([]);
  });

  it('espinhas inflamadas frequentes pedem acompanhamento e não recebem kit', () => {
    const r = buildTesteResult({ ...leve, lesions: ['pus'], amount: 'varias' }, KITS);
    expect(r.profile).toBe('acompanhar');
    expect(r.kits).toEqual([]);
  });

  it('caroços, cicatrizes, muitas lesões ou qualquer alerta levam ao dermatologista, sem kit', () => {
    const cases: TesteAnswers[] = [
      { ...leve, lesions: ['carocos'] },
      { ...leve, marks: 'cicatrizes' },
      { ...leve, amount: 'muitas' },
      ...TESTE_ALERTS.map((x) => ({ ...leve, noAlerts: false, alerts: [x.value] })),
    ];
    for (const c of cases) {
      const r = buildTesteResult(c, KITS);
      expect(r.profile).toBe('dermatologista');
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.kits).toEqual([]);
    }
  });

  it('não promete cura nem cita medicamento', () => {
    const r = buildTesteResult({ ...leve, lesions: ['cravos', 'pus', 'carocos'], marks: 'manchas', sensitivity: 'sim', alerts: TESTE_ALERTS.map((x) => x.value) });
    const text = [...r.reasons, ...r.needs].join(' ');
    expect(text).not.toMatch(/cura|garant|elimina|isotretino|antibi[oó]tico|peróxido|adapaleno|tretino[ií]na/i);
  });
});
