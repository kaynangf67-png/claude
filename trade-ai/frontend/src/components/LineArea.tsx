import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, LineStyle, createChart, type UTCTimestamp } from "lightweight-charts";
import type { LinePoint } from "../lib/types";

/** Curva de capital / desempenho. */
export function LineArea({ points, baseline, height = 220 }: { points: LinePoint[]; baseline?: number; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const chart = createChart(el.current, {
      height, autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#586176", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: "#161d2a" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      handleScroll: false, handleScale: false,
    });
    const last = points.at(-1)?.value ?? baseline ?? 0;
    const up = baseline === undefined || last >= baseline;
    const s = chart.addSeries(AreaSeries, {
      lineColor: up ? "#22c55e" : "#f04444", lineWidth: 2,
      topColor: up ? "#22c55e33" : "#f0444433", bottomColor: "#22c55e00", priceLineVisible: false,
    });
    // pontos com o mesmo segundo precisam ser únicos e crescentes
    let prev = 0;
    s.setData(points.map((p) => {
      const t = Math.max(Math.floor(p.time), prev + 1);
      prev = t;
      return { time: t as UTCTimestamp, value: p.value };
    }));
    if (baseline !== undefined)
      s.createPriceLine({ price: baseline, color: "#3b82f666", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Inicial" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points, baseline, height]);
  return <div ref={el} style={{ height }} className="w-full" />;
}
