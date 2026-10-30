import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time,
} from 'lightweight-charts';
import type { ZoneRect } from './chartLayers';

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  bitmapSize: { width: number; height: number };
}
interface Target {
  useBitmapCoordinateSpace<T>(cb: (scope: BitmapScope) => T): T;
}

/** Desenha as zonas como faixas translúcidas atrás dos candles. */
export class ZonesPrimitive implements ISeriesPrimitive<Time> {
  private rects: ZoneRect[] = [];
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Candlestick'> | null = null;
  private requestUpdate: (() => void) | null = null;

  attached(p: SeriesAttachedParameter<Time>): void {
    this.chart = p.chart as IChartApi;
    this.series = p.series as ISeriesApi<'Candlestick'>;
    this.requestUpdate = p.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  setRects(rects: ZoneRect[]): void {
    this.rects = rects;
    this.requestUpdate?.();
  }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => {
        (target as unknown as Target).useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr, bitmapSize }) => {
          const chart = this.chart;
          const series = this.series;
          if (!chart || !series) return;
          for (const r of this.rects) {
            const xa = chart.timeScale().timeToCoordinate(r.t0 as unknown as Time);
            const xb = chart.timeScale().timeToCoordinate(r.t1 as unknown as Time);
            const ya = series.priceToCoordinate(r.upper);
            const yb = series.priceToCoordinate(r.lower);
            if (ya === null || yb === null) continue;
            const x0 = Math.max(0, Math.round((xa ?? 0) * hr));
            const x1 = Math.min(bitmapSize.width, Math.round(((xb ?? bitmapSize.width / hr) + 40) * hr));
            const y0 = Math.round(Math.min(ya, yb) * vr);
            const h = Math.max(2, Math.round(Math.abs(yb - ya) * vr));
            if (x1 <= x0) continue;
            ctx.fillStyle = `${r.color}22`;
            ctx.fillRect(x0, y0, x1 - x0, h);
            ctx.strokeStyle = `${r.color}77`;
            ctx.lineWidth = Math.max(1, Math.round(hr));
            ctx.setLineDash([4 * hr, 4 * hr]);
            ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, h);
            ctx.setLineDash([]);
            ctx.fillStyle = `${r.color}cc`;
            ctx.font = `${Math.round(10 * hr)}px ui-sans-serif, system-ui, sans-serif`;
            ctx.fillText(r.label, x0 + 6 * hr, y0 - 4 * vr > 10 * vr ? y0 - 4 * vr : y0 + h + 12 * vr);
          }
        });
      },
    };
    return [{ renderer: () => renderer, zOrder: () => 'bottom' }];
  }
}
