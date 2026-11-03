import { describe, expect, it } from 'vitest';
import {
  CONFIG_STORAGE_KEY, clearUndefinedParams, applyExploratoryPreset, configHash, defaultConfig, loadConfig, saveConfig,
  sanitizeConfig, setParam, setRuleEnabled, validateParamValue,
} from './config';
import { analyze } from './engine';
import {
  compareByState, createRecord, csvCell, filterRecords, laterCandlesAvailable, loadHistory, recordsToCsv, saveHistory,
  setOutcome, type AnalysisRecord,
} from './history';
import { fullConfig, memoryStore, rangeBound, strongTrend, testSource } from './testing/fixtures';

describe('persistência das configurações', () => {
  it('grava e recarrega a configuração, incluindo origem dos parâmetros e filtros desabilitados', () => {
    const store = memoryStore();
    let c = setParam(defaultConfig(), 'wickRelevantRatio', 0.4);
    c = setRuleEnabled(c, 'alternancia', false);
    expect(saveConfig(store, c)).toBe(true);
    const back = loadConfig(store);
    expect(back.params.wickRelevantRatio).toEqual({ value: 0.4, origin: 'usuario' });
    expect(back.enabled.alternancia).toBe(false);
    expect(back.params.minPriorValidTouches).toEqual({ value: 2, origin: 'aula' });
    expect(configHash(back)).toBe(configHash(c));
  });

  it('sem nada salvo, devolve o padrão com parâmetros da aula 1 indefinidos', () => {
    const c = loadConfig(memoryStore());
    expect(c.params.wickRelevantRatio).toEqual({ value: null, origin: 'nao_definido' });
    expect(c.params.maxSameDirectionRun).toEqual({ value: 3, origin: 'aula' });
  });

  it('JSON corrompido ou armazenamento que lança exceção não derruba o app', () => {
    const store = memoryStore();
    store.setItem(CONFIG_STORAGE_KEY, '{nao e json');
    expect(loadConfig(store)).toEqual(defaultConfig());
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cota'); }, removeItem: () => {} };
    expect(loadConfig(broken)).toEqual(defaultConfig());
    expect(saveConfig(broken, defaultConfig())).toBe(false);
  });

  it('valores inválidos ou fora do intervalo voltam ao padrão; os válidos são mantidos', () => {
    const c = sanitizeConfig({
      enabled: { pavios: false, alternancia: 'sim' },
      params: {
        wickRelevantRatio: { value: 7, origin: 'usuario' }, // fora do intervalo
        bigBodyRatio: { value: 0.85, origin: 'usuario' },
        swingLookback: { value: 2.5, origin: 'usuario' }, // não inteiro
        minCandles: { value: null, origin: 'nao_definido' }, // essencial: não pode ficar indefinido
        zoneToleranceMult: { value: 1, origin: 'invalida' },
      },
    });
    expect(c.params.wickRelevantRatio.value).toBeNull();
    expect(c.params.bigBodyRatio).toEqual({ value: 0.85, origin: 'usuario' });
    expect(c.params.swingLookback.value).toBe(2);
    expect(c.params.minCandles.value).toBe(30);
    expect(c.params.zoneToleranceMult.value).toBeNull();
    expect(c.enabled.pavios).toBe(false);
    expect(c.enabled.alternancia).toBe(true);
    expect(sanitizeConfig('lixo')).toEqual(defaultConfig());
  });

  it('valida limites dos parâmetros', () => {
    expect(validateParamValue('swingLookback', 0)).toMatch(/entre/);
    expect(validateParamValue('swingLookback', 2.5)).toMatch(/inteiro/);
    expect(validateParamValue('swingLookback', 3)).toBeNull();
    expect(validateParamValue('wickRelevantRatio', NaN)).toBe('Valor inválido.');
  });

  it('limpar o preset exploratório devolve os parâmetros a "não definido"', () => {
    const withPreset = applyExploratoryPreset(defaultConfig());
    expect(withPreset.params.zoneToleranceMult.origin).toBe('preset_exploratorio');
    const cleared = clearUndefinedParams(withPreset);
    expect(cleared.params.zoneToleranceMult).toEqual({ value: null, origin: 'nao_definido' });
  });
});

