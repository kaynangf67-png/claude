import type { ReportKind, UserProfile } from '../../types';

/**
 * Fronteira com o backend. A interface é a mesma para o mock local e para a API real,
 * então trocar de implementação não muda nenhum componente.
 */
export interface ParkingRepository {
  readonly kind: 'mock' | 'http';
  loadProfile(): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<void>;
  submitReport(input: { spotId: string; kind: ReportKind; latitude: number; longitude: number; timestamp: number }): Promise<void>;
}
