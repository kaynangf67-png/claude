import { useEffect } from 'react';
import { calcularSinal, type Sinal, type SinalTipo } from '../core/sinal';
import { fmtPrice } from '../core/format';
import { ChartPage } from './ChartPage';
import { useLive } from './live';
import { useStore } from './store';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const TOM: Record<SinalTipo, { borda: string; texto: string; fundo: string; ponto: string }> = {
  entrada: { borda: 'border-pos', texto: 'text-pos', fundo: 'bg-pos/10', ponto: 'bg-pos' },
  zona_tocada: { borda: 'border-warn', texto: 'text-warn', fundo: 'bg-warn/10', ponto: 'bg-warn' },
  nao_entre: { borda: 'border-neg', texto: 'text-neg', fundo: 'bg-neg/10', ponto: 'bg-neg' },
  aguarde: { borda: 'border-line', texto: 'text-muted', fundo: 'bg-surface', ponto: 'bg-faint' },
  sem_dados: { borda: 'border-line', texto: 'text-muted', fundo: 'bg-surface', ponto: 'bg-faint' },
};

const MARCA = { ok: '✓', falta: '✕', na: '–' } as const;
const COR_ITEM = { ok: 'text-pos', falta: 'text-neg', na: 'text-faint' } as const;

/**
 * Tela única: olhar, identificar a oportunidade e entrar. Uma estratégia só, sem
 * configuração. O app NÃO opera: a entrada é sua, na corretora.
 */
export function SimplePage() {
  const live = useLive();
  const { analysis, data, config, setModo } = useStore();

  // liga o feed sozinho: não há botão para "conectar"
  useEffect(() => {
    if (!live.on) live.connect();
  }, [live.on]); // eslint-disable-line react-hooks/exhaustive-deps

  const price = data?.live?.intrabar.forming?.c ?? null;
  const minPrior = config.params.minPriorValidTouches.value ?? 2;
  const sinal: Sinal = calcularSinal(data?.live ? analysis : null, price, minPrior);
  const tom = TOM[sinal.tipo];
  const rem = data?.live?.intrabar.remainingSeconds ?? null;
  const minRem = config.params.triggerMinRemainingSeconds.value ?? 150;
  const semDados = live.on && !data?.live ? (live.rows.find((r) => r.symbol === live.selected)?.error ?? null) : null;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-3 px-3 py-3 sm:px-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[15px] font-semibold tracking-tight">M5 · Retração</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => live.setFonte(live.fonte === 'mt5' ? 'binance' : 'mt5')}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
            aria-label={`Fonte dos preços: ${live.fonte === 'mt5' ? 'forex pelo MT5' : 'cripto pela Binance'}. Tocar para trocar.`}
          >
            {live.fonte === 'mt5' ? 'Forex · MT5' : 'Cripto'}
          </button>
          <button onClick={() => setModo('avancado')} className="text-xs text-muted underline hover:text-ink">Modo avançado</button>
        </div>
      </header>

      {/* pares: a cor mostra onde olhar */}
      <nav aria-label="Pares" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {live.symbols.map((s) => {
          const row = live.rows.find((r) => r.symbol === s);
          const st = calcularSinal(row?.analysis ?? null, row?.price ?? null, minPrior);
          const sel = s === live.selected;
          return (
            <button
              key={s} onClick={() => live.select(s)} aria-pressed={sel}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${sel ? 'border-ink bg-raised text-ink' : 'border-line text-muted'}`}
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${TOM[st.tipo].ponto}`} />
              {s.replace('USDT', '')}
              {st.tipo === 'entrada' && <span className={`text-[11px] font-semibold ${TOM.entrada.texto}`}>{st.lado}</span>}
            </button>
          );
        })}
      </nav>

      {semDados && (
        <p role="status" className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-[13px] leading-snug text-ink">
          {live.fonte === 'mt5' ? 'Sem dados do MT5: ' : 'Sem dados: '}{semDados}
          {live.fonte === 'mt5' && ' Passo a passo em docs/MT5.md.'}
        </p>
      )}

      {/* o sinal */}
      <section aria-live="polite" className={`rounded-xl border-2 p-4 ${tom.borda} ${tom.fundo}`}>
        <div className={`text-3xl font-bold tracking-tight sm:text-4xl ${tom.texto}`}>{sinal.titulo}</div>
        <p className="mt-1 text-[14px] leading-snug text-ink">{sinal.detalhe}</p>
        {rem !== null && (
          <div className="mt-4">
            <div className="flex items-baseline gap-3">
              <span className="num text-4xl font-semibold">{clock(rem)}</span>
              <span className={`text-xs ${rem >= minRem ? 'text-pos' : 'text-neg'}`}>{rem >= minRem ? 'ainda dá tempo' : `menos de ${clock(minRem)}: espere o próximo candle`}</span>
            </div>
            <div className="relative mt-2 h-2.5 rounded bg-raised" role="img" aria-label="Tempo do candle">
              <div className="absolute inset-y-0 left-0 rounded-l bg-pos/25" style={{ width: `${((300 - minRem) / 300) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-l bg-ink/40" style={{ width: `${((300 - rem) / 300) * 100}%` }} />
              <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${((300 - minRem) / 300) * 100}%` }} />
            </div>
          </div>
        )}
        {price !== null && <div className="num mt-3 text-xs text-muted">preço agora {fmtPrice(price)}</div>}
      </section>

      <ChartPage compact />

      {/* checklist: só olhar */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3" aria-label="Critérios">
        {sinal.checklist.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <span aria-hidden className={`w-4 text-center font-bold ${COR_ITEM[i.status]}`}>{MARCA[i.status]}</span>
            <span className={i.status === 'falta' ? 'text-ink' : 'text-muted'}>{i.nome}</span>
            <span className="sr-only">{i.status === 'ok' ? 'atendido' : i.status === 'falta' ? 'não atendido' : 'sem dados'}</span>
          </li>
        ))}
      </ul>

      <footer className="mt-auto space-y-1 pt-2 text-[11px] leading-snug text-faint">
        <p>Você entra na corretora: este app não opera. {live.fonte === 'mt5' ? 'Dados da corretora do seu MT5 (forex), não da Quotex.' : 'Dados da Binance (cripto), não da Quotex.'} Valores de teste que não vêm da aula; sem prova de resultado. Análise técnica não garante lucro, e operações curtas podem causar perdas.</p>
      </footer>
    </div>
  );
}
