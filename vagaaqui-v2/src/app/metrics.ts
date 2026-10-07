import type { MetricEvent } from '../data/store';

export interface PilotMetrics {
  opens: number;
  forecasts: number;
  /** mediana do tempo até mostrar a previsão (ms) */
  medianForecastMs: number | null;
  /** mediana do "abrir o app" até a 1ª resposta (ms) */
  medianOpenToAnswerMs: number | null;
  answers: number;
  /** % das chegadas em que achou vaga na rua */
  foundRate: number | null;
  /** acerto: previsão ALTA/MÉDIA e achou, ou BAIXA e não achou */
  hitRate: number | null;
  /** erro quadrático médio da chance prevista (0 = perfeito, 0,25 = chute) */
  brier: number | null;
  reports: number;
  reportsPerWeek: number | null;
  autoReports: number;
  navigations: number;
  subscribeClicks: number;
  waitlist: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeMetrics(events: MetricEvent[]): PilotMetrics {
  const by = (n: MetricEvent['name']) => events.filter((e) => e.name === n);
  const forecasts = by('forecast_shown');
  const answers = by('answer');
  const scored = answers.filter((a) => typeof a.props?.predicted === 'number');
  const outcome = (a: MetricEvent) => (a.props?.answer === 'street' ? 1 : 0);
  const reports = by('report');
  const span = events.length ? (Math.max(...events.map((e) => e.at)) - Math.min(...events.map((e) => e.at))) / (7 * 86400000) : 0;
  return {
    opens: by('app_open').length,
    forecasts: forecasts.length,
    medianForecastMs: median(forecasts.map((f) => Number(f.props?.ms)).filter((x) => Number.isFinite(x))),
    medianOpenToAnswerMs: median(forecasts.map((f) => f.props?.sinceOpenMs).filter((x): x is number => typeof x === 'number')),
    answers: answers.length,
    foundRate: answers.length ? answers.filter((a) => outcome(a) === 1).length / answers.length : null,
    hitRate: scored.length ? scored.filter((a) => (Number(a.props!.predicted) >= 0.5 ? 1 : 0) === outcome(a)).length / scored.length : null,
    brier: scored.length ? scored.reduce((s, a) => s + (Number(a.props!.predicted) - outcome(a)) ** 2, 0) / scored.length : null,
    reports: reports.filter((r) => !r.props?.auto).length,
    autoReports: reports.filter((r) => r.props?.auto).length,
    reportsPerWeek: span >= 1 ? reports.length / span : null,
    navigations: by('navigate').length,
    subscribeClicks: by('subscribe_click').length,
    waitlist: by('waitlist').length,
  };
}
