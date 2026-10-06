import type { Vec2 } from '../../types';
import type { CityData, CityEdge, CurbSlot } from '../../world/cityTypes';
import { CAR_COLORS, sidewalkWidth } from '../map/mapStyle';

/**
 * Cache de "azulejos" (tiles) do mapa 2D, como fazem os apps de mapa:
 * a parte que não muda (áreas, calçadas, ruas, faixas e carros estacionados) é
 * desenhada UMA vez em imagens de 512 px por nível de zoom. A cada quadro o mapa só
 * posiciona/gira essas imagens — custo de copiar pixels, não de redesenhar a cidade.
 */

export const TILE_PX = 512;
const PAD = 2; // px de sobreposição entre tiles vizinhos (evita frestas ao girar)
/** resoluções disponíveis, em pixels por metro */
export const LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16];
const GRID = 80; // célula do índice espacial, em metros

export const MAP_COLORS = {
  land: '#15181d',
  sidewalk: '#30343b',
  road: '#41454d',
  center: '#d9a640',
  water: '#16324a',
  beach: '#5a5040',
  park: '#1f3a27',
  plaza: '#2a2d33',
  lot: '#2d3037',
  coast: 'rgba(160,200,225,0.55)',
};

export const CAR_L = 4.4;
export const CAR_W = 1.8;

export function carCorners(p: Vec2, heading: number, l = CAR_L, w = CAR_W) {
  const fx = Math.cos(heading);
  const fz = -Math.sin(heading);
  const rx = -fz;
  const rz = fx;
  const hl = l / 2;
  const hw = w / 2;
  return [
    { x: p.x + fx * hl + rx * hw, z: p.z + fz * hl + rz * hw },
    { x: p.x + fx * hl - rx * hw, z: p.z + fz * hl - rz * hw },
    { x: p.x - fx * hl - rx * hw, z: p.z - fz * hl - rz * hw },
    { x: p.x - fx * hl + rx * hw, z: p.z - fz * hl + rz * hw },
  ];
}

export function addQuad(path: Path2D, c: Vec2[]) {
  path.moveTo(c[0].x, c[0].z);
  for (let i = 1; i < 4; i++) path.lineTo(c[i].x, c[i].z);
  path.closePath();
}

/** menor nível com resolução suficiente para a escala de tela (zoom × dpr) */
export function pickLevel(scale: number) {
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i] >= scale * 0.9) return i;
  return LEVELS.length - 1;
}

export const tileMeters = (level: number) => TILE_PX / LEVELS[level];

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const boxOf = (pts: Vec2[], pad = 0): Box => {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of pts) {
    if (p.x < b.minX) b.minX = p.x;
    if (p.x > b.maxX) b.maxX = p.x;
    if (p.z < b.minZ) b.minZ = p.z;
    if (p.z > b.maxZ) b.maxZ = p.z;
  }
  b.minX -= pad;
  b.maxX += pad;
  b.minZ -= pad;
  b.maxZ += pad;
  return b;
};

const overlaps = (a: Box, b: Box) => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

/** índice espacial simples em grade para buscar só o que cai dentro de um tile */
class Grid<T> {
  private cells = new Map<string, T[]>();
  insert(item: T, box: Box) {
    for (let gx = Math.floor(box.minX / GRID); gx <= Math.floor(box.maxX / GRID); gx++) {
      for (let gz = Math.floor(box.minZ / GRID); gz <= Math.floor(box.maxZ / GRID); gz++) {
        const k = `${gx},${gz}`;
        const cell = this.cells.get(k);
        if (cell) cell.push(item);
        else this.cells.set(k, [item]);
      }
    }
  }
  query(box: Box): Set<T> {
    const out = new Set<T>();
    for (let gx = Math.floor(box.minX / GRID); gx <= Math.floor(box.maxX / GRID); gx++) {
      for (let gz = Math.floor(box.minZ / GRID); gz <= Math.floor(box.maxZ / GRID); gz++) {
        const cell = this.cells.get(`${gx},${gz}`);
        if (cell) for (const item of cell) out.add(item);
      }
    }
    return out;
  }
}

interface EdgeItem {
  a: Vec2;
  b: Vec2;
  road: number;
  outer: number;
  center: boolean;
}

