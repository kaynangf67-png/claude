import { dist } from '../lib/geo';
import type { RouteData, RouteInstruction, Vec2 } from '../types';
import { canTraverse, edgePoint, laneOffset, type CityData, type CityEdge } from './cityTypes';

export interface EdgePosition {
  edgeId: string;
  /** distância (m) a partir do nó `a` da aresta */
  s: number;
}

export interface ShortestPaths {
  start: EdgePosition;
  dist: Map<string, number>;
  prev: Map<string, string | null>;
}

/** Projeta um ponto qualquer na aresta mais próxima. */
export function nearestEdgePosition(city: CityData, p: Vec2): EdgePosition & { distance: number } {
  let best: EdgePosition & { distance: number } = { edgeId: '', s: 0, distance: Infinity };
  for (const e of city.edges.values()) {
    if (!e.routable) continue;
    const a = city.nodes.get(e.a)!.position;
    const s = Math.max(0, Math.min(e.length, (p.x - a.x) * e.dir.x + (p.z - a.z) * e.dir.z));
    const q = edgePoint(city, e, s);
    const d = dist(p, q);
    if (d < best.distance) best = { edgeId: e.id, s, distance: d };
  }
  return best;
}

/** Fila de prioridade mínima (heap binário) para o Dijkstra. */
class MinHeap {
  private items: [number, string][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, string]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, string] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Dijkstra dirigido (respeita mão única) a partir de uma posição sobre uma aresta. */
export function shortestPaths(city: CityData, start: EdgePosition): ShortestPaths {
  const edge = city.edges.get(start.edgeId)!;
  const distMap = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const id of city.nodes.keys()) distMap.set(id, Infinity);
  const heap = new MinHeap();
  distMap.set(edge.b, edge.length - start.s);
  prev.set(edge.b, null);
  heap.push([edge.length - start.s, edge.b]);
  if (!edge.oneway) {
    distMap.set(edge.a, start.s);
    prev.set(edge.a, null);
    heap.push([start.s, edge.a]);
  }
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > distMap.get(u)!) continue;
    for (const eid of city.nodes.get(u)!.edges) {
      const e = city.edges.get(eid)!;
      if (!canTraverse(e, u)) continue;
      const v = e.a === u ? e.b : e.a;
      const nd = d + e.length;
      if (nd < distMap.get(v)!) {
        distMap.set(v, nd);
        prev.set(v, u);
        heap.push([nd, v]);
      }
    }
  }
  return { start, dist: distMap, prev };
}

/** Distância de direção até uma posição-alvo e por qual nó chegar (null = mesma aresta). */
export function distanceTo(city: CityData, sp: ShortestPaths, target: EdgePosition): { distance: number; via: string | null } {
  const e = city.edges.get(target.edgeId)!;
  const viaA = sp.dist.get(e.a)! + target.s;
  const viaB = e.oneway ? Infinity : sp.dist.get(e.b)! + (e.length - target.s);
  let best = viaA <= viaB ? { distance: viaA, via: e.a as string | null } : { distance: viaB, via: e.b as string | null };
  if (sp.start.edgeId === target.edgeId) {
    const forward = target.s >= sp.start.s;
    const direct = Math.abs(sp.start.s - target.s);
    if ((forward || !e.oneway) && direct <= best.distance) best = { distance: direct, via: null };
  }
  return best;
}

function nodePath(sp: ShortestPaths, end: string): string[] {
  const path: string[] = [];
  let cur: string | null | undefined = end;
  while (cur) {
    path.unshift(cur);
    cur = sp.prev.get(cur);
  }
  return path;
}

function edgeBetween(city: CityData, a: string, b: string): CityEdge | undefined {
  let best: CityEdge | undefined;
  for (const eid of city.nodes.get(a)!.edges) {
    const e = city.edges.get(eid)!;
    if (!((e.a === a && e.b === b) || (e.a === b && e.b === a)) || !canTraverse(e, a)) continue;
    if (!best || e.length < best.length) best = e;
  }
  return best;
}

