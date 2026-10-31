/**
 * Rastreamento para tráfego pago (Meta Ads / Google Ads / GA4).
 *
 * IDs vêm de variáveis de ambiente (veja .env.example). Nenhum ID foi inventado.
 *
 *  - Com VITE_GTM_ID: carrega SÓ o Google Tag Manager. Configure GA4, Meta Pixel
 *    e conversões dentro do GTM, usando os eventos do dataLayer abaixo. (GA4 e
 *    Pixel diretos ficam desligados para não contar tudo em dobro.)
 *  - Sem GTM: carrega GA4 (VITE_GA4_ID) e/ou Meta Pixel (VITE_META_PIXEL_ID) direto.
 *
 * Tudo só é carregado depois do consentimento (lib/consent.ts).
 * Nenhum dado pessoal (telefone, nome, texto da mensagem) é enviado: apenas
 * nome do evento, seção de origem, categoria, tipo de página e UTMs.
 *
 * Depuração: abra o site com ?debug_analytics=1 para ver os eventos no console.
 */
import { getConsent, onConsent, type Consent } from './consent';
import { utmParams } from './utm';

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

const env = import.meta.env;
const valid = (value: unknown, re: RegExp) => (typeof value === 'string' && re.test(value.trim()) ? value.trim() : '');

export const trackingIds = {
  gtm: valid(env.VITE_GTM_ID, /^GTM-[A-Z0-9]{4,12}$/),
  ga4: valid(env.VITE_GA4_ID, /^G-[A-Z0-9]{4,14}$/),
  metaPixel: valid(env.VITE_META_PIXEL_ID, /^\d{6,20}$/),
};

export const hasTracking = Boolean(trackingIds.gtm || trackingIds.ga4 || trackingIds.metaPixel);

let debug = false;
let pageType = 'home';
const loaded = { gtm: false, ga4: false, meta: false };
const lastFired = new Map<string, number>();
const firedOnce = new Set<string>();

function log(...args: unknown[]) {
  if (debug) console.info('[analytics]', ...args);
}

function loadScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function consentState(c: Consent) {
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
  };
}

// gtag e fbq precisam enfileirar o objeto `arguments` (não um array), como nos snippets oficiais.
function gtagShim() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function apply(c: Consent) {
  window.gtag = window.gtag || (gtagShim as unknown as typeof window.gtag);

  if (trackingIds.gtm) {
    if (!loaded.gtm && (c.analytics || c.marketing)) {
      window.gtag!('consent', 'default', consentState(c));
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${trackingIds.gtm}`);
      loaded.gtm = true;
      log('GTM carregado', trackingIds.gtm);
    } else if (loaded.gtm) {
      window.gtag!('consent', 'update', consentState(c));
    }
    window.dataLayer.push({ event: 'consent_update', consent_analytics: c.analytics, consent_marketing: c.marketing });
    return;
  }

  if (trackingIds.ga4 && c.analytics && !loaded.ga4) {
    window.gtag!('consent', 'default', consentState(c));
    window.gtag!('js', new Date());
    window.gtag!('config', trackingIds.ga4, { page_type: pageType, ...utmParams() });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${trackingIds.ga4}`);
    loaded.ga4 = true;
    log('GA4 carregado', trackingIds.ga4);
  } else if (loaded.ga4) {
    window.gtag!('consent', 'update', consentState(c));
  }

  if (trackingIds.metaPixel && c.marketing && !loaded.meta) {
    const fbq = function (this: unknown) {
      const f = fbq as unknown as { callMethod?: { apply: (t: unknown, a: IArguments) => void }; queue: unknown[] };
      // eslint-disable-next-line prefer-rest-params
      if (f.callMethod) f.callMethod.apply(f, arguments);
      // eslint-disable-next-line prefer-rest-params
      else f.queue.push(arguments);
    } as unknown as NonNullable<Window['fbq']> & { push: unknown; version: string };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = fbq;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', trackingIds.metaPixel);
    window.fbq('track', 'PageView');
    loaded.meta = true;
    log('Meta Pixel carregado', trackingIds.metaPixel);
  } else if (loaded.meta && !c.marketing) {
    window.fbq?.('consent', 'revoke');
  } else if (loaded.meta && c.marketing) {
    window.fbq?.('consent', 'grant');
  }
}

export function initAnalytics(type: string) {
  pageType = type;
  window.dataLayer = window.dataLayer || [];
  debug = new URLSearchParams(location.search).has('debug_analytics');
  log('IDs configurados:', trackingIds);

  const existing = getConsent();
  if (existing) apply(existing);
  onConsent(apply);

  track('page_view', { page_path: location.pathname }, { once: 'page_view' });
}

/**
 * Dispara um evento.
 *  - once: chave para disparar só uma vez por carregamento de página
 *    (ex.: visualização de seção).
 *  - cliques repetidos do mesmo evento em menos de 1s são ignorados.
 */
export function track(name: string, params: Params = {}, opts: { once?: string } = {}) {
  if (opts.once) {
    if (firedOnce.has(opts.once)) return;
    firedOnce.add(opts.once);
  } else {
    const key = name + JSON.stringify(params);
    const now = Date.now();
    if (now - (lastFired.get(key) ?? 0) < 1000) return;
    lastFired.set(key, now);
  }

  const payload = { page_type: pageType, ...utmParams(), ...params };
  window.dataLayer?.push({ event: name, ...payload });
  log(name, payload);

  // page_view do GA4 já sai pelo `config`; o do Pixel, pelo init.
  if (name === 'page_view') return;
  if (loaded.ga4) window.gtag?.('event', name, payload);
  if (loaded.meta) {
    if (name.startsWith('click_whatsapp')) {
      window.fbq?.('track', 'Contact', { content_category: String(params.category ?? '') });
    }
    window.fbq?.('trackCustom', name, payload);
  }
}

/* ---------------------------------------------------------------- */

/** Origem do clique no WhatsApp → nome do evento. */
export type CtaSource =
  | 'hero'
  | 'header'
  | 'brides'
  | 'hair'
  | 'treatments'
  | 'makeup'
  | 'footer'
  | 'sticky'
  | 'floating'
  | 'final'
  | 'steps'
  | 'identification'
  | 'faq'
  | 'location'
  | 'about'
  | 'proof'
  | 'gallery'
  | 'menu';

export function trackWhatsApp(source: CtaSource, category: string, ctaId?: string) {
  track(`click_whatsapp_${source}`, { cta_source: source, category, cta_id: ctaId ?? source });
}
