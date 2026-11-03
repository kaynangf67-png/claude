// Gera public/exemplo-sintetico.csv a partir do mesmo gerador usado na demonstração.
// Uso: npm run gerar-exemplo
import { writeFileSync } from 'node:fs';
import { candlesToCsv } from '../src/core/csv';
import { generateDemoCandles } from '../src/core/demo';

writeFileSync(new URL('../public/exemplo-sintetico.csv', import.meta.url), candlesToCsv(generateDemoCandles('lateral', 240)));
console.log('public/exemplo-sintetico.csv gerado (dados FICTÍCIOS).');