/** Desloca a polilinha para a faixa da direita, encontrando as quinas pela interseção das retas. */
function offsetPolyline(points: Vec2[], offsets: number[]): Vec2[] {
  if (points.length < 2) return points.slice();
  const segs = points.slice(0, -1).map((p, i) => {
    const q = points[i + 1];
    const len = Math.max(1e-6, dist(p, q));
    const d = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
    const offset = offsets[i] ?? 0;
    const r = { x: -d.z * offset, z: d.x * offset };
    return { p: { x: p.x + r.x, z: p.z + r.z }, d, offset };
  });
  const out: Vec2[] = [segs[0].p];
  for (let i = 1; i < segs.length; i++) {
    const s0 = segs[i - 1];
    const s1 = segs[i];
    const cross = s0.d.x * s1.d.z - s0.d.z * s1.d.x;
    const corner = points[i];
    const r1 = { x: -s1.d.z * s1.offset, z: s1.d.x * s1.offset };
    if (Math.abs(cross) < 0.05) {
      out.push({ x: corner.x + r1.x, z: corner.z + r1.z });
      continue;
    }
    const w = { x: s1.p.x - s0.p.x, z: s1.p.z - s0.p.z };
    const t = (w.x * s1.d.z - w.z * s1.d.x) / cross;
    out.push({ x: s0.p.x + s0.d.x * t, z: s0.p.z + s0.d.z * t });
  }
  const last = segs[segs.length - 1];
  const end = points[points.length - 1];
  out.push({ x: end.x - last.d.z * last.offset, z: end.z + last.d.x * last.offset });
  return out;
}

/** Arredonda as quinas com curvas de Bézier quadráticas para conversões suaves. */
export function smoothCorners(points: Vec2[], radius = 9, samples = 10): Vec2[] {
  if (points.length < 3) return points.slice();
  const out: Vec2[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const l0 = dist(p0, p1);
    const l1 = dist(p1, p2);
    const r = Math.min(radius, l0 * 0.45, l1 * 0.45);
    if (r < 0.5) {
      out.push(p1);
      continue;
    }
    const a = { x: p1.x + ((p0.x - p1.x) / l0) * r, z: p1.z + ((p0.z - p1.z) / l0) * r };
    const b = { x: p1.x + ((p2.x - p1.x) / l1) * r, z: p1.z + ((p2.z - p1.z) / l1) * r };
    for (let k = 0; k <= samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * p1.x + t * t * b.x,
        z: u * u * a.z + 2 * u * t * p1.z + t * t * b.z,
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function cumulativeOf(points: Vec2[]) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]));
  return cumulative;
}

/**
 * Monta a rota completa: posição atual → nós → vaga.
 * `finalPoint` é a posição exata da vaga (na faixa de estacionamento).
 */
