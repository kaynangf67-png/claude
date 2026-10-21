import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, diffDays, toKey } from './dates';
import { dayProgress, isDone, ROUTINE_STEPS, stepsFor } from './routine';
import { OBSERVATIONS, SKIN_FEELS } from './journal';
import { validateDisplayName, validateEmail, validatePassword } from './validation';
import { isCaktoCheckout, missingLaunchConfig, type Launch } from '../config/launch';
import { ARTICLES, CATEGORIES } from '../content/articles';
import { CATEGORY_GUIDES, PRODUCTS, productIssues, type Product } from '../content/products';

const migration = readFileSync(new URL('../../supabase/migrations/20261020120000_pele_em_foco_schema.sql', import.meta.url), 'utf8');

describe('datas', () => {
  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-20', '2026-11-19')).toBe(30);
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('rotina', () => {
  it('tem os passos educativos pedidos', () => {
    expect(stepsFor('manha').map((s) => s.label)).toEqual(['Limpeza suave', 'Hidratação', 'Proteção solar']);
    expect(stepsFor('noite').map((s) => s.label)).toEqual(['Limpeza suave', 'Hidratação', 'Revisão dos cuidados utilizados']);
  });

  it('as chaves dos passos são exatamente as aceitas pelo banco', () => {
    for (const period of ['manha', 'noite'] as const) {
      const sql = migration.match(new RegExp(`period = '${period}' and step_key in \\(([^)]+)\\)`))![1];
      const dbKeys = [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      expect(stepsFor(period).map((s) => s.key)).toEqual(dbKeys);
    }
  });

  it('calcula progresso por dia e período', () => {
    const c = [
      { completedOn: '2026-10-20', period: 'manha' as const, stepKey: 'limpeza' },
      { completedOn: '2026-10-20', period: 'manha' as const, stepKey: 'protecao-solar' },
      { completedOn: '2026-10-19', period: 'noite' as const, stepKey: 'limpeza' },
    ];
    expect(dayProgress(c, '2026-10-20', 'manha')).toEqual({ done: 2, total: 3, complete: false });
    expect(dayProgress(c, '2026-10-20')).toEqual({ done: 2, total: 6, complete: false });
    expect(isDone(c, '2026-10-20', 'noite', 'limpeza')).toBe(false);
    expect(ROUTINE_STEPS).toHaveLength(6);
  });
});

describe('diário', () => {
  it('opções do formulário são exatamente as aceitas pelo banco', () => {
    const obs = migration.match(/observations <@ array\[([^\]]+)\]/)![1];
    expect(OBSERVATIONS.map((o) => o.value).sort()).toEqual([...obs.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort());
    const feel = migration.match(/skin_feel text check \(skin_feel in \(([^)]+)\)/)![1];
    expect(SKIN_FEELS.map((o) => o.value)).toEqual([...feel.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  });
});

describe('validação de formulários', () => {
  it('e-mail', () => {
    expect(validateEmail('')).toBe('Informe seu e-mail.');
    expect(validateEmail('ana@')).toBe('Este e-mail não parece válido.');
    expect(validateEmail(' ana@exemplo.com ')).toBeNull();
  });
  it('senha', () => {
    expect(validatePassword('')).toBe('Crie uma senha.');
    expect(validatePassword('abc12')).toMatch(/pelo menos 8/);
    expect(validatePassword('abcdefgh')).toMatch(/letras e números/);
    expect(validatePassword('pele2026foco')).toBeNull();
  });
  it('nome', () => {
    expect(validateDisplayName('x'.repeat(61))).toMatch(/60/);
    expect(validateDisplayName('Lu')).toBeNull();
  });
});

describe('configuração de lançamento', () => {
  const empty: Launch = { priceLabel: null, checkoutUrl: null, refundDays: 7, supportEmail: null, businessName: null, businessDocument: null, siteUrl: null };
  it('lista o que falta preencher', () => {
    expect(missingLaunchConfig(empty)).toHaveLength(4);
    const full = { ...empty, priceLabel: 'R$ 27', checkoutUrl: 'https://pay.cakto.com.br/abc123', supportEmail: 'a@b.c', businessName: 'X', businessDocument: '1' };
    expect(missingLaunchConfig(full)).toEqual([]);
    expect(missingLaunchConfig({ ...full, checkoutUrl: 'https://hotmart.com/x' })).toEqual(['VITE_CHECKOUT_URL não parece um link pay.cakto.com.br']);
  });
  it('aceita só links de oferta pay.cakto.com.br em https', () => {
    expect(isCaktoCheckout('https://pay.cakto.com.br/ct947fn_1173605')).toBe(true);
    expect(isCaktoCheckout('http://pay.cakto.com.br/abc')).toBe(false);
    expect(isCaktoCheckout('https://pay.cakto.com.br/')).toBe(false);
    expect(isCaktoCheckout('https://pay.cakto.com.br.golpe.com/abc')).toBe(false);
    expect(isCaktoCheckout('não é url')).toBe(false);
  });
});

describe('conteúdo', () => {
  it('as 6 categorias da biblioteca têm artigos e batem com o banco', () => {
    const dbCats = [...migration.match(/category text not null check \(category in \(([\s\S]+?)\)\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(CATEGORIES.map((c) => c.id)).toEqual(dbCats);
    for (const c of CATEGORIES) expect(ARTICLES.some((a) => a.category === c.id), c.id).toBe(true);
  });

  it('todo artigo tem slug válido e único e fontes em https', () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.minutes).toBeGreaterThan(0);
      expect(a.sources.length, a.slug).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('o seed do banco está atualizado com o conteúdo do app', () => {
    const seed = readFileSync(new URL('../../supabase/migrations/20261020120100_seed_educational_articles.sql', import.meta.url), 'utf8');
    for (const a of ARTICLES) expect(seed, `rode npm run db:seed-articles (${a.slug})`).toContain(JSON.stringify(a.sections).replaceAll("'", "''"));
  });

  it('nenhum texto promete cura ou prazo de resultado', () => {
    const text = JSON.stringify(ARTICLES).toLowerCase();
    for (const banned of ['cura a acne', 'pele perfeita em', 'garantido', 'em 7 dias']) expect(text).not.toContain(banned);
  });

  it('produtos cadastrados seguem as regras editoriais', () => {
    for (const p of PRODUCTS) expect(productIssues(p), p.id).toEqual([]);
    for (const p of PRODUCTS) expect(CATEGORY_GUIDES.some((g) => g.id === p.category)).toBe(true);
    const bad: Product = {
      id: 'x', name: 'Gel', brand: 'Marca', category: 'limpador', purpose: '', keyIngredients: ['Glicerina'], affiliate: true,
      price: { minBRL: 30, maxBRL: 40, verifiedAt: '', source: '' },
    };
    expect(productIssues(bad)).toEqual(expect.arrayContaining(['produto afiliado precisa de link', 'preço sem data de verificação', 'preço sem fonte']));
  });
});
