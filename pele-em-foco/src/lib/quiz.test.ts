import { describe, expect, it } from 'vitest';
import { CATEGORY_GUIDES } from '../content/products';
import { ALERTS, buildResult, emptyAnswers, isComplete, type QuizAnswers } from './quiz';

const base: QuizAnswers = { oiliness: 'zona-t', sensitivity: 'nao', makeup: false, sweat: false, shaves: false, alerts: [] };
const allText = (a: QuizAnswers) => {
  const r = buildResult(a);
  return [...r.suggestions.map((s) => s.text), ...r.habits].join(' ');
};

describe('questionário de rotina', () => {
  it('só completa com as perguntas 1 a 5 respondidas; alertas são opcionais', () => {
    expect(isComplete(emptyAnswers())).toBe(false);
    expect(isComplete({ ...base, makeup: null })).toBe(false);
    expect(isComplete(base)).toBe(true);
  });

  it('qualquer sinal de alerta leva ao dermatologista', () => {
    expect(buildResult(base).seeDermatologist).toBe(false);
    for (const a of ALERTS) expect(buildResult({ ...base, alerts: [a.value] }).seeDermatologist).toBe(true);
  });

  it('sempre sugere limpador, hidratante e protetor; demaquilante só com maquiagem', () => {
    const cats = (a: QuizAnswers) => buildResult(a).suggestions.map((s) => s.category);
    expect(cats(base)).toEqual(['limpador', 'hidratante', 'protetor']);
    expect(cats({ ...base, makeup: true })).toContain('demaquilante');
  });

  it('as categorias sugeridas existem no guia de produtos', () => {
    const ids = new Set(CATEGORY_GUIDES.map((g) => g.id));
    for (const s of buildResult({ ...base, makeup: true }).suggestions) expect(ids.has(s.category!)).toBe(true);
  });

  it('adapta textura e hábitos às respostas', () => {
    expect(allText({ ...base, oiliness: 'seca' })).toMatch(/creme/);
    expect(allText({ ...base, oiliness: 'rosto-todo' })).toMatch(/matte/);
    expect(allText({ ...base, sensitivity: 'as-vezes' })).toMatch(/sem fragrância/);
    expect(allText({ ...base, sweat: true })).toMatch(/Resistente à água/);
    expect(allText({ ...base, shaves: true })).toMatch(/barba/);
  });

  it('não promete cura, não indica medicamento e não cita marca', () => {
    const variants: QuizAnswers[] = [base, { ...base, oiliness: 'seca', sensitivity: 'sim', makeup: true, sweat: true, shaves: true }];
    for (const v of variants) {
      expect(allText(v)).not.toMatch(/cura|garant|elimina|isotretino|antibi[oó]tico|peróxido|adapaleno|tretino[ií]na|ácido salicílico/i);
    }
  });
});
