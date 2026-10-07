import { uuid } from '@/lib/utils';
import type { CapabilityInfo, ExternalLiveState, LiveRequest, PublishRequest, TikTokService } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Implementação de demonstração. Não fala com o TikTok: simula respostas para que
 * o produto seja testável de ponta a ponta. Toda tela que usa este serviço exibe
 * o selo "Simulado".
 */
export class MockTikTokService implements TikTokService {
  readonly mode = 'mock' as const;

  capabilities(): CapabilityInfo[] {
    return [
      { capability: 'authenticate', available: true, note: 'Simulado — nenhuma conta real é conectada.' },
      { capability: 'getProducts', available: true, note: 'Simulado — retorna catálogo fictício.' },
      { capability: 'publishVideo', available: false, note: 'Publicação assistida: você posta pelo app (com link do produto). API oficial exige auditoria; sem ela, só posts privados.' },
      { capability: 'createLive', available: true, note: 'Simulado — nada é transmitido.' },
      { capability: 'scheduleLive', available: true, note: 'Simulado — o agendamento existe só no LiveFlow.' },
      { capability: 'getLiveStatus', available: true, note: 'Simulado — status derivado do horário.' },
      { capability: 'getAnalytics', available: true, note: 'Simulado — métricas fictícias.' },
    ];
  }

  async authenticate() {
    await wait(600);
    return { displayName: '@minhaloja.demo', scopes: ['user.info.basic', 'shop.products.read'] };
  }

  async disconnect() {
    await wait(200);
  }

  async getProducts() {
    await wait(300);
    return [
      { externalId: 'mock-1', title: 'Garrafa Térmica Inox 1L', price: 89.9, imageUrl: null, url: null },
      { externalId: 'mock-2', title: 'Ring Light 26cm com Tripé', price: 129.9, imageUrl: null, url: null },
    ];
  }

  async publishVideo(req: PublishRequest) {
    void req;
    await wait(300);
    return { publishId: `mock_pub_${uuid().slice(0, 8)}` };
  }

  async createLive(req: LiveRequest) {
    void req;
    await wait(150);
    return { externalId: `mock_${uuid().slice(0, 8)}` };
  }

  async scheduleLive(req: LiveRequest) {
    return this.createLive(req);
  }

  async getLiveStatus(live: { externalId: string | null; startsAt: string; durationMinutes: number; status: string }): Promise<ExternalLiveState> {
    if (live.status === 'cancelled' || live.status === 'error' || live.status === 'draft') {
      return { status: live.status === 'draft' ? 'scheduled' : live.status };
    }
    const start = new Date(live.startsAt).getTime();
    const end = start + live.durationMinutes * 60_000;
    const now = Date.now();
    if (now < start) return { status: 'scheduled' };
    if (now < end) return { status: 'running' };
    return { status: 'finished' };
  }

  async getAnalytics() {
    return [];
  }
}