export interface Tile {
  level: number;
  tx: number;
  tz: number;
  canvas: Canvas;
}

function makeCanvas(size: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export class TileCache {
  private tiles = new Map<string, Tile>();
  /** nível mais grosso da cidade inteira: sempre disponível como reserva, nunca descartado */
  private base = new Map<string, Tile>();
  private edges = new Grid<EdgeItem>();
  private slots = new Grid<CurbSlot>();
  private areas: { kind: keyof typeof MAP_COLORS; polygon: Vec2[]; box: Box }[];
  private coasts: { line: Vec2[]; box: Box }[];
  private spare: Canvas[] = [];
  /** telas descartadas neste quadro: só voltam a ser reutilizadas no próximo, pois ainda podem estar na fila de desenho */
  private retired: Canvas[] = [];
  built = 0;

  constructor(
    city: CityData,
    parkedSlots: CurbSlot[],
    private readonly capacity = 40,
  ) {
    for (const e of city.edges.values()) this.addEdge(city, e);
    for (const s of parkedSlots) this.slots.insert(s, boxOf([s.position], 3));
    this.areas = city.areas.map((a) => ({ kind: a.kind, polygon: a.polygon, box: boxOf(a.polygon) }));
    this.coasts = city.coastlines.map((line) => ({ line, box: boxOf(line, 2) }));
  }

  private addEdge(city: CityData, e: CityEdge) {
    const a = city.nodes.get(e.a)!.position;
    const b = city.nodes.get(e.b)!.position;
    const outer = e.width + 2 * sidewalkWidth(e);
    this.edges.insert({ a, b, road: e.width, outer, center: !e.oneway && e.width >= 8 }, boxOf([a, b], outer / 2 + 1));
  }

  /** desenha o nível 0 da cidade inteira (poucos tiles de 2 km) */
  warmBase(bounds: Box) {
    for (const [tx, tz] of tilesFor(0, bounds)) if (!this.base.has(`0/${tx}/${tz}`)) this.build(0, tx, tz);
  }

  beginFrame() {
    if (this.retired.length) this.spare.push(...this.retired.splice(0));
  }

  get(level: number, tx: number, tz: number) {
    const key = `${level}/${tx}/${tz}`;
    if (level === 0) return this.base.get(key);
    const t = this.tiles.get(key);
    if (t) {
      // LRU: reinsere no fim
      this.tiles.delete(key);
      this.tiles.set(key, t);
    }
    return t;
  }

  has(level: number, tx: number, tz: number) {
    return (level === 0 ? this.base : this.tiles).has(`${level}/${tx}/${tz}`);
  }

  build(level: number, tx: number, tz: number): Tile {
    const key = `${level}/${tx}/${tz}`;
    const res = LEVELS[level];
    const size = TILE_PX + 2 * PAD;
    const canvas = (level > 0 && this.spare.pop()) || makeCanvas(size);
    const ctx = canvas.getContext('2d', { alpha: false }) as Ctx;
    const m = tileMeters(level);
    const x0 = tx * m - PAD / res;
    const z0 = tz * m - PAD / res;
    const box: Box = { minX: x0, maxX: x0 + size / res, minZ: z0, maxZ: z0 + size / res };
    drawTile(ctx, res, x0, z0, size, box, this);
    const tile = { level, tx, tz, canvas };
    this.built++;
    if (level === 0) {
      this.base.set(key, tile);
      return tile;
    }
    this.tiles.set(key, tile);
    while (this.tiles.size > this.capacity) {
      const oldest = this.tiles.keys().next().value!;
      this.retired.push(this.tiles.get(oldest)!.canvas);
      this.tiles.delete(oldest);
    }
    return tile;
  }

  /** ponto de vista dos dados, para o desenho do tile */
  queryEdges(box: Box) {
    return this.edges.query(box);
  }
  querySlots(box: Box) {
    return this.slots.query(box);
  }
  queryAreas(box: Box) {
    return this.areas.filter((a) => overlaps(a.box, box));
  }
  queryCoasts(box: Box) {
    return this.coasts.filter((c) => overlaps(c.box, box));
  }
}

function drawTile(ctx: Ctx, res: number, x0: number, z0: number, size: number, box: Box, data: TileCache) {
  const px = 1 / res;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = MAP_COLORS.land;
  ctx.fillRect(0, 0, size, size);
  ctx.setTransform(res, 0, 0, res, -x0 * res, -z0 * res);

  // áreas (água, praia, parques...)
  const areaPaths = new Map<string, Path2D>();
  for (const a of data.queryAreas(box)) {
    let p = areaPaths.get(a.kind);
    if (!p) areaPaths.set(a.kind, (p = new Path2D()));
    a.polygon.forEach((pt, i) => (i === 0 ? p!.moveTo(pt.x, pt.z) : p!.lineTo(pt.x, pt.z)));
    p.closePath();
  }
  for (const kind of ['water', 'beach', 'park', 'plaza', 'lot'] as const) {
    const p = areaPaths.get(kind);
    if (!p) continue;
    ctx.fillStyle = MAP_COLORS[kind];
    ctx.fill(p);
  }
  const coasts = data.queryCoasts(box);
  if (coasts.length) {
    const p = new Path2D();
    for (const { line } of coasts) line.forEach((pt, i) => (i === 0 ? p.moveTo(pt.x, pt.z) : p.lineTo(pt.x, pt.z)));
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = MAP_COLORS.coast;
    ctx.stroke(p);
  }

  // calçadas e ruas: traços largos com ponta redonda = cruzamentos limpos
  const edges = [...data.queryEdges(box)];
  const byWidth = (key: 'outer' | 'road') => {
    const m = new Map<number, Path2D>();
    for (const e of edges) {
      const w = Math.round(e[key] * 2) / 2;
      let p = m.get(w);
      if (!p) m.set(w, (p = new Path2D()));
      p.moveTo(e.a.x, e.a.z);
      p.lineTo(e.b.x, e.b.z);
    }
    return [...m.entries()].sort((p, q) => q[0] - p[0]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = MAP_COLORS.sidewalk;
  for (const [w, p] of byWidth('outer')) {
    ctx.lineWidth = Math.max(w, 2 * px);
    ctx.stroke(p);
  }
  ctx.strokeStyle = MAP_COLORS.road;
  for (const [w, p] of byWidth('road')) {
    ctx.lineWidth = Math.max(w, 1.5 * px);
    ctx.stroke(p);
  }
  if (res >= 2) {
    const p = new Path2D();
    for (const e of edges) {
      if (!e.center) continue;
      p.moveTo(e.a.x, e.a.z);
      p.lineTo(e.b.x, e.b.z);
    }
    ctx.strokeStyle = MAP_COLORS.center;
    ctx.lineWidth = Math.max(0.15, px);
    ctx.lineCap = 'butt';
    ctx.setLineDash([3, 5]);
    ctx.stroke(p);
    ctx.setLineDash([]);
  }

  // carros estacionados (decorativos, não mudam)
  if (res >= 1) {
    const groups = CAR_COLORS.map(() => new Path2D());
    for (const s of data.querySlots(box)) {
      const h = slotHash(s.id);
      if (res < 2 && h % 2) continue; // de longe, metade basta (mesma escolha em todo tile)
      addQuad(groups[h % groups.length], carCorners(s.position, s.heading, CAR_L - 0.4));
    }
    groups.forEach((g, k) => {
      ctx.fillStyle = CAR_COLORS[k];
      ctx.fill(g);
    });
  }
}

function slotHash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** quais tiles cobrem um retângulo do mundo */
export function tilesFor(level: number, b: Box) {
  const m = tileMeters(level);
  const out: [number, number][] = [];
  for (let tx = Math.floor(b.minX / m); tx <= Math.floor(b.maxX / m); tx++) {
    for (let tz = Math.floor(b.minZ / m); tz <= Math.floor(b.maxZ / m); tz++) out.push([tx, tz]);
  }
  return out;
}

/** desenha um tile já pronto com o contexto na transformação de mundo */
export function blitTile(ctx: CanvasRenderingContext2D, t: Tile) {
  const res = LEVELS[t.level];
  const m = tileMeters(t.level);
  const size = TILE_PX + 2 * PAD;
  ctx.drawImage(t.canvas, t.tx * m - PAD / res, t.tz * m - PAD / res, size / res, size / res);
}
