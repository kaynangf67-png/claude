import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Modo "artifact": publica o app inteiro como página estática em subcaminho
// (caminhos relativos + rotas com #). Uso: npm run build:artifact
function relativeAssets(): Plugin {
  return {
    name: 'lumia-relative-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.*\.(ts|tsx)$/.test(id)) return null;
      return code.replace(/(['"`])\/(media|posters|models)\//g, '$1./$2/');
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  plugins: [react(), ...(mode === 'artifact' ? [relativeAssets()] : [])],
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
}));
