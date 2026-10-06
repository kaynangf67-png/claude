import { historicalOccupancy } from '../domain/historical';
import { worldToLatLon } from '../lib/geo';
import { createRng } from '../lib/random';
import type { ParkingLot, ParkingSpot, ReportKind, SpotReport, ZoneId } from '../types';
import { edgePoint, parkingOffset, type CityData, type CurbSlot } from '../world/cityTypes';

/**
 * Dados simulados realistas. Em produção estes dados viriam do backend
 * (ver services/repository/HttpParkingRepository.ts).
 *
 * Formato equivalente ao JSON do backend:
 * { "id": "vaga-001", "latitude": -20.329, "longitude": -40.292, "confidence": 87,
 *   "status": "likely_available", "lastConfirmed": "18 seconds ago" }
 */

const ZONE_DENSITY: Record<ZoneId, number> = {
  centro: 0.042,
  comercial: 0.034,
  orla: 0.04,
  residencial: 0.022,
};


export interface MockWorld {
  spots: ParkingSpot[];
  lots: ParkingLot[];
  /** vagas de meio-fio não monitoradas que têm um carro parado (cenário) */
  parkedSlots: CurbSlot[];
  /** ocupação real inicial (só a simulação conhece) */
  initialTruth: Map<string, boolean>;
}

export function createMockWorld(city: CityData, now = Date.now(), seed = 4021): MockWorld {
  const rng = createRng(seed);
  const date = new Date(now);
  const spots: ParkingSpot[] = [];
  const parkedSlots: CurbSlot[] = [];
  const initialTruth = new Map<string, boolean>();

  const capacityBySide = new Map<string, number>();
  for (const s of city.slots) {
    const key = `${s.edgeId}:${s.side}`;
    capacityBySide.set(key, (capacityBySide.get(key) ?? 0) + 1);
  }
  // ~110 vagas monitoradas, qualquer que seja o tamanho da malha
  const expected = city.slots.length * 0.034;
  const densityScale = Math.min(1.2, 110 / Math.max(1, expected));

  const makeReports = (occupied: boolean): SpotReport[] => {
    const reports: SpotReport[] = [];
    const count = rng.chance(0.18) ? 0 : rng.int(1, 3);
    for (let k = 0; k < count; k++) {
      // idades com cauda longa: de segundos a ~40 minutos
      const ageS = 6 * Math.exp(rng.next() * 6);
      const correct = rng.chance(0.88);
      const seesOccupied = correct ? occupied : !occupied;
      let kind: ReportKind = seesOccupied ? 'occupied' : 'available';
      if (seesOccupied && rng.chance(0.3)) kind = 'parked';
      reports.push({
        id: `seed-${spots.length}-${k}`,
        kind,
        source: 'crowd',
        timestamp: now - ageS * 1000,
        trust: rng.range(0.65, 1),
      });
    }
    return reports.sort((a, b) => a.timestamp - b.timestamp);
  };

  for (const slot of city.slots) {
    const zone = city.zoneAt(slot.position);
    const occupancy = historicalOccupancy(zone, date);
    const tracked = rng.chance(ZONE_DENSITY[zone] * densityScale);
    if (!tracked) {
      if (rng.chance(Math.min(0.92, occupancy + 0.1))) parkedSlots.push(slot);
      continue;
    }
    const id = `vaga-${String(spots.length + 1).padStart(3, '0')}`;
    // vagas monitoradas tendem a ser as que giram mais (por isso foram reportadas)
    const occupied = rng.chance(occupancy * 0.85);
    initialTruth.set(id, occupied);
    const { lat, lon } = worldToLatLon(slot.position);
    const edge = city.edges.get(slot.edgeId)!;
    spots.push({
      id,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      position: slot.position,
      heading: slot.heading,
      edgeId: slot.edgeId,
      t: slot.s / edge.length,
      streetName: edge.street,
      zone,
      type: 'curb',
      segmentCapacity: capacityBySide.get(`${slot.edgeId}:${slot.side}`) ?? 10,
      reports: makeReports(occupied),
    });
  }

  const lots: ParkingLot[] = city.lots.map((def, index) => {
    const edge = city.edges.get(def.entryEdgeId)!;
    const position = edgePoint(city, edge, def.entryS, def.entrySide * parkingOffset(edge));
    const { lat, lon } = worldToLatLon(position);
    const zone = city.zoneAt(def.center);
    const spotId = `vaga-est-${index + 1}`;
    const occupancy = historicalOccupancy(zone, date);
    const free = Math.max(0, Math.round(def.capacity * (1 - occupancy) * rng.range(0.5, 1.1)));
    // Um dos estacionamentos não tem integração de API: mostra como os dados degradam.
    const integrated = index % 3 !== 2;
    spots.push({
      id: spotId,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      position,
      heading: Math.atan2(-edge.dir.z, edge.dir.x),
      edgeId: edge.id,
      t: def.entryS / edge.length,
      streetName: edge.street,
      zone,
      type: 'lot',
      lotId: def.id,
      segmentCapacity: def.capacity,
      reports: integrated ? [] : makeReports(false),
    });
    initialTruth.set(spotId, free === 0);
    return {
      id: def.id,
      name: def.name,
      position: def.center,
      polygon: def.polygon,
      capacityMeasured: def.capacityMeasured,
      capacity: def.capacity,
      reportedFree: integrated ? free : null,
      reportedAt: integrated ? now - rng.range(10, 90) * 1000 : null,
      pricePerHour: def.pricePerHour,
      entrySpotId: spotId,
    };
  });

  return { spots, lots, parkedSlots, initialTruth };
}
