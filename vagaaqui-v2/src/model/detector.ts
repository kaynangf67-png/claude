import { distance, type LonLat } from '../lib/geo';

export interface Fix {
  pos: LonLat;
  /** m/s; null quando o aparelho não informa (calculamos pela leitura anterior) */
  speed: number | null;
  at: number;
  accuracy?: number;
}

export type ParkingEvent = { type: 'parked'; pos: LonLat; at: number } | { type: 'left'; pos: LonLat; at: number };

export const DETECTOR = {
  driveSpeed: 5, // m/s (18 km/h) — acima disto é carro
  driveSustainS: 20, // tempo contínuo para considerar "dirigindo"
  stopSpeed: 1.2, // abaixo disto, parado
  walkMin: 0.5,
  walkMax: 2.4, // 1,8–8,6 km/h
  walkAwayM: 40, // afastou-se a pé do ponto de parada
  walkWindowS: 300, // precisa começar a andar em até 5 min
  leaveRadiusM: 120, // voltou a dirigir perto de onde estacionou
  maxAccuracyM: 60, // leituras piores que isso são ignoradas
};

type State =
  | { k: 'idle'; fastSince: number | null }
  | { k: 'driving'; lastFast: number }
  | { k: 'stopped'; stopPos: LonLat; since: number }
  | { k: 'parked'; pos: LonLat; fastSince: number | null };

/**
 * Detecta "estacionou" (dirigia → parou → saiu andando) e "saiu da vaga"
 * (estava estacionado → voltou a dirigir a partir dali). Só gera eventos;
 * nada da trilha de GPS sai do aparelho.
 */
export class ParkingDetector {
  private state: State = { k: 'idle', fastSince: null };
  private prev: Fix | null = null;

  constructor(initialParked?: LonLat) {
    if (initialParked) this.state = { k: 'parked', pos: initialParked, fastSince: null };
  }

  get mode() {
    return this.state.k;
  }

  /** Processa uma leitura de GPS e devolve um evento quando houver. */
  push(fix: Fix): ParkingEvent | null {
    if (fix.accuracy !== undefined && fix.accuracy > DETECTOR.maxAccuracyM) return null;
    let speed = fix.speed;
    if ((speed === null || Number.isNaN(speed)) && this.prev) {
      const dt = (fix.at - this.prev.at) / 1000;
      speed = dt > 0 ? distance(this.prev.pos, fix.pos) / dt : 0;
    }
    this.prev = fix;
    const v = speed ?? 0;
    const s = this.state;

    switch (s.k) {
      case 'idle': {
        if (v >= DETECTOR.driveSpeed) {
          const since = s.fastSince ?? fix.at;
          if ((fix.at - since) / 1000 >= DETECTOR.driveSustainS) this.state = { k: 'driving', lastFast: fix.at };
          else this.state = { k: 'idle', fastSince: since };
        } else this.state = { k: 'idle', fastSince: null };
        return null;
      }
      case 'driving': {
        if (v >= DETECTOR.stopSpeed) {
          this.state = { k: 'driving', lastFast: v >= DETECTOR.driveSpeed ? fix.at : s.lastFast };
          return null;
        }
        this.state = { k: 'stopped', stopPos: fix.pos, since: fix.at };
        return null;
      }
      case 'stopped': {
        const away = distance(s.stopPos, fix.pos);
        if (v >= DETECTOR.driveSpeed) {
          // era semáforo / trânsito
          this.state = { k: 'driving', lastFast: fix.at };
          return null;
        }
        if ((fix.at - s.since) / 1000 > DETECTOR.walkWindowS) {
          // ficou parado sem sair andando (esperando no carro, por ex.)
          this.state = { k: 'idle', fastSince: null };
          return null;
        }
        if (away >= DETECTOR.walkAwayM && v >= DETECTOR.walkMin && v <= DETECTOR.walkMax) {
          this.state = { k: 'parked', pos: s.stopPos, fastSince: null };
          return { type: 'parked', pos: s.stopPos, at: s.since };
        }
        return null;
      }
      case 'parked': {
        if (v >= DETECTOR.driveSpeed) {
          const since = s.fastSince ?? fix.at;
          if ((fix.at - since) / 1000 >= 8) {
            const startedNear = this.startPos && distance(this.startPos, s.pos) <= DETECTOR.leaveRadiusM;
            this.state = { k: 'driving', lastFast: fix.at };
            this.startPos = null;
            // só conta "saiu da vaga" se começou a andar perto do carro (não é ônibus/Uber)
            return startedNear ? { type: 'left', pos: s.pos, at: since } : null;
          }
          if (s.fastSince === null) this.startPos = this.lastSlow ?? fix.pos;
          this.state = { ...s, fastSince: since };
        } else {
          this.lastSlow = fix.pos;
          this.state = { ...s, fastSince: null };
        }
        return null;
      }
    }
  }

  private startPos: LonLat | null = null;
  private lastSlow: LonLat | null = null;
}
