import { config, hasBackend } from '../config';
import { demoReports } from '../data/demoReports';
import { nearestSegment } from '../data/osm';
import { getStore } from '../data/store';
import { loadStreets, STREET_RADIUS_M } from '../data/streets';
import { bboxAround, distance, type LonLat } from '../lib/geo';
import { ParkingDetector, type Fix } from '../model/detector';
import { forecastDestination, MODEL } from '../model/forecast';
import type { Report, ReportKind } from '../model/types';
import type { Place } from '../services/geocode';
import { watchGps } from '../services/gps';
import { driveEta, estimateEta, navLinks, type Eta } from '../services/route';
import { creditReport, FREE_FAVORITES, isPro } from './plan';
import { getState, setState, toast, type Favorite } from './state';

export const ARRIVAL_RADIUS_M = 150;
const REFRESH_MS = 30000;

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let inflight: AbortController | null = null;
let baseEta: { eta: Eta; from: LonLat } | null = null;
let detector: ParkingDetector | null = null;
let firstForecastTracked = false;
/** só pergunta "Achou vaga?" sozinho para quem saiu de longe e chegou */
let startedFar = false;

const destKey = (p: Place) => `${p.pos[0].toFixed(5)},${p.pos[1].toFixed(5)}`;

export function origin(): LonLat {
  return getState().gps.pos ?? config.defaultCenter;
}

export function init() {
  getStore().track({ name: 'app_open', at: Date.now(), props: { backend: hasBackend() } });
  const stop = watchGps(
    (gps) => {
      setState({ gps });
      checkArrival();
    },
    (fix) => onFix(fix),
  );
  return () => {
    stop();
    clearInterval(refreshTimer);
  };
}

function onFix(fix: Fix) {
  const s = getState();
  if (!s.settings.autoDetect) return;
  if (!detector) detector = new ParkingDetector(s.parked?.pos);
  const ev = detector.push(fix);
  if (!ev) return;
  const seg = nearestSegment(getState().segments, ev.pos, 40);
  if (ev.type === 'parked') {
    setState({ parked: { pos: ev.pos, segmentId: seg?.id ?? null, at: ev.at } });
    if (seg) void sendReport(seg.id, 'parked', ev.pos, 0.6, false);
  } else {
    if (seg) void sendReport(seg.id, 'left', ev.pos, 0.6, false);
    setState({ parked: null });
    toast('Saída da vaga detectada — obrigado por liberar a vaga!');
  }
}

/** Escolheu o destino: busca ruas, tempo de viagem e relatos, e calcula a previsão. */
export async function selectDestination(place: Place) {
  if (getState().dest?.id !== place.id) setState({ answeredDestKey: null });
  setState({ dest: place, selectedSegmentId: null, error: null, screen: 'map' });
  baseEta = null;
  startedFar = distance(origin(), place.pos) > ARRIVAL_RADIUS_M + 100;
  await runForecast(true);
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => void runForecast(false), REFRESH_MS);
}

/** "Estou procurando aqui": previsão para a posição atual, chegada imediata. */
export async function forecastHere() {
  const pos = origin();
  await selectDestination({ id: `here-${Date.now()}`, name: 'Aqui perto', detail: 'Sua localização atual', pos });
}

export function clearDestination() {
  inflight?.abort();
  clearInterval(refreshTimer);
  setState({ dest: null, forecast: null, eta: null, selectedSegmentId: null, arrivalOpen: false, error: null, loading: false, arriveAtTarget: null });
}

