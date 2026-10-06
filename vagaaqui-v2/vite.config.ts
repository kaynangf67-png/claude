import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('maplibre-gl') ? 'maplibre' : undefined) },
    },
  },
  test: { environment: 'node' },
});
