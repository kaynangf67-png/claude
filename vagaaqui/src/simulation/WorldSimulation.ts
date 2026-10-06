import { assessSpot } from '../domain/confidence';
import { historicalOccupancy, turnover } from '../domain/historical';
import { CITY_SPEED_MS } from '../config/constants';
import type { Candidate } from '../domain/recommendation';
import { createMockWorld, type MockWorld } from '../data/mockSpots';
import { dist } from '../lib/geo';
import { createRng, uid } from '../lib/random';
import type { ParkingLot, ParkingSpot, ReportKind, RouteData, SpotAssessment, Vec2 } from '../types';
import { getCity } from '../world/cityStore';
import { canTraverse, edgePoint, laneOffset, type CityData, type CityEdge } from '../world/cityTypes';
import {
  buildRoute,
  distanceTo,
  nearestEdgePosition,
  sampleRoute,
  shortestPaths,
  type EdgePosition,
} from '../world/roadGraph';

/**
 * Simulação do mundo para o MVP sem backend.
 *
 * Mantém uma "verdade" oculta (se cada vaga está mesmo ocupada) que o app NUNCA lê
 * para decidir o que mostrar. O app só vê o que um sistema real veria: confirmações
 * de usuários (com erros), dados de estacionamentos e o fluxo de veículos.
 * A verdade só é usada para (a) desenhar os carros que de fato estão nas vagas e
 * (b) validar a precisão das confirmações do usuário.
 */

export interface TrafficAgent {
  id: number;
  edgeId: string;
  forward: boolean;
  s: number;
  speed: number;
  cruiseSpeed: number;
  /** usuário do VagaAqui (contribui com confirmações) */
  isUser: boolean;
  /** dirigindo devagar procurando vaga */
  searching: boolean;
  position: Vec2;
  heading: number;
  colorIndex: number;
  lastReportAt: Map<string, number>;
}

export type VehicleMode = 'idle' | 'driving' | 'arrived' | 'parked';

export interface VehicleState {
  position: Vec2;
  heading: number;
  speed: number;
  edge: EdgePosition;
  mode: VehicleMode;
  route: RouteData | null;
  routeS: number;
  targetSpotId: string | null;
  /** distância final onde o carro para (antes da vaga se ela estiver ocupada) */
  stopAt: number;
}

export interface SimulationSnapshot {
  version: number;
  now: number;
  assessments: Map<string, SpotAssessment>;
  lots: ParkingLot[];
  /** ids de vagas monitoradas que têm um carro visível (renderização) */
  occupiedVisible: Set<string>;
}

export type SimulationEvent =
  | { type: 'arrived'; spotId: string; blocked: boolean }
  | { type: 'passing'; spotId: string };

const USER_RADIUS = 150;
const VEHICLE_CRUISE = 11;

export class WorldSimulation {
  readonly city: CityData;
  readonly spots: ParkingSpot[];
  readonly spotsById: Map<string, ParkingSpot>;
  readonly spotsByEdge: Map<string, ParkingSpot[]>;
  readonly world: MockWorld;
  lots: ParkingLot[];
  readonly agents: TrafficAgent[] = [];
  readonly vehicle: VehicleState;

