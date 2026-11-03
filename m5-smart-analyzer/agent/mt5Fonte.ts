import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { idadeSegundos, klines, nomeArquivo, parseExport, type M1Row } from '../src/core/arquivoM1';
import type { Candle } from '../src/core/types';

/**
 * Leitura dos arquivos exportados por `mql5/M5Exportador.mq5`. Só lê arquivos
 * locais; não abre rede, não envia nada ao MT5. Devolve candles no formato da
 * API de klines, para o agente e a ponte usarem o mesmo caminho da Binance.
 */

/** Sem candle novo há mais que isso = script parado ou mercado fechado: não analisa dado velho. */
export const IDADE_MAXIMA_S = 180;

export function pastaPadraoWindows(): string | null {
  const base = process.env['APPDATA'];
  return base ? join(base, 'MetaQuotes', 'Terminal', 'Common', 'Files') : null;
}

export function lerM1(pasta: string, symbol: string): M1Row[] {
  const file = join(resolve(pasta), nomeArquivo(symbol));
  let texto: string;
  try { texto = readFileSync(file, 'utf8'); } catch {
    throw new Error(`arquivo não encontrado: ${file} (o script M5Exportador está rodando no MT5 e o símbolo está certo?)`);
  }
  return parseExport(texto).candles;
}

/** Mesma assinatura de `SessionDeps.fetchKlines`. `now` em ms. */
export function criarFetchMt5(pasta: string, now: () => number) {
  return async (symbol: string, interval: '1m' | '5m', limit: number, extra = ''): Promise<Candle[]> => {
    const nowSec = now() / 1000;
    const c1 = lerM1(pasta, symbol);
    if (c1.length === 0) throw new Error(`arquivo de ${symbol} vazio ou ilegível`);
    const startTime = /[?&]startTime=(\d+)/.exec(extra)?.[1];
    // resolver uma entrada antiga só precisa do candle daquele instante; para analisar, o dado tem que ser fresco
    if (startTime === undefined) {
      const idade = idadeSegundos(c1, nowSec);
      if (idade > IDADE_MAXIMA_S) throw new Error(`dados de ${symbol} parados há ${Math.round(idade)}s (script parado ou mercado fechado)`);
    }
    return klines(c1, interval, limit, nowSec, startTime === undefined ? undefined : Number(startTime) / 1000);
  };
}
