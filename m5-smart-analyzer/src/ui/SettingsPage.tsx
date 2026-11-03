import { useMemo, useState } from 'react';
import {
  PARAM_SPECS, applyExploratoryPreset, clearUndefinedParams, setParam, setRuleEnabled, validateParamValue,
} from '../core/config';
import type { ImportResult } from '../core/csv';
import { recordsToCsv } from '../core/history';
import { RULES } from '../core/rules';
import { formatDateTime } from '../core/time';
import { PARAM_KEYS, type ParamKey, type ParamOrigin } from '../core/types';
import { downloadText } from './download';
import { Btn, Chip, Field, Panel } from './kit';
import { useStore } from './store';

const ORIGIN_LABEL: Record<ParamOrigin, string> = {
  aula: 'da aula',
  padrao_tecnico: 'padrão técnico',
  preset_exploratorio: 'exploratório (não é da aula)',
  usuario: 'definido por você',
  nao_definido: 'não definido',
};
const ORIGIN_TONE: Record<ParamOrigin, string> = {
  aula: 'text-pos', padrao_tecnico: 'text-muted', preset_exploratorio: 'text-warn', usuario: 'text-info', nao_definido: 'text-faint',
};

const TZ_PRESETS = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

function allTimezones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (list && list.length) return ['UTC', ...list.filter((z) => z !== 'UTC')];
  } catch { /* usa a lista curta */ }
  return TZ_PRESETS;
}

// ------------------------------------------------------------- parâmetro

function ParamRow({ k }: { k: ParamKey }) {
  const { config, setConfig } = useStore();
  const spec = PARAM_SPECS[k];
  const param = config.params[k];
  const toShown = (v: number | null) => (v === null ? '' : String(spec.percent ? Math.round(v * 1000) / 10 : v));
  const [text, setText] = useState(toShown(param.value));
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') { setError(null); setConfig(setParam(config, k, null)); return; }
    const n = Number(raw.replace(',', '.'));
    const value = spec.percent ? n / 100 : n;
    const err = validateParamValue(k, Math.round(value * 1e6) / 1e6);
    setError(err ? (spec.percent ? `Use um valor entre ${spec.min * 100} e ${spec.max * 100}.` : err) : null);
    if (!err) setConfig(setParam(config, k, Math.round(value * 1e6) / 1e6));
  };

  return (
    <div className="grid items-start gap-x-4 gap-y-1 border-b border-line/60 py-2.5 sm:grid-cols-[1fr_11rem]">
      <div>
        <label htmlFor={`p-${k}`} className="text-[13px]">{spec.label}</label>
        <p className="text-[11px] leading-snug text-faint">{spec.description}</p>
        <span className={`text-[11px] ${ORIGIN_TONE[param.origin]}`}>{ORIGIN_LABEL[param.origin]}</span>
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <input
            id={`p-${k}`} className="num w-full" inputMode="decimal" value={text} placeholder="não definido"
            aria-invalid={error ? true : undefined} aria-describedby={error ? `e-${k}` : undefined}
            onChange={(e) => commit(e.target.value)}
          />
          <span className="w-8 shrink-0 text-[11px] text-faint">{spec.percent ? '%' : spec.unit ?? ''}</span>
        </div>
        {error && <p id={`e-${k}`} role="alert" className="mt-1 text-[11px] text-neg">{error}</p>}
      </div>
    </div>
  );
}

// --------------------------------------------------------- fonte de dados

