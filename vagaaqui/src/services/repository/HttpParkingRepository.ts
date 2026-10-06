import type { ReportKind, UserProfile } from '../../types';
import type { ParkingRepository } from './ParkingRepository';

/**
 * Implementação para um backend real (VITE_API_URL). Endpoints esperados:
 *   GET  /me/profile            -> UserProfile
 *   PUT  /me/profile            <- UserProfile
 *   POST /reports               <- { spotId, kind, latitude, longitude, timestamp }
 *   GET  /spots?bbox=...        -> ParkingSpot[] (a integrar no lugar da simulação)
 * A autenticação (token de sessão) deve ser adicionada aqui, nunca hardcoded.
 */
export class HttpParkingRepository implements ParkingRepository {
  readonly kind = 'http' as const;
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`API ${res.status} em ${path}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  loadProfile() {
    return this.request<UserProfile>('/me/profile');
  }

  async saveProfile(profile: UserProfile) {
    await this.request('/me/profile', { method: 'PUT', body: JSON.stringify(profile) });
  }

  async submitReport(input: { spotId: string; kind: ReportKind; latitude: number; longitude: number; timestamp: number }) {
    await this.request('/reports', { method: 'POST', body: JSON.stringify(input) });
  }
}
