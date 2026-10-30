import { describe, expect, it } from 'vitest';
import { DATA_STORAGE_KEY, MAX_PERSISTED_CANDLES, loadData, saveData } from './dataStore';
import { generateDemoCandles, demoSource } from './demo';
import { memoryStore } from './testing/fixtures';

const make = (n = 60) => {
  const candles = generateDemoCandles('lateral', n);
  return { candles, source: demoSource('lateral', candles, 'UTC', 1) };
};

describe('persistência dos candles carregados', () => {
  it('grava e recarrega candles e fonte sem perdas', () => {
    const store = memoryStore();
    const d = make();
    expect(saveData(store, d)).toBe('salvo');
    expect(loadData(store)).toEqual(d);
  });

  it('não persiste conjuntos grandes demais e limpa o que havia', () => {
    const store = memoryStore();
    saveData(store, make());
    const big = make(MAX_PERSISTED_CANDLES + 1);
    expect(saveData(store, big)).toBe('grande_demais');
    expect(store.getItem(DATA_STORAGE_KEY)).toBeNull();
  });

  it('remover dados apaga o armazenamento', () => {
    const store = memoryStore();
    saveData(store, make());
    saveData(store, null);
    expect(loadData(store)).toBeNull();
  });

  it('rejeita dados corrompidos em vez de analisá-los', () => {
    const store = memoryStore();
    const d = make(40);
    saveData(store, d);
    const raw = JSON.parse(store.getItem(DATA_STORAGE_KEY)!);
    raw.rows[10][2] = 0.0001; // high menor que o corpo
    store.setItem(DATA_STORAGE_KEY, JSON.stringify(raw));
    expect(loadData(store)).toBeNull();
    raw.rows[10][2] = d.candles[10]!.h;
    raw.rows[11][0] = raw.rows[10][0]; // timestamp repetido
    store.setItem(DATA_STORAGE_KEY, JSON.stringify(raw));
    expect(loadData(store)).toBeNull();
    store.setItem(DATA_STORAGE_KEY, '{lixo');
    expect(loadData(store)).toBeNull();
  });

  it('armazenamento que lança exceção não derruba nada', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('cota'); }, removeItem: () => {} };
    expect(saveData(broken, make())).toBe('falhou');
    expect(loadData(broken)).toBeNull();
  });
});
