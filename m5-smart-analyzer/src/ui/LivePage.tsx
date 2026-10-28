import { useState } from 'react';
import { fmtNum, fmtPrice } from '../core/format';
import { journalCsv, journalStats } from '../core/journal';
import type { Tally, Verdict } from '../core/stats';
import { formatDateTime } from '../core/time';
import { downloadText } from './download';
import { Btn, Chip, Field, Panel, SCENARIO_LABEL, STATUS_LABEL, Status, scenarioTone, statusTone } from './kit';
import { useLive } from './live';
import { useStore } from './store';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
const ORDER = { FAVORAVEL: 0, AGUARDAR: 1, DESFAVORAVEL: 2, NAO_AVALIAVEL: 3 } as const;

const VERDICT_TEXT: Record<Verdict, { tone: 'pos' | 'neg' | 'warn' | 'mute'; text: string }> = {
  sem_casos: { tone: 'mute', text: 'sem casos' },
  acima: { tone: 'pos', text: 'acima do equilíbrio' },
  abaixo: { tone: 'neg', text: 'abaixo do equilíbrio' },
  inconclusivo: { tone: 'warn', text: 'inconclusivo' },
};

/** Taxa de acerto com intervalo e veredito. Verde só se o intervalo INTEIRO passa do equilíbrio. */
export function StatCell({ t, v }: { t: Tally; v: Verdict }) {
  if (!t.n) return <span className="text-muted">sem casos</span>;
  const x = VERDICT_TEXT[v];
  return (
    <div>
      <span className={`num text-xl ${x.tone === 'pos' ? 'text-pos' : x.tone === 'neg' ? 'text-neg' : x.tone === 'warn' ? 'text-warn' : 'text-muted'}`}>{pct(t.rate)}</span>{' '}
      <span className="text-xs text-muted">{x.text}</span>
      <div className="num text-[11px] text-faint">{t.wins} de {t.n} · intervalo {pct(t.lo, 0)} a {pct(t.hi, 0)}{t.ties ? ` · ${t.ties} empate(s)` : ''}</div>
    </div>
  );
}

export const VERDICT_NOTE =
  'Verde só aparece quando o intervalo inteiro fica acima do ponto de equilíbrio; amarelo quer dizer que a amostra não permite concluir. ' +
  'Com poucos casos o resultado quase sempre fica amarelo, e isso é o esperado.';

