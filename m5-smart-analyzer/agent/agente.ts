/**
 * Agente de SIMULAÇÃO 24 h do M5 Smart Analyzer.
 *
 * - Lê candles da API PÚBLICA da Binance (cripto). Não usa chave, login nem conta.
 * - Detecta toques em zonas armadas e registra entradas VIRTUAIS.
 * - Resolve cada entrada no fechamento do M5 e grava diario.csv / diario.json.
 * - NÃO envia ordens, nem reais nem de teste. Dinheiro de mentira.
 *
 * Uso:  npm run agente -- --exploratorio
 *       npm run agente -- --config agent/config.exemplo.json --simbolos BTCUSDT,ETHUSDT
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BINANCE_BASES, isValidSymbol, parseKlines } from '../src/core/binance';
import { applyExploratoryPreset, configHash, defaultConfig, setParam, setRuleEnabled, validateParamValue } from '../src/core/config';
import { journalCsv, journalStats, loadJournalFromJson, type JournalEntry } from '../src/core/journal';
import { formatSummary } from '../src/core/relatorio';
import { SimSession } from '../src/core/session';
import { PARAM_KEYS, RULE_IDS, type AnalysisConfig, type Candle, type ParamKey, type RuleId } from '../src/core/types';

const AJUDA = `
Agente de simulação do M5 Smart Analyzer (dinheiro de mentira: não envia ordens).

  npm run agente -- --exploratorio              usa os valores exploratórios (NÃO vêm da aula)
  npm run agente -- --config arquivo.json       usa seus parâmetros (veja agent/config.exemplo.json)

Opções:
  --simbolos A,B,C    pares da Binance (padrão: BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT)
  --intervalo N       segundos entre consultas (padrão 5, mínimo 3)
  --payout N          payout da corretora em % para o equilíbrio (padrão 80)
  --dados PASTA       onde gravar diario.json/diario.csv/agente.log (padrão agent/dados)
  --ciclos N          para depois de N consultas (testes)
  --base URL          host da API (só para testes)
`;

interface Args { [k: string]: string | boolean }

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

function fail(msg: string): never {
  console.error(`\nERRO: ${msg}\n`);
  process.exit(2);
}

/** Aplica um arquivo de configuração (parâmetros e critérios) validando cada valor. */
function applyConfigFile(base: AnalysisConfig, path: string): { config: AnalysisConfig; payout?: number; simbolos?: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(resolve(path), 'utf8')); } catch (e) { fail(`não consegui ler ${path}: ${e instanceof Error ? e.message : e}`); }
  const o = raw as { params?: Record<string, unknown>; enabled?: Record<string, unknown>; payout?: unknown; simbolos?: unknown };
  let config = base;
  for (const [k, v] of Object.entries(o.params ?? {})) {
    if (!(PARAM_KEYS as readonly string[]).includes(k)) fail(`parâmetro desconhecido em ${path}: "${k}"`);
    if (v === null) { config = setParam(config, k as ParamKey, null); continue; }
    if (typeof v !== 'number') fail(`"${k}" precisa ser número ou null`);
    const err = validateParamValue(k as ParamKey, v);
    if (err) fail(`"${k}": ${err}`);
    config = setParam(config, k as ParamKey, v);
  }
  for (const [k, v] of Object.entries(o.enabled ?? {})) {
    if (!(RULE_IDS as readonly string[]).includes(k)) fail(`critério desconhecido em ${path}: "${k}"`);
    if (typeof v !== 'boolean') fail(`"enabled.${k}" precisa ser true ou false`);
    config = setRuleEnabled(config, k as RuleId, v);
  }
  return {
    config,
    payout: typeof o.payout === 'number' ? o.payout : undefined,
    simbolos: Array.isArray(o.simbolos) ? o.simbolos.filter((x): x is string => typeof x === 'string') : undefined,
  };
}

