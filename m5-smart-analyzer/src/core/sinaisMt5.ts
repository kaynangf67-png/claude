import { breakevenRate, compareGroups, tally, verdict, type Comparison, type Tally, type Verdict } from './stats';

/**
 * Sinais registrados pelo indicador `mql5/M5Retracao.mq5` (arquivo
 * m5sinais_<SIMBOLO>.csv). Cada linha é um sinal já resolvido no fechamento do
 * M5, com as características anotadas no momento do sinal. Aqui só se mede:
 * nada é ajustado para o resultado ficar bonito.
 */
export interface SinalMt5 {
  t: number;
  simbolo: string;
  lado: 'venda' | 'compra';
  entrada: number;
  fechamento: number;
  win: boolean;
  tie: boolean;
  /** 1 = sim, 0 = não, -1 = desconhecido */
  ma: number;
  rejeicao: number;
  engolfo: number;
  doji: number;
  /** Entrada dentro do pavio da última vela H1 (coluna opcional; -1 em arquivos antigos). */
  h1: number;
  /** Último candle fechado ≥ 1,5× a média dos 10 anteriores (opcional). */
  exaustao: number;
  /** RSI(14) ≥ 70 na venda ou ≤ 30 na compra (opcional). */
  rsi: number;
}

export function parseSinaisMt5(text: string): { sinais: SinalMt5[]; rejeitadas: number } {
  const sinais: SinalMt5[] = [];
  let rejeitadas = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/^\d/.test(line)) continue; // cabeçalho
    const p = line.split(',');
    if (p.length < 10) { rejeitadas++; continue; }
    const [t, simbolo, lado, entrada, fechamento, resultado, ma, rej, eng, doji, h1, exa, rsi] = p.map((x) => x.trim());
    const n = (x: string | undefined) => Number(x);
    const flag = (x: string | undefined) => (x === '1' ? 1 : x === '0' ? 0 : -1);
    if ((lado !== 'venda' && lado !== 'compra') || !['ganho', 'perda', 'empate'].includes(resultado!)
      || ![n(t), n(entrada), n(fechamento)].every(Number.isFinite)) { rejeitadas++; continue; }
    sinais.push({
      t: n(t), simbolo: simbolo!, lado, entrada: n(entrada), fechamento: n(fechamento),
      win: resultado === 'ganho', tie: resultado === 'empate',
      ma: flag(ma), rejeicao: flag(rej), engolfo: flag(eng), doji: flag(doji), h1: flag(h1), exaustao: flag(exa), rsi: flag(rsi),
    });
  }
  // o mesmo sinal pode aparecer duas vezes se o indicador foi recarregado: fica o primeiro
  const vistos = new Set<string>();
  const unicos = sinais.filter((s) => {
    const k = `${s.simbolo}|${s.t}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return { sinais: unicos.sort((a, b) => a.t - b.t), rejeitadas: rejeitadas + (sinais.length - unicos.length) };
}

export const CARACTERISTICAS = [
  { id: 'ma', nome: 'Médias móveis 9/21 a favor' },
  { id: 'rejeicao', nome: 'Rejeição (pavio do lado da zona)' },
  { id: 'engolfo', nome: 'Engolfo a favor' },
  { id: 'doji', nome: 'Doji (indecisão)' },
  { id: 'h1', nome: 'No pavio da última vela H1' },
  { id: 'exaustao', nome: 'Exaustão (vela ≥ 1,5× a média)' },
  { id: 'rsi', nome: 'RSI extremo (≥ 70 venda, ≤ 30 compra)' },
] as const;

export interface LinhaCaracteristica {
  id: (typeof CARACTERISTICAS)[number]['id'];
  nome: string;
  com: Tally;
  sem: Tally;
  cmp: Comparison;
}

/** Períodos do dia no horário de Brasília (UTC-3, sem horário de verão desde 2019). */
export const PERIODOS = [
  { id: 'madrugada', nome: 'Madrugada (0h–6h)', de: 0, ate: 6 },
  { id: 'manha', nome: 'Manhã (6h–12h)', de: 6, ate: 12 },
  { id: 'tarde', nome: 'Tarde (12h–18h)', de: 12, ate: 18 },
  { id: 'noite', nome: 'Noite (18h–24h)', de: 18, ate: 24 },
] as const;

/** Hora de Brasília (0–23) de um timestamp Unix em segundos (UTC). */
export function horaBrasilia(t: number): number {
  return (((Math.floor(t / 3600) - 3) % 24) + 24) % 24;
}

export interface LinhaGrupo {
  nome: string;
  t: Tally;
  v: Verdict;
}

export interface ResumoSinais {
  breakeven: number;
  todos: Tally;
  veredito: Verdict;
  caracteristicas: LinhaCaracteristica[];
  periodos: LinhaGrupo[];
  pares: LinhaGrupo[];
}

export function resumoSinaisMt5(sinais: SinalMt5[], payoutPercent: number): ResumoSinais {
  const be = breakevenRate(payoutPercent);
  const todos = tally(sinais);
  return {
    breakeven: be,
    todos,
    veredito: verdict(todos, be),
    caracteristicas: CARACTERISTICAS.map(({ id, nome }) => {
      const conhecidos = sinais.filter((s) => s[id] >= 0);
      const com = tally(conhecidos.filter((s) => s[id] === 1));
      const sem = tally(conhecidos.filter((s) => s[id] === 0));
      return { id, nome, com, sem, cmp: compareGroups(com, sem) };
    }),
    periodos: PERIODOS.map(({ nome, de, ate }) => {
      const t = tally(sinais.filter((s) => { const h = horaBrasilia(s.t); return h >= de && h < ate; }));
      return { nome, t, v: verdict(t, be) };
    }),
    pares: [...new Set(sinais.map((s) => s.simbolo))].sort().map((nome) => {
      const t = tally(sinais.filter((s) => s.simbolo === nome));
      return { nome, t, v: verdict(t, be) };
    }),
  };
}
