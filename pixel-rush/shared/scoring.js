// Sistema de pontuação (mesmas regras no cliente — para exibir — e no servidor — que decide).
export const LEVEL_MAX = 1600;

export function levelScore(parSec, timeMs, deaths) {
  const ratio = (parSec * 1000) / Math.max(1, timeMs);
  return Math.round(1000 * Math.min(1.5, ratio)) + (deaths === 0 ? 100 : 0);
}

export function endlessScore(distance) { return Math.max(0, Math.floor(distance)) * 3; }

// Medalha da fase conforme o tempo em relação ao "par"
export function levelMedal(parSec, timeMs) {
  if (timeMs == null) return null;
  const r = timeMs / (parSec * 1000);
  if (r <= 0.8) return 'diamante';
  if (r <= 1) return 'ouro';
  if (r <= 1.5) return 'prata';
  return 'bronze';
}

// Recompensa em moedas por tentativa validada (o servidor aplica limite diário)
export function runReward({ mode, firstClear, newBest, coins, distance, place }) {
  let r = 0;
  if (mode === 'level') r = 5 + coins * 2 + (firstClear ? 50 : 0) + (newBest ? 15 : 0);
  else if (mode === 'endless') r = Math.floor(distance / 10) + (newBest ? 25 : 0);
  else if (mode === 'daily' || mode === 'event') r = 20 + (newBest ? 20 : 0) + coins;
  else if (mode === 'race') r = [40, 25, 15, 10][place - 1] ?? 5;
  return r;
}

export const DAILY_COIN_CAP = 800;

export const SEASON_REWARDS = [
  { from: 1, to: 1, medal: 'season_gold', coins: 1500, items: ['frame_champion'], label: '1º lugar — Troféu de Ouro' },
  { from: 2, to: 2, medal: 'season_silver', coins: 1000, items: ['frame_champion'], label: '2º lugar — Troféu de Prata' },
  { from: 3, to: 3, medal: 'season_bronze', coins: 700, items: ['frame_champion'], label: '3º lugar — Troféu de Bronze' },
  { from: 4, to: 10, medal: 'season_top10', coins: 400, items: ['frame_top10'], label: 'Top 10' },
  { from: 11, to: 100, medal: 'season_top100', coins: 150, items: [], label: 'Top 100' },
];

export const EVENT_REWARDS = [
  { from: 1, to: 1, medal: 'event_gold', coins: 600 },
  { from: 2, to: 2, medal: 'event_silver', coins: 400 },
  { from: 3, to: 3, medal: 'event_bronze', coins: 250 },
  { from: 4, to: 25, medal: 'event_top25', coins: 80 },
];

export const MEDALS = {
  season_gold: { name: 'Campeão da Temporada', icon: '🏆', color: '#ffd23f' },
  season_silver: { name: 'Vice da Temporada', icon: '🥈', color: '#d7e1ea' },
  season_bronze: { name: '3º da Temporada', icon: '🥉', color: '#e08a4b' },
  season_top10: { name: 'Top 10 da Temporada', icon: '🎖️', color: '#8a6cff' },
  season_top100: { name: 'Top 100 da Temporada', icon: '🏅', color: '#5ac8fa' },
  event_gold: { name: 'Vencedor do Evento Mundial', icon: '🌍', color: '#ffd23f' },
  event_silver: { name: '2º no Evento Mundial', icon: '🌎', color: '#d7e1ea' },
  event_bronze: { name: '3º no Evento Mundial', icon: '🌏', color: '#e08a4b' },
  event_top25: { name: 'Top 25 do Evento Mundial', icon: '⭐', color: '#5ac8fa' },
};

// Períodos (UTC)
export function seasonId(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function seasonRange(id) {
  const [y, m] = id.split('-').map(Number);
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
}
export function prevSeasonId(id) {
  const [y, m] = id.split('-').map(Number);
  return seasonId(Date.UTC(y, m - 2, 1));
}
export function weekStart(ms = Date.now()) { // segunda-feira 00:00 UTC
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}
export function eventId(ms = Date.now()) {
  const ws = weekStart(ms);
  const d = new Date(ws);
  return `event-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function eventRange(id) {
  const [, y, m, d] = id.split('-');
  const start = Date.UTC(+y, +m - 1, +d);
  return { start, end: start + 7 * 86400000 };
}
export function dailyId(ms = Date.now()) {
  const d = new Date(ms);
  return `daily-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function dailyRange(id) {
  const [, y, m, d] = id.split('-');
  const start = Date.UTC(+y, +m - 1, +d);
  return { start, end: start + 86400000 };
}
