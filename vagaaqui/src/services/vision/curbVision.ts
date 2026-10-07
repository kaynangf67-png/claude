import type { Vec2 } from '../../types';

/**
 * Geometria do sensor de câmera (protótipo).
 *
 * Câmera presa no painel, olhando para a frente, aproximadamente nivelada.
 * Modelo de "chão plano": a base da caixa de um carro detectado toca o chão; a
 * distância sai da altura da câmera e de quantos pixels a base está abaixo do horizonte.
 *
 * LIMITAÇÕES (por isso é protótipo): o chão não é plano (ladeiras), a câmera
 * inclina com o celular, carros passando na pista são confundidos com estacionados,
 * entradas de garagem e faixas proibidas parecem "vaga livre", e à noite/chuva a
 * detecção piora. Tudo vira evidência com peso baixo no Índice de Confiança.
 */

export interface CameraModel {
  /** largura e altura da imagem (px) */
  width: number;
  height: number;
  /** campo de visão horizontal (graus) */
  hfovDeg: number;
  /** altura da lente em relação ao chão (m) */
  cameraHeight: number;
  /** linha do horizonte como fração da altura da imagem (0 = topo) */
  horizon: number;
}

export interface Detection {
  category: string;
  score: number;
  /** caixa em pixels */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pose {
  position: Vec2;
  /** rad, padrão do mundo 3D (frente = (cos, -sin)) */
  heading: number;
}

export interface GroundDetection extends Detection {
  /** distância à frente (m) e deslocamento lateral (m, + = direita) */
  forward: number;
  lateral: number;
  world: Vec2;
  /** provavelmente parado junto ao meio-fio (fora da faixa do próprio carro) */
  curbside: boolean;
  /** velocidade estimada no chão (m/s) pelo rastreamento entre quadros; null = ainda sem histórico */
  groundSpeed?: number | null;
  /** em movimento: não pode ser carro estacionado */
  moving?: boolean;
}

/**
 * Rastreamento simples entre quadros: associa cada detecção à mais próxima do quadro
 * anterior (no chão) e estima a velocidade dela. Carro estacionado fica parado no mundo
 * enquanto nós andamos; carro no trânsito se move junto. Velocidade suavizada.
 */
export class MotionTracker {
  private tracks: { world: Vec2; at: number; speed: number | null }[] = [];

  constructor(private readonly options = { matchRadius: 5, movingSpeed: 2.5, smoothing: 0.5 }) {}