  private truth: Map<string, boolean>;
  private lotFree: Map<string, number>;
  private rng = createRng(77);
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: SimulationEvent) => void>();
  private snapshot: SimulationSnapshot;
  private accumulator = 0;
  private lastLotPush = 0;
  private passingAsked = new Map<string, number>();
  private lastPassingAt = 0;
  /** multiplicador de velocidade da simulação (1×, 2×, 4×) */
  speedMultiplier = 1;

  constructor(now = Date.now()) {
    this.city = getCity();
    this.world = createMockWorld(this.city, now);
    this.spots = this.world.spots;
    this.spotsById = new Map(this.spots.map((s) => [s.id, s]));
    this.spotsByEdge = new Map();
    for (const s of this.spots) {
      const list = this.spotsByEdge.get(s.edgeId) ?? [];
      list.push(s);
      this.spotsByEdge.set(s.edgeId, list);
    }
    this.lots = this.world.lots;
    this.truth = new Map(this.world.initialTruth);
    this.lotFree = new Map(this.lots.map((l) => [l.id, l.reportedFree ?? Math.round(l.capacity * 0.2)]));

    // Ponto de partida do usuário: definido pelos dados do mapa (perto do centro da área).
    const startEdge = this.city.edges.get(this.city.start.edgeId)!;
    const startS = this.city.start.s;
    this.vehicle = {
      position: edgePoint(this.city, startEdge, startS, laneOffset(startEdge)),
      heading: Math.atan2(-startEdge.dir.z, startEdge.dir.x),
      speed: 0,
      edge: { edgeId: startEdge.id, s: startS },
      mode: 'idle',
      route: null,
      routeS: 0,
      targetSpotId: null,
      stopAt: 0,
    };
    this.spawnAgents(42);
    this.snapshot = this.computeSnapshot(now);
  }

  // ---------- assinatura (useSyncExternalStore) ----------
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;
  onEvent(listener: (e: SimulationEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
  private emit(e: SimulationEvent) {
    for (const l of this.eventListeners) l(e);
  }
  private publish(now = Date.now()) {
    this.snapshot = this.computeSnapshot(now);
    for (const l of this.listeners) l();
  }

  /** Ajusta a quantidade de veículos conforme a qualidade gráfica. */
  setTrafficDensity(count: number) {
    if (count < this.agents.length) this.agents.length = count;
    else this.spawnAgents(count - this.agents.length);
  }

  private routableEdges: CityEdge[] | null = null;
  private drivable() {
    if (!this.routableEdges) this.routableEdges = [...this.city.edges.values()].filter((e) => e.routable);
    return this.routableEdges;
  }

  private spawnAgents(count: number) {
    const edges = this.drivable();
    for (let k = 0; k < count; k++) {
      const edge = this.rng.pick(edges);
      const isUser = this.rng.chance(0.35);
      const searching = isUser && this.rng.chance(0.35);
      const cruise = searching ? this.rng.range(2.2, 3.6) : this.rng.range(7, 12);
      const agent: TrafficAgent = {
        id: this.agents.length,
        edgeId: edge.id,
        forward: edge.oneway || this.rng.chance(0.5),
        s: this.rng.range(0, edge.length),
        speed: cruise,
        cruiseSpeed: cruise,
        isUser,
        searching,
        position: { x: 0, z: 0 },
        heading: 0,
        colorIndex: this.rng.int(0, 7),
        lastReportAt: new Map(),
      };
      this.placeAgent(agent);
      this.agents.push(agent);
    }
  }

  private placeAgent(a: TrafficAgent) {
    const e = this.city.edges.get(a.edgeId)!;
    const lateral = (a.forward ? 1 : -1) * laneOffset(e);
    a.position = edgePoint(this.city, e, a.s, lateral);
    a.heading = a.forward ? Math.atan2(-e.dir.z, e.dir.x) : Math.atan2(e.dir.z, -e.dir.x);
  }

  private nextEdge(a: TrafficAgent, e: CityEdge) {
    const nodeIdAtEnd = a.forward ? e.b : e.a;
    const node = this.city.nodes.get(nodeIdAtEnd)!;
    const options = node.edges.filter((id) => {
      const cand = this.city.edges.get(id)!;
      return id !== e.id && cand.routable && canTraverse(cand, nodeIdAtEnd);
    });
    // beco sem saída: retorna se a via for de mão dupla, senão reaparece em outro lugar
    if (!options.length && e.oneway) {
      this.respawnAgent(a);
      return;
    }
    const nextId = options.length ? this.rng.pick(options) : e.id;
    const next = this.city.edges.get(nextId)!;
    a.edgeId = nextId;
    a.forward = next.a === nodeIdAtEnd;
    a.s = a.forward ? 0 : next.length;
  }

  // ---------- laço principal ----------
  /** Chamado a cada frame com o delta em segundos. */
  update(dtRaw: number) {
    const dt = Math.min(0.1, dtRaw) * this.speedMultiplier;
    this.updateAgents(dt);
    this.updateVehicle(dt);
    this.accumulator += dt;
    if (this.accumulator >= 1) {
      const steps = Math.floor(this.accumulator);
      this.accumulator -= steps;
      this.slowTick(steps);
    }
  }

  private updateAgents(dt: number) {
    for (const a of this.agents) {
      // desacelera perto dos cruzamentos
      const e = this.city.edges.get(a.edgeId)!;
      const remaining = a.forward ? e.length - a.s : a.s;
      const target = remaining < 14 ? Math.min(a.cruiseSpeed, 5) : a.cruiseSpeed;
      a.speed += (target - a.speed) * Math.min(1, dt * 1.5);
      const step = a.speed * dt;
      a.s += a.forward ? step : -step;
      if (a.s > e.length || a.s < 0) {
        const overflow = a.s > e.length ? a.s - e.length : -a.s;
        this.nextEdge(a, e);
        const ne = this.city.edges.get(a.edgeId)!;
        a.s = Math.max(0, Math.min(ne.length, a.s + (a.forward ? overflow : -overflow)));
      }
      this.placeAgent(a);
    }
  }

  private updateVehicle(dt: number) {
    const v = this.vehicle;
    if (v.mode !== 'driving' || !v.route) return;
    const route = v.route;
    const remaining = v.stopAt - v.routeS;
    // velocidade alvo: reduz em curvas e na chegada
    const here = sampleRoute(route, v.routeS);
    const ahead = sampleRoute(route, v.routeS + 14);
    let turn = Math.abs(ahead.heading - here.heading);
    if (turn > Math.PI) turn = Math.PI * 2 - turn;
    let target = turn > 0.35 ? 5.5 : VEHICLE_CRUISE;
    target = Math.min(target, Math.sqrt(Math.max(0, 2 * 3.2 * remaining)) + 0.6);
    const accel = target > v.speed ? 3 : 6;
    v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), accel * dt);
    v.routeS = Math.min(v.stopAt, v.routeS + v.speed * dt);
    const sample = sampleRoute(route, v.routeS);
    v.position = sample.position;
    // direção suavizada para curvas naturais
    let d = sample.heading - v.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.heading += d * Math.min(1, dt * 8);

    // se a vaga-alvo foi ocupada, para na faixa ao lado dela
    if (v.targetSpotId && this.truth.get(v.targetSpotId) && route.length - v.routeS < 35 && v.stopAt === route.length) {
      v.stopAt = Math.max(v.routeS, route.length - 9);
    }

    this.checkPassingSpots();

    if (v.stopAt - v.routeS < 0.15) {
      v.speed = 0;
      v.mode = 'arrived';
      const near = nearestEdgePosition(this.city, v.position);
      v.edge = { edgeId: near.edgeId, s: near.s };
      const spotId = v.targetSpotId!;
      this.emit({ type: 'arrived', spotId, blocked: v.stopAt < route.length });
    }
  }

  private checkPassingSpots() {
    const v = this.vehicle;
    const now = Date.now();
    if (now - this.lastPassingAt < 25_000) return;
    for (const spot of this.spots) {
      if (spot.id === v.targetSpotId || spot.type !== 'curb') continue;
      if (dist(spot.position, v.position) > 9) continue;
      const asked = this.passingAsked.get(spot.id) ?? 0;
      if (now - asked < 300_000) continue;
      this.passingAsked.set(spot.id, now);
      this.lastPassingAt = now;
      this.emit({ type: 'passing', spotId: spot.id });
      return;
    }
  }

  private slowTick(steps: number) {
    const now = Date.now();
    const date = new Date(now);
    for (let k = 0; k < steps; k++) {
      // 1) Dinâmica real das vagas (o que acontece na rua, invisível para o app)
      for (const spot of this.spots) {
        if (spot.type === 'lot') continue;
        if (spot.id === this.vehicle.targetSpotId && this.vehicle.mode === 'parked') continue;
        const { occupyRate, leaveRate } = turnover(spot.zone, date);
        const occupied = this.truth.get(spot.id)!;
        if (!occupied && this.rng.chance(occupyRate)) {
          this.truth.set(spot.id, true);
        } else if (occupied && this.rng.chance(leaveRate)) {
          this.truth.set(spot.id, false);
          // usuários do app que saem da vaga geram o evento "saí da vaga"
          if (this.rng.chance(0.3)) this.addReport(spot, 'left', 'crowd', 0.9, now);
        }
      }

      // 2) Usuários que passam pelas vagas confirmam o que veem (com erro)
      for (const a of this.agents) {
        if (!a.isUser) continue;
        const list = this.spotsByEdge.get(a.edgeId);
        if (!list) continue;
        for (const spot of list) {
          if (dist(spot.position, a.position) > 14) continue;
          const last = a.lastReportAt.get(spot.id) ?? 0;
          if (now - last < 120_000) continue;
          a.lastReportAt.set(spot.id, now);
          const occupied = this.truth.get(spot.id)!;
          if (a.searching && !occupied && spot.type === 'curb' && this.rng.chance(0.25) && spot.id !== this.vehicle.targetSpotId) {
            this.truth.set(spot.id, true);
            this.addReport(spot, 'parked', 'crowd', 0.95, now);
            this.respawnAgent(a);
            break;
          }
          if (!this.rng.chance(0.35)) continue;
          const correct = this.rng.chance(0.9);
          const seesOccupied = correct ? occupied : !occupied;
          this.addReport(spot, seesOccupied ? 'occupied' : 'available', 'crowd', this.rng.range(0.7, 1), now);
        }
      }

      // 3) Estacionamentos: entradas/saídas e atualização da API a cada ~45 s
      for (const lot of this.lots) {
        const zone = this.spotsById.get(lot.entrySpotId)!.zone;
        const occ = historicalOccupancy(zone, date);
        let free = this.lotFree.get(lot.id)!;
        if (this.rng.chance(0.25 * (0.5 + occ)) && free > 0) free -= 1;
        if (this.rng.chance(0.25 * (1.5 - occ)) && free < lot.capacity) free += 1;
        this.lotFree.set(lot.id, free);
        this.truth.set(lot.entrySpotId, free === 0);
      }
    }
    if (now - this.lastLotPush > 45_000) {
      this.lastLotPush = now;
      this.lots = this.lots.map((l) =>
        l.reportedFree == null ? l : { ...l, reportedFree: this.lotFree.get(l.id)!, reportedAt: now },
      );
    }
    this.publish(now);
  }

  private respawnAgent(a: TrafficAgent) {
    const edge = this.rng.pick(this.drivable());
    a.edgeId = edge.id;
    a.s = this.rng.range(0, edge.length);
    a.forward = edge.oneway || this.rng.chance(0.5);
    a.lastReportAt.clear();
    this.placeAgent(a);
  }

  private addReport(spot: ParkingSpot, kind: ReportKind, source: 'crowd' | 'self', trust: number, now: number) {
    spot.reports.push({ id: uid('rep'), kind, source, timestamp: now, trust });
    // mantém só a última hora
    while (spot.reports.length && now - spot.reports[0].timestamp > 3_600_000) spot.reports.shift();
    if (spot.reports.length > 12) spot.reports.splice(0, spot.reports.length - 12);
  }

  // ---------- contexto para o Índice de Confiança ----------
  private contextFor(spot: ParkingSpot, now: number) {
    let nearbyUsers = 0;
    let cruising = 0;
    let flowCount = 0;
    let speedSum = 0;
    for (const a of this.agents) {
      const d = dist(a.position, spot.position);
      if (d < 120) flowCount += a.speed / 10;
      if (!a.isUser || d > USER_RADIUS) continue;
      nearbyUsers += 1;
      speedSum += a.speed;
      if (a.searching) cruising += 1;
    }
    const lot = spot.lotId ? this.lots.find((l) => l.id === spot.lotId) : undefined;
    return {
      now,
      date: new Date(now),
      nearbyUsers,
      cruisingNearby: cruising,
      // normaliza para veículos/min: escala da simulação (42 carros para ~2 km de ruas)
      flowPerMin: flowCount * 6,
      avgNearbySpeed: nearbyUsers ? speedSum / nearbyUsers : null,
      // estimativa para quando o motorista chegaria (distância em grade ≈ 1,3× a reta)
      horizonS: (dist(this.vehicle.position, spot.position) * 1.3) / CITY_SPEED_MS,
      lot: lot ? { capacity: lot.capacity, reportedFree: lot.reportedFree, reportedAt: lot.reportedAt } : undefined,
    };
  }

  private computeSnapshot(now: number): SimulationSnapshot {
    const assessments = new Map<string, SpotAssessment>();
    const occupiedVisible = new Set<string>();
    for (const spot of this.spots) {
      assessments.set(spot.id, assessSpot(spot, this.contextFor(spot, now)));
      const ownCar = this.vehicle?.mode === 'parked' && this.vehicle.targetSpotId === spot.id;
      if (spot.type === 'curb' && this.truth.get(spot.id) && !ownCar) occupiedVisible.add(spot.id);
    }
    return { version: (this.snapshot?.version ?? 0) + 1, now, assessments, lots: this.lots, occupiedVisible };
  }

  /** Força recálculo imediato (ex.: depois de uma confirmação do usuário). */
  refresh() {
    this.publish();
  }

  // ---------- API usada pela interface ----------
  candidates(): Candidate[] {
    const sp = shortestPaths(this.city, this.vehicle.edge);
    const snapshot = this.snapshot;
    return this.spots
      .filter((s) => !(this.vehicle.mode === 'parked' && s.id === this.vehicle.targetSpotId))
      .map((spot) => {
        const target = { edgeId: spot.edgeId, s: spot.t * this.city.edges.get(spot.edgeId)!.length };
        const { distance, via } = distanceTo(this.city, sp, target);
        let turns = 0;
        if (via && Number.isFinite(distance)) {
          // conta mudanças de direção > 45° ao longo do caminho de nós
          const pts: Vec2[] = [this.vehicle.position];
          let cur: string | null | undefined = via;
          const path: Vec2[] = [];
          while (cur) {
            path.unshift(this.city.nodes.get(cur)!.position);
            cur = sp.prev.get(cur);
          }
          pts.push(...path, spot.position);
          for (let k = 1; k < pts.length - 1; k++) {
            const d1 = { x: pts[k].x - pts[k - 1].x, z: pts[k].z - pts[k - 1].z };
            const d2 = { x: pts[k + 1].x - pts[k].x, z: pts[k + 1].z - pts[k].z };
            const n = Math.hypot(d1.x, d1.z) * Math.hypot(d2.x, d2.z);
            if (n > 1 && Math.abs(d1.x * d2.z - d1.z * d2.x) / n > 0.7) turns += 1;
          }
        }
        return { spot, assessment: snapshot.assessments.get(spot.id)!, driveDistance: distance, turns };
      });
  }

  startNavigation(spotId: string, label: string) {
    const spot = this.spotsById.get(spotId);
    if (!spot) return null;
    const edge = this.city.edges.get(spot.edgeId)!;
    const v = this.vehicle;
    const from = { position: { ...v.position }, edge: v.edge };
    if (v.mode === 'driving' || v.mode === 'arrived') {
      const near = nearestEdgePosition(this.city, v.position);
      from.edge = { edgeId: near.edgeId, s: near.s };
    }
    const route = buildRoute(this.city, from, { edgeId: spot.edgeId, s: spot.t * edge.length }, spot.position, label);
    v.route = route;
    v.routeS = 0;
    v.stopAt = route.length;
    v.mode = 'driving';
    v.targetSpotId = spotId;
    return route;
  }

  cancelNavigation() {
    const v = this.vehicle;
    v.route = null;
    v.mode = 'idle';
    v.speed = 0;
    v.targetSpotId = null;
    const near = nearestEdgePosition(this.city, v.position);
    v.edge = { edgeId: near.edgeId, s: near.s };
  }

  /** Coloca o veículo em uma posição real (GPS) se ela estiver dentro da área mapeada. */
  placeVehicleAt(p: Vec2) {
    const near = nearestEdgePosition(this.city, p);
    if (near.distance > 60) return false;
    const e = this.city.edges.get(near.edgeId)!;
    this.vehicle.edge = { edgeId: near.edgeId, s: near.s };
    this.vehicle.position = edgePoint(this.city, e, near.s, laneOffset(e));
    this.vehicle.heading = Math.atan2(-e.dir.z, e.dir.x);
    return true;
  }

  /**
   * Registra a confirmação do próprio usuário. Retorna se ela bate com a realidade
   * (em produção: validação cruzada com confirmações seguintes de outras fontes).
   */
  submitUserReport(spotId: string, kind: ReportKind, trust: number) {
    const spot = this.spotsById.get(spotId);
    if (!spot) return false;
    const now = Date.now();
    const occupied = this.truth.get(spotId)!;
    let accurate = kind === 'available' ? !occupied : kind === 'parked' ? true : occupied;
    if (kind === 'parked') {
      if (spot.type === 'curb') this.truth.set(spotId, true);
      else this.lotFree.set(spot.lotId!, Math.max(0, (this.lotFree.get(spot.lotId!) ?? 1) - 1));
      const v = this.vehicle;
      v.mode = 'parked';
      v.position = { ...spot.position };
      v.heading = spot.heading;
      v.targetSpotId = spotId;
      v.edge = { edgeId: spot.edgeId, s: spot.t * this.city.edges.get(spot.edgeId)!.length };
      // vagas de estacionamento fechado não exibem o carro no meio-fio
      if (spot.type === 'lot') accurate = true;
    }
    this.addReport(spot, kind, 'self', trust, now);
    this.publish(now);
    return accurate;
  }

  /** O usuário saiu da vaga em que estava estacionado. */
  leaveParking() {
    const v = this.vehicle;
    if (v.mode !== 'parked' || !v.targetSpotId) return;
    const spot = this.spotsById.get(v.targetSpotId)!;
    if (spot.type === 'curb') this.truth.set(spot.id, false);
    this.addReport(spot, 'left', 'self', 1, Date.now());
    const e = this.city.edges.get(spot.edgeId)!;
    const s = spot.t * e.length;
    v.position = edgePoint(this.city, e, s, laneOffset(e));
    v.mode = 'idle';
    v.targetSpotId = null;
    v.route = null;
    this.publish();
  }

  isOccupiedForRender(spotId: string) {
    return this.truth.get(spotId) ?? false;
  }
}

let instance: WorldSimulation | null = null;
export function getSimulation() {
  if (!instance) instance = new WorldSimulation();
  return instance;
}
