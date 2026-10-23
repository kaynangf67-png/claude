import type { ExtractionMethod, FieldStatusMap, ProductData } from '@vendora/shared';
import { AppError } from '../../lib/errors';
import type { Fetcher } from '../../security/safeFetch';
import { validatePublicUrl } from '../../security/url';
import { fetchMercadoLivreItem, mercadoLivreItemId } from './mercadolivre';
import { looksBlocked, parseProductPage } from './parse';
import { robotsAllows } from './robots';

export interface ExtractionDeps {
  fetcher: Fetcher;
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  respectRobots: boolean;
  mlApiUrl: string;
  /** Token do Mercado Livre do usuário, se a conta estiver conectada. */
  getMercadoLivreToken?: () => Promise<string | null>;
}

export type ExtractionOutcome =
  | {
      ok: true;
      url: string;
      domain: string;
      method: ExtractionMethod;
      data: ProductData;
      fieldStatus: FieldStatusMap;
      /** extracted = há dados estruturados; partial = só metadados genéricos. */
      quality: 'extracted' | 'partial';
      notes: string[];
    }
  | { ok: false; url: string; domain: string; code: string; reason: string };

const fail = (url: URL, code: string, reason: string): ExtractionOutcome => ({
  ok: false,
  url: url.toString(),
  domain: url.hostname,
  code,
  reason,
});

/**
 * Lê a página do produto por meios públicos e autorizados.
 * Nunca devolve dados "de exemplo": se não deu para ler, devolve ok:false com o motivo.
 */
export async function extractProduct(input: string, deps: ExtractionDeps): Promise<ExtractionOutcome> {
  const url = validatePublicUrl(input); // lança AppError 400 para URLs inválidas/bloqueadas
  const common = { userAgent: deps.userAgent, timeoutMs: deps.timeoutMs };

  const mlId = mercadoLivreItemId(url);
  if (mlId && deps.getMercadoLivreToken) {
    const token = await deps.getMercadoLivreToken();
    if (token) {
      try {
        const viaApi = await fetchMercadoLivreItem(mlId, token, deps.mlApiUrl, deps.fetcher, common);
        if (viaApi?.data.title)
          return {
            ok: true,
            url: url.toString(),
            domain: url.hostname,
            method: 'mercadolivre-api',
            data: viaApi.data,
            fieldStatus: viaApi.fieldStatus,
            quality: 'extracted',
            notes: ['Dados lidos pela API oficial do Mercado Livre com a sua conta conectada.'],
          };
      } catch {
        // Se a API falhar, tenta a página pública abaixo.
      }
    }
  }

  if (deps.respectRobots && !(await robotsAllows(url, deps.userAgent, deps.fetcher, deps.timeoutMs)))
    return fail(
      url,
      'robots_disallowed',
      'O site informa (robots.txt) que não permite leitura automatizada desta página. Importe os dados manualmente ou use uma integração autorizada.',
    );

  let res;
  try {
    res = await deps.fetcher(url.toString(), {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      maxBytes: deps.maxBytes,
      ...common,
    });
  } catch (err) {
    if (err instanceof AppError && err.code === 'blocked_url') throw err;
    const reason = err instanceof AppError ? err.message : 'Não conseguimos acessar o site.';
    return fail(url, err instanceof AppError ? err.code : 'fetch_failed', reason);
  }

  const finalUrl = new URL(res.url);
  if ([401, 403, 429].includes(res.status) || res.status === 503)
    return fail(
      finalUrl,
      'site_blocked',
      `O site recusou a leitura automatizada (HTTP ${res.status}). Isso é comum em grandes marketplaces. Importe os dados manualmente.`,
    );
  if (res.status === 404 || res.status === 410) return fail(finalUrl, 'not_found', 'A página não existe mais (HTTP 404).');
  if (res.status >= 400) return fail(finalUrl, 'http_error', `O site respondeu com erro (HTTP ${res.status}).`);
  if (!/text\/html|application\/xhtml/.test(res.contentType))
    return fail(finalUrl, 'not_html', 'O link não aponta para uma página de produto (o conteúdo não é HTML).');

  const html = res.body.toString('utf8');
  if (looksBlocked(html))
    return fail(
      finalUrl,
      'site_blocked',
      'O site exibiu uma verificação anti-robô (captcha) em vez da página do produto. Importe os dados manualmente.',
    );

  const parsed = parseProductPage(html, finalUrl.toString());
  if (!parsed || !parsed.data.title)
    return fail(finalUrl, 'no_product_data', 'Lemos a página, mas não encontramos dados de produto nela.');

  const structured = parsed.method === 'json-ld' || parsed.method === 'microdata';
  const notes: string[] = [];
  if (!structured)
    notes.push(
      'A página não traz dados estruturados de produto. Usamos apenas título, descrição e imagem de compartilhamento — confira tudo antes de gerar.',
    );
  return {
    ok: true,
    url: finalUrl.toString(),
    domain: finalUrl.hostname,
    method: parsed.method,
    data: parsed.data,
    fieldStatus: parsed.fieldStatus,
    quality: structured ? 'extracted' : 'partial',
    notes,
  };
}
