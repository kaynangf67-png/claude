import { Fragment, useMemo, useState } from 'react';
import {
  compareByState, filterRecords, laterCandlesAvailable, recordsToCsv, type AnalysisRecord, type HistoryFilter, type OutcomeValue,
} from '../core/history';
import { formatDateTime } from '../core/time';
import type { ScenarioState } from '../core/types';
import { downloadText } from './download';
import { Btn, Chip, Field, Panel, SCENARIO_LABEL, Status, scenarioTone } from './kit';
import { ReplayPanel } from './ReplayPanel';
import { useStore } from './store';

const OUTCOME_LABEL: Record<OutcomeValue | '', string> = {
  '': 'Sem resultado registrado',
  retracao_observada: 'Retração observada',
  retracao_nao_observada: 'Retração não observada',
  inconclusivo: 'Inconclusivo',
};

const dayStart = (s: string) => (s ? new Date(`${s}T00:00:00`).getTime() / 1000 : undefined);
const dayEnd = (s: string) => (s ? new Date(`${s}T23:59:59`).getTime() / 1000 : undefined);

export function HistoryPage() {
  const { history, displayTimezone, data, updateOutcome, deleteRecords } = useStore();
  const [f, setF] = useState<{ asset: string; timeframe: string; state: ScenarioState | ''; configHash: string; origin: 'todas' | 'reais' | 'sinteticas'; from: string; to: string }>({
    asset: '', timeframe: '', state: '', configHash: '', origin: 'todas', from: '', to: '',
  });
  const [open, setOpen] = useState<string | null>(null);

  const filter: HistoryFilter = { asset: f.asset, timeframe: f.timeframe, state: f.state, configHash: f.configHash, origin: f.origin, fromDate: dayStart(f.from), toDate: dayEnd(f.to) };
  const rows = useMemo(() => filterRecords(history, filter), [history, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const hashes = useMemo(() => [...new Set(history.map((r) => r.configHash))], [history]);
  const comparison = useMemo(() => compareByState(rows), [rows]);
  const realCount = rows.filter((r) => !r.source.synthetic).length;
  const loaded = data ? { datasetId: data.source.datasetId, candleTimes: data.candles.map((c) => c.t) } : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Panel
        title={`Histórico de análises (${rows.length}${rows.length !== history.length ? ` de ${history.length}` : ''})`}
        action={
          <Btn onClick={() => downloadText(`m5-analises-${new Date().toISOString().slice(0, 10)}.csv`, recordsToCsv(rows))} disabled={rows.length === 0}>
            Exportar CSV
          </Btn>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Ativo"><input value={f.asset} onChange={(e) => setF({ ...f, asset: e.target.value })} placeholder="contém…" /></Field>
          <Field label="Timeframe">
            <select value={f.timeframe} onChange={(e) => setF({ ...f, timeframe: e.target.value })}>
              <option value="">Todos</option><option value="M5">M5</option>
            </select>
          </Field>
          <Field label="Classificação">
            <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as ScenarioState | '' })}>
              <option value="">Todas</option>
              {(['FAVORAVEL', 'DESFAVORAVEL', 'AGUARDAR', 'NAO_AVALIAVEL'] as const).map((s) => <option key={s} value={s}>{SCENARIO_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Configuração">
            <select value={f.configHash} onChange={(e) => setF({ ...f, configHash: e.target.value })}>
              <option value="">Todas</option>
              {hashes.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Origem">
            <select value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value as typeof f.origin })}>
              <option value="todas">Todas</option><option value="reais">Só CSV (não fictícios)</option><option value="sinteticas">Só fictícios</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="De"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="Até"><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-[13px] text-muted">{history.length === 0 ? 'Nenhuma análise registrada. Use "Registrar análise no histórico" no Dashboard.' : 'Nenhum registro corresponde aos filtros.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                  <th className="py-2 pr-3 font-medium">Registrado</th><th className="pr-3 font-medium">Ativo</th><th className="pr-3 font-medium">TF</th>
                  <th className="pr-3 font-medium">Classificação</th><th className="pr-3 font-medium">Critérios</th><th className="pr-3 font-medium">Resultado posterior</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-line/60 align-top">
                      <td className="num py-2 pr-3 text-xs">{formatDateTime(r.analyzedAt / 1000, displayTimezone)}</td>
                      <td className="pr-3">{r.asset || <span className="text-faint">—</span>}{r.source.synthetic && <> <Chip>fictício</Chip></>}</td>
                      <td className="pr-3">{r.timeframe}</td>
                      <td className="pr-3"><Status tone={scenarioTone(r.state)}>{SCENARIO_LABEL[r.state]}</Status></td>
                      <td className="num pr-3 text-xs text-muted">
                        <span className="text-pos">{r.favorableFilters.length}</span> / <span className="text-neg">{r.unfavorableFilters.length}</span> / <span className="text-warn">{r.pendingFilters.length}</span>
                      </td>
                      <td className="pr-3 text-xs">
                        {r.outcome ? OUTCOME_LABEL[r.outcome.value] : laterCandlesAvailable(r, loaded) === 0 ? <span className="text-faint">sem dados posteriores</span> : <span className="text-muted">{laterCandlesAvailable(r, loaded)} candle(s) posteriores carregados</span>}
                      </td>
                      <td className="text-right"><Btn variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Fechar' : 'Detalhes'}</Btn></td>
                    </tr>
                    {open === r.id && (
                      <tr className="border-b border-line/60 bg-bg/40"><td colSpan={7} className="p-3"><Details r={r} onOutcome={(o) => updateOutcome(r.id, o)} onDelete={() => { deleteRecords([r.id]); setOpen(null); }} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Comparação por classificação (contagens, não taxas de acerto)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                <th className="py-2 font-medium">Classificação</th><th className="font-medium">Registros</th><th className="font-medium">Retração observada</th>
                <th className="font-medium">Não observada</th><th className="font-medium">Inconclusivo</th><th className="font-medium">Sem resultado</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((c) => (
                <tr key={c.state} className="border-b border-line/60">
                  <td className="py-2"><Status tone={scenarioTone(c.state)}>{SCENARIO_LABEL[c.state]}</Status></td>
                  <td className="num">{c.total}</td><td className="num">{c.retracaoObservada}</td><td className="num">{c.retracaoNaoObservada}</td>
                  <td className="num">{c.inconclusivo}</td><td className="num">{c.semResultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-faint">
          Considera apenas os {realCount} registro(s) não fictícios dos filtros acima. Resultados são marcados manualmente por você; não há gatilho nem expiração
          definidos para medir acerto, e amostras pequenas não permitem conclusões. Estas contagens não são taxa de acerto nem prova de desempenho.
          Registros fictícios nunca entram aqui.
        </p>
      </Panel>

      <ReplayPanel />
    </div>
  );
}

function Details({ r, onOutcome, onDelete }: { r: AnalysisRecord; onOutcome: (o: AnalysisRecord['outcome']) => void; onDelete: () => void }) {
  const { displayTimezone } = useStore();
  const [value, setValue] = useState<OutcomeValue | ''>(r.outcome?.value ?? '');
  const [note, setNote] = useState(r.outcome?.note ?? '');
  return (
    <div className="grid gap-4 text-xs lg:grid-cols-2">
      <div className="space-y-2">
        <p className="text-[13px] leading-relaxed">{r.summary}</p>
        {r.noEntryReasons.length > 0 && <List title="Motivo de não entrada" tone="text-neg" items={r.noEntryReasons} />}
        <List title="Filtros favoráveis" tone="text-pos" items={r.favorableFilters} />
        <List title="Filtros desfavoráveis" tone="text-neg" items={r.unfavorableFilters} />
        <List title="Pendentes" tone="text-warn" items={r.pendingFilters} />
        <p className="text-muted">Gatilho: {r.trigger.message}</p>
      </div>
      <div className="space-y-2 text-muted">
        <div className="num">Último candle: {formatDateTime(r.cutoffT, displayTimezone)}</div>
        {r.window && <div className="num">Janela: {r.window.count} candles ({formatDateTime(r.window.fromT, displayTimezone)} → {formatDateTime(r.window.toT, displayTimezone)})</div>}
        <div>Fonte: {r.source.kind === 'csv' ? 'CSV' : 'demonstração'} — {r.source.name} · {r.source.origin} · OTC declarado: {r.source.otc ? 'sim' : 'não'}</div>
        <div>Regras: <span className="num">{r.rulesVersion}</span> · Configuração: <span className="num">{r.configHash}</span> (cópia guardada no registro)</div>
        {r.note && <div>Observação: {r.note}</div>}
        <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          <Field label="Resultado posterior (manual)">
            <select value={value} onChange={(e) => setValue(e.target.value as OutcomeValue | '')}>
              {(Object.keys(OUTCOME_LABEL) as Array<OutcomeValue | ''>).map((k) => <option key={k} value={k}>{OUTCOME_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label="Anotação do resultado"><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={() => onOutcome(value === '' ? null : { value, note, recordedAt: Date.now() })}>Salvar resultado</Btn>
          <Btn variant="danger" onClick={() => { if (window.confirm('Excluir este registro do histórico?')) onDelete(); }}>Excluir registro</Btn>
        </div>
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`font-semibold uppercase tracking-wider ${tone}`}>{title}</div>
      <ul className="list-disc pl-4 text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}
