import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Serve (dev) e copia (build) o WebAssembly do MediaPipe para /mediapipe-wasm,
 * usado pelo sensor de câmera. Só as variantes com e sem SIMD (~23 MB),
 * baixadas apenas quando o sensor é aberto.
 */
export function mediapipeWasm(): Plugin {
  const dir = resolve('node_modules/@mediapipe/tasks-vision/wasm');
  const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use('/mediapipe-wasm', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        const file = join(dir, name);
        if (!files.includes(name) || !existsSync(file)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const name of readdirSync(dir).filter((f) => files.includes(f))) {
        this.emitFile({ type: 'asset', fileName: `mediapipe-wasm/${name}`, source: readFileSync(join(dir, name)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipeWasm()],
  build: {
    // o chunk 3D (three + r3f + drei) é carregado sob demanda durante a abertura
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
