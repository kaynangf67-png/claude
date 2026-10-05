// Checkout hospedado na Cakto. O RecuperaAI não processa nem guarda dados de pagamento:
// só abre o link da oferta com nome e e-mail já preenchidos.

export type PlanId = 'inicial' | 'profissional';

const DEFAULT_LINKS: Record<PlanId, string | undefined> = {
  inicial: 'https://pay.cakto.com.br/ct947fn_1173605',
  profissional: undefined,
};

/** Link da oferta na Cakto. Pode ser trocado por VITE_CAKTO_CHECKOUT_INICIAL / _PROFISSIONAL. */
export function checkoutLink(plan: PlanId): string | undefined {
  const env = import.meta.env;
  const fromEnv = plan === 'inicial' ? env.VITE_CAKTO_CHECKOUT_INICIAL : env.VITE_CAKTO_CHECKOUT_PROFISSIONAL;
  return (fromEnv as string | undefined)?.trim() || DEFAULT_LINKS[plan];
}

/** Monta a URL com checkout pré-preenchido (parâmetros aceitos pela Cakto: name, email, confirmEmail, phone). */
export function buildCheckoutUrl(base: string, buyer: { name?: string; email?: string; phone?: string }) {
  const url = new URL(base);
  const name = buyer.name?.trim();
  const email = buyer.email?.trim();
  const phone = buyer.phone?.replace(/\D/g, '');
  if (name) url.searchParams.set('name', name);
  if (email) {
    url.searchParams.set('email', email);
    url.searchParams.set('confirmEmail', email);
  }
  if (phone) url.searchParams.set('phone', phone.length <= 11 ? `55${phone}` : phone);
  return url.toString();
}
