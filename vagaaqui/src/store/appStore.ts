import { env } from '../config/env';
import { recommend } from '../domain/recommendation';
import { applyReward, DEFAULT_PROFILE, trustFor } from '../domain/rewards';
import { detectQualityTier, type QualityTier } from '../hooks/deviceQuality';
import { uid } from '../lib/random';
import { startGpsTracking } from '../services/location/gpsTracker';
import { repository } from '../services/repository';
import { speak } from '../services/speech';
import { getSimulation } from '../simulation/WorldSimulation';
import type { Destination, LevelName, Recommendation, RewardAction, RouteData, UserProfile } from '../types';
import { levelFor } from '../domain/rewards';
import { cameraBus } from './cameraBus';
import { createStore } from './createStore';
import { loadCity, type CityOrigin } from '../world/cityStore';

export type CameraMode = 'follow' | 'free' | 'preview';
export type NavStatus = 'idle' | 'navigating' | 'arrived' | 'parked';
export type Panel = null | 'profile' | 'settings' | 'sources';

export interface Prompt {
  id: string;
  kind: 'passing' | 'arrival';
  spotId: string;
  /** chegada em vaga confirmada como livre: falta só confirmar que estacionou */
  stage: 'ask' | 'confirmed_free';
  blocked?: boolean;
}

export interface Toast {
  id: string;
  points: number;
  label: string;
  levelUp?: LevelName;
}

export interface Notice {
  id: string;
  text: string;
  tone: 'info' | 'warn';
}

export interface AppState {
  phase: 'splash' | 'map';
  cityStatus: 'loading' | 'ready';
  cityStatusText: string;
  cityOrigin: CityOrigin | null;
  /** aviso a mostrar ao entrar no mapa (ex.: OSM indisponível) */
  cityNote: string | null;
  cameraMode: CameraMode;
  navStatus: NavStatus;
  targetSpotId: string | null;
  route: RouteData | null;
  selectedSpotId: string | null;
  recommendations: Recommendation[];
  recommendationsOpen: boolean;
  destination: Destination | null;
  excluded: string[];
  driverMode: boolean;
  profile: UserProfile;
  toasts: Toast[];
  prompt: Prompt | null;
  notice: Notice | null;
  panel: Panel;
  qualityOverride: 'auto' | QualityTier;
  detectedTier: QualityTier;
  voice: boolean;
  /** '2d' (padrão, leve) ou '3d' (mais bonito, mais pesado) */
  mapMode: '2d' | '3d';
  /** prédios 3D (desligado por padrão: o mapa mostra só ruas, vagas e carros) */
  showBuildings: boolean;
  simSpeed: 1 | 2 | 4;
  locationSource: 'simulada' | 'gps';
  /** GPS contínuo: off · aguardando 1ª leitura · ok · fora da área do mapa · negado/indisponível */
  gps: { status: 'off' | 'waiting' | 'ok' | 'outside' | 'denied' | 'unavailable'; accuracy: number | null };
  /** sensor de câmera (protótipo) aberto */
  cameraSensorOpen: boolean;
  parkedAt: number | null;
  sessionPoints: number;
}

const PREFS_KEY = 'vagaaqui.prefs.v1';
function loadPrefs(): Partial<AppState> & { gpsEnabled?: boolean } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as Partial<AppState>;
  } catch {
    /* sem preferências salvas */
  }
  return {};
}
const prefs = loadPrefs();

export const appStore = createStore<AppState>({
  phase: 'splash',
  cityStatus: 'loading',
  cityStatusText: 'Carregando mapa…',
  cityOrigin: null,
  cityNote: null,
  cameraMode: 'follow',
  navStatus: 'idle',
  targetSpotId: null,
  route: null,
  selectedSpotId: null,
  recommendations: [],
  recommendationsOpen: false,
  destination: null,
  excluded: [],
  driverMode: prefs.driverMode ?? false,
  profile: DEFAULT_PROFILE,
  toasts: [],
  prompt: null,
  notice: null,
  panel: null,
  qualityOverride: prefs.qualityOverride ?? 'auto',
  detectedTier: 'medium',
  voice: prefs.voice ?? true,
  showBuildings: prefs.showBuildings ?? false,
  mapMode: prefs.mapMode ?? '2d',
  simSpeed: prefs.simSpeed ?? 1,
  locationSource: 'simulada',
  gps: { status: 'off', accuracy: null },
  cameraSensorOpen: false,
  parkedAt: null,
  sessionPoints: 0,
});

