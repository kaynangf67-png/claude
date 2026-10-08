import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // O motor 3D fica em um chunk separado: o catálogo e o player carregam
          // sem esperar Three.js, e o avatar só é baixado quando Libras é ativada.
          if (/node_modules\/(three|@react-three)\//.test(id)) return 'three';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
