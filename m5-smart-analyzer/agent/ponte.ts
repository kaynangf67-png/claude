/**
 * Ponte LOCAL de leitura: serve os arquivos exportados do MT5 no formato da API
 * de klines da Binance, só para o app web (aberto no seu navegador) mostrar o forex.
 *
 * - Escuta somente em 127.0.0.1 (este computador). Nada sai para a internet.
 * - Só tem GET de candles. Não recebe ordens, não fala com o MT5, não usa chaves.
 *
 * Uso:  npm run ponte
 *       npm run ponte -- --pasta "C:\Users\...\Common\Files" --porta 8765
 */
import { existsSync } from 'node:fs';
import { pastaPadraoWindows } from './mt5Fonte';
import { criarServidor } from './ponteServidor';

const AJUDA = `
Ponte local MT5 -> app (somente leitura, 127.0.0.1).

  npm run ponte                         usa a pasta padrão do MT5 no Windows
  npm run ponte -- --pasta CAMINHO      pasta Common\\Files do MT5
  npm run ponte -- --porta 8765         porta local (padrão 8765)
`;

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['ajuda']) { console.log(AJUDA); return; }
  const pasta = typeof args['pasta'] === 'string' ? args['pasta'] : pastaPadraoWindows();
  if (!pasta || !existsSync(pasta)) {
    console.error(`\nERRO: pasta do MT5 não encontrada${pasta ? `: ${pasta}` : ''}. Use --pasta (veja docs/MT5.md).\n`);
    process.exit(2);
  }
  const porta = typeof args['porta'] === 'string' ? Number(args['porta']) : 8765;
  if (!Number.isInteger(porta) || porta < 1024 || porta > 65535) { console.error('\nERRO: --porta inválida.\n'); process.exit(2); }
  criarServidor({ pasta, now: () => Date.now() }).listen(porta, '127.0.0.1', () => {
    console.log('='.repeat(70));
    console.log(' Ponte MT5 -> app: SOMENTE LEITURA, só neste computador (127.0.0.1).');
    console.log(` Pasta: ${pasta}`);
    console.log(` No app: Ao vivo > Fonte "MT5" > endereço http://127.0.0.1:${porta}`);
    console.log(' Para parar: feche esta janela ou Ctrl+C.');
    console.log('='.repeat(70));
  });
}

void main();
