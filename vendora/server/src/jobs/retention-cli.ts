// Execução avulsa da retenção: npm run retention -w server
import { createContext } from '../app';
import { loadConfig } from '../config';
import { runRetention } from './retention';

const ctx = createContext(loadConfig());
console.log(await runRetention(ctx));
await ctx.db.$disconnect();
