import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { criarFetchMt5, IDADE_MAXIMA_S } from '../../agent/mt5Fonte';
import { origemPermitida, responder } from '../../agent/ponteServidor';

const dir = mkdtempSync(join(tmpdir(), 'm5exp-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = 1_700_000_100;
function exportar(symbol: string, n: number, start = T0) {
  const linhas = Array.from({ length: n }, (_, i) => {
    const o = 1.1 + i * 0.0001;
    return `${start + i * 60},${o.toFixed(5)},${(o + 0.0002).toFixed(5)},${(o - 0.0001).toFixed(5)},${(o + 0.0001).toFixed(5)},10,${i === n - 1 ? 1 : 0}`;
  });
  writeFileSync(join(dir, `m5exp_${symbol}_M1.csv`), 'timestamp,open,high,low,close,volume,forming\n' + linhas.join('\n') + '\n');
}

describe('leitor Node dos arquivos do MT5', () => {
  it('devolve candles M5 e M1', async () => {
    exportar('EURUSD', 20);
    const f = criarFetchMt5(dir, () => (T0 + 20 * 60 + 5) * 1000);
    expect((await f('EURUSD', '5m', 100)).length).toBeGreaterThanOrEqual(3);
    expect(await f('EURUSD', '1m', 8)).toHaveLength(8);
  });

  it('recusa dado velho para análise, mas deixa resolver uma entrada antiga', async () => {
    exportar('GBPUSD', 20);
    const velho = (T0 + 20 * 60 + IDADE_MAXIMA_S + 120) * 1000;
    const f = criarFetchMt5(dir, () => velho);
    await expect(f('GBPUSD', '5m', 100)).rejects.toThrow(/parados/);
    expect((await f('GBPUSD', '5m', 1, `&startTime=${T0 * 1000}`))[0]!.t).toBe(T0);
  });

  it('arquivo ausente e símbolo com caminho dão erro claro', async () => {
    const f = criarFetchMt5(dir, () => T0 * 1000);
    await expect(f('USDJPY', '5m', 10)).rejects.toThrow(/não encontrado/);
    await expect(f('../segredo', '5m', 10)).rejects.toThrow(/inválido/);
  });
});

describe('ponte local', () => {
  const deps = { pasta: dir, now: () => (T0 + 20 * 60 + 5) * 1000 };
  const get = (url: string, method = 'GET') => responder(deps, { url, method, headers: {} });

  it('responde no formato de klines da Binance e na hora do computador', async () => {
    exportar('EURUSD', 20);
    expect((await get('/api/v3/time')).body).toEqual({ serverTime: deps.now() });
    const r = await get('/api/v3/klines?symbol=EURUSD&interval=1m&limit=3');
    expect(r.status).toBe(200);
    const k = r.body as string[][];
    expect(k).toHaveLength(3);
    expect(k[0]).toHaveLength(6);
    expect(typeof k[0]![0]).toBe('number'); // instante em ms, como a Binance
  });

  it('só aceita GET e entradas válidas', async () => {
    expect((await get('/api/v3/klines?symbol=EURUSD&interval=1m', 'POST')).status).toBe(405);
    expect((await get('/api/v3/klines?symbol=..%2Fx&interval=1m')).status).toBe(400);
    expect((await get('/api/v3/klines?symbol=EURUSD&interval=15m')).status).toBe(400);
    expect((await get('/api/v3/klines?symbol=EURUSD&interval=5m&startTime=abc')).status).toBe(400);
    expect((await get('/qualquer-outra')).status).toBe(404);
    expect((await get('/api/v3/klines?symbol=SEMARQ&interval=5m&limit=5')).status).toBe(503);
  });

  it('CORS: só o app publicado e endereços locais', () => {
    expect(origemPermitida('https://m5-smart-analyzer.vercel.app')).toBe(true);
    expect(origemPermitida('http://localhost:5173')).toBe(true);
    expect(origemPermitida('https://evil.example.com')).toBe(false);
    expect(origemPermitida('https://m5-smart-analyzer.vercel.app.evil.com')).toBe(false);
  });
});

describe('segurança do script MQL5', () => {
  const codigo = readFileSync(join(__dirname, '../../mql5/M5Exportador.mq5'), 'utf8');
  // remove comentários e strings: a checagem vale para o que o script EXECUTA
  const executavel = codigo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

  it('não tem nenhuma chamada de negociação, DLL ou internet', () => {
    const proibidos = [
      'OrderSend', 'OrderSendAsync', 'OrderCheck', 'CTrade', 'PositionOpen', 'PositionClose', 'PositionModify', 'OrderModify',
      'OrderDelete', 'Buy(', 'Sell(', 'BuyLimit', 'SellLimit', 'BuyStop', 'SellStop', 'trade/Trade.mqh',
      '#import', 'WebRequest', 'SocketCreate', 'SocketConnect', 'DLL', 'ShellExecute', 'FileDelete',
    ];
    for (const p of proibidos) expect(executavel, p).not.toContain(p);
  });

  it('só escreve na pasta comum e troca o arquivo de uma vez', () => {
    expect(executavel).toContain('FILE_COMMON');
    expect(executavel).toContain('FileMove');
  });
});
