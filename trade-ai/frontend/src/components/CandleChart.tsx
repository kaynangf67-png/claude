import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart,
  type IChartApi, type UTCTimestamp,
} from "lightweight-charts";
import type { ChartPayload } from "../lib/types";
import { SOURCE_LABEL, price as fmtPrice } from "../lib/format";

// O gráfico trabalha em UTC; deslocamos para o fuso local do navegador só na exibição.
const local = (t: number) => (t - new Date(t * 1000).getTimezoneOffset() * 60) as UTCTimestamp;

const C = {
  bg: "#10151f", grid: "#182030", text: "#8a93a6", buy: "#22c55e", sell: "#f04444", info: "#3b82f6",
  warn: "#f5a524", ema50: "#60a5fa", ema200: "#c084fc", vwap: "#f5a524",
};

export interface CandleChartHandle {
  screenshot: () => HTMLCanvasElement | null;
}

export const CandleChart = forwardRef<CandleChartHandle, { data: ChartPayload; height?: number }>(
  function CandleChart({ data, height = 460 }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useImperativeHandle(ref, () => ({ screenshot: () => chartRef.current?.takeScreenshot() ?? null }));

    useEffect(() => {
      if (!el.current) return;
      const chart = createChart(el.current, {
        height,
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: C.bg }, textColor: C.text, fontSize: 11,
          fontFamily: "Inter Variable, system-ui", panes: { separatorColor: "#1d2431" },
        },
        grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#1d2431" },
        timeScale: { borderColor: "#1d2431", timeVisible: true, secondsVisible: false, rightOffset: 6 },
      });
      chartRef.current = chart;

      const candles = [...data.candles, ...(data.forming ? [data.forming] : [])].map((c) => ({
        time: local(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: C.buy, downColor: C.sell, borderVisible: false, wickUpColor: C.buy, wickDownColor: C.sell,
      });
      cs.setData(candles);

      if (data.asset.has_volume) {
        const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
        vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        vol.setData([...data.candles, ...(data.forming ? [data.forming] : [])].map((c) => ({
          time: local(c.time), value: c.volume, color: c.close >= c.open ? "#22c55e40" : "#f0444440",
        })));
      }

      const line = (pts: { time: number; value: number }[], color: string, title: string, width: 1 | 2 = 1) => {
        if (!pts.length) return;
        const s = chart.addSeries(LineSeries, { color, lineWidth: width, title, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        s.setData(pts.map((p) => ({ time: local(p.time), value: p.value })));
      };
      line(data.series.ema50, C.ema50, "EMA 50");
      line(data.series.ema200, C.ema200, "EMA 200", 2);
      // VWAP reinicia a cada sessão (dia UTC): uma série por dia evita o traço vertical na virada
      const sessions = new Map<string, { time: number; value: number }[]>();
      for (const pt of data.series.vwap) {
        const day = new Date(pt.time * 1000).toISOString().slice(0, 10);
        sessions.set(day, [...(sessions.get(day) ?? []), pt]);
      }
      [...sessions.values()].forEach((pts, i, all) => line(pts, C.vwap, i === all.length - 1 ? "VWAP" : ""));

      // Suportes e resistências
      const a = data.analysis;
      for (const lv of a.levels?.supports ?? [])
        cs.createPriceLine({ price: lv.price, color: "#22c55e88", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: `S ×${lv.touches}` });
      for (const lv of a.levels?.resistances ?? [])
        cs.createPriceLine({ price: lv.price, color: "#f0444488", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: `R ×${lv.touches}` });

      // Plano do sinal: entrada, stop, alvos
      const plan = data.signal?.status === "ativo" ? data.signal : a.plan;
      if (plan) {
        cs.createPriceLine({ price: plan.entry, color: C.info, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "Entrada" });
        cs.createPriceLine({ price: plan.stop, color: C.sell, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Stop" });
        cs.createPriceLine({ price: plan.tp1, color: C.buy, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Alvo 1" });
        cs.createPriceLine({ price: plan.tp2, color: C.buy, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Alvo 2" });
      }

      // Painel de RSI
      if (data.series.rsi.length) {
        const rsi = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, title: "RSI", priceLineVisible: false }, 1);
        rsi.setData(data.series.rsi.map((p) => ({ time: local(p.time), value: p.value })));
        rsi.createPriceLine({ price: 70, color: "#f0444455", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
        rsi.createPriceLine({ price: 30, color: "#22c55e55", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
        const macd = chart.addSeries(HistogramSeries, { title: "MACD hist", priceLineVisible: false, lastValueVisible: false }, 2);
        macd.setData(data.series.macd_hist.map((p) => ({ time: local(p.time), value: p.value, color: p.value >= 0 ? "#22c55e99" : "#f0444499" })));
        const panes = chart.panes();
        panes[1]?.setHeight(90);
        panes[2]?.setHeight(70);
      }
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 140), to: candles.length + 4 });
      return () => {
        chart.remove();
        chartRef.current = null;
      };
    }, [data, height]);

    return <div ref={el} className="w-full overflow-hidden rounded-xl" style={{ height }} />;
  },
);

/** Gera PNG anotado: gráfico + cabeçalho com plano e rodapé com fonte e aviso. */
export function annotatedPng(chartCanvas: HTMLCanvasElement, data: ChartPayload): string {
  const top = 118, bottom = 44, pad = 20;
  const W = chartCanvas.width, H = chartCanvas.height + top + bottom;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#06080d";
  g.fillRect(0, 0, W, H);
  g.drawImage(chartCanvas, 0, top);

  const a = data.analysis;
  const sig = data.signal?.status === "ativo" ? data.signal : null;
  const plan = sig ?? (a.plan ? { ...a.plan, decision: a.decision, score: a.score } : null);
  const decision = sig?.decision ?? a.decision;
  const color = decision === "COMPRA" ? C.buy : decision === "VENDA" ? C.sell : C.text;

  g.font = "700 22px Inter Variable, system-ui";
  g.fillStyle = "#e7eaf1";
  g.fillText(`${data.asset.display} · M5`, pad, 36);
  g.fillStyle = color;
  g.fillText(decision, pad + g.measureText(`${data.asset.display} · M5  `).width, 36);
  g.font = "500 13px Inter Variable, system-ui";
  g.fillStyle = C.text;
  const tf = new Date().toLocaleString("pt-BR");
  g.fillText(`${data.asset.market_label} · Fonte: ${SOURCE_LABEL[data.asset.source] ?? data.asset.source}${data.asset.is_live ? "" : " (SIMULADO)"} · Captura: ${tf}`, pad, 60);
  if (plan) {
    g.font = "600 13px JetBrains Mono Variable, monospace";
    const parts = [
      ["Entrada", fmtPrice(plan.entry), C.info], ["Stop", fmtPrice(plan.stop), C.sell],
      ["Alvo 1", fmtPrice(plan.tp1), C.buy], ["Alvo 2", fmtPrice(plan.tp2), C.buy],
      ["R:R", `1:${plan.rr1} / 1:${plan.rr2}`, "#e7eaf1"], ["Confluência", `${plan.score ?? a.score}/100`, "#e7eaf1"],
    ] as const;
    let x = pad, y = 84;
    for (const [k, v, c] of parts) {
      if (x + g.measureText(`${k} ${v}`).width > W - pad) {
        x = pad;
        y += 22;
      }
      g.fillStyle = C.text;
      g.fillText(`${k} `, x, y);
      x += g.measureText(`${k} `).width;
      g.fillStyle = c;
      g.fillText(v, x, y);
      x += g.measureText(v).width + 18;
    }
  } else {
    g.fillStyle = C.text;
    g.fillText(`Sem plano de entrada: ${a.blockers[0] ?? "aguardando confirmação"}`, pad, 84);
  }
  g.font = "500 11.5px Inter Variable, system-ui";
  g.fillStyle = "#586176";
  g.fillText("Trade AI · Confluência técnica não é probabilidade de lucro · Operações apenas em modo demo", pad, H - 18);
  return cv.toDataURL("image/png");
}
