import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Gera um único HTML autocontido (JS e CSS embutidos) para abrir com clique
 * duplo, sem servidor: `npm run build:single` → dist-single/index.html
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
