import { MockTikTokService } from './mock';
import type { TikTokService } from './types';

export * from './types';

/**
 * Ponto único de escolha da implementação.
 *
 * Integração oficial (quando for implementada) deve:
 *  1. Rodar o OAuth (Login Kit / TikTok Shop Partner) numa Edge Function;
 *  2. Guardar tokens em integration_secrets via service_role;
 *  3. Expor só endpoints documentados (ex.: catálogo/pedidos/afiliados do Partner API);
 *  4. Marcar como `available: false` o que não tem API pública — como criar/agendar LIVE.
 */
let instance: TikTokService | null = null;

export function getTikTokService(): TikTokService {
  instance ??= new MockTikTokService();
  return instance;
}
