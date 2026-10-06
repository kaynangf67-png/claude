import { academia, WHATSAPP_NUMBER } from '../config/academia';

export const hasWhatsApp = /^55\d{10,11}$/.test(WHATSAPP_NUMBER);

/**
 * Link do canal principal de contato. Com WhatsApp configurado, abre a conversa
 * com a mensagem pronta; sem ele, liga para o telefone fixo.
 */
export function contactUrl(message: string): string {
  return hasWhatsApp
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    : `tel:${academia.phone.e164}`;
}

export const telUrl = `tel:${academia.phone.e164}`;

/** "Falar no WhatsApp" ou "Ligar para a academia", conforme o canal disponível. */
export const channelLabel = hasWhatsApp ? 'Falar no WhatsApp' : 'Ligar para a academia';