function DataPanel() {
  const { data, importCsv, loadDemo, clearData, displayTimezone, setDisplayTimezone, setTab } = useStore();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [tz, setTz] = useState('');
  const [asset, setAsset] = useState('');
  const [origin, setOrigin] = useState('');
  const [synthetic, setSynthetic] = useState(false);
  const [otc, setOtc] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const tzList = useMemo(allTimezones, []);

  const onFile = async (file: File | undefined) => {
    setResult(null); setFileError(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setFileError('Arquivo maior que 10 MB. Divida em partes menores.'); setText(null); return; }
    setText(await file.text());
    setFileName(file.name);
    if (/sintetic|demo|fict/i.test(file.name)) setSynthetic(true);
  };

  const doImport = () => {
    if (text === null) return;
    const r = importCsv({ text, fileName, timezone: tz || undefined, asset, origin, synthetic, otc });
    setResult(r);
    if (r.ok) setTab('dashboard');
  };

  return (
    <Panel title="Fonte de dados">
      <div className="space-y-4">
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
          Importe um CSV com as colunas <code className="num text-ink">timestamp, open, high, low, close</code> (e opcionalmente <code className="num text-ink">volume</code>).
          A importação é estrita: qualquer linha inválida rejeita o arquivo inteiro, e candles ausentes nunca são inventados.
          O aplicativo <strong className="text-ink">não está conectado à Quotex</strong>; não afirma que o CSV tenha os mesmos preços da corretora.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Arquivo CSV">
            <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
          </Field>
          <Field label="Fuso horário dos timestamps sem offset" hint="Obrigatório só se o arquivo não trouxer Z / +00:00 nos horários.">
            <select value={tz} onChange={(e) => setTz(e.target.value)}
              className={result?.needsTimezone ? 'border-warn' : ''}>
              <option value="">Selecione…</option>
              {[...new Set([...TZ_PRESETS, ...tzList])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Ativo (opcional)"><input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="ex.: EURUSD-OTC" maxLength={40} /></Field>
          <Field label="Origem dos dados" hint="Como você obteve este arquivo (ex.: exportação da plataforma X).">
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="ex.: exportação manual do gráfico" maxLength={120} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} /> Dados sintéticos / de teste (não reais)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={otc} onChange={(e) => setOtc(e.target.checked)} /> O gráfico de origem é OTC</label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={doImport} disabled={text === null}>Importar</Btn>
          <a className="text-xs text-info underline" href={`${import.meta.env.BASE_URL}exemplo-sintetico.csv`} download>Baixar CSV de exemplo (dados fictícios)</a>
          {fileName && <span className="text-xs text-faint">{fileName}</span>}
        </div>
        {fileError && <p role="alert" className="text-xs text-neg">{fileError}</p>}

        {result && !result.ok && (
          <div role="alert" className="rounded-md border border-neg/40 bg-neg/10 p-3 text-[13px]">
            <div className="mb-1 font-semibold text-neg">Importação rejeitada ({result.errorsTotal} problema{result.errorsTotal === 1 ? '' : 's'})</div>
            <ul className="list-disc space-y-1 pl-4">{result.errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
            {result.errorsTotal > result.errors.length && <p className="mt-1 text-xs text-muted">… e mais {result.errorsTotal - result.errors.length}.</p>}
          </div>
        )}
        {result?.ok && result.warnings.length > 0 && (
          <ul className="list-disc space-y-1 pl-4 text-xs text-warn">{result.warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>
        )}

        <div className="grid gap-3 border-t border-line pt-4 md:grid-cols-2">
          <Field label="Fuso horário de exibição">
            <select value={displayTimezone} onChange={(e) => setDisplayTimezone(e.target.value)}>
              {[...new Set([displayTimezone, ...TZ_PRESETS, ...tzList])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Btn onClick={() => loadDemo('lateral')}>Demo lateral (fictício)</Btn>
            <Btn onClick={() => loadDemo('tendencia')}>Demo tendência (fictício)</Btn>
            <Btn variant="danger" onClick={clearData} disabled={!data}>Remover dados</Btn>
          </div>
        </div>

        {data?.importInfo && data.importInfo.gaps.length > 0 && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Lacunas temporais ({data.importInfo.gaps.length})</summary>
            <ul className="num mt-2 space-y-0.5">
              {data.importInfo.gaps.slice(0, 30).map((g) => (
                <li key={g.fromT}>{formatDateTime(g.fromT, displayTimezone)} → {formatDateTime(g.toT, displayTimezone)} · {g.missingCandles} candle(s) ausente(s)</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- página

export function SettingsPage() {
  const { config, setConfig, resetConfig, history } = useStore();
  const [nonce, setNonce] = useState(0);
  const groups = useMemo(() => {
    const g = new Map<string, ParamKey[]>();
    for (const k of PARAM_KEYS) g.set(PARAM_SPECS[k].group, [...(g.get(PARAM_SPECS[k].group) ?? []), k]);
    return [...g.entries()];
  }, []);
  const undef = PARAM_KEYS.filter((k) => config.params[k].value === null).length;
  const hasPreset = PARAM_KEYS.some((k) => config.params[k].origin === 'preset_exploratorio');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <DataPanel />

      <Panel title="Critérios habilitados">
        <ul className="space-y-1">
          {RULES.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[13px]">
                <input type="checkbox" className="mt-0.5" checked={config.enabled[r.id]} onChange={(e) => setConfig(setRuleEnabled(config, r.id, e.target.checked))} />
                <span>
                  {r.name} <Chip>{r.lesson}</Chip> <Chip>{r.role === 'nao_entrada' ? 'não entrada' : r.role === 'informativo' ? 'informativo' : 'contexto'}</Chip>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 max-w-xs">
          <Field label="Timeframe" hint="As regras foram extraídas apenas para o M5.">
            <select value={config.timeframe} onChange={() => undefined}>
              <option value="M5">M5 (5 minutos)</option>
              <option value="M1" disabled>M1 — sem regras extraídas</option>
              <option value="M15" disabled>M15 — sem regras extraídas</option>
            </select>
          </Field>
        </div>
      </Panel>

      <Panel
        title="Parâmetros e limites"
        action={<span className="text-xs text-muted">{undef} não definido{undef === 1 ? '' : 's'}</span>}
      >
        <div className="mb-4 rounded-md border border-line bg-raised p-3 text-[12px] leading-relaxed text-muted">
          A aula define poucos números. Todo parâmetro marcado <span className="text-faint">não definido</span> deixa o filtro correspondente
          <strong className="text-warn"> pendente</strong> (nunca satisfeito). Você pode preencher cada um manualmente
          ou aplicar valores <strong className="text-warn">exploratórios</strong> — escolhidos para testar o aplicativo,
          <strong className="text-ink"> não vêm da aula e não foram validados</strong>. Cada análise registra de onde veio cada valor.
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Btn onClick={() => { setConfig(applyExploratoryPreset(config)); setNonce((n) => n + 1); }}>Preencher com valores exploratórios</Btn>
          <Btn disabled={!hasPreset} onClick={() => { setConfig(clearUndefinedParams(config)); setNonce((n) => n + 1); }}>Remover valores exploratórios</Btn>
          <Btn variant="danger" onClick={() => { if (window.confirm('Restaurar todos os parâmetros e critérios ao padrão?')) { resetConfig(); setNonce((n) => n + 1); } }}>Restaurar padrão</Btn>
        </div>
        {groups.map(([group, keys]) => (
          <div key={group} className="mb-5">
            <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">{group}</h3>
            {keys.map((k) => <ParamRow key={`${k}-${nonce}`} k={k} />)}
          </div>
        ))}
        <p className="text-[11px] text-faint">Versão das regras: <span className="num">{config.rulesVersion}</span></p>
      </Panel>

      <Panel title="Exportação dos registros">
        <p className="mb-3 text-[13px] text-muted">{history.length} registro(s) salvos neste navegador. O histórico fica só no seu navegador; exporte para guardar uma cópia.</p>
        <Btn disabled={history.length === 0} onClick={() => downloadText(`m5-analises-${new Date().toISOString().slice(0, 10)}.csv`, recordsToCsv(history))}>
          Exportar todos em CSV
        </Btn>
      </Panel>
    </div>
  );
}
