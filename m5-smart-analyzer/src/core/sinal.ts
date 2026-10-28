import { priorValidTouches } from './zones';
import type { AnalysisResult } from './types';

/**
 * Traduz a análise completa em UM sinal simples para a tela principal:
 * "entrada", "zona tocada", "não entre", "aguarde" ou "sem dados".
 * Não cria regra nova: só resume o que o motor já decidiu.
 */
export type SinalTipo = 'entrada' | 'zona_tocada' | 'nao_entre' | 'aguarde' | 'sem_dados';

export type ItemStatus = 'ok' | 'falta' | 'na';

export interface Sinal {
  tipo: SinalTipo;
  lado?: 'venda' | 'compra';
  /** Frase curta e grande. */
  titulo: string;
  /** Uma linha de explicação. */
  detalhe: string;
  /** O que ainda falta para virar entrada (nomes curtos). */
  faltam: string[];
  checklist: Array<{ id: string; nome: string; status: ItemStatus }>;
}

const CHECKS: Array<{ id: string; nome: string; from: 'filtro' | 'criterio' }> = [
  { id: 'historico_minimo', nome: 'Zona com 2 toques', from: 'filtro' },
  { id: 'gatilho_tempo_restante', nome: 'Tempo ≥ 2:30', from: 'criterio' },
  { id: 'gatilho_velas_com_pavio', nome: 'Velas anteriores', from: 'criterio' },
  { id: 'reversao', nome: 'Sem reversão', from: 'filtro' },
  { id: 'vela_proxima_regiao', nome: 'Não nasceu na zona', from: 'filtro' },
  { id: 'sequencia_direcional', nome: 'Sem 3 velas iguais', from: 'filtro' },
  { id: 'vela_lenta_parada', nome: 'Vela com vida', from: 'filtro' },
];

export function checklist(a: AnalysisResult | null): Sinal['checklist'] {
  return CHECKS.map((c) => {
    let status: ItemStatus = 'na';
    if (a) {
      if (c.from === 'filtro') {
        const f = a.filters.find((x) => x.id === c.id);
        if (f) status = f.status === 'favoravel' ? 'ok' : f.status === 'desfavoravel' ? 'falta' : 'na';
      } else {
        const t = a.trigger.criteria.find((x) => x.id === c.id);
        if (t) status = t.status === 'atendido' ? 'ok' : t.status === 'nao_atendido' ? 'falta' : 'na';
      }
    }
    return { id: c.id, nome: c.nome, status };
  });
}

/** Zona armada mais próxima do preço: lado e distância relativa ao preço. */
export function zonaMaisProxima(a: AnalysisResult, price: number, minPrior = 2): { lado: 'resistencia' | 'suporte'; distPct: number } | null {
  let best: { lado: 'resistencia' | 'suporte'; distPct: number } | null = null;
  const nextIdx = (a.window?.toIndex ?? 0) + 1;
  for (const z of a.zones) {
    if (priorValidTouches(z, nextIdx).length < minPrior) continue;
    const res = z.side === 'resistencia';
    const dist = res ? z.lower - price : price - z.upper;
    if (dist < 0) continue; // preço já dentro ou além
    const distPct = (dist / price) * 100;
    if (!best || distPct < best.distPct) best = { lado: z.side, distPct };
  }
  return best;
}

const fmtPct = (x: number) => x.toFixed(2).replace('.', ',') + '%';
const nomeLado = (s: 'resistencia' | 'suporte') => (s === 'resistencia' ? 'resistência' : 'suporte');

export function calcularSinal(a: AnalysisResult | null, price: number | null, minPrior = 2): Sinal {
  const list = checklist(a);
  const base = { faltam: [] as string[], checklist: list };
  if (!a) return { ...base, tipo: 'sem_dados', titulo: 'Conectando…', detalhe: 'Buscando os candles.' };
  if (a.state === 'NAO_AVALIAVEL') {
    return { ...base, tipo: 'sem_dados', titulo: 'Sem dados suficientes', detalhe: a.invalidReasons[0] ?? 'Aguardando candles.' };
  }

  const e = a.entry;
  if (e && e.armed) {
    const lado = e.side === 'resistencia' ? 'venda' : 'compra';
    const faltam = list.filter((i) => i.status === 'falta').map((i) => i.nome);
    const tempoRuim = list.find((i) => i.id === 'gatilho_tempo_restante')?.status === 'falta';
    if (a.trigger.confirmed) {
      return {
        ...base, tipo: 'entrada', lado,
        titulo: `${lado.toUpperCase()} agora`,
        detalhe: `Preço tocou ${nomeLado(e.side)} com ${e.priorValidTouches} toques anteriores e todos os critérios batem.`,
      };
    }
    if (tempoRuim) {
      return { ...base, faltam, tipo: 'nao_entre', lado, titulo: 'Tempo esgotado', detalhe: 'Menos de 2:30 no candle. Espere o próximo.' };
    }
    if (a.state === 'DESFAVORAVEL') {
      return { ...base, faltam, tipo: 'nao_entre', lado, titulo: 'NÃO ENTRE', detalhe: a.blockingReasons[0] ?? 'Há um filtro de não entrada ativo.' };
    }
    return {
      ...base, faltam, tipo: 'zona_tocada', lado,
      titulo: `Zona de ${nomeLado(e.side)} tocada`,
      detalhe: faltam.length ? `Ainda falta: ${faltam.join(', ')}.` : 'Confirmando os critérios…',
    };
  }
  if (e && !e.armed) {
    return { ...base, tipo: 'aguarde', titulo: 'Aguarde', detalhe: `Zona com só ${e.priorValidTouches} toque(s) válido(s): ainda não é confiável.` };
  }

  const prox = price !== null ? zonaMaisProxima(a, price, minPrior) : null;
  return {
    ...base, tipo: 'aguarde', titulo: 'Aguarde',
    detalhe: prox ? `${nomeLado(prox.lado)[0]!.toUpperCase()}${nomeLado(prox.lado).slice(1)} armada a ${fmtPct(prox.distPct)} do preço.` : 'Nenhuma zona armada perto do preço.',
  };
}
