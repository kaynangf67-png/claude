import { WHATSAPP_NUMBER, appendCampaignRef, whatsappMessages, type Intent } from '../config/site';
import { campaignRef } from './utm';

/** Monta o texto, com referência discreta da campanha quando houver UTM. */
export function buildMessage(intent: Intent, withRef = true): string {
  const base = whatsappMessages[intent];
  const ref = withRef && appendCampaignRef ? campaignRef() : '';
  return ref ? `${base}\n\n(Ref.: ${ref})` : base;
}

/**
 * withRef=false gera um link estável (igual no HTML pré-renderizado e no
 * navegador). O componente WhatsAppLink troca pelo link com a referência
 * da campanha no momento do toque/clique.
 */
export function whatsappUrl(intent: Intent, withRef = true): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage(intent, withRef))}`;
}
