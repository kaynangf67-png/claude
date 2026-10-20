import { WHATSAPP_NUMBER } from '../config/site';

/** Link oficial de clique para conversa, com a mensagem codificada corretamente. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