export async function runForecast(full: boolean) {
  const s = getState();
  const dest = s.dest;
  if (!dest) return;
  inflight?.abort();
  const ctrl = new AbortController();
  inflight = ctrl;
  if (full) setState({ loading: true });
  const t0 = performance.now();
  try {
    const from = origin();
    // ruas (cache → OSM → demonstração)
    let { segments, lots, streetSource } = s;
    const haveArea = segments.length && segments.some((x) => distance(x.mid, dest.pos) < 300);
    if (full || !haveArea) {
      const data = await loadStreets(dest.pos, ctrl.signal);
      segments = data.segments;
      lots = data.lots;
      streetSource = data.source;
    }
    // tempo de viagem: rota uma vez, depois proporcional à distância restante
    let eta: Eta;
    if (!baseEta || full) {
      eta = await driveEta(from, dest.pos, ctrl.signal);
      baseEta = { eta, from };
    } else {
      const total = distance(baseEta.from, dest.pos) || 1;
      const left = distance(from, dest.pos);
      eta = baseEta.eta.source === 'route' ? { ...baseEta.eta, minutes: Math.max(0, Math.round((baseEta.eta.minutes * left) / total)) } : estimateEta(from, dest.pos);
    }
    if (distance(from, dest.pos) < ARRIVAL_RADIUS_M) eta = { ...eta, minutes: 0 };

    const now = Date.now();
    let etaMin = eta.minutes;
    // Pro: previsão para um horário futuro de chegada
    if (s.arriveAtTarget && isPro(s.plan)) etaMin = Math.max(eta.minutes, Math.round((s.arriveAtTarget - now) / 60000));

    const box = bboxAround(dest.pos, STREET_RADIUS_M);
    let reports: Report[] = [];
    try {
      reports = await getStore().getReports(box, now - MODEL.maxAgeMin * 60000);
    } catch {
      toast('Sem conexão com o servidor — usando só o histórico');
    }
    if (s.settings.demo && !hasBackend()) reports = reports.concat(demoReports(segments, now));

    const forecast = forecastDestination({ segments, reports, destination: dest.pos, now, etaMin, radiusM: s.settings.radiusM });
    if (ctrl.signal.aborted) return;
    setState({ segments, lots, streetSource, eta, forecast, loading: false, error: null });
    if (full) {
      const ms = Math.round(performance.now() - t0);
      getStore().track({ name: 'forecast_shown', at: now, props: { ms, sinceOpenMs: firstForecastTracked ? null : now - s.openedAt, level: forecast.level, p: +forecast.overall.toFixed(3), reports: forecast.best.reduce((n, b) => n + b.reportsUsed, 0), streets: streetSource } });
      firstForecastTracked = true;
    }
    checkArrival();
  } catch (e) {
    if (ctrl.signal.aborted) return;
    setState({ loading: false, error: e instanceof Error ? e.message : 'Falha ao calcular a previsão' });
  }
}

function checkArrival() {
  const s = getState();
  if (!s.dest || !s.forecast || s.arrivalOpen || !s.gps.pos) return;
  if (s.answeredDestKey === destKey(s.dest)) return;
  if (s.dest.id.startsWith('here-') || !startedFar) return;
  if (distance(s.gps.pos, s.dest.pos) <= ARRIVAL_RADIUS_M) setState({ arrivalOpen: true });
}

export function openArrival() {
  setState({ arrivalOpen: true });
}

async function sendReport(segmentId: string, kind: ReportKind, pos: LonLat, trust: number, credit = true) {
  try {
    await getStore().addReport({ segmentId, kind, pos, trust });
  } catch {
    toast('Não foi possível enviar agora — tente de novo em instantes');
    return false;
  }
  getStore().track({ name: 'report', at: Date.now(), props: { kind, auto: !credit } });
  if (credit) {
    const { plan, earnedDay } = creditReport(getState().plan);
    setState({ plan });
    if (earnedDay) toast('Você ganhou 1 dia de VagaAqui Pro por ajudar outros motoristas!');
  }
  return true;
}

/** trecho ao qual o relato se refere: onde o usuário está (se perto de um) ou o melhor recomendado */
function reportSegment(): { id: string; pos: LonLat } | null {
  const s = getState();
  const here = s.gps.pos ? nearestSegment(s.segments, s.gps.pos, 60) : null;
  if (here) return { id: here.id, pos: s.gps.pos! };
  const chosen = s.forecast?.all.find((f) => f.segment.id === s.selectedSegmentId) ?? s.forecast?.best[0];
  return chosen ? { id: chosen.segment.id, pos: chosen.segment.mid } : null;
}

