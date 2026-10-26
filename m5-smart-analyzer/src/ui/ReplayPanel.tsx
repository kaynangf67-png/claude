import { useState } from 'react';
import { configHash } from '../core/config';
import { replay } from '../core/replay';
import { formatDateTime } from '../core/time';
import type { ScenarioState } from '../core/types';
import { Btn, Field, Panel, SCENARIO_LABEL, Status, scenarioTone } from './kit';
import { useStore } from './store';

interface Summary {
  states: ScenarioState[];
  times: number[];
  counts: Record<ScenarioState, number>;
  blockers: Array<[string, number]>;
  hash: string;
  ms: number;
}

const STRIP_COLOR: Record<ScenarioState, string> = {
  FAVORAVEL: 'bg-pos', DESFAVORAVEL: 'bg-neg', AGUARDAR: 'bg-warn', NAO_AVALIAVEL: 'bg-faint',
};

/**
 * Reprodução histórica: para cada candle, a análise só vê os candles até ele.
 * Mostra a distribuição de estados — NÃO mede acerto.
 */
export function ReplayPanel() {
  const { data, config, displayTimezone } = useStore();
  const [span, setSpan] = useState(300);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Summary | null>(null);

  if (!data) {
    return <Panel title="Reprodução histórica (sem look-ahead)"><p className="text-[13px] text-muted">Carregue candles para reproduzir a análise ao longo do histórico.</p></Panel>;
  }

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const t0 = performance.now();
      const n = data.candles.length;
      const from = Math.max(config.params.minCandles.value! - 1, n - span);
      const pts = replay(data.candles, config, data.source, { from });
      const counts: Record<ScenarioState, number> = { FAVORAVEL: 0, DESFAVORAVEL: 0, AGUARDAR: 0, NAO_AVALIAVEL: 0 };
      const block = new Map<string, number>();
      for (const p of pts) {
        counts[p.state]++;
        for (const f of p.result.filters) {
          if (f.role === 'nao_entrada' && f.status === 'desfavoravel') block.set(f.name, (block.get(f.name) ?? 0) + 1);
        }
      }
      setOut({
        states: pts.map((p) => p.state), times: pts.map((p) => p.t), counts,
        blockers: [...block.entries()].sort((a, b) => b[1] - a[1]), hash: configHash(config), ms: Math.round(performance.now() - t0),
      });
      setBusy(false);
    }, 20);
  };

  const total = out ? out.states.length : 0;
  return (
    <Panel title="Reprodução histórica (sem look-ahead)">
      <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        Refaz a análise candle a candle, com a configuração atual, usando em cada ponto <strong className="text-ink">somente os candles já fechados até ali</strong>.
        Mostra como os estados se distribuem no histórico carregado. <strong className="text-ink">Não mede acerto</strong>: não há gatilho
        completo nem expiração definidos, e os parâmetros não foram otimizados.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Trecho">
          <select value={span} onChange={(e) => { setSpan(Number(e.target.value)); setOut(null); }}>
            <option value={150}>últimos 150 candles</option>
            <option value={300}>últimos 300 candles</option>
            <option value={1000}>últimos 1000 candles</option>
            <option value={3000}>últimos 3000 candles</option>
          </select>
        </Field>
        <Btn variant="primary" onClick={run} disabled={busy}>{busy ? 'Calculando…' : 'Reproduzir'}</Btn>
      </div>

      {out && total > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['FAVORAVEL', 'DESFAVORAVEL', 'AGUARDAR', 'NAO_AVALIAVEL'] as const).map((s) => (
              <div key={s}>
                <Status tone={scenarioTone(s)}>{SCENARIO_LABEL[s]}</Status>
                <div className="num text-lg">{out.counts[s]} <span className="text-xs text-faint">({Math.round((out.counts[s] / total) * 100)}%)</span></div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-faint">Linha do tempo ({total} candles)</div>
            <div className="flex h-4 overflow-hidden rounded border border-line" role="img" aria-label="Estado da análise ao longo do tempo">
              {out.states.map((s, i) => (
                <span key={i} title={`${formatDateTime(out.times[i]!, displayTimezone)} — ${SCENARIO_LABEL[s]}`} className={`h-full flex-1 ${STRIP_COLOR[s]}`} />
              ))}
            </div>
            <div className="num mt-1 flex justify-between text-[11px] text-faint">
              <span>{formatDateTime(out.times[0]!, displayTimezone)}</span><span>{formatDateTime(out.times[total - 1]!, displayTimezone)}</span>
            </div>
          </div>
          {out.blockers.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-faint">Filtros de não entrada que mais bloquearam</div>
              <ul className="space-y-0.5 text-[13px]">
                {out.blockers.map(([name, n]) => <li key={name} className="flex justify-between gap-3 sm:max-w-md"><span>{name}</span><span className="num text-muted">{n} de {total}</span></li>)}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-faint">Configuração <span className="num">{out.hash}</span> · {config.rulesVersion} · calculado em {out.ms} ms{data.source.synthetic ? ' · DADOS FICTÍCIOS: apenas demonstração' : ''}</p>
        </div>
      )}
      {out && total === 0 && <p className="mt-3 text-[13px] text-warn">Candles insuficientes para este trecho (mínimo configurado: {config.params.minCandles.value}).</p>}
    </Panel>
  );
}
