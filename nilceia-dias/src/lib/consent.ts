/**
 * Consentimento para cookies e tecnologias não essenciais (LGPD).
 *
 * - analytics: Google Analytics 4 (e GTM em modo de consentimento)
 * - marketing: Meta Pixel e tags de anúncio
 *
 * Nada além do essencial é carregado antes da escolha do visitante.
 * Se nenhum ID de rastreamento estiver configurado, o banner nem aparece.
 */

export interface Consent {
  analytics: boolean;
  marketing: boolean;
  /** Data da escolha (ISO). */
  at: string;
  /** Versão do texto da política aceito. */
  v: number;
}

const KEY = 'nd_consent';
export const CONSENT_VERSION = 1;
const listeners = new Set<(c: Consent) => void>();

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as Consent | null;
    return c && c.v === CONSENT_VERSION ? c : null;
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean, marketing: boolean): Consent {
  const c: Consent = { analytics, marketing, at: new Date().toISOString(), v: CONSENT_VERSION };
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* sem storage: vale para esta visita */
  }
  listeners.forEach((fn) => fn(c));
  return c;
}

export function onConsent(fn: (c: Consent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Abre o painel de preferências (link "Preferências de cookies" no rodapé). */
export const OPEN_CONSENT_EVENT = 'nd:open-consent';
export function openConsentPanel() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
