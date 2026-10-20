import { todayKey } from '../lib/dates';

// Configuração de lançamento lida das variáveis VITE_* (veja .env.example).
// Valor ausente = null: a interface mostra "a configurar" em vez de inventar dados.

function read(name: string): string | null {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value && value.trim() ? value.trim() : null;
}

function readDate(name: string): string | null {
  const value = read(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export type CaktoDelivery = 'email' | 'members';

/** Link de oferta da Cakto (pay.cakto.com.br). */
export function isCaktoCheckout(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'pay.cakto.com.br' && u.pathname.length > 1;
  } catch {
    return false;
  }
}

export const launch = {
  priceLabel: read('VITE_PRICE_LABEL'),
  /** Link da oferta na Cakto, ex.: https://pay.cakto.com.br/abc123 */
  checkoutUrl: read('VITE_CHECKOUT_URL'),
  /** Como a Cakto entrega o PDF: anexo/link no e-mail de compra ou área de membros (Cakto Members). */
  caktoDelivery: (read('VITE_CAKTO_DELIVERY') === 'members' ? 'members' : 'email') as CaktoDelivery,
  bonusEndDate: readDate('VITE_BONUS_END_DATE'),
  /** Nunca menos que os 7 dias do direito de arrependimento (art. 49 do CDC). */
  refundDays: Math.max(7, Number(read('VITE_REFUND_DAYS') ?? '7') || 7),
  supportEmail: read('VITE_SUPPORT_EMAIL'),
  businessName: read('VITE_BUSINESS_NAME'),
  businessDocument: read('VITE_BUSINESS_DOCUMENT'),
  siteUrl: read('VITE_SITE_URL'),
};

export type Launch = typeof launch;

/** Itens que precisam ser preenchidos antes de publicar a página de vendas. */
export function missingLaunchConfig(config: Launch = launch, today: string = todayKey()): string[] {
  const missing: string[] = [];
  if (!config.priceLabel) missing.push('Preço (VITE_PRICE_LABEL)');
  if (!config.checkoutUrl) missing.push('Link do checkout da Cakto (VITE_CHECKOUT_URL)');
  else if (!isCaktoCheckout(config.checkoutUrl)) missing.push('VITE_CHECKOUT_URL não parece um link pay.cakto.com.br');
  if (!config.bonusEndDate) missing.push('Data final do bônus (VITE_BONUS_END_DATE)');
  else if (config.bonusEndDate < today) missing.push('Data do bônus já passou (VITE_BONUS_END_DATE)');
  if (!config.supportEmail) missing.push('E-mail de suporte (VITE_SUPPORT_EMAIL)');
  if (!config.businessName || !config.businessDocument) missing.push('Responsável e CPF/CNPJ (VITE_BUSINESS_NAME, VITE_BUSINESS_DOCUMENT)');
  return missing;
}
