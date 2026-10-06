import { fromLocal, lineLength, midpoint, type LonLat } from '../lib/geo';
import type { AreaProfile, Segment } from './types';

export const ORIGIN: LonLat = [-40.3, -20.3];

export function seg(id: string, x0: number, y0: number, x1: number, y1: number, profile: AreaProfile = 'commercial', extra: Partial<Segment> = {}): Segment {
  const line: LonLat[] = [fromLocal(ORIGIN, x0, y0), fromLocal(ORIGIN, x1, y1)];
  const lengthM = lineLength(line);
  return { id, name: `Rua ${id}`, line, mid: midpoint(line), lengthM, capacity: Math.floor(lengthM / 6) * 2, profile, noParking: false, paid: false, ...extra };
}
