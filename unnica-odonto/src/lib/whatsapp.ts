import { WHATSAPP_NUMBER } from '../config/clinic';

export const isWhatsAppConfigured = /^55\d{10,11}$/.test(WHATSAPP_NUMBER);

if (import.meta.env.DEV && !isWhatsAppConfigured) {
  console.warn('[Unnica Odonto] WHATSAPP_NUMBER ainda não foi preenchido em src/config/clinic.ts');
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
