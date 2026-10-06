import { env } from '../../config/env';
import { HttpParkingRepository } from './HttpParkingRepository';
import { MockParkingRepository } from './MockParkingRepository';
import type { ParkingRepository } from './ParkingRepository';

export const repository: ParkingRepository = env.apiUrl
  ? new HttpParkingRepository(env.apiUrl)
  : new MockParkingRepository();
