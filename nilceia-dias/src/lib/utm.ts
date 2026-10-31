/**
 * Captura e preserva parâmetros de campanha (UTM + IDs de clique).
 *
 * - Lidos da URL na chegada e guardados no sessionStorage (último toque
 *   da sessão: uma nova UTM na URL substitui a anterior).
 * - Repassados para links internos entre páginas do site (/noivas, /cabelos…).
 * - Anexados como parâmetros aos eventos de clique e, de forma discreta,
 *   à mensagem do WhatsApp (veja appendCampaignRef em config/site.ts).
 */

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const CLICK_IDS = ['gclid', 'fbclid', 'gbraid', 'wbraid'] as const;
const STORAGE_KEY = 'nd_campaign';

export type Campaign = Partial<Record<(typeof UTM_KEYS)[number] | (typeof CLICK_IDS)[number], string>> & {
  landing_page?: string;
};

function read(): Campaign {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') as Campaign;
  } catch {
    return {};
  }
}

let current: Campaign = {};

export function captureCampaign(): Campaign {
  if (typeof window === 'undefined') return current;
  const params = new URLSearchParams(window.location.search);
  const fromUrl: Campaign = {};
  for (const key of [...UTM_KEYS, ...CLICK_IDS]) {
    const value = params.get(key)?.trim();
    if (value) fromUrl[key] = value.slice(0, 120);
  }
  const hasNew = UTM_KEYS.some((k) => fromUrl[k]) || CLICK_IDS.some((k) => fromUrl[k]);
  current = hasNew ? { ...fromUrl, landing_page: window.location.pathname } : read();
  try {
    if (hasNew) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* modo privado sem storage: segue só em memória */
  }
  return current;
}

export function getCampaign(): Campaign {
  return current;
}

/** Só as UTMs (sem IDs de clique), para anexar a eventos de analytics. */
export function utmParams(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) if (current[k]) out[k] = current[k]!;
  return out;
}

/** Referência curta para a mensagem do WhatsApp. Ex.: "instagram / noivas-nov" */
export function campaignRef(): string {
  const parts = [current.utm_source, current.utm_campaign].filter(Boolean) as string[];
  if (!parts.length) return '';
  return parts.join(' / ').replace(/[_+]/g, '-').slice(0, 48);
}

/** Acrescenta as UTMs atuais a um link interno (outra página do site). */
export function withCampaign(href: string): string {
  const utms = utmParams();
  if (!Object.keys(utms).length || !href.startsWith('/')) return href;
  const [pathAndQuery, hash = ''] = href.split('#');
  const url = new URL(pathAndQuery, window.location.origin);
  for (const [k, v] of Object.entries(utms)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  return url.pathname + url.search + (hash ? `#${hash}` : '');
}

/**
 * Preserva as UTMs em qualquer clique em link interno para outra página
 * (delegação global; âncoras da mesma página não são alteradas).
 */
export function installCampaignLinkDecorator() {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="/"]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      const href = a.getAttribute('href')!;
      if (href.startsWith('/#') || href.startsWith('#')) return;
      a.setAttribute('href', withCampaign(href));
    },
    { capture: true },
  );
}
