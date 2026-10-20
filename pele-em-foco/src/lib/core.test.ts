import { describe, expect, it } from 'vitest';
import { addDays, diffDays, toKey } from './dates';
import { buildRoutine, mergeRoutine, progress } from './routine';
import { lastDays, streak } from './habits';
import { emptyData, load, save, STORAGE_KEY } from './storage';
import { bonusStatus } from './bonus';
import { missingLaunchConfig } from '../config/launch';
import { CATEGORY_GUIDES, PRODUCTS, productIssues, type Product } from '../content/products';
import { ARTICLES } from '../content/articles';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const prefs = { name: '', skinFeel: 'oleosa' as const, usesMakeup: true, shaves: false, hasTreatment: true };

describe('datas', () => {
  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-20', '2026-11-19')).toBe(30);
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('rotina', () => {
  it('monta passos conforme as preferências', () => {
    const ids = buildRoutine(prefs).map((s) => s.id);
    expect(ids).toContain('demaquilar');
    expect(ids).toContain('tratamento');
    expect(ids).not.toContain('barbear');
    expect(ids.filter((id) => id === 'protetor')).toHaveLength(1);
  });

  it('mantém passos personalizados e desativados ao mudar preferências', () => {
    const routine = buildRoutine(prefs).map((s) => (s.id === 'hidratante-noite' ? { ...s, enabled: false } : s));
    routine.push({ id: 'custom-1', period: 'noite', label: 'Ler o diário', enabled: true, custom: true });
    const merged = mergeRoutine(routine, { ...prefs, usesMakeup: false, shaves: true });
    expect(merged.find((s) => s.id === 'hidratante-noite')?.enabled).toBe(false);
    expect(merged.some((s) => s.id === 'custom-1')).toBe(true);
    expect(merged.some((s) => s.id === 'demaquilar')).toBe(false);
    expect(merged.some((s) => s.id === 'barbear')).toBe(true);
  });

  it('calcula progresso só com passos ativos', () => {
    const routine = buildRoutine(prefs);
    const entry = { done: ['limpeza-manha', 'protetor'], habits: [], tags: [], note: '' };
    expect(progress(routine, entry, 'manha')).toEqual({ done: 2, total: 3, complete: false });
    expect(progress(routine, undefined).done).toBe(0);
  });
});

describe('hábitos', () => {
  it('conta sequência de dias completos', () => {
    const data = emptyData();
    const all = data.routine.map((s) => s.id);
    data.days['2026-10-18'] = { done: all, habits: [], tags: [], note: '' };
    data.days['2026-10-19'] = { done: all, habits: [], tags: [], note: '' };
    expect(streak(data, '2026-10-20')).toBe(2); // hoje ainda aberto
    data.days['2026-10-20'] = { done: all, habits: [], tags: [], note: '' };
    expect(streak(data, '2026-10-20')).toBe(3);
    expect(lastDays(data, '2026-10-20', 7)).toHaveLength(7);
    expect(lastDays(data, '2026-10-20', 7).filter((d) => d.complete)).toHaveLength(3);
  });
});

describe('armazenamento local', () => {
  it('salva e recarrega', () => {
    const storage = memoryStorage();
    const data = emptyData();
    data.preferences.name = 'Ana';
    data.days['2026-10-20'] = { done: ['protetor'], habits: ['dormi-bem'], tags: [], note: 'ok' };
    expect(save(data, storage)).toBe(true);
    const back = load(storage);
    expect(back.preferences.name).toBe('Ana');
    expect(back.days['2026-10-20'].done).toEqual(['protetor']);
  });

  it('volta ao estado inicial com JSON corrompido ou versão desconhecida', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{quebrado');
    expect(load(storage).onboardedAt).toBeNull();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(load(storage).days).toEqual({});
  });

  it('não quebra quando o navegador bloqueia o armazenamento', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => undefined,
    };
    expect(load(blocked).version).toBe(1);
    expect(save(emptyData(), blocked)).toBe(false);
  });
});

describe('bônus', () => {
  it('informa período ativo, último dia e encerrado', () => {
    expect(bonusStatus(null, '2026-10-20')).toEqual({ kind: 'nao-configurado' });
    expect(bonusStatus('2026-10-30', '2026-10-20')).toEqual({ kind: 'ativo', endDate: '2026-10-30', daysLeft: 10 });
    expect(bonusStatus('2026-10-20', '2026-10-20')).toMatchObject({ kind: 'ativo', daysLeft: 0 });
    expect(bonusStatus('2026-10-19', '2026-10-20')).toEqual({ kind: 'encerrado', endDate: '2026-10-19' });
  });
});

describe('configuração de lançamento', () => {
  it('lista o que falta preencher', () => {
    const empty = { priceLabel: null, checkoutUrl: null, bonusEndDate: null, refundDays: 7, supportEmail: null, businessName: null, businessDocument: null, siteUrl: null };
    expect(missingLaunchConfig(empty)).toHaveLength(5);
    const full = { ...empty, priceLabel: 'R$ 27', checkoutUrl: 'https://x', bonusEndDate: '2027-01-31', supportEmail: 'a@b.c', businessName: 'X', businessDocument: '1' };
    expect(missingLaunchConfig(full, '2026-10-20')).toEqual([]);
    expect(missingLaunchConfig(full, '2027-02-01')).toEqual(['Data do bônus já passou (VITE_BONUS_END_DATE)']);
  });
});

describe('conteúdo', () => {
  it('produtos cadastrados seguem as regras editoriais', () => {
    for (const p of PRODUCTS) expect(productIssues(p), p.id).toEqual([]);
    for (const p of PRODUCTS) expect(CATEGORY_GUIDES.some((g) => g.id === p.category)).toBe(true);
  });

  it('a validação recusa preço sem verificação e afiliado sem link', () => {
    const bad: Product = {
      id: 'x', name: 'Gel', brand: 'Marca', category: 'limpador', purpose: '', keyIngredients: ['Glicerina'], affiliate: true,
      price: { minBRL: 30, maxBRL: 40, verifiedAt: '', source: '' },
    };
    expect(productIssues(bad)).toEqual(expect.arrayContaining(['produto afiliado precisa de link', 'preço sem data de verificação', 'preço sem fonte']));
  });

  it('todo artigo tem fonte em https e slug único', () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    expect(slugs.size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.sources.length, a.slug).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('nenhum texto promete cura ou prazo de resultado', () => {
    const text = JSON.stringify(ARTICLES).toLowerCase();
    for (const banned of ['cura a acne', 'pele perfeita em', 'garantido', 'em 7 dias']) expect(text).not.toContain(banned);
  });
});
