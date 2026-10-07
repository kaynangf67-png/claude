import { DEFAULT_PROFILE } from '../../domain/rewards';
import type { UserProfile } from '../../types';
import type { ParkingRepository } from './ParkingRepository';

const KEY = 'vagaaqui.profile.v1';

/** Persiste o perfil no navegador. As confirmações vão direto para a simulação local. */
export class MockParkingRepository implements ParkingRepository {
  readonly kind = 'mock' as const;

  async loadProfile(): Promise<UserProfile> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
    } catch {
      /* armazenamento indisponível: usa o perfil padrão */
    }
    return DEFAULT_PROFILE;
  }

  async saveProfile(profile: UserProfile) {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* ignora: modo privado ou cota cheia */
    }
  }

  async submitReport() {
    /* no modo mock a confirmação já foi aplicada na simulação */
  }
}
