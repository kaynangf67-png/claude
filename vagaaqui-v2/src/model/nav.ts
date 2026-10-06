import { distance, toLocal, type LonLat } from '../lib/geo';

export interface NavStep {
  /** texto em português, ex.: "Vire à direita na Rua Sete" */
  text: string;
  /** ícone da manobra */
  icon: 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'straight' | 'uturn' | 'roundabout' | 'arrive' | 'depart';
  pos: LonLat;
  /** distância ao longo da rota até a manobra (m) */
  atM: number;
}

export interface NavRoute {
  line: LonLat[];
  /** distância acumulada até cada ponto (m) */
  cum: number[];
  distanceM: number;
  durationS: number;
  steps: NavStep[];
}

/** Manobra do OSRM (formato da API /route/v1). */
export interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number };
}

const MOD: Record<string, { word: string; icon: NavStep['icon'] }> = {
  left: { word: 'Vire à esquerda', icon: 'left' },
  right: { word: 'Vire à direita', icon: 'right' },
  'slight left': { word: 'Mantenha-se à esquerda', icon: 'slight-left' },
  'slight right': { word: 'Mantenha-se à direita', icon: 'slight-right' },
  'sharp left': { word: 'Vire acentuadamente à esquerda', icon: 'sharp-left' },
  'sharp right': { word: 'Vire acentuadamente à direita', icon: 'sharp-right' },
  straight: { word: 'Siga em frente', icon: 'straight' },
  uturn: { word: 'Faça o retorno', icon: 'uturn' },
};

const onto = (name: string, prep = 'na') => (name ? ` ${prep} ${name}` : '');

/** Traduz uma manobra do OSRM para uma instrução curta em português. */
export function stepText(s: OsrmStep): { text: string; icon: NavStep['icon'] } {
  const { type, modifier, exit } = s.maneuver;
  const m = MOD[modifier ?? 'straight'] ?? MOD.straight;
  switch (type) {
    case 'depart':
      return { text: `Siga${onto(s.name, 'pela')}`, icon: 'depart' };
    case 'arrive':
      return { text: 'Você chegou ao destino', icon: 'arrive' };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return { text: `Na rotatória, pegue a ${exit ?? 1}ª saída${onto(s.name, 'para a')}`, icon: 'roundabout' };
    case 'continue':
    case 'new name':
      return { text: modifier && modifier !== 'straight' ? `${m.word}${onto(s.name)}` : `Continue${onto(s.name, 'pela')}`, icon: modifier ? m.icon : 'straight' };
    case 'merge':
      return { text: `Entre${onto(s.name)}`, icon: m.icon };
    case 'on ramp':
      return { text: `Pegue o acesso${onto(s.name, 'para a')}`, icon: m.icon };
    case 'off ramp':
      return { text: `Pegue a saída${onto(s.name, 'para a')}`, icon: m.icon };
    case 'fork':
      return { text: `Na bifurcação, mantenha-se à ${modifier?.includes('left') ? 'esquerda' : 'direita'}${onto(s.name)}`, icon: m.icon };
    case 'end of road':
      return { text: `No fim da rua, ${m.word.toLowerCase()}${onto(s.name)}`, icon: m.icon };
    default:
      return { text: `${m.word}${onto(s.name)}`, icon: m.icon };
  }
}

export function buildRoute(line: LonLat[], durationS: number, osrmSteps: OsrmStep[]): NavRoute {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + distance(line[i - 1], line[i]));
  let acc = 0;
  const steps: NavStep[] = osrmSteps.map((s) => {
    const t = stepText(s);
    const step: NavStep = { ...t, pos: s.maneuver.location, atM: acc };
    acc += s.distance;
    return step;
  });
  return { line, cum, distanceM: cum[cum.length - 1] ?? 0, durationS, steps };
}

export interface NavProgress {
  /** distância já percorrida ao longo da rota (m) */
  alongM: number;
  /** distância da rota (m) — usado para recalcular quando sai do caminho */
  offRouteM: number;
  remainingM: number;
  remainingS: number;
  next: NavStep | null;
  nextIndex: number;
  toNextM: number;
}

/**
 * Projeta a posição na rota. `hintM` (progresso anterior) evita "pular" para um
 * trecho paralelo da própria rota (ida e volta na mesma avenida).
 */
export function routeProgress(r: NavRoute, pos: LonLat, hintM = 0): NavProgress {
  let best = { d: Infinity, along: 0 };
  for (let i = 0; i < r.line.length - 1; i++) {
    if (r.cum[i + 1] < hintM - 80) continue;
    const a = toLocal(pos, r.line[i]);
    const b = toLocal(pos, r.line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
    const d = Math.hypot(a.x + t * dx, a.y + t * dy);
    // pequena preferência por continuar perto do progresso anterior
    const score = d + (r.cum[i] + t * (r.cum[i + 1] - r.cum[i]) < hintM - 20 ? 15 : 0);
    if (score < best.d) best = { d, along: r.cum[i] + t * (r.cum[i + 1] - r.cum[i]) };
  }
  const alongM = best.d === Infinity ? hintM : best.along;
  const remainingM = Math.max(0, r.distanceM - alongM);
  const nextIndex = r.steps.findIndex((s) => s.atM > alongM + 3);
  const next = nextIndex >= 0 ? r.steps[nextIndex] : null;
  return {
    alongM,
    offRouteM: best.d === Infinity ? 0 : best.d,
    remainingM,
    remainingS: r.distanceM ? (r.durationS * remainingM) / r.distanceM : 0,
    next,
    nextIndex,
    toNextM: next ? Math.max(0, next.atM - alongM) : remainingM,
  };
}

export function formatDistance(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',')} km`;
  if (m >= 100) return `${Math.round(m / 10) * 10} m`;
  return `${Math.max(0, Math.round(m / 5) * 5)} m`;
}