export type ArrivalAnswer = 'street' | 'full' | 'lot';

/** Resposta de 1 toque na chegada — o dado que mede se a previsão acertou. */
export async function answerArrival(answer: ArrivalAnswer) {
  const s = getState();
  const target = reportSegment();
  const predicted = s.forecast?.overall ?? null;
  getStore().track({ name: 'answer', at: Date.now(), props: { answer, predicted: predicted === null ? null : +predicted.toFixed(3), level: s.forecast?.level ?? null } });
  setState({ arrivalOpen: false, answeredDestKey: s.dest ? destKey(s.dest) : null });
  if (!target) return;
  if (answer === 'street') {
    await sendReport(target.id, 'free', target.pos, 1);
    setState({ parked: { pos: s.gps.pos ?? target.pos, segmentId: target.id, at: Date.now() } });
    detector = null;
    toast('Valeu! Quando for embora, toque em "Estou saindo da vaga".');
  } else {
    await sendReport(target.id, 'full', target.pos, answer === 'lot' ? 0.7 : 1);
    toast('Obrigado — isso já ajuda quem está chegando.');
  }
}

/** "Estou saindo da vaga": libera a vaga para quem está chegando. */
export async function leaveSpot() {
  const p = getState().parked;
  if (!p) return;
  let segId = p.segmentId;
  if (!segId) segId = nearestSegment(getState().segments, p.pos, 60)?.id ?? null;
  if (segId) await sendReport(segId, 'left', p.pos, 1);
  setState({ parked: null });
  detector = null;
  toast('Vaga liberada para quem está chegando. Boa viagem!');
}

export function forgetParked() {
  setState({ parked: null });
  detector = null;
}

export function navigate(app: 'waze' | 'google' | 'walk', to?: LonLat) {
  const s = getState();
  const target = to ?? s.dest?.pos;
  if (!target) return;
  getStore().track({ name: 'navigate', at: Date.now(), props: { app } });
  window.open(navLinks(target)[app], '_blank', 'noopener');
}

export function setArriveAt(ts: number | null) {
  const s = getState();
  if (ts !== null && !isPro(s.plan)) {
    setState({ screen: 'account' });
    toast('Previsão para outro horário é do VagaAqui Pro');
    return;
  }
  setState({ arriveAtTarget: ts });
  void runForecast(false);
}

export function addFavorite(label: string, place: Place): boolean {
  const s = getState();
  const exists = s.favorites.findIndex((f) => f.label === label);
  if (exists < 0 && s.favorites.length >= FREE_FAVORITES && !isPro(s.plan)) {
    setState({ screen: 'account' });
    toast(`O plano grátis guarda ${FREE_FAVORITES} favoritos — no Pro são ilimitados`);
    return false;
  }
  const fav: Favorite = { label, place };
  const favorites = exists >= 0 ? s.favorites.map((f, i) => (i === exists ? fav : f)) : [...s.favorites, fav];
  setState({ favorites });
  toast(`"${label}" salvo`);
  return true;
}

export function removeFavorite(label: string) {
  setState({ favorites: getState().favorites.filter((f) => f.label !== label) });
}

export function subscribeClick() {
  const s = getState();
  getStore().track({ name: 'subscribe_click', at: Date.now(), props: { checkout: Boolean(config.checkoutUrl) } });
  if (config.checkoutUrl) {
    const url = new URL(config.checkoutUrl);
    url.searchParams.set('ref', 'app');
    window.open(url.toString(), '_blank', 'noopener');
    return;
  }
  getStore().track({ name: 'waitlist', at: Date.now() });
  setState({ plan: { ...s.plan, waitlisted: true } });
  toast('Você entrou na lista do Pro — avisaremos quando abrir.');
}

export async function clearMyData() {
  await getStore().clearMine();
  window.location.reload();
}