export function LivePage() {
  const live = useLive();
  const { config, analysis, data, displayTimezone, setTab } = useStore();
  const [text, setText] = useState(live.symbols.join(', '));
  const payout = config.params.payoutPercent.value ?? 80;
  const stats = journalStats(live.journal, payout);
  const minRem = config.params.triggerMinRemainingSeconds.value ?? 150;
  const liveData = data?.live;
  const rem = liveData?.intrabar.remainingSeconds ?? 0;
  const rows = [...live.rows].sort((a, b) => (ORDER[a.analysis?.state ?? 'NAO_AVALIAVEL'] - ORDER[b.analysis?.state ?? 'NAO_AVALIAVEL']));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Panel
        title="Feed ao vivo"
        action={<span className="flex items-center gap-2 text-xs"><Status tone={live.on ? (live.online ? 'pos' : 'warn') : 'mute'}>{live.on ? (live.online ? 'conectado à Binance' : 'conectando…') : 'desconectado'}</Status></span>}
      >
        <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-muted">
          Consulta a API <strong className="text-ink">pública da Binance (cripto)</strong> a cada 5 segundos, sem chave nem login. Isso <strong className="text-ink">não são os preços da Quotex</strong>:
          serve para ver o gatilho com o candle em formação. Compare com o seu gráfico antes de confiar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {live.on ? <Btn variant="danger" onClick={live.disconnect}>Desconectar</Btn> : <Btn variant="primary" onClick={live.connect}>Conectar</Btn>}
          <div className="min-w-[16rem] flex-1">
            <Field label="Pares monitorados (máx. 12)" hint="Símbolos da Binance separados por vírgula, ex.: BTCUSDT, ETHUSDT.">
              <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => live.setSymbols(text.split(/[\s,;]+/))} />
            </Field>
          </div>
        </div>
      </Panel>

      {live.on && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <Panel title="Pares">
            {rows.length === 0 ? <p className="text-[13px] text-muted">Carregando…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                      <th className="py-2 font-medium">Par</th><th className="font-medium">Cenário</th><th className="font-medium">Zona agora</th><th className="font-medium">Gatilho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const a = r.analysis;
                      const ok = a ? a.trigger.criteria.filter((c) => c.status === 'atendido').length : 0;
                      return (
                        <tr key={r.symbol} onClick={() => live.select(r.symbol)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') live.select(r.symbol); }}
                          className={`cursor-pointer border-b border-line/60 hover:bg-raised ${r.symbol === live.selected ? 'bg-raised' : ''}`}>
                          <td className="py-2"><b>{r.symbol.replace('USDT', '')}</b> <span className="num text-xs text-muted">{r.price === null ? '' : fmtPrice(r.price)}</span></td>
                          <td>{a ? <Status tone={scenarioTone(a.state)}>{SCENARIO_LABEL[a.state]}</Status> : <span className="text-xs text-faint">{r.error ?? 'carregando'}</span>}</td>
                          <td className="text-xs text-muted">{a?.entry ? `${a.entry.side === 'resistencia' ? 'resistência' : 'suporte'} · ${a.entry.priorValidTouches} toques${a.entry.armed ? '' : ' (não armada)'}` : '—'}</td>
                          <td className="num text-xs">{a ? `${ok}/${a.trigger.criteria.length}` : ''}{a?.trigger.confirmed ? <span className="ml-1 text-pos">confirmado</span> : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={`${live.selected.replace('USDT', '')} · cronômetro do candle M5`}>
            {liveData && analysis ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="num text-4xl font-semibold">{clock(rem)}</span>
                  <span className={rem >= minRem ? 'text-pos' : 'text-neg'}>{rem >= minRem ? 'janela de entrada aberta' : `abaixo de ${clock(minRem)}: não entrar neste candle`}</span>
                </div>
                <div className="relative h-3 rounded border border-line bg-raised" role="img" aria-label="Tempo restante do candle">
                  <div className="absolute inset-y-0 left-0 rounded-l bg-pos/25" style={{ width: `${((300 - minRem) / 300) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-l bg-ink/30" style={{ width: `${((300 - rem) / 300) * 100}%` }} />
                  <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${((300 - minRem) / 300) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2"><Status tone={scenarioTone(analysis.state)}>{SCENARIO_LABEL[analysis.state]}</Status><span className="text-xs text-muted">{analysis.trigger.message}</span></div>
                <ul className="space-y-1.5 text-[13px]">
                  {analysis.trigger.criteria.map((c) => (
                    <li key={c.id} className="flex gap-2"><Status tone={c.status === 'atendido' ? 'pos' : c.status === 'nao_atendido' ? 'neg' : 'mute'}>{c.status === 'atendido' ? 'ok' : c.status === 'nao_atendido' ? 'não' : 'n/a'}</Status><span><span className="font-medium">{c.name}</span> <span className="text-faint">— {c.explanation}</span></span></li>
                  ))}
                  {analysis.filters.filter((f) => f.role === 'nao_entrada').map((f) => (
                    <li key={f.id} className="flex gap-2"><Status tone={statusTone(f.status)}>{f.status === 'favoravel' ? 'ok' : f.status === 'desfavoravel' ? 'bloqueia' : STATUS_LABEL[f.status].toLowerCase()}</Status><span><span className="font-medium">{f.name}</span> <span className="text-faint">— {f.explanation}</span></span></li>
                  ))}
                </ul>
                <p className="text-xs text-faint">Este par também está nas telas Dashboard, Gráfico e Filtros. <button className="text-info underline" onClick={() => setTab('grafico')}>Abrir gráfico</button></p>
              </div>
            ) : <p className="text-[13px] text-muted">Aguardando dados do par…</p>}
          </Panel>
        </div>
      )}

      <Panel
        title="Diário ao vivo"
        action={<div className="flex gap-2"><Btn disabled={!live.journal.length} onClick={() => downloadText('diario-m5.csv', journalCsv(live.journal))}>Baixar CSV</Btn><Btn variant="danger" disabled={!live.journal.length} onClick={() => { if (window.confirm('Apagar todo o diário ao vivo?')) live.clearJournal(); }}>Apagar</Btn></div>}
      >
        <div className="mb-3 grid gap-3 sm:grid-cols-4">
          <div><div className="text-[11px] uppercase tracking-wider text-faint">Todo toque em zona armada</div><StatCell t={stats.todos} v={stats.verdicts.todos} /></div>
          <div><div className="text-[11px] uppercase tracking-wider text-faint">Cenário favorável</div><StatCell t={stats.favoravel} v={stats.verdicts.favoravel} /></div>
          <div><div className="text-[11px] uppercase tracking-wider text-faint">Gatilho confirmado</div><StatCell t={stats.gatilho} v={stats.verdicts.gatilho} /></div>
          <div><div className="text-[11px] uppercase tracking-wider text-faint">Ponto de equilíbrio</div><span className="num text-xl">{pct(stats.breakeven)}</span><div className="text-[11px] text-faint">payout de {payout}% (mude em Configurações)</div></div>
        </div>
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-faint">
          {live.journal.length} toque(s) registrado(s), {stats.pending} aguardando o fechamento. Registra sozinho enquanto esta página estiver aberta e visível (o navegador pausa abas em segundo plano).
          O resultado é o fechamento do mesmo candle M5 contra o preço de entrada na borda da zona. {VERDICT_NOTE}
        </p>
        {live.journal.length === 0 ? <p className="text-[13px] text-muted">Nenhum toque registrado. Conecte o feed e deixe a página aberta.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-[13px]">
              <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint"><th className="py-2 font-medium">Candle</th><th className="font-medium">Par</th><th className="font-medium">Lado</th><th className="font-medium">Restante</th><th className="font-medium">Cenário</th><th className="font-medium">Resultado</th></tr></thead>
              <tbody>
                {[...live.journal].slice(-60).reverse().map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="num py-2 text-xs">{formatDateTime(e.t5, displayTimezone)}</td><td>{e.symbol.replace('USDT', '')}</td>
                    <td>{e.side === 'resistencia' ? 'venda' : 'compra'}</td><td className="num">{clock(e.remainingSeconds)}</td>
                    <td><Status tone={scenarioTone(e.state)}>{SCENARIO_LABEL[e.state]}</Status>{e.triggerConfirmed && <> <Chip>gatilho</Chip></>}</td>
                    <td className={e.result === 'ganhou' ? 'text-pos' : e.result === 'perdeu' ? 'text-neg' : 'text-muted'}>{e.result ?? 'pendente'}{e.close !== null && <span className="num text-[11px] text-faint"> ({fmtNum(e.entry, 4)} → {fmtNum(e.close, 4)})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
