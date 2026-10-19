// Roteador único da API. Usado pelas funções da Vercel (api/*.ts) e pelo
// middleware de desenvolvimento do Vite.
import type { TrendPeriod } from '../shared/types.js';
import { serverEnv } from './env.js';
import { ApiError, errorResponse, json, requiredParam } from './http.js';
import { fetchTrends } from './integrations/googleTrends.js';
import { mercadoLivreBestSellers, mercadoLivreCategories, mercadoLivreTrends, searchMercadoLivre } from './integrations/mercadoLivre.js';
import { searchShopee } from './integrations/shopee.js';
import { integrationStatus } from './status.js';
import { runSync } from './sync.js';

const PERIODS: TrendPeriod[] = ['7d', '30d', '90d', '12m'];

export async function handleApi(request: Request, route: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    switch (route) {
      case 'status':
        return json({ integrations: integrationStatus(), checkedAt: new Date().toISOString() });

      case 'trends': {
        const terms = requiredParam(url, 'terms', 400).split('|').map((t) => t.trim()).filter(Boolean);
        if (terms.length > 5) throw new ApiError(400, 'bad_request', 'Compare no máximo 5 termos.');
        const period = (url.searchParams.get('period') ?? '30d') as TrendPeriod;
        if (!PERIODS.includes(period)) throw new ApiError(400, 'bad_request', 'Período inválido.');
        const geo = url.searchParams.get('geo') ?? 'BR';
        if (!/^BR(-[A-Z]{2})?$/.test(geo)) throw new ApiError(400, 'bad_request', 'Região inválida (use BR ou BR-UF).');
        return json(await fetchTrends({ terms, period, geo, details: url.searchParams.get('details') === '1' }));
      }

      case 'mercadolivre': {
        const action = url.searchParams.get('action');
        if (action === 'search') return json(await searchMercadoLivre(requiredParam(url, 'q'), url.searchParams.get('category') ?? undefined));
        if (action === 'trends') return json({ fetchedAt: new Date().toISOString(), keywords: await mercadoLivreTrends(url.searchParams.get('category') ?? undefined) });
        if (action === 'bestsellers') return json(await mercadoLivreBestSellers(requiredParam(url, 'category', 20)));
        if (action === 'categories') return json({ categories: await mercadoLivreCategories() });
        throw new ApiError(400, 'bad_request', 'Ação inválida.');
      }

      case 'shopee': {
        const sort = url.searchParams.get('sort') === 'vendas' ? 'vendas' : 'relevancia';
        return json(await searchShopee(requiredParam(url, 'q'), sort));
      }

      case 'sync': {
        const secret = serverEnv.cronSecret;
        if (!secret) throw new ApiError(503, 'not_configured', 'Defina CRON_SECRET para habilitar a sincronização.', 'database');
        if (request.headers.get('authorization') !== `Bearer ${secret}`) throw new ApiError(401, 'unauthorized', 'Não autorizado.');
        return json(await runSync());
      }

      default:
        throw new ApiError(404, 'not_found', 'Rota não encontrada.');
    }
  } catch (err) {
    return errorResponse(err);
  }
}