export const useApp = appStore.useStore;
const set = appStore.set;
const get = appStore.get;

function savePrefs() {
  const s = get();
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        driverMode: s.driverMode,
        qualityOverride: s.qualityOverride,
        voice: s.voice,
        simSpeed: s.simSpeed,
        showBuildings: s.showBuildings,
        mapMode: s.mapMode,
      }),
    );
  } catch {
    /* ignora */
  }
}

export function effectiveTier(s: AppState): QualityTier {
  return s.qualityOverride === 'auto' ? s.detectedTier : s.qualityOverride;
}

function notify(text: string, tone: Notice['tone'] = 'info') {
  const id = uid('ntc');
  set({ notice: { id, text, tone } });
  window.setTimeout(() => {
    if (get().notice?.id === id) set({ notice: null });
  }, 4200);
}

function say(text: string) {
  if (get().voice) speak(text);
}

let initialized = false;
let stopGps: (() => void) | null = null;
let gpsWatchdog: number | null = null;
let lastFixAt = 0;
function persistGpsPref(on: boolean) {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, gpsEnabled: on }));
  } catch {
    /* ignora */
  }
}
export const actions = {
  async init() {
    if (initialized) return;
    initialized = true;
    set({ detectedTier: detectQualityTier() });
    const profile = await repository.loadProfile().catch(() => DEFAULT_PROFILE);
    set({ profile });
    // a cidade precisa existir antes da simulação (vagas e trânsito dependem das ruas)
    const result = await loadCity((text) => set({ cityStatusText: text }));
    set({ cityStatus: 'ready', cityOrigin: result.origin, cityNote: result.note ?? null, cityStatusText: '' });
    const sim = getSimulation();
    sim.speedMultiplier = get().simSpeed;
    sim.onEvent((e) => {
      if (e.type === 'arrived') actions.handleArrival(e.spotId, e.blocked);
      if (e.type === 'passing') actions.handlePassing(e.spotId);
      if (e.type === 'offroute') {
        const target = get().targetSpotId;
        if (target && get().navStatus === 'navigating') {
          say('Recalculando a rota.');
          actions.navigateTo(target, true);
        }
      }
    });
  },

  async enterMap() {
    set({ phase: 'map' });
    const note = get().cityNote;
    if (note) window.setTimeout(() => notify(note, 'warn'), 600);
    if (env.useBrowserGps || prefs.gpsEnabled) actions.enableGps();
  },

  /** Liga o GPS contínuo: o carro do app passa a seguir o carro real. */
  enableGps() {
    if (stopGps) return;
    set({ gps: { status: 'waiting', accuracy: null } });
    let announced = false;
    stopGps = startGpsTracking(
      (fix) => {
        lastFixAt = Date.now();
        const inside = getSimulation().applyGpsFix(fix);
        set({ gps: { status: inside ? 'ok' : 'outside', accuracy: fix.accuracy }, locationSource: inside ? 'gps' : 'simulada' });
        if (!inside) getSimulation().releaseGps();
        if (!announced) {
          announced = true;
          if (inside) {
            notify(`GPS ativo (±${Math.round(fix.accuracy)} m). O carro no mapa segue você.`);
            cameraBus.emit({ type: 'focus', x: fix.position.x, z: fix.position.z, distance: 160 });
            set({ cameraMode: 'follow' });
          } else {
            notify('Você está fora da área do mapa. Usando o carro simulado.', 'warn');
          }
        }
      },
      (e) => {
        if (e === 'weak') {
          // temporário: mantém o rastreamento e o último ponto conhecido
          if (get().gps.status !== 'waiting') set((s) => ({ gps: { ...s.gps, status: 'waiting' } }));
          return;
        }
        set({ gps: { status: e === 'denied' ? 'denied' : 'unavailable', accuracy: null } });
        notify(e === 'denied' ? 'Permissão de localização negada.' : 'Este navegador não oferece GPS.', 'warn');
        actions.disableGps(false);
      },
    );
    // vigia: sem leitura nova por 15 s → "sinal fraco" (o carro fica parado no último ponto)
    gpsWatchdog = window.setInterval(() => {
      if (get().gps.status === 'ok' && Date.now() - lastFixAt > 15_000) set((s) => ({ gps: { ...s.gps, status: 'waiting' } }));
    }, 5000);
    persistGpsPref(true);
  },

  disableGps(clearPref = true) {
    stopGps?.();
    stopGps = null;
    if (gpsWatchdog) window.clearInterval(gpsWatchdog);
    gpsWatchdog = null;
    getSimulation().releaseGps();
    set((s) => ({ gps: { status: s.gps.status === 'denied' ? 'denied' : 'off', accuracy: null }, locationSource: 'simulada' }));
    if (clearPref) persistGpsPref(false);
  },

  setCameraSensorOpen(open: boolean) {
    set({ cameraSensorOpen: open, panel: null });
  },

  findParking(destination: Destination | null = get().destination) {
    const sim = getSimulation();
    if (get().navStatus === 'parked') {
      sim.leaveParking();
      set({ navStatus: 'idle', parkedAt: null });
    }
    const recs = recommend(sim.candidates(), {
      destination: destination?.position ?? null,
      exclude: new Set(get().excluded),
    });
    if (!recs.length) {
      notify('Nenhuma vaga provável encontrada agora. Tente ampliar a busca ou aguarde novas confirmações.', 'warn');
      set({ recommendations: [], recommendationsOpen: false });
      return;
    }
    set({ destination, recommendations: recs, recommendationsOpen: true, selectedSpotId: null });
    const best = sim.spotsById.get(recs[0].spotId)!;
    if (get().cameraMode !== 'follow') cameraBus.emit({ type: 'focus', x: best.position.x, z: best.position.z, distance: 260 });
  },

  setDestination(destination: Destination | null) {
    set({ destination });
    actions.findParking(destination);
  },

  navigateTo(spotId: string, reroute = false) {
    const sim = getSimulation();
    if (get().navStatus === 'parked') sim.leaveParking();
    const spot = sim.spotsById.get(spotId);
    if (!spot) return;
    const lot = spot.lotId ? sim.lots.find((l) => l.id === spot.lotId) : undefined;
    const route = sim.startNavigation(spotId, lot ? lot.name : spot.streetName);
    if (!route) return;
    set({
      navStatus: 'navigating',
      targetSpotId: spotId,
      route,
      selectedSpotId: null,
      recommendationsOpen: false,
      cameraMode: 'follow',
      prompt: null,
      parkedAt: null,
    });
    if (reroute) return;
    const a = sim.getSnapshot().assessments.get(spotId);
    say(`${route.instructions[0]?.text ?? 'Siga a rota'}. ${a ? Math.round(a.probability * 100) : ''} por cento de chance de vaga.`);
  },

  cancelNavigation() {
    getSimulation().cancelNavigation();
    set({ navStatus: 'idle', targetSpotId: null, route: null, prompt: null });
  },

  handleArrival(spotId: string, blocked: boolean) {
    set({
      navStatus: 'arrived',
      prompt: { id: uid('pr'), kind: 'arrival', spotId, stage: 'ask', blocked },
    });
    say(blocked ? 'Você chegou. Parece haver um carro na vaga. Ela está livre?' : 'Você chegou. A vaga está livre?');
  },

  handlePassing(spotId: string) {
    const s = get();
    // Segurança: no Modo Motorista não interrompemos com perguntas durante a rota.
    if (s.driverMode || s.prompt) return;
    set({ prompt: { id: uid('pr'), kind: 'passing', spotId, stage: 'ask' } });
  },

  reward(action: RewardAction, spotId: string, accurate: boolean) {
    const { profile, event, levelUp } = applyReward(get().profile, action, spotId, accurate);
    const toast: Toast = {
      id: event.id,
      points: event.points,
      label: event.label,
      levelUp: levelUp ? levelFor(profile.points).current.name : undefined,
    };
    set((s) => ({ profile, toasts: [...s.toasts, toast], sessionPoints: s.sessionPoints + event.points }));
    void repository.saveProfile(profile);
    window.setTimeout(() => actions.dismissToast(toast.id), levelUp ? 4200 : 2600);
  },

  answerPrompt(answer: 'available' | 'occupied' | 'parked' | 'dismiss') {
    const prompt = get().prompt;
    if (!prompt) return;
    if (answer === 'dismiss') {
      set({ prompt: null });
      if (prompt.kind === 'arrival') set({ navStatus: 'idle', targetSpotId: null, route: null });
      if (prompt.kind === 'arrival') getSimulation().cancelNavigation();
      return;
    }
    const sim = getSimulation();
    const spot = sim.spotsById.get(prompt.spotId)!;
    const trust = trustFor(get().profile);
    const accurate = sim.submitUserReport(prompt.spotId, answer, trust);
    void repository.submitReport({
      spotId: spot.id,
      kind: answer,
      latitude: spot.latitude,
      longitude: spot.longitude,
      timestamp: Date.now(),
    });

    if (answer === 'available') {
      actions.reward('confirm_available', spot.id, accurate);
      if (prompt.kind === 'arrival') {
        set({ prompt: { ...prompt, stage: 'confirmed_free' } });
        return;
      }
      set({ prompt: null });
      return;
    }
    if (answer === 'occupied') {
      actions.reward('confirm_occupied', spot.id, accurate);
      set({ prompt: null });
      if (prompt.kind === 'arrival') {
        set((s) => ({ excluded: [...s.excluded, spot.id], navStatus: 'idle', targetSpotId: null, route: null }));
        sim.cancelNavigation();
        notify('Obrigado! Buscando a próxima melhor vaga…');
        say('Vaga ocupada. Buscando outra opção.');
        window.setTimeout(() => actions.findParking(), 700);
      }
      return;
    }
    // estacionou
    actions.reward('parked', spot.id, accurate);
    set({ prompt: null, navStatus: 'parked', targetSpotId: spot.id, route: null, parkedAt: Date.now(), excluded: [] });
    say('Estacionamento registrado. Bom passeio!');
  },

  leaveSpot() {
    getSimulation().leaveParking();
    set({ navStatus: 'idle', targetSpotId: null, parkedAt: null });
    notify('Saída registrada. A vaga foi liberada para outros motoristas.');
  },

  selectSpot(spotId: string | null) {
    set({ selectedSpotId: spotId, recommendationsOpen: spotId ? false : get().recommendationsOpen });
  },

  closeRecommendations() {
    set({ recommendationsOpen: false });
  },

  setCameraMode(cameraMode: CameraMode) {
    set({ cameraMode });
  },

  toggleDriverMode() {
    set((s) => ({ driverMode: !s.driverMode, cameraMode: 'follow', panel: null, selectedSpotId: null }));
    savePrefs();
  },

  setPanel(panel: Panel) {
    set({ panel });
  },

  setQuality(q: AppState['qualityOverride']) {
    set({ qualityOverride: q });
    savePrefs();
  },

  setMapMode(mapMode: '2d' | '3d') {
    set({ mapMode, cameraMode: 'follow' });
    savePrefs();
  },

  toggleBuildings() {
    set((s) => ({ showBuildings: !s.showBuildings }));
    savePrefs();
  },

  toggleVoice() {
    set((s) => ({ voice: !s.voice }));
    savePrefs();
  },

  setSimSpeed(simSpeed: 1 | 2 | 4) {
    getSimulation().speedMultiplier = simSpeed;
    set({ simSpeed });
    savePrefs();
  },

  dismissToast(id: string) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  resetProfile() {
    set({ profile: DEFAULT_PROFILE });
    void repository.saveProfile(DEFAULT_PROFILE);
  },

  notify,
  say,
};
