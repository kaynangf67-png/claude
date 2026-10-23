import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/jobs/retention-cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é TypeScript puro e precisa ser empacotado junto.
  noExternal: ['@vendora/shared'],
});
