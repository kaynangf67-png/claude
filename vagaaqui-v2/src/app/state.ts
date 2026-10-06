import { useSyncExternalStore } from 'react';
import type { LonLat } from '../lib/geo';
import type { DestinationForecast, ParkingLot, Segment } from '../model/types';
import type { StreetSource } from '../data/streets';
import type { GpsState } from '../services/gps';
import type { Eta } from '../services/route';
import type { Place } from '../services/geocode';
import type { NavProgress, NavRoute } from '../model/nav';
import type { Plan } from './plan';

export interface Favorite {
  label: string;
  place: Place;
}

export interface Parked {
  pos: LonLat;
  segmentId: string | null;
  at: number;
}

export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
  radiusM: number;
  autoDetect: boolean;
  /** relatos simulados para demonstração (só sem servidor) */
  demo: boolean;
  theme: Theme;
  /** instruções de navegação faladas */
  voice: boolean;
}

export interface NavState {
  route: NavRoute;
  target: LonLat;
  targetName: string;
  progress: NavProgress;
  rerouting: boolean;
  startedAt: number;
}

export type Screen = 'map' | 'account' | 'settings' | 'metrics';

export interface AppState {
  gps: GpsState;
  dest: Place | null;
  /** null = sair agora; número = horário de chegada desejado (Pro) */
  arriveAtTarget: number | null;
  eta: Eta | null;
  forecast: DestinationForecast | null;
  loading: boolean;
  error: string | null;
  segments: Segment[];
  lots: ParkingLot[];
  streetSource: StreetSource | null;
  selectedSegmentId: string | null;
  arrivalOpen: boolean;
  answeredDestKey: string | null;
  parked: Parked | null;
  settings: Settings;
  favorites: Favorite[];
  recent: Place[];
  nav: NavState | null;
  plan: Plan;
  screen: Screen;
  toast: string | null;
  openedAt: number;
}

const PREFS = 'vq2.prefs';

function loadPrefs(): Partial<AppState> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || '{}') as Partial<AppState>;
    return { settings: p.settings, favorites: p.favorites, plan: p.plan, parked: p.parked, recent: p.recent };
  } catch {
    return {};
  }
}

const prefs = loadPrefs();

let state: AppState = {
  gps: { status: 'off', pos: null, accuracy: null, heading: null, speed: null },
  dest: null,
  arriveAtTarget: null,
  eta: null,
  forecast: null,
  loading: false,
  error: null,
  segments: [],
  lots: [],
  streetSource: null,
  selectedSegmentId: null,
  arrivalOpen: false,
  answeredDestKey: null,
  parked: prefs.parked ?? null,
  settings: { radiusM: 400, autoDetect: false, demo: true, theme: 'light', voice: true, ...prefs.settings },
  favorites: prefs.favorites ?? [],
  recent: prefs.recent ?? [],
  nav: null,
  plan: { proUntil: 0, reports: 0, waitlisted: false, ...prefs.plan },
  screen: 'map',
  toast: null,
  openedAt: Date.now(),
};

const listeners = new Set<() => void>();

export const getState = () => state;

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  if ('settings' in patch || 'favorites' in patch || 'plan' in patch || 'parked' in patch || 'recent' in patch) {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ settings: state.settings, favorites: state.favorites, plan: state.plan, parked: state.parked, recent: state.recent }));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), 3500);
}