describe('histórico de análises', () => {
  const mk = (cs = rangeBound(5, 5), config = fullConfig(), synthetic = false, now = 1_700_000_000_000) => {
    const source = testSource(cs, { synthetic, asset: 'EURUSD-OTC', origin: 'export do usuário' });
    return createRecord(analyze({ candles: cs, source, config }), config, source, now, 'obs')!;
  };

  it('cria o registro com todos os campos exigidos', () => {
    const r = mk();
    expect(r).toMatchObject({
      asset: 'EURUSD-OTC', timeframe: 'M5', state: 'FAVORAVEL', rulesVersion: defaultConfig().rulesVersion, note: 'obs', outcome: null,
    });
    expect(r.source.origin).toBe('export do usuário');
    expect(r.window!.count).toBeGreaterThan(0);
    expect(r.favorableFilters).toContain('Pavios visíveis');
    expect(r.trigger.confirmed).toBe(false);
    expect(r.configHash).toBe(configHash(fullConfig()));
  });

  it('guarda uma cópia da configuração: alterar depois não muda registros antigos', () => {
    const config = fullConfig();
    const rec = mk(rangeBound(5, 5), config);
    config.params.wickRelevantRatio.value = 0.99;
    expect(rec.configSnapshot.params.wickRelevantRatio.value).toBe(0.3);
  });

  it('registra motivos de não entrada para cenários desfavoráveis', () => {
    const rec = mk(strongTrend(60));
    expect(rec.state).toBe('DESFAVORAVEL');
    expect(rec.noEntryReasons.length).toBeGreaterThan(0);
  });

  it('persiste e recarrega, descartando registros malformados', () => {
    const store = memoryStore();
    const rec = mk();
    expect(saveHistory(store, [rec])).toBe(true);
    store.setItem('m5sa.history.v1', JSON.stringify([rec, { id: 1 }, null]));
    expect(loadHistory(store)).toEqual([rec]);
    store.setItem('m5sa.history.v1', 'xx');
    expect(loadHistory(store)).toEqual([]);
  });

  it('filtra por ativo, timeframe, classificação, configuração, data e origem', () => {
    const a = mk(rangeBound(5, 5), fullConfig(), false, 1_700_000_000_000);
    const b = mk(strongTrend(60), fullConfig(), true, 1_800_000_000_000);
    const rs = [a, b];
    expect(filterRecords(rs, { asset: 'eurusd' })).toHaveLength(2);
    expect(filterRecords(rs, { asset: 'xyz' })).toHaveLength(0);
    expect(filterRecords(rs, { state: 'DESFAVORAVEL' })).toEqual([b]);
    expect(filterRecords(rs, { timeframe: 'M1' })).toHaveLength(0);
    expect(filterRecords(rs, { configHash: a.configHash })).toHaveLength(2);
    expect(filterRecords(rs, { configHash: 'zzzz' })).toHaveLength(0);
    expect(filterRecords(rs, { fromDate: 1_750_000_000 })).toEqual([b]);
    expect(filterRecords(rs, { toDate: 1_750_000_000 })).toEqual([a]);
    expect(filterRecords(rs, { origin: 'reais' })).toEqual([a]);
    expect(filterRecords(rs, { origin: 'sinteticas' })).toEqual([b]);
  });

  it('o resultado posterior é manual e a comparação ignora dados sintéticos', () => {
    const real = mk(rangeBound(5, 5), fullConfig(), false);
    const demo = mk(rangeBound(5, 5), fullConfig(), true);
    let rs: AnalysisRecord[] = [real, demo];
    rs = setOutcome(rs, real.id, { value: 'retracao_observada', note: '', recordedAt: 1 });
    rs = setOutcome(rs, demo.id, { value: 'retracao_observada', note: '', recordedAt: 1 });
    const fav = compareByState(rs).find((r) => r.state === 'FAVORAVEL')!;
    expect(fav).toMatchObject({ total: 1, retracaoObservada: 1, semResultado: 0 });
    expect(rs[0]!.outcome).not.toBeNull();
    expect(setOutcome(rs, real.id, null)[0]!.outcome).toBeNull();
  });

  it('identifica resultados sem dados posteriores suficientes', () => {
    const cs = rangeBound(5, 5);
    const rec = mk(cs);
    const times = cs.map((c) => c.t);
    expect(laterCandlesAvailable(rec, { datasetId: rec.source.datasetId, candleTimes: times })).toBe(0);
    const longer = [...times, times.at(-1)! + 300, times.at(-1)! + 600];
    expect(laterCandlesAvailable(rec, { datasetId: rec.source.datasetId, candleTimes: longer })).toBe(2);
    expect(laterCandlesAvailable(rec, null)).toBe(0);
  });
});

describe('exportação CSV', () => {
  it('escapa aspas, vírgulas e quebras de linha', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
    expect(csvCell(12)).toBe('12');
  });

  it('neutraliza injeção de fórmulas em planilhas', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('gera cabeçalho e uma linha por registro', () => {
    const cs = rangeBound(5, 5);
    const config = fullConfig();
    const source = testSource(cs, { asset: '=cmd|calc' });
    const rec = createRecord(analyze({ candles: cs, source, config }), config, source, 1_700_000_000_000)!;
    const csv = recordsToCsv([rec]);
    const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines[0]).toContain('classificacao');
    expect(lines[0]).toContain('versao_regras');
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain('FAVORAVEL');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
