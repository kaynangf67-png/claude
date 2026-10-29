import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries, ColorType, CrosshairMode, createChart, createSeriesMarkers,
  type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time, type UTCTimestamp,
} from 'lightweight-charts';
import { candleMetrics } from '../core/candle';
import { fmtPct, fmtPrice } from '../core/format';
import { formatDateTime, formatTime } from '../core/time';
import { COLORS, DEFAULT_LAYERS, buildMarkers, buildZoneRects, type Layers } from './chartLayers';
import { ZonesPrimitive } from './zonesPrimitive';
import { Btn, Chip, Panel, SCENARIO_LABEL, Status, scenarioTone } from './kit';
import { useStore } from './store';

interface Tip { x: number; y: number; t: number; o: number; h: number; l: number; c: number; v?: number }

export function ChartPage({ compact = false }: { compact?: boolean } = {}) {
  const { data, analysis, displayTimezone, focus, setFocus, setTab, loadDemo } = useStore();
  // versão compacta (modo simples): só zonas e o ponto da oportunidade, sem rótulos
  const [layers, setLayers] = useState<Layers>(compact ? { swings: false, zones: true, opportunities: true, flow: false } : DEFAULT_LAYERS);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const zonesPrim = useRef<ZonesPrimitive | null>(null);
  const byTime = useRef(new Map<number, { v?: number }>());
  // série enquadrada por último: só reenquadra quando mudar o par ou a fonte, para não desfazer o zoom
  const framed = useRef<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const tzRef = useRef(displayTimezone);
  tzRef.current = displayTimezone;
  const hasData = data !== null;

  // criação única do gráfico
  useEffect(() => {
    if (!host.current || !hasData) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#0e0f11' }, textColor: '#8d949c', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11 },
      grid: { vertLines: { color: '#15171a' }, horzLines: { color: '#1b1e22' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2e34' },
      timeScale: {
        borderColor: '#2a2e34', timeVisible: true, secondsVisible: false,
        tickMarkFormatter: (t: number) => formatTime(t, tzRef.current),
      },
      localization: { timeFormatter: (t: number) => formatDateTime(t, tzRef.current) },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: COLORS.up, downColor: COLORS.down, borderVisible: false,
      wickUpColor: COLORS.up, wickDownColor: COLORS.down,
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    });
    markers.current = createSeriesMarkers(s, []);
    const zp = new ZonesPrimitive();
    s.attachPrimitive(zp);
    zonesPrim.current = zp;
    c.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(s);
      if (!p.point || !p.time || !d || !('open' in d)) { setTip(null); return; }
      const t = p.time as number;
      setTip({ x: p.point.x, y: p.point.y, t, o: d.open, h: d.high, l: d.low, c: d.close, v: byTime.current.get(t)?.v });
    });
    chart.current = c;
    series.current = s;
    return () => {
      c.remove();
      chart.current = null; series.current = null; markers.current = null; zonesPrim.current = null; framed.current = null;
    };
  }, [hasData]);

  // dados
  useEffect(() => {
    if (!data || !series.current || !chart.current) return;
    byTime.current = new Map(data.candles.map((c) => [c.t, { v: c.v }]));
    series.current.setData(data.candles.map((c) => ({ time: c.t as UTCTimestamp, open: c.o, high: c.h, low: c.l, close: c.c })));
    const n = data.candles.length;
    const key = data.source.name; // inclui o par; não usa o 1º candle, que muda a cada M5 no ao vivo
    if (framed.current !== key) {
      framed.current = key;
      chart.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 90), to: n + 3 });
    }
  }, [data?.candles]);

  // candle em formação (feed ao vivo): atualiza só a última barra
  useEffect(() => {
    const live = data?.live;
    if (!live || !series.current || !live.intrabar.forming) return;
    const f = live.intrabar.forming;
    series.current.update({ time: live.formingOpenT as UTCTimestamp, open: f.o, high: f.h, low: f.l, close: f.c });
  }, [data?.live, data?.candles]);

  // fuso de exibição: força o redesenho dos rótulos
  useEffect(() => {
    chart.current?.applyOptions({ localization: { timeFormatter: (t: number) => formatDateTime(t, displayTimezone) } });
  }, [displayTimezone]);

  // camadas
  useEffect(() => {
    if (!series.current || !markers.current || !data) return;
    markers.current.setMarkers(
      buildMarkers(analysis, data.candles, layers, focus).map((m) => ({
        time: m.time as UTCTimestamp, position: m.position, shape: m.shape, color: m.color, text: compact ? '' : m.text, size: m.size,
      })),
    );
    zonesPrim.current?.setRects(buildZoneRects(analysis, layers, data.candles));
  }, [analysis, data, layers, focus, compact]);

  if (compact && (!data || !analysis)) {
    return <div className="flex h-[300px] items-center justify-center rounded-lg border border-line text-sm text-muted sm:h-[400px]">Carregando o gráfico…</div>;
  }
  if (!data || !analysis) {
    return (
      <Panel title="Gráfico">
        <p className="mb-3 text-[13px] text-muted">Nenhum candle carregado.</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => setTab('configuracoes')}>Importar CSV</Btn>
          <Btn onClick={() => loadDemo('lateral')}>Demonstração fictícia</Btn>
        </div>
      </Panel>
    );
  }

  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const m = tip ? candleMetrics({ t: tip.t, o: tip.o, h: tip.h, l: tip.l, c: tip.c }) : null;

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'mx-auto flex max-w-6xl flex-col gap-3'}>
      {!compact && data.source.synthetic && (
        <div role="note" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          DADOS FICTÍCIOS — {data.source.name}. Não representam nenhum ativo ou corretora.
        </div>
      )}
      {!compact && <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Status tone={scenarioTone(analysis.state)}>{SCENARIO_LABEL[analysis.state]}</Status>
          <span className="text-xs text-muted">{analysis.trigger.message}</span>
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <legend className="sr-only">Camadas do gráfico</legend>
          {([
            ['swings', 'Topos/fundos'], ['zones', 'Zonas'], ['opportunities', 'Zona candidata'], ['flow', 'Fluxo da mesma cor'],
          ] as Array<[keyof Layers, string]>).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} /> {label}
            </label>
          ))}
        </fieldset>
      </div>}

      <div className="relative overflow-hidden rounded-lg border border-line bg-bg">
        <div ref={host} className={compact ? 'h-[300px] w-full sm:h-[400px]' : 'h-[340px] w-full sm:h-[460px]'} role="img" aria-label="Gráfico de candles M5" />
        {tip && m && (
          <div
            className="pointer-events-none absolute z-10 w-[11.5rem] rounded-md border border-line bg-raised/95 p-2 text-[11px] shadow-lg"
            style={{ left: Math.min(Math.max(tip.x + 14, 4), (host.current?.clientWidth ?? 300) - 190), top: Math.max(tip.y - 70, 4) }}
          >
            <div className="num mb-1 text-ink">{formatDateTime(tip.t, displayTimezone)}</div>
            <div className="num grid grid-cols-[auto_1fr] gap-x-2 text-muted">
              <span>Abertura</span><span className="text-right text-ink">{fmtPrice(tip.o)}</span>
              <span>Máxima</span><span className="text-right text-ink">{fmtPrice(tip.h)}</span>
              <span>Mínima</span><span className="text-right text-ink">{fmtPrice(tip.l)}</span>
              <span>Fechamento</span><span className="text-right text-ink">{fmtPrice(tip.c)}</span>
              {tip.v !== undefined && (<><span>Volume</span><span className="text-right text-ink">{tip.v}</span></>)}
            </div>
            <div className="num mt-1 border-t border-line pt-1 text-faint">
              {m.direction} · corpo {m.bodyRatio === null ? '—' : fmtPct(m.bodyRatio)} · pavio sup {m.upperWickRatio === null ? '—' : fmtPct(m.upperWickRatio)} · inf {m.lowerWickRatio === null ? '—' : fmtPct(m.lowerWickRatio)}
            </div>
          </div>
        )}
      </div>

      {!compact && focus && (
        <div className="flex items-center gap-2 text-xs text-info">
          Destacando candles de: <strong>{focus.label}</strong>
          <button className="text-muted underline" onClick={() => setFocus(null)}>limpar</button>
        </div>
      )}

      {!compact && <Panel title="Legenda">
        <ul className="grid gap-x-6 gap-y-1.5 text-xs text-muted sm:grid-cols-2">
          <li><Chip>topo / fundo</Chip> pivô <strong className="text-ink">validado</strong> (afastamento mínimo atingido com candles já fechados).</li>
          <li><Chip>topo? / fundo?</Chip> apenas <strong className="text-ink">candidato geométrico</strong>; ainda não validado pela regra.</li>
          <li><span className="text-neg">faixa vermelha</span> / <span className="text-pos">verde</span>: zona de resistência / suporte, do primeiro pivô até o último candle (as 6 mais recentes).</li>
          <li><Chip>zona candidata · não é gatilho</Chip> o último candle toca ou se aproxima de uma zona com o histórico mínimo. <strong className="text-ink">Não é entrada.</strong></li>
          <li>Os marcadores de topo/fundo ficam no candle do pivô, mas só foram conhecidos {data ? 'alguns candles depois' : ''} (veja o painel de filtros).</li>
        </ul>
      </Panel>}
    </div>
  );
}
