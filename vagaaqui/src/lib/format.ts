export function formatPercent(p: number) {
  return `${Math.round(p * 100)}%`;
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatEta(seconds: number) {
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} min`;
}

export function formatAgo(timestamp: number | null, now: number) {
  if (timestamp == null) return 'sem confirmações';
  const s = Math.max(0, Math.round((now - timestamp) / 1000));
  if (s < 3) return 'agora mesmo';
  if (s < 60) return `há ${s} ${s === 1 ? 'segundo' : 'segundos'}`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  return `há ${h} ${h === 1 ? 'hora' : 'horas'}`;
}

export function formatPoints(n: number) {
  return n.toLocaleString('pt-BR');
}

export function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
