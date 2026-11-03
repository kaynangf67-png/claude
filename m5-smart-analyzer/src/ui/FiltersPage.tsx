import { useState } from 'react';
import { PARAM_SPECS } from '../core/config';
import { RULES } from '../core/rules';
import { formatDateTime } from '../core/time';
import type { FilterResult, FilterRole } from '../core/types';
import { Btn, Chip, Panel, REASON_LABEL, ROLE_LABEL, STATUS_LABEL, Status, statusTone } from './kit';
import { useStore } from './store';

const ORDER: FilterRole[] = ['nao_entrada', 'contexto_positivo', 'informativo'];
const GROUP_TITLE: Record<FilterRole, string> = {
  nao_entrada: 'Filtros de não entrada — se detectados, o cenário é desfavorável',
  contexto_positivo: 'Contexto favorável — evidências que sustentam um cenário de retração',
  informativo: 'Informativos — registram dados, sem peso na classificação',
};

function FilterCard({ f }: { f: FilterResult }) {
  const { setTab, setFocus, data, displayTimezone } = useStore();
  const [open, setOpen] = useState(false);
  const idx = f.supportingIndexes;
  return (
    <li className="rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-medium">{f.name}</h3>
            <Chip title={f.lesson}>{ROLE_LABEL[f.role]}</Chip>
            <Chip>{f.lesson}</Chip>
          </div>
          <p className="mt-1 text-[13px] text-muted">{f.explanation}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Status tone={f.role === 'informativo' ? 'mute' : statusTone(f.status)}>
            {f.role === 'informativo' ? 'Informativo' : STATUS_LABEL[f.status]}
          </Status>
          <span className="text-[11px] text-faint">{REASON_LABEL[f.reason]}</span>
        </div>
      </div>
      {f.evidence.length > 0 && (
        <dl className="grid gap-x-6 gap-y-0.5 border-t border-line px-4 py-2 text-xs sm:grid-cols-2">
          {f.evidence.slice(0, open ? undefined : 4).map((e) => (
            <div key={e.label} className="flex justify-between gap-3">
              <dt className="text-muted">{e.label}</dt>
              <dd className="num text-right">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
        <Btn variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? 'Ocultar detalhes técnicos' : 'Detalhes técnicos'}</Btn>
        {idx.length > 0 && data && (
          <Btn variant="ghost" onClick={() => { setFocus({ label: f.name, indexes: idx }); setTab('grafico'); }}>
            Ver {idx.length} candle(s) no gráfico
          </Btn>
        )}
        {f.missingParams.length > 0 && <Btn variant="ghost" onClick={() => setTab('configuracoes')}>Definir parâmetros</Btn>}
      </div>
      {open && (
        <div className="space-y-3 border-t border-line bg-bg/40 px-4 py-3 text-xs">
          <div>
            <div className="mb-0.5 font-semibold uppercase tracking-wider text-faint">Regra utilizada</div>
            <p className="leading-relaxed text-muted">{f.rule}</p>
          </div>
          {f.missingParams.length > 0 && (
            <div>
              <div className="mb-0.5 font-semibold uppercase tracking-wider text-warn">Parâmetros não definidos</div>
              <ul className="list-disc pl-4 text-muted">
                {f.missingParams.map((k) => <li key={k}>{PARAM_SPECS[k].label}</li>)}
              </ul>
            </div>
          )}
          {idx.length > 0 && data && (
            <div>
              <div className="mb-0.5 font-semibold uppercase tracking-wider text-faint">Candles que sustentam ({idx.length})</div>
              <p className="num leading-relaxed text-muted">
                {idx.slice(0, 24).map((i) => formatDateTime(data.candles[i]!.t, displayTimezone).slice(-5)).join(' · ')}
                {idx.length > 24 ? ` … (+${idx.length - 24})` : ''}
              </p>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-muted">Dados brutos</summary>
            <pre className="num mt-2 max-h-72 overflow-auto rounded bg-bg p-2 text-[11px] text-muted">
              {JSON.stringify(f.technical, null, 1).slice(0, 8000)}
            </pre>
          </details>
        </div>
      )}
    </li>
  );
}

export function FiltersPage() {
  const { analysis, config, setTab } = useStore();
  if (!analysis) return <Panel title="Filtros"><p className="text-[13px] text-muted">Carregue candles para avaliar os filtros.</p></Panel>;
  const disabled = RULES.filter((r) => !config.enabled[r.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {analysis.state === 'NAO_AVALIAVEL' && (
        <Panel title="Dados insuficientes ou inválidos">
          <ul className="list-disc space-y-1 pl-4 text-[13px]">{analysis.invalidReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </Panel>
      )}
      {ORDER.map((role) => {
        const list = analysis.filters.filter((f) => f.role === role);
        if (list.length === 0) return null;
        return (
          <section key={role}>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{GROUP_TITLE[role]}</h2>
            <ul className="space-y-2">{list.map((f) => <FilterCard key={f.id} f={f} />)}</ul>
          </section>
        );
      })}

      {analysis.trigger.criteria.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Gatilho de entrada — aula 2 (anotações)</h2>
          <Panel>
            <p className="mb-2 text-[13px]">{analysis.trigger.message}</p>
            <ul className="space-y-2 text-[13px]">
              {analysis.trigger.criteria.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start gap-2">
                  <Status tone={c.status === 'atendido' ? 'pos' : c.status === 'nao_atendido' ? 'neg' : 'mute'}>
                    {c.status === 'atendido' ? 'atendido' : c.status === 'nao_atendido' ? 'não atendido' : 'não avaliável'}
                  </Status>
                  <span className="min-w-0 flex-1"><span className="font-medium">{c.name}</span> <span className="text-muted">— {c.explanation}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}

      {disabled.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Desabilitados</h2>
          <ul className="space-y-1 text-[13px] text-muted">
            {disabled.map((r) => <li key={r.id}>{r.name} <Chip>{r.lesson}</Chip></li>)}
          </ul>
          <button className="mt-1 text-xs text-info underline" onClick={() => setTab('configuracoes')}>Habilitar em Configurações</button>
        </section>
      )}
    </div>
  );
}
