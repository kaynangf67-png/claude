import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Em desenvolvimento, serve /api/followup com o mesmo handler usado na Vercel.
function devApi(): Plugin {
  return {
    name: 'recupera-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/followup', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const request = new Request('http://localhost/api/followup', {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined,
        });
        const mod = await server.ssrLoadModule('/server/followupHandler.ts');
        const response: Response = await mod.handleFollowupRequest(request);
        res.statusCode = response.status;
        res.setHeader('content-type', 'application/json');
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
});
