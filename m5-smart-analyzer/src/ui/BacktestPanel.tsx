import { useState } from 'react';
import { runBacktest, summarizeBacktest, type BacktestSummary } from '../core/backtest';
import { configHash } from '../core/config';
import { bucketM1, looksLikeM1, parseMt5M1, type Bucketed } from '../core/mt5';
import { verdict as verdictFn } from '../core/stats';
import { formatDateTime } from '../core/time';
import { fetchRange } from './binanceApi';
import { Btn, Field, Panel } from './kit';
import { StatCell, VERDICT_NOTE } from './LivePage';
import { useLive } from './live';
import { useStore } from './store';

interface Out {
  summary: BacktestSummary;
  label: string;
  analyzed: number;
  rows: number;
  skipped: { semAnalise: number; m1Divergente: number; semM1: number };
  hash: string;
  payout: number;
}

/** Teste histórico com resultado: o mesmo código do uso ao vivo, aplicado a velas passadas. */
export function BacktestPanel() {
  const { config, setTab, displayTimezone } = useStore();
  const live = useLive();
  const [src, setSrc] = useState<'binance' | 'mt5'>('binance');
  const [symbol, setSymbol] = useState(live.symbols[0]!);
  const [days, setDays] = useState(3);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<Out | null>(null);

  const p = config.params;
  const missing = [p.zoneToleranceMult, p.retractionMinMult, p.retractionWindow].some((x) => x.value === null);
  const payout = p.payoutPercent.value ?? 80;

  const run = async () => {
    setBusy(true); setErr(null); setOut(null);
    try {
      let b: Bucketed;
      let label: string;
      if (src === 'mt5') {
        if (!file) throw new Error('Escolha o arquivo CSV exportado do MT5 (velas de 1 minuto).');
        setMsg('Lendo o arquivo…');
        const parsed = parseMt5M1(await file.text());
        if (parsed.candles.length < 2000) throw new Error(`Li só ${parsed.candles.length} velas válidas. Exporte alguns dias de velas de 1 minuto (M1).`);
        if (!looksLikeM1(parsed.candles)) throw new Error('Este arquivo não parece ser de velas de 1 minuto. Exporte o gráfico em M1.');
        b = bucketM1(parsed.candles);
        label = `${file.name} · ${parsed.candles.length} velas M1${parsed.rejected ? ` (${parsed.rejected} linhas rejeitadas)` : ''} · horário do servidor do MT5`;
      } else {
        const end = Math.floor(Date.now() / 300_000) * 300;
        const start = end - (days * 288 + 820) * 300; // folga p/ montar zonas de M15/H1
        const c1 = await fetchRange(symbol, '1m', start, end, (n) => setMsg(`Baixando velas de 1 minuto: ${n}…`));
        b = bucketM1(c1);
        label = `${symbol} · ${days} dia(s) · Binance`;
      }
      if (b.c5.length < 100) throw new Error('Candles insuficientes para o teste.');
      setMsg(`Analisando ${b.c5.length} velas M5…`);
      await new Promise((r) => setTimeout(r, 30));
      const r = runBacktest(b.c5, b.m1, config, null);
      setOut({ summary: summarizeBacktest(r.rows, payout), label, analyzed: r.analyzedCandles, rows: r.rows.length, skipped: r.skipped, hash: configHash(config), payout });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false); setMsg(null);
    }
  };

  const s = out?.summary;
  return (
    <Panel title="Teste histórico com resultado">
      <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        Repete as regras em velas passadas e confere se o candle M5 fechou do lado certo do preço de entrada (a borda da zona). É a pergunta que importa:
        a taxa de acerto passa do ponto de equilíbrio com folga, numa amostra grande? Usa só velas anteriores a cada toque e os mesmos critérios do uso ao vivo.
      </p>
      {missing && (
        <p className="mb-3 rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          Sem os parâmetros da zona e da retração (Regra 4) não existe zona armada, e o teste não tem o que avaliar.{' '}
          <button className="underline" onClick={() => setTab('configuracoes')}>Defina em Configurações</button>. Fixe os números ANTES de olhar o resultado.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Fonte dos dados">
          <select value={src} onChange={(e) => setSrc(e.target.value as 'binance' | 'mt5')}>
            <option value="binance">Binance (cripto)</option><option value="mt5">CSV de 1 min do MT5 (forex)</option>
          </select>
        </Field>
        {src === 'binance' ? (
          <>
            <Field label="Par"><select value={symbol} onChange={(e) => setSymbol(e.target.value)}>{live.symbols.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Período"><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>1 dia</option><option value={3}>3 dias</option><option value={7}>7 dias</option></select></Field>
          </>
        ) : (
          <Field label="Arquivo"><input type="file" accept=".csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        )}
        <Btn variant="primary" onClick={() => void run()} disabled={busy || missing}>{busy ? 'Rodando…' : 'Rodar teste'}</Btn>
      </div>
      {src === 'mt5' && (
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-faint">
          No MT5: Ctrl+U (Símbolos) → aba Barras → escolha o par e o tempo gráfico de 1 minuto e o período → Solicitar → Exportar barras (CSV). No MT4: Ferramentas → Central de históricos.
          Quanto mais meses, melhor; fins de semana não têm dados no forex.
        </p>
      )}
      {msg && <p className="mt-3 text-[13px] text-muted">{msg}</p>}
      {err && <p role="alert" className="mt-3 text-[13px] text-neg">{err}</p>}

      {out && s && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Todo toque em zona armada</div><StatCell t={s.todos} v={s.verdicts.todos} /></div>
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Cenário favorável no toque</div><StatCell t={s.favoravel} v={s.verdicts.favoravel} /></div>
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Gatilho confirmado</div><StatCell t={s.gatilho} v={s.verdicts.gatilho} /></div>
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Ponto de equilíbrio</div><span className="num text-xl">{(s.breakeven * 100).toFixed(1).replace('.', ',')}%</span><div className="text-[11px] text-faint">payout {out.payout}%</div></div>
          </div>
          <p className="text-xs text-faint">{out.label} · {out.analyzed} velas analisadas · {out.rows} toques · descartes: {out.skipped.semM1} sem M1, {out.skipped.m1Divergente} com M1 divergente, {out.skipped.semAnalise} sem análise. Configuração <span className="num">{out.hash}</span>.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-[13px]">
              <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint"><th className="py-2 font-medium">Critério</th><th className="font-medium">Quando atendido</th><th className="font-medium">Quando falha</th></tr></thead>
              <tbody>{s.ablation.map((a) => (
                <tr key={a.id} className="border-b border-line/60 align-top"><td className="py-2 pr-3">{a.label}</td><td className="pr-3"><StatCell t={a.pass} v={verdictOf(a.pass, s.breakeven)} /></td><td><StatCell t={a.fail} v={verdictOf(a.fail, s.breakeven)} /></td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-faint">
            <p>{VERDICT_NOTE}</p>
            <p>As linhas de confluência com M15/H1 (hipótese) só contam toques que têm candles suficientes do timeframe maior, então a amostra é menor. Ligue a regra só se isso melhorar o resultado com folga, em outros pares e períodos.</p>
            <p>Nove critérios olhados ao mesmo tempo: por puro acaso, um ou dois vão parecer bons. Só vale levar a sério o que se repetir em outros pares e períodos, com os números fixados antes. Pares de cripto andam juntos, então os casos não são independentes e o intervalo é otimista.</p>
            <p>Como o teste é feito: a entrada é a borda da zona, o resultado é o fechamento do mesmo M5, e o tempo restante é estimado pelo minuto do toque. Dados de mercado real da fonte escolhida; isso não prova nada sobre o preço da Quotex (e menos ainda em OTC). Horários em {displayTimezone}; hoje é {formatDateTime(Date.now() / 1000, displayTimezone)}.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

const verdictOf = verdictFn;