const ts = () => new Date().toLocaleString('pt-BR', { hour12: false });

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.ajuda || args.h) { console.log(AJUDA); return; }

  let config = defaultConfig();
  let payout = 80;
  let simbolos = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
  if (typeof args.config === 'string') {
    const r = applyConfigFile(config, args.config);
    config = r.config;
    if (r.payout !== undefined) payout = r.payout;
    if (r.simbolos?.length) simbolos = r.simbolos;
  } else if (args.exploratorio) {
    config = applyExploratoryPreset(config);
  } else {
    fail('escolha os parâmetros: --exploratorio (valores de teste, NÃO da aula) ou --config arquivo.json. Veja --ajuda.');
  }
  if (typeof args.simbolos === 'string') simbolos = args.simbolos.split(',');
  simbolos = [...new Set(simbolos.map((s) => s.trim().toUpperCase()))];
  const ruins = simbolos.filter((s) => !isValidSymbol(s));
  if (ruins.length || simbolos.length === 0 || simbolos.length > 12) fail(`símbolos inválidos (use até 12, ex.: BTCUSDT): ${ruins.join(', ') || '(nenhum)'}`);
  if (typeof args.payout === 'string') {
    const n = Number(args.payout);
    if (!Number.isFinite(n) || n < 50 || n > 100) fail('--payout precisa estar entre 50 e 100');
    payout = n;
  }
  const intervalo = Math.max(3, Number(args.intervalo ?? 5) || 5);
  const maxCiclos = typeof args.ciclos === 'string' ? Number(args.ciclos) : Infinity;

  const p = config.params;
  if ([p.zoneToleranceMult, p.retractionMinMult, p.retractionWindow].some((x) => x.value === null)) {
    fail('faltam parâmetros da zona e da retração (zoneToleranceMult, retractionMinMult, retractionWindow). Sem eles não existe zona armada e o agente não registraria nada.');
  }

  const dir = resolve(typeof args.dados === 'string' ? args.dados : join('agent', 'dados'));
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, 'diario.json');
  const csvPath = join(dir, 'diario.csv');
  const logPath = join(dir, 'agente.log');
  const log = (msg: string) => {
    const line = `[${ts()}] ${msg}`;
    console.log(line);
    try { appendFileSync(logPath, line + '\n'); } catch { /* disco indisponível: segue só no console */ }
  };
  const save = (list: JournalEntry[]) => {
    const tmp = jsonPath + '.tmp';
    writeFileSync(tmp, JSON.stringify(list));
    renameSync(tmp, jsonPath);
    writeFileSync(csvPath, journalCsv(list));
  };

  const bases = typeof args.base === 'string' ? [args.base.replace(/\/$/, '')] : [...BINANCE_BASES];
  let baseIdx = 0;
  const api = async (path: string): Promise<unknown> => {
    let last: unknown = new Error('sem resposta');
    for (let i = 0; i < bases.length; i++) {
      const idx = (baseIdx + i) % bases.length;
      try {
        const r = await fetch(bases[idx] + path, { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: unknown = await r.json();
        baseIdx = idx;
        return j;
      } catch (e) { last = e; }
    }
    throw last instanceof Error ? last : new Error('falha de rede');
  };
  let offset = 0;
  const syncClock = async () => {
    try { const r = (await api('/api/v3/time')) as { serverTime?: number }; if (typeof r.serverTime === 'number') offset = r.serverTime - Date.now(); } catch { /* mantém o anterior */ }
  };
  await syncClock();

  const previous: JournalEntry[] = existsSync(jsonPath) ? loadJournalFromJson(readFileSync(jsonPath, 'utf8')) : [];
  const session = new SimSession({
    fetchKlines: async (symbol, interval, limit, extra = ''): Promise<Candle[]> =>
      parseKlines(await api(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}${extra}`)),
    now: () => Date.now() + offset,
  }, config, simbolos, previous);

  console.log('='.repeat(78));
  console.log(' AGENTE DE SIMULAÇÃO — dinheiro de mentira. Não envia ordens, não usa chaves.');
  console.log(' Dados: API pública da Binance (cripto). NÃO são os preços da Quotex.');
  console.log('='.repeat(78));
  log(`iniciado · pares: ${simbolos.join(', ')} · intervalo ${intervalo}s · payout ${payout}% · regras ${config.rulesVersion} · config ${configHash(config)}`);
  log(`parâmetros exploratórios/definidos por você: ${args.exploratorio ? 'valores EXPLORATÓRIOS (não vêm da aula)' : 'do arquivo de configuração'}`);
  log(`diário em ${dir} (${previous.length} registros anteriores retomados)`);

  let stop = false;
  let wake: (() => void) | null = null; // interrompe a espera entre consultas
  const shutdown = () => {
    if (!stop) { stop = true; log('encerrando: salvando o diário…'); }
    wake?.();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  let ciclos = 0;
  let falhas = 0;
  let lastStatus = 0;
  let lastSync = Date.now();
  let lastSummary = 0;
  while (!stop && ciclos < maxCiclos) {
    ciclos++;
    const r = await session.tick();
    for (const e of r.newEntries) log(`ENTRADA VIRTUAL ${e.symbol} ${e.side === 'resistencia' ? 'venda' : 'compra'} em ${e.entry} · restam ${Math.round(e.remainingSeconds)}s · cenário ${e.state}${e.triggerConfirmed ? ' · gatilho confirmado' : ''}`);
    for (const e of r.resolved) log(`RESULTADO ${e.symbol} ${e.result!.toUpperCase()} (entrada ${e.entry} → fechamento ${e.close})`);
    if (r.newEntries.length || r.resolved.length) {
      try { save(session.journal); } catch (e) { log(`aviso: não consegui gravar o diário (${e instanceof Error ? e.message : e})`); }
    }
    falhas = r.symbolsOk === 0 ? falhas + 1 : 0;
    if (falhas === 1 || falhas % 12 === 0) for (const e of r.errors.slice(0, 3)) log(`aviso: ${e.symbol}: ${e.message}`);
    if (Date.now() - lastStatus > 300_000) {
      lastStatus = Date.now();
      log(`ok · ${r.symbolsOk}/${simbolos.length} pares · ${session.journal.length} registros (${journalStats(session.journal, payout).pending} pendentes)`);
    }
    if (r.resolved.length || Date.now() - lastSummary > 3_600_000) {
      lastSummary = Date.now();
      for (const l of formatSummary(journalStats(session.journal, payout), payout)) log(l);
    }
    if (Date.now() - lastSync > 600_000) { lastSync = Date.now(); await syncClock(); }
    if (stop || ciclos >= maxCiclos) break;
    const espera = falhas > 0 ? Math.min(60, intervalo * 2 ** Math.min(falhas, 4)) : intervalo;
    await new Promise<void>((res) => {
      const t = setTimeout(res, espera * 1000);
      wake = () => { clearTimeout(t); res(); };
    });
    wake = null;
  }
  try { save(session.journal); } catch { /* já avisado */ }
  for (const l of formatSummary(journalStats(session.journal, payout), payout)) log(l);
  log('encerrado.');
}

void main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