export function buildRoute(
  city: CityData,
  from: { position: Vec2; edge: EdgePosition },
  target: EdgePosition,
  finalPoint: Vec2,
  destinationLabel: string,
): RouteData {
  const sp = shortestPaths(city, from.edge);
  const { via } = distanceTo(city, sp, target);
  const startEdge = city.edges.get(from.edge.edgeId)!;
  const targetEdge = city.edges.get(target.edgeId)!;

  // pontos da linha central e a aresta de cada trecho entre eles
  const center: Vec2[] = [edgePoint(city, startEdge, from.edge.s)];
  const segEdges: CityEdge[] = [];
  if (via) {
    const nodes = nodePath(sp, via);
    for (let k = 0; k < nodes.length; k++) {
      center.push(city.nodes.get(nodes[k])!.position);
      segEdges.push(k === 0 ? startEdge : edgeBetween(city, nodes[k - 1], nodes[k]) ?? startEdge);
    }
    segEdges.push(targetEdge);
  } else {
    segEdges.push(startEdge);
  }
  const targetCenter = edgePoint(city, targetEdge, target.s);
  center.push(targetCenter);

  // remove pontos duplicados (ex.: carro parado exatamente sobre um nó)
  const dedup: Vec2[] = [center[0]];
  const dedupEdges: CityEdge[] = [];
  for (let k = 1; k < center.length; k++) {
    if (dist(dedup[dedup.length - 1], center[k]) > 0.5) {
      dedup.push(center[k]);
      dedupEdges.push(segEdges[k - 1]);
    }
  }
  if (dedup.length < 2) {
    dedup.push({ x: targetCenter.x + targetEdge.dir.x * 0.6, z: targetCenter.z + targetEdge.dir.z * 0.6 });
    dedupEdges.push(targetEdge);
  }
  const streets = dedupEdges.map((e) => e.street);

  const lane = offsetPolyline(dedup, dedupEdges.map(laneOffset));
  const raw = [from.position, ...lane.slice(1, -1)];
  // aproximação final: entra na vaga vindo da faixa de rolamento
  const laneEnd = lane[lane.length - 1];
  const lastDir = (() => {
    const p = dedup[dedup.length - 2];
    const q = dedup[dedup.length - 1];
    const l = Math.max(1e-6, dist(p, q));
    return { x: (q.x - p.x) / l, z: (q.z - p.z) / l };
  })();
  const approachLen = Math.min(8, Math.max(0, dist(dedup[dedup.length - 2], dedup[dedup.length - 1]) - 2));
  raw.push({ x: laneEnd.x - lastDir.x * approachLen, z: laneEnd.z - lastDir.z * approachLen });
  raw.push(finalPoint);

  const points = smoothCorners(raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 0.3));
  const cumulative = cumulativeOf(points);
  const length = cumulative[cumulative.length - 1];

  // Instruções curva a curva, calculadas na linha central.
  const centerCum = cumulativeOf(dedup);
  const scale = centerCum[centerCum.length - 1] > 0 ? length / centerCum[centerCum.length - 1] : 1;
  const instructions: RouteInstruction[] = [
    { at: 0, type: 'start', text: `Siga pela ${streets[0]}`, street: streets[0] },
  ];
  // curvas suaves de uma mesma rua não geram instrução; só conversões de verdade
  for (let k = 1; k < dedup.length - 1; k++) {
    const p0 = dedup[k - 1];
    const p1 = dedup[k];
    const p2 = dedup[k + 1];
    const d1 = { x: p1.x - p0.x, z: p1.z - p0.z };
    const d2 = { x: p2.x - p1.x, z: p2.z - p1.z };
    const cross = d1.x * d2.z - d1.z * d2.x;
    const dot = d1.x * d2.x + d1.z * d2.z;
    const nextStreet = streets[Math.min(k, streets.length - 1)] ?? '';
    const norm = Math.hypot(d1.x, d1.z) * Math.hypot(d2.x, d2.z) || 1;
    if (dot / norm < -0.7) {
      instructions.push({ at: centerCum[k] * scale, type: 'left', text: `Faça o retorno na ${nextStreet}`, street: nextStreet });
    } else if (Math.abs(cross / norm) > (streets[k - 1] === nextStreet ? 0.8 : 0.5)) {
      const type = cross > 0 ? 'right' : 'left';
      instructions.push({
        at: centerCum[k] * scale,
        type,
        text: `Vire à ${type === 'right' ? 'direita' : 'esquerda'} na ${nextStreet}`,
        street: nextStreet,
      });
    }
  }
  instructions.push({ at: length, type: 'arrive', text: `Chegada: ${destinationLabel}`, street: targetEdge.street });

  return { points, cumulative, length, instructions };
}

/** Amostra posição e direção na rota para uma distância percorrida. */
export function sampleRoute(route: RouteData, s: number): { position: Vec2; heading: number; index: number } {
  const { points, cumulative } = route;
  const clamped = Math.max(0, Math.min(route.length, s));
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= clamped) lo = mid;
    else hi = mid;
  }
  const segLen = cumulative[hi] - cumulative[lo] || 1;
  const t = (clamped - cumulative[lo]) / segLen;
  const a = points[lo];
  const b = points[hi];
  return {
    position: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
    heading: Math.atan2(-(b.z - a.z), b.x - a.x),
    index: lo,
  };
}

/** Número de conversões na rota (usado na estimativa de tempo). */
export function countTurns(route: RouteData) {
  return route.instructions.filter((i) => i.type === 'left' || i.type === 'right').length;
}

/** Projeta um ponto na rota, buscando só numa janela [fromS, toS] (evita saltar para outro trecho). */
export function projectOnRoute(route: RouteData, p: Vec2, fromS = 0, toS = route.length): { s: number; distance: number } {
  let best = { s: fromS, distance: Infinity };
  const { points, cumulative } = route;
  for (let i = 0; i < points.length - 1; i++) {
    if (cumulative[i + 1] < fromS || cumulative[i] > toS) continue;
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
    if (d < best.distance) best = { s: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]), distance: d };
  }
  return best;
}
