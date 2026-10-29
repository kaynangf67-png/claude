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
}

export function parseSinaisMt5(text: string): { sinais: SinalMt5[]; rejeitadas: number } {
  const sinais: SinalMt5[] = [];
  let rejeitadas = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/^\d/.test(line)) continue; // cabeçalho
    const p = line.split(',');
    if (p.length < 10) { rejeitadas++; continue; }
    const [t, simbolo, lado, entrada, fechamento, resultado, ma, rej, eng, doji, h1] = p.map((x) => x.trim());
    const n = (x: string | undefined) => Number(x);
    const flag = (x: string | undefined) => (x === '1' ? 1 : x === '0' ? 0 : -1);
    if ((lado !== 'venda' && lado !== 'compra') || !['ganho', 'perda', 'empate'].includes(resultado!)
      || ![n(t), n(entrada), n(fechamento)].every(Number.isFinite)) { rejeitadas++; continue; }
    sinais.push({
      t: n(t), simbolo: simbolo!, lado, entrada: n(entrada), fechamento: n(fechamento),
      win: resultado === 'ganho', tie: resultado === 'empate',
      ma: flag(ma), rejeicao: flag(rej), engolfo: flag(eng), doji: flag(doji), h1: flag(h1),
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
] as const;

export interface LinhaCaracteristica {
  id: (typeof CARACTERISTICAS)[number]['id'];
  nome: string;
  com: Tally;
  sem: Tally;
  cmp: Comparison;
}

export interface ResumoSinais {
  breakeven: number;
  todos: Tally;
  veredito: Verdict;
  caracteristicas: LinhaCaracteristica[];
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
  };
}
