"use client";

import { useEffect, useMemo, useRef } from "react";
import { monoSamples } from "@/lib/audio";
import { computePeaks } from "@/lib/wav";

type Drag = { kind: "start" | "end" | "move"; startX: number; s0: number; e0: number } | null;

/** Forma de onda com seleção do trecho (alças arrastáveis) e cursor de reprodução. */
export function Waveform({
  buffer,
  start,
  end,
  playhead,
  onChange,
}: {
  buffer: AudioBuffer;
  start: number;
  end: number;
  playhead: number | null;
  onChange: (start: number, end: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag>(null);
  const dur = buffer.duration;
  const peaks = useMemo(() => computePeaks(monoSamples(buffer), 120), [buffer]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const x = c.getContext("2d")!;
    x.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const dim = css.getPropertyValue("--muted") || "#888";
    const bw = w / peaks.length;
    peaks.forEach((p, i) => {
      const t = (i / peaks.length) * dur;
      const inSel = t >= start && t <= end;
      const ph = Math.max(2, p * (h - 8));
      x.fillStyle = inSel ? "#25D366" : dim;
      x.globalAlpha = inSel ? 1 : 0.35;
      const bx = i * bw + bw * 0.2;
      const r = Math.min(bw * 0.3, 2);
      x.beginPath();
      if (x.roundRect) x.roundRect(bx, (h - ph) / 2, bw * 0.6, ph, r);
      else x.rect(bx, (h - ph) / 2, bw * 0.6, ph);
      x.fill();
    });
    x.globalAlpha = 1;
  }, [peaks, start, end, dur]);

  const toTime = (clientX: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur));
  };

  const onDown = (kind: "start" | "end" | "move") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, s0: start, e0: end };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = wrapRef.current!.getBoundingClientRect();
    const dt = ((e.clientX - d.startX) / r.width) * dur;
    if (d.kind === "start") onChange(Math.min(toTime(e.clientX), d.e0 - 0.3), d.e0);
    else if (d.kind === "end") onChange(d.s0, Math.max(toTime(e.clientX), d.s0 + 0.3));
    else {
      const len = d.e0 - d.s0;
      const s = Math.min(dur - len, Math.max(0, d.s0 + dt));
      onChange(s, s + len);
    }
  };
  const onUp = () => (drag.current = null);

  const pct = (t: number) => `${(t / dur) * 100}%`;

  return (
    <div ref={wrapRef} className="relative h-24 touch-none select-none rounded-2xl bg-surface-2/60" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {/* área selecionada */}
      <div
        className="absolute inset-y-0 cursor-grab rounded-xl border-2 border-brand bg-brand/10 active:cursor-grabbing"
        style={{ left: pct(start), width: `calc(${pct(end - start)})` }}
        onPointerDown={onDown("move")}
        aria-hidden
      />
      {(["start", "end"] as const).map((k) => (
        <div
          key={k}
          role="slider"
          tabIndex={0}
          aria-label={k === "start" ? "Início do corte" : "Fim do corte"}
          aria-valuemin={0}
          aria-valuemax={Math.round(dur * 10) / 10}
          aria-valuenow={Math.round((k === "start" ? start : end) * 10) / 10}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 1 : 0.1;
            const delta = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
            if (!delta) return;
            e.preventDefault();
            if (k === "start") onChange(Math.max(0, Math.min(end - 0.3, start + delta)), end);
            else onChange(start, Math.min(dur, Math.max(start + 0.3, end + delta)));
          }}
          onPointerDown={onDown(k)}
          className="absolute inset-y-0 z-10 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center outline-none"
          style={{ left: pct(k === "start" ? start : end) }}
        >
          <span className="h-14 w-3 rounded-full bg-brand shadow-lg ring-4 ring-brand/20 focus-visible:ring-brand/60" />
        </div>
      ))}
      {playhead !== null && (
        <div className="pointer-events-none absolute inset-y-1 z-20 w-0.5 rounded bg-white shadow" style={{ left: pct(playhead) }} />
      )}
    </div>
  );
}
