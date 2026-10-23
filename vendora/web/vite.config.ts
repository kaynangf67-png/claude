import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Mesma origem em dev: cookies de sessão e callback do OAuth funcionam sem CORS.
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  test: { environment: 'jsdom' },
});
