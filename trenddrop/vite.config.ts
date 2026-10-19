import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em desenvolvimento, serve /api/* com o mesmo roteador usado na Vercel.
function devApi(): Plugin {
  return {
    name: 'trenddrop-dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const route = url.pathname.replace(/^\//, '').split('/')[0];
        const mod = await server.ssrLoadModule('/server/router.ts');
        const headers = new Headers();
        if (req.headers.authorization) headers.set('authorization', String(req.headers.authorization));
        const response: Response = await mod.handleApi(new Request(`http://localhost/api${url.pathname}${url.search}`, { method: req.method, headers }), route);
        res.statusCode = response.status;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Disponibiliza as variáveis do .env (inclusive as de servidor) para o middleware de dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
            if (id.includes('node_modules/@supabase')) return 'supabase';
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          },
        },
      },
    },
  };
});