  update(ground: GroundDetection[], now: number) {
    const next: typeof this.tracks = [];
    const used = new Set<number>();
    for (const g of ground) {
      let best = -1;
      let bestD = this.options.matchRadius;
      this.tracks.forEach((t, i) => {
        if (used.has(i)) return;
        const d = Math.hypot(t.world.x - g.world.x, t.world.z - g.world.z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      let speed: number | null = null;
      if (best >= 0) {
        used.add(best);
        const t = this.tracks[best];
        const dt = (now - t.at) / 1000;
        if (dt > 0.05 && dt < 2) {
          const inst = bestD / dt;
          speed = t.speed == null ? inst : t.speed * this.options.smoothing + inst * (1 - this.options.smoothing);
        } else speed = t.speed;
      }
      g.groundSpeed = speed;
      g.moving = speed != null && speed > this.options.movingSpeed;
      next.push({ world: { ...g.world }, at: now, speed });
    }
    this.tracks = next;
  }
}

export const DEFAULT_CAMERA: Omit<CameraModel, 'width' | 'height'> = {
  hfovDeg: 66,
  cameraHeight: 1.25,
  horizon: 0.5,
};

const MAX_RANGE = 35;
const MIN_RANGE = 3;
/** metade da largura da faixa do próprio carro: detecções dentro dela são trânsito à frente */
const OWN_LANE = 2.0;

export function focalPx(cam: CameraModel) {
  return cam.width / 2 / Math.tan(((cam.hfovDeg * Math.PI) / 180) / 2);
}

function axes(heading: number) {
  const fwd = { x: Math.cos(heading), z: -Math.sin(heading) };
  return { fwd, right: { x: -fwd.z, z: fwd.x } };
}

/** Converte uma detecção em posição no chão (ou null se acima do horizonte / longe demais). */
export function toGround(d: Detection, cam: CameraModel, pose: Pose): GroundDetection | null {
  const f = focalPx(cam);
  const horizonY = cam.horizon * cam.height;
  const bottom = d.y + d.h;
  const below = bottom - horizonY;
  if (below < 4) return null;
  const forward = (cam.cameraHeight * f) / below;
  if (forward < MIN_RANGE || forward > MAX_RANGE) return null;
  const lateral = ((d.x + d.w / 2 - cam.width / 2) * forward) / f;
  const { fwd, right } = axes(pose.heading);
  // a base da caixa é a traseira/lateral mais próxima; o centro do carro fica ~2 m adiante
  const along = forward + 2;
  return {
    ...d,
    forward,
    lateral,
    world: {
      x: pose.position.x + fwd.x * along + right.x * lateral,
      z: pose.position.z + fwd.z * along + right.z * lateral,
    },
    curbside: Math.abs(lateral) >= OWN_LANE,
  };
}

/** Coordenadas da vaga relativas ao carro e, se estiver no campo de visão, seu pixel na imagem. */
export function spotInView(spot: Vec2, cam: CameraModel, pose: Pose) {
  const { fwd, right } = axes(pose.heading);
  const rel = { x: spot.x - pose.position.x, z: spot.z - pose.position.z };
  const forward = rel.x * fwd.x + rel.z * fwd.z;
  const lateral = rel.x * right.x + rel.z * right.z;
  const half = Math.tan(((cam.hfovDeg * Math.PI) / 180) / 2) * 0.9;
  const visible = forward > 6 && forward < 28 && Math.abs(lateral) / forward < half && Math.abs(lateral) > 1.5;
  const f = focalPx(cam);
  return {
    forward,
    lateral,
    visible,
    px: { x: cam.width / 2 + (lateral * f) / Math.max(forward, 0.1), y: cam.horizon * cam.height + (cam.cameraHeight * f) / Math.max(forward, 0.1) },
  };
}

interface PassState {
  frames: number;
  occupied: number;
  firstAt: number;
}

export interface CameraObservation {
  spotId: string;
  kind: 'available' | 'occupied';
  /** 0..1 — peso da observação no Índice de Confiança */
  trust: number;
  frames: number;
  ratio: number;
  at: number;
}

/**
 * Agrega vários quadros por vaga enquanto ela passa pelo campo de visão e
 * decide uma única observação por passagem (votação), evitando ruído quadro a quadro.
 */
export class CurbObserver {
  private passes = new Map<string, PassState>();
  private lastEmit = new Map<string, number>();

  constructor(
    private readonly options = { minFrames: 4, cooldownMs: 60_000, maxTrust: 0.55, matchBase: 2.2, matchPerMeter: 0.08 },
  ) {}

  /**
   * Processa um quadro; retorna as observações decididas neste quadro.
   * `egoSpeed` (m/s): parado (semáforo, congestionamento) não acumula votos — um carro
   * parado na faixa ao lado ficaria minutos no mesmo lugar e pareceria estacionado.
   */
  update(
    spots: { id: string; position: Vec2 }[],
    ground: GroundDetection[],
    cam: CameraModel,
    pose: Pose,
    now: number,
    egoSpeed = Infinity,
  ): CameraObservation[] {
    const out: CameraObservation[] = [];
    const seen = new Set<string>();
    const moving = egoSpeed >= 1.5;
    for (const spot of spots) {
      const v = spotInView(spot.position, cam, pose);
      if (!v.visible) continue;
      seen.add(spot.id);
      if (!moving) continue;
      const tol = this.options.matchBase + this.options.matchPerMeter * v.forward;
      const occupied = ground.some(
        (g) => g.curbside && !g.moving && Math.hypot(g.world.x - spot.position.x, g.world.z - spot.position.z) < tol,
      );
      const st = this.passes.get(spot.id) ?? { frames: 0, occupied: 0, firstAt: now };
      st.frames += 1;
      if (occupied) st.occupied += 1;
      this.passes.set(spot.id, st);
    }
    // a vaga saiu do campo de visão (ou ficou tempo suficiente nele): decide
    for (const [id, st] of this.passes) {
      const left = !seen.has(id) && moving;
      const longEnough = now - st.firstAt > 2500 && st.frames >= this.options.minFrames * 2;
      if (!left && !longEnough) continue;
      this.passes.delete(id);
      if (st.frames < this.options.minFrames) continue;
      if (now - (this.lastEmit.get(id) ?? -Infinity) < this.options.cooldownMs) continue;
      const ratio = st.occupied / st.frames;
      const kind = ratio >= 0.5 ? 'occupied' : ratio <= 0.15 ? 'available' : null;
      if (!kind) continue;
      this.lastEmit.set(id, now);
      const evidence = Math.min(1, st.frames / 10) * (kind === 'occupied' ? ratio : 1 - ratio);
      out.push({ spotId: id, kind, trust: this.options.maxTrust * evidence, frames: st.frames, ratio, at: now });
    }
    return out;
  }
}
