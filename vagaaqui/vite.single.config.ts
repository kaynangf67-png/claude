import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// No arquivo único (aberto via file://) o WebAssembly do sensor de câmera vem do CDN.
process.env.VITE_MEDIAPIPE_WASM_URL ??= 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

/**
 * Gera um único HTML autocontido (JS e CSS embutidos) para abrir com clique
 * duplo, sem servidor: `npm run build:single` → dist-single/vagaaqui.html
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
