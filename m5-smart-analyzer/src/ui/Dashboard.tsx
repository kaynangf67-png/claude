import { useState } from 'react';
import { formatDateTime } from '../core/time';
import { useStore } from './store';
import { Btn, Chip, Field, Panel, SCENARIO_LABEL, Status, scenarioTone } from './kit';

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'pos' | 'neg' | 'warn' | 'mute' }) {
  const color = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`num text-xl ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  const { loadDemo, setTab } = useStore();
  return (
    <Panel title="Comece carregando candles">
      <div className="max-w-2xl space-y-3 text-[13px] text-muted">
        <p>
          O M5 Smart Analyzer analisa candles M5 que <strong className="text-ink">você importa em CSV</strong> (timestamp, open, high, low, close e,
          opcionalmente, volume). Ele não está conectado à Quotex nem a nenhuma corretora, e nada aqui equivale a um preço da Quotex sem que você mesmo confira a fonte.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => setTab('configuracoes')}>Importar CSV</Btn>
          <Btn onClick={() => loadDemo('lateral')}>Demonstração: mercado lateral (fictício)</Btn>
          <Btn onClick={() => loadDemo('tendencia')}>Demonstração: tendência contínua (fictício)</Btn>
        </div>
        <p className="text-xs text-faint">
          As demonstrações são geradas por computador e nunca se misturam aos dados reais nem entram nas comparações do histórico.
        </p>
      </div>
    </Panel>
  );
}

export function Dashboard() {
  const { data, analysis, config, displayTimezone, history, setTab, registerAnalysis, intrabarSeconds, setIntrabarSeconds } = useStore();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  if (!data || !analysis) return <EmptyState />;
  const tone = scenarioTone(analysis.state);
  const s = data.source;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title="Estado atual da análise"
        action={<span className="num text-xs text-faint">candle de corte: {formatDateTime(analysis.cutoffT!, displayTimezone)}</span>}
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={`text-3xl font-semibold tracking-tight ${tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'warn' ? 'text-warn' : 'text-muted'}`}>
            {SCENARIO_LABEL[analysis.state]}
          </span>
          {analysis.state === 'FAVORAVEL' && <Chip title="Cenário favorável não é gatilho de entrada">não é entrada confirmada</Chip>}
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink">{analysis.summary}</p>

        {analysis.blockingReasons.length > 0 && (
          <div className="mt-4 rounded-md border border-neg/40 bg-neg/10 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-neg">Filtros de não entrada detectados</div>
            <ul className="list-disc space-y-1 pl-4 text-[13px]">{analysis.blockingReasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {analysis.invalidReasons.length > 0 && (
          <div className="mt-4 rounded-md border border-line bg-raised p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Por que não foi possível avaliar</div>
            <ul className="list-disc space-y-1 pl-4 text-[13px]">{analysis.invalidReasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {analysis.incompleteReasons.length > 0 && analysis.state !== 'DESFAVORAVEL' && (
          <div className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-warn">Critérios pendentes ou não atendidos</div>
            <ul className="list-disc space-y-1 pl-4 text-[13px]">
              {analysis.incompleteReasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {analysis.incompleteReasons.some((r) => r.includes('parâmetro não definido')) && (
              <button onClick={() => setTab('configuracoes')} className="mt-2 text-xs text-info underline">Definir parâmetros em Configurações</button>
            )}
          </div>
        )}
        {analysis.caveats.length > 0 && (
          <div className="mt-4 rounded-md border border-line bg-raised p-3 text-xs text-muted">
            <div className="mb-1 font-semibold uppercase tracking-wider">Não verificado com esta fonte de dados</div>
            <ul className="list-disc space-y-1 pl-4">{analysis.caveats.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Timeframe" value={config.timeframe} />
          <Metric label="Candles analisados" value={analysis.window ? `${analysis.window.count}/${data.candles.length}` : data.candles.length} />
          <Metric label="Favoráveis" value={analysis.counts.favoravel} tone="pos" />
          <Metric label="Desfavoráveis" value={analysis.counts.desfavoravel} tone="neg" />
          <Metric label="Pendentes" value={analysis.counts.pendente} tone="warn" />
          <Metric label="Não avaliáveis" value={analysis.counts.nao_avaliavel} tone="mute" />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Gatilho de entrada
            <Status tone={analysis.trigger.confirmed ? 'pos' : 'warn'}>
              {analysis.trigger.status === 'nao_definido' ? 'não definido' : analysis.trigger.confirmed ? 'confirmado' : 'não confirmado'}
            </Status>
          </div>
          <p className="mt-1 text-[13px] text-muted">{analysis.trigger.message}</p>
          {analysis.trigger.criteria.length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {analysis.trigger.criteria.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <Status tone={c.status === 'atendido' ? 'pos' : c.status === 'nao_atendido' ? 'neg' : 'mute'}>
                    {c.status === 'atendido' ? 'atendido' : c.status === 'nao_atendido' ? 'não atendido' : 'não avaliável'}
                  </Status>
                  <span><span className="text-ink">{c.name}</span> <span className="text-faint">— {c.explanation}</span></span>
                </li>
              ))}
            </ul>
          )}
          {data.live ? (
            <p className="mt-3 text-xs text-muted">Tempo restante e candle em formação vêm do feed ao vivo (aba "Ao vivo"): {Math.floor(data.live.intrabar.remainingSeconds / 60)}:{String(Math.floor(data.live.intrabar.remainingSeconds % 60)).padStart(2, '0')} restantes.</p>
          ) : (
            <div className="mt-3 max-w-xs">
              <Field label="Tempo restante no candle atual, em segundos (entrada manual)" hint="Como o cronômetro da corretora mostra (150 = 2:30). O CSV só traz candles fechados; opcional, alimenta só o critério do tempo. Para o gatilho completo, conecte o feed na aba Ao vivo.">
                <input
                  type="number" min={0} max={300} inputMode="numeric" className="num"
                  value={intrabarSeconds ?? ''} placeholder="ex.: 170"
                  onChange={(e) => setIntrabarSeconds(e.target.value === '' ? null : Math.max(0, Math.min(300, Number(e.target.value))))}
                />
              </Field>
            </div>
          )}
        </div>

        <form
          className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (registerAnalysis(note)) { setSaved(true); setNote(''); setTimeout(() => setSaved(false), 2500); }
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Field label="Observação do registro (opcional)">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="ex.: observado às 07:35, gráfico OTC" />
            </Field>
          </div>
          <Btn type="submit" variant="primary">Registrar análise no histórico</Btn>
          {saved && <span role="status" className="text-xs text-pos">Registrado.</span>}
        </form>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="Fonte de dados">
          <dl className="space-y-1.5 text-[13px]">
            <Row k="Tipo" v={s.synthetic ? 'Dados FICTÍCIOS' : s.kind === 'binance_live' ? 'Ao vivo — Binance (cripto)' : s.kind === 'mt5_arquivo' ? 'Ao vivo — MT5 (forex)' : 'CSV importado'} warn={s.synthetic} />
            <Row k="Nome" v={s.name} />
            <Row k="Origem informada" v={s.origin} />
            <Row k="Ativo" v={s.asset || 'não informado'} />
            <Row k="OTC (declarado)" v={s.otc ? 'sim' : 'não'} />
            <Row k="Fuso dos dados" v={s.timezone} />
            <Row k="Candles" v={String(s.rows)} num />
            <Row k="Primeiro" v={formatDateTime(s.firstT, displayTimezone)} num />
            <Row k="Último" v={formatDateTime(s.lastT, displayTimezone)} num />
            <Row k="Carregado em" v={formatDateTime(s.importedAt / 1000, displayTimezone)} num />
          </dl>
          {data.importInfo && data.importInfo.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-warn">
              {data.importInfo.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-snug text-faint">
            {s.kind === 'binance_live' ? 'Preços da Binance (cripto), não da Quotex. Não há garantia de que coincidam com os da sua corretora.' : s.kind === 'mt5_arquivo' ? 'Preços da corretora do seu MT5, não da Quotex. Não há garantia de que coincidam com os da Quotex.' : 'Sem conexão com a Quotex. Não há garantia de que estes preços coincidam com os da corretora.'}
          </p>
        </Panel>

        <Panel title="Últimos sinais registrados" action={<button className="text-xs text-info underline" onClick={() => setTab('historico')}>ver todos</button>}>
          {history.length === 0 ? (
            <p className="text-[13px] text-muted">Nenhuma análise registrada ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {history.slice(0, 5).map((r) => (
                <li key={r.id} className="text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <Status tone={scenarioTone(r.state)}>{SCENARIO_LABEL[r.state]}</Status>
                    <span className="num text-[11px] text-faint">{formatDateTime(r.analyzedAt / 1000, displayTimezone)}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {r.asset || 'sem ativo'} · {r.timeframe}{r.source.synthetic ? ' · fictício' : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v, num, warn }: { k: string; v: string; num?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={`min-w-0 break-words text-right ${num ? 'num' : ''} ${warn ? 'text-warn' : ''}`}>{v}</dd>
    </div>
  );
}
