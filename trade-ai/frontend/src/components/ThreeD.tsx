import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/** Candle 3D em CSS: corpo em cubóide (4 faces + topo) e pavio atravessando. */
export function Candle3D({ up, w = 26, h = 70, wick = 30, spin = true, style }: {
  up: boolean; w?: number; h?: number; wick?: number; spin?: boolean; style?: CSSProperties;
}) {
  const color = up ? "var(--color-buy)" : "var(--color-sell)";
  const dark = up ? "#0f5132" : "#7f1d1d";
  const half = w / 2;
  const face = (transform: string, bg: string): CSSProperties => ({
    position: "absolute", width: w, height: h, left: 0, top: wick, transform, background: bg,
    border: "1px solid #ffffff1f", borderRadius: 3,
  });
  return (
    <div className={spin ? "c3d-spin" : undefined}
      style={{ position: "relative", width: w, height: h + wick * 2, transformStyle: "preserve-3d", ...style }}>
      {/* pavio: dois planos cruzados */}
      <div style={{ position: "absolute", left: half - 1, top: 0, width: 2, height: h + wick * 2, background: color, opacity: 0.85 }} />
      <div style={{ position: "absolute", left: half - 1, top: 0, width: 2, height: h + wick * 2, background: color, opacity: 0.85, transform: "rotateY(90deg)" }} />
      <div style={face(`translateZ(${half}px)`, `linear-gradient(160deg, ${color}, ${dark})`)} />
      <div style={face(`rotateY(180deg) translateZ(${half}px)`, dark)} />
      <div style={face(`rotateY(90deg) translateZ(${half}px)`, `linear-gradient(160deg, ${dark}, ${color})`)} />
      <div style={face(`rotateY(-90deg) translateZ(${half}px)`, dark)} />
      <div style={{ position: "absolute", width: w, height: w, left: 0, top: wick - half, transform: "rotateX(90deg)", background: color, borderRadius: 3 }} />
    </div>
  );
}

/** Fundo com candles 3D flutuando, bem discretos. */
export function CandleScene() {
  const items = [
    { up: true, x: "6%", y: "18%", s: 0.9, d: 0 },
    { up: false, x: "16%", y: "62%", s: 0.7, d: -4 },
    { up: true, x: "84%", y: "12%", s: 1.1, d: -2 },
    { up: false, x: "92%", y: "55%", s: 0.8, d: -6 },
    { up: true, x: "72%", y: "80%", s: 0.6, d: -3 },
    { up: false, x: "40%", y: "88%", s: 0.55, d: -5 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ perspective: 900 }}>
      {items.map((c, i) => (
        <div key={i} className="c3d-float absolute opacity-[0.22]"
          style={{ left: c.x, top: c.y, transform: `scale(${c.s})`, animationDelay: `${c.d}s` }}>
          <Candle3D up={c.up} style={{ animationDelay: `${c.d}s` }} />
        </div>
      ))}
    </div>
  );
}

/** Card que inclina levemente seguindo o mouse (desligado em toque e em "reduzir movimento"). */
export function Tilt({ children, className, max = 4 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
    el.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className ?? ""}`}>
      {children}
    </div>
  );
}
