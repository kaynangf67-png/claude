import { WHATSAPP_NUMBER } from '../config/site';

export const isWhatsAppConfigured = /^55\d{10,11}$/.test(WHATSAPP_NUMBER);

if (import.meta.env.DEV && !isWhatsAppConfigured) {
  console.warn('[Auto Escola São Francisco] WHATSAPP_NUMBER ainda não foi preenchido em src/config/site.ts');
}

/** Link oficial click-to-chat do WhatsApp com a mensagem já codificada. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
