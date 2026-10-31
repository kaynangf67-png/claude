import type { DeskState } from "../lib/desk";

/** Escritório em perspectiva isométrica (SVG). Coordenadas em "metros": x para a direita-baixo, y para a esquerda-baixo, z para cima. */

const S = 40; // px por unidade
const W = 12; // largura do piso (x)
const D = 7; // profundidade do piso (y)
const H = 4.2; // altura da parede
const PAD = 16;
const OX = D * 0.866 * S + PAD;
const OY = H * S + PAD;
const VW = (W + D) * 0.866 * S + PAD * 2;
const VH = (W + D) * 0.5 * S + H * S + PAD * 2;

type P = [number, number, number];
const iso = ([x, y, z]: P): [number, number] => [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (...ps: P[]) => ps.map((p) => iso(p).map((n) => n.toFixed(1)).join(",")).join(" ");

function Box({ x, y, z = 0, w, d, h, top, left, right, stroke = "#ffffff10" }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; top: string; left: string; right: string; stroke?: string;
}) {
  return (
    <g stroke={stroke} strokeWidth={0.8} strokeLinejoin="round">
      <polygon points={pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h])} fill={left} />
      <polygon points={pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h])} fill={right} />
      <polygon points={pts([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h])} fill={top} />
    </g>
  );
}

type Mood = "on" | "trade" | "locked" | "off" | "error";

function moodOf(d: DeskState, now: number): Mood {
  if (d.lockUntil && now < d.lockUntil) return "locked";
  if (d.open) return "trade";
  if (d.last?.decision === "ERRO" && d.on) return "error";
  return d.on ? "on" : "off";
}

const MOOD_COLOR: Record<Mood, string> = {
  on: "#22c55e", trade: "#4ade80", locked: "#ef4444", off: "#5b6a61", error: "#f87171",
};

function bubbleText(d: DeskState, now: number): string {
  const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const asset = d.asset.replace("USD", "/USD");
  if (d.lockUntil && now < d.lockUntil) return `${d.lockReason} · volto ${hhmm(d.lockUntil)}`;
  if (d.open) return `${d.open.direction} ${asset} · expira ${hhmm(d.open.expiry)}`;
  if (!d.on) return "Desligada";
  if (d.last?.decision === "ERRO") return "Sem conseguir analisar";
  if (d.last?.decision === "AGUARDAR") return `Sem setup em ${asset} · aguardando`;
  return `Analisando ${asset} a cada vela M5`;
}

/** Mesa com monitor, cadeira e assistente. (x, y) = canto de trás da mesa. */
function Desk({ x, y, desk, now, hair, shirt }: { x: number; y: number; desk: DeskState; now: number; hair: string; shirt: string }) {
  const mood = moodOf(desk, now);
  const glow = MOOD_COLOR[mood];
  const [hx, hy] = iso([x + 2.25, y - 0.55, 1.95]); // cabeça
  const [bx, by] = iso([x + 2.25, y - 0.55, 2.75]); // balão
  const text = bubbleText(desk, now);
  const bw = Math.max(120, text.length * 6.2 + 24);
  const screen: P[] = [[x + 0.45, y + 0.42, 1.32], [x + 1.75, y + 0.42, 1.32], [x + 1.75, y + 0.42, 2.12], [x + 0.45, y + 0.42, 2.12]];
  const [sx, sy] = iso([x + 0.55, y + 0.42, 1.98]);
  const arrowUp = desk.open?.direction === "CALL";
  return (
    <g>
      {/* cadeira (atrás da assistente) */}
      <Box x={x + 1.85} y={y - 1.0} w={0.8} d={0.12} h={1.7} top="#26342c" left="#1a241f" right="#141c17" />
      <Box x={x + 1.85} y={y - 0.95} w={0.8} d={0.7} z={0.75} h={0.1} top="#26342c" left="#1a241f" right="#141c17" />
      {/* assistente (billboard voltado para a câmera) */}
      <g className={mood === "off" ? undefined : "office-bob"} style={{ transformOrigin: `${hx}px ${hy}px` }}>
        <path d={`M ${hx - 22} ${hy + 64} Q ${hx - 24} ${hy + 22} ${hx} ${hy + 18} Q ${hx + 24} ${hy + 22} ${hx + 22} ${hy + 64} Z`} fill={shirt} />
        <path d={`M ${hx - 6} ${hy + 18} L ${hx} ${hy + 28} L ${hx + 6} ${hy + 18}`} fill="#e8b48f" />
        <circle cx={hx} cy={hy} r={15} fill="#e8b48f" />
        <path d={`M ${hx - 16} ${hy + 4} Q ${hx - 18} ${hy - 20} ${hx} ${hy - 17} Q ${hx + 18} ${hy - 20} ${hx + 16} ${hy + 4} Q ${hx + 12} ${hy - 8} ${hx} ${hy - 9} Q ${hx - 12} ${hy - 8} ${hx - 16} ${hy + 4} Z`} fill={hair} />
        <path d={`M ${hx - 16} ${hy + 2} Q ${hx - 20} ${hy + 22} ${hx - 13} ${hy + 30}`} stroke={hair} strokeWidth={6} fill="none" strokeLinecap="round" />
        {/* fone com microfone */}
        <path d={`M ${hx - 16} ${hy - 2} Q ${hx} ${hy - 26} ${hx + 16} ${hy - 2}`} stroke="#0b0f0d" strokeWidth={3} fill="none" />
        <rect x={hx + 13} y={hy - 4} width={6} height={10} rx={2} fill={glow} />
        <path d={`M ${hx + 16} ${hy + 6} Q ${hx + 14} ${hy + 14} ${hx + 6} ${hy + 14}`} stroke="#0b0f0d" strokeWidth={2} fill="none" />
        <circle cx={hx - 5} cy={hy + 1} r={1.6} fill="#1b1b1b" />
        <circle cx={hx + 5} cy={hy + 1} r={1.6} fill="#1b1b1b" />
        <path d={`M ${hx - 4} ${hy + 7} Q ${hx} ${hy + 10} ${hx + 4} ${hy + 7}`} stroke="#9a5b45" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </g>
      {/* mesa: tampo e laterais */}
      <Box x={x} y={y} z={1.0} w={3.2} d={1.4} h={0.12} top="#1f2b24" left="#16201b" right="#121a16" stroke="#22c55e33" />
      <Box x={x} y={y} w={0.1} d={1.4} h={1.0} top="#16201b" left="#121a16" right="#0f1612" />
      <Box x={x + 3.1} y={y} w={0.1} d={1.4} h={1.0} top="#16201b" left="#121a16" right="#0f1612" />
      <Box x={x + 0.1} y={y + 0.1} w={3.0} d={0.06} h={0.9} top="#141c17" left="#101713" right="#0d130f" />
      {/* monitor */}
      <Box x={x + 1.0} y={y + 0.25} z={1.12} w={0.2} d={0.12} h={0.25} top="#26342c" left="#1a241f" right="#141c17" />
      <Box x={x + 0.4} y={y + 0.3} z={1.3} w={1.4} d={0.1} h={0.85} top="#26342c" left="#0b100d" right="#141c17" />
      <polygon points={pts(...screen)} fill="#07100b" stroke={glow} strokeWidth={1.2} className={mood === "off" ? undefined : "office-glow"} style={{ color: glow }} />
      <g transform={`matrix(0.866 0.5 0 1 ${sx} ${sy})`}>
        <text x={0} y={-12} fontSize={9} fontWeight={700} fill={glow} fontFamily="JetBrains Mono Variable, monospace">
          {desk.asset.replace("USD", "/USD")}
        </text>
        {desk.open ? (
          <text x={0} y={2} fontSize={13} fontWeight={800} fill={arrowUp ? "#22c55e" : "#ef4444"} fontFamily="Inter Variable, sans-serif">
            {arrowUp ? "▲ CALL" : "▼ PUT"}
          </text>
        ) : (
          <polyline points="0,0 6,-4 12,-2 18,-8 24,-5 30,-11 36,-7 42,-10" fill="none" stroke={glow} strokeWidth={1.6} />
        )}
      </g>
      {/* teclado e caneca */}
      <Box x={x + 0.5} y={y + 0.85} z={1.12} w={1.1} d={0.32} h={0.04} top="#2c3a32" left="#1a241f" right="#141c17" />
      <Box x={x + 2.6} y={y + 0.8} z={1.12} w={0.22} d={0.22} h={0.26} top="#3a2a20" left="#c2410c" right="#9a3412" />
      {/* placar da mesa na frente */}
      <g transform={`matrix(0.866 0.5 0 1 ${iso([x + 0.3, y + 1.4, 0.75])[0]} ${iso([x + 0.3, y + 1.4, 0.75])[1]})`}>
        <text x={0} y={0} fontSize={11} fontWeight={800} fill="#ecf2ee" fontFamily="Inter Variable, sans-serif">{desk.name}</text>
        <text x={0} y={14} fontSize={10} fontWeight={700} fontFamily="JetBrains Mono Variable, monospace">
          <tspan fill="#22c55e">{desk.wins}W</tspan>
          <tspan fill="#8fa096"> · </tspan>
          <tspan fill="#ef4444">{desk.losses}L</tspan>
        </text>
      </g>
      {/* balão de status */}
      <g>
        <rect x={bx - bw / 2} y={by - 24} width={bw} height={24} rx={12} fill="#0a0f0cf0" stroke={glow} strokeWidth={1.2} />
        <path d={`M ${bx - 6} ${by} L ${bx} ${by + 8} L ${bx + 6} ${by} Z`} fill="#0a0f0cf0" stroke={glow} strokeWidth={1.2} />
        <rect x={bx - 7} y={by - 2} width={14} height={4} fill="#0a0f0c" />
        <circle cx={bx - bw / 2 + 13} cy={by - 12} r={3.5} fill={glow} className={mood === "on" || mood === "trade" ? "office-blink" : undefined} />
        <text x={bx - bw / 2 + 22} y={by - 8} fontSize={10.5} fontWeight={600} fill="#ecf2ee" fontFamily="Inter Variable, sans-serif">{text}</text>
      </g>
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  const [px, py] = iso([x + 0.3, y + 0.3, 0.75]);
  return (
    <g>
      <Box x={x} y={y} w={0.6} d={0.6} h={0.7} top="#3b2a1f" left="#5b3a26" right="#4a2f1f" />
      <circle cx={px} cy={py - 14} r={16} fill="#15803d" />
      <circle cx={px - 12} cy={py - 4} r={11} fill="#166534" />
      <circle cx={px + 12} cy={py - 6} r={12} fill="#16a34a" />
    </g>
  );
}

function Server({ x, y }: { x: number; y: number }) {
  const leds = [0.5, 0.9, 1.3, 1.7, 2.1];
  return (
    <g>
      <Box x={x} y={y} w={0.9} d={0.8} h={2.4} top="#1a241f" left="#0f1612" right="#0b100d" />
      {leds.map((z, i) => {
        const [lx, ly] = iso([x + 0.15, y + 0.8, z]);
        return (
          <g key={z}>
            <rect x={lx} y={ly - 2} width={22} height={3} rx={1} fill="#141c17" transform={`skewY(30)`} style={{ transformBox: "fill-box", transformOrigin: "left" }} />
            <circle cx={lx + 3} cy={ly + 3} r={1.8} fill={i % 3 === 1 ? "#ef4444" : "#22c55e"} className="office-blink" style={{ animationDelay: `${i * 0.37}s` }} />
          </g>
        );
      })}
    </g>
  );
}

export function Office3D({ desks, now }: { desks: DeskState[]; now: number }) {
  // gráfico do telão
  const chart = [2.2, 2.5, 2.35, 2.7, 2.55, 2.9, 2.75, 3.05, 2.85, 3.15, 2.95, 3.25];
  const chartPts = chart.map((z, i): P => [0.02, 1.5 + i * 0.42, z]);
  return (
    <svg viewBox={`0 0 ${VW.toFixed(0)} ${VH.toFixed(0)}`} className="h-auto w-full" role="img" aria-label="Escritório 3D com duas mesas de assistentes de IA">
      <defs>
        <linearGradient id="of-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1d16" />
          <stop offset="1" stopColor="#1a0f12" />
        </linearGradient>
        <radialGradient id="of-floor" cx="0.5" cy="0.6" r="0.7">
          <stop offset="0" stopColor="#121a16" />
          <stop offset="1" stopColor="#0a0f0c" />
        </radialGradient>
      </defs>

      {/* paredes */}
      <polygon points={pts([0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H])} fill="#0e1512" />
      <polygon points={pts([0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H])} fill="#111a15" />
      <polygon points={pts([0, 0, H], [W, 0, H], [W, 0, H - 0.08], [0, 0, H - 0.08])} fill="#22c55e55" />
      <polygon points={pts([0, 0, H], [0, D, H], [0, D, H - 0.08], [0, 0, H - 0.08])} fill="#ef444455" />

      {/* janela com cidade */}
      <polygon points={pts([1.2, 0, 1.5], [5.0, 0, 1.5], [5.0, 0, 3.5], [1.2, 0, 3.5])} fill="url(#of-sky)" stroke="#26342c" strokeWidth={3} />
      {[1.6, 2.2, 2.9, 3.5, 4.2].map((bx, i) => (
        <polygon key={bx} points={pts([bx, 0, 1.5], [bx + 0.45, 0, 1.5], [bx + 0.45, 0, 2.1 + (i % 3) * 0.4], [bx, 0, 2.1 + (i % 3) * 0.4])} fill="#0a120e" />
      ))}
      {[[1.75, 1.9], [2.35, 2.2], [3.05, 1.8], [3.65, 2.5], [4.35, 2.1], [2.45, 1.7]].map(([lx, lz]) => {
        const [cx, cy] = iso([lx, 0, lz]);
        return <rect key={`${lx}-${lz}`} x={cx} y={cy} width={3} height={3} fill="#fde68a" opacity={0.7} className="office-blink" style={{ animationDelay: `${lx}s` }} />;
      })}
      <polygon points={pts([3.1, 0, 1.5], [3.1, 0, 3.5])} stroke="#26342c" strokeWidth={3} fill="none" />

      {/* marca na parede */}
      <g transform={`matrix(0.866 0.5 0 1 ${iso([6.4, 0, 3.0])[0]} ${iso([6.4, 0, 3.0])[1]})`}>
        <text x={0} y={0} fontSize={26} fontWeight={900} fill="#ecf2ee" letterSpacing={3} fontFamily="Inter Variable, sans-serif">
          TRADE <tspan fill="#22c55e">A</tspan><tspan fill="#ef4444">I</tspan>
        </text>
        <text x={2} y={18} fontSize={10} fill="#8fa096" letterSpacing={2} fontFamily="Inter Variable, sans-serif">MESA DE OPERAÇÕES · SIMULADA</text>
      </g>

      {/* telão na parede esquerda */}
      <polygon points={pts([0.02, 1.2, 1.6], [0.02, 6.4, 1.6], [0.02, 6.4, 3.6], [0.02, 1.2, 3.6])} fill="#07100b" stroke="#26342c" strokeWidth={3} />
      <polyline points={pts(...chartPts)} fill="none" stroke="#22c55e" strokeWidth={2.2} />
      {chart.map((z, i) => {
        const up = i === 0 || z >= chart[i - 1];
        const [cx, cy] = iso([0.02, 1.5 + i * 0.42, z - 0.35]);
        return <rect key={i} x={cx - 3} y={cy} width={6} height={14} fill={up ? "#22c55e" : "#ef4444"} opacity={0.55} transform={`skewY(-30)`} style={{ transformBox: "fill-box", transformOrigin: "center" }} />;
      })}

      {/* piso */}
      <polygon points={pts([0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0])} fill="url(#of-floor)" />
      {Array.from({ length: W - 1 }, (_, i) => (
        <polyline key={`gx${i}`} points={pts([i + 1, 0, 0], [i + 1, D, 0])} stroke="#ffffff08" />
      ))}
      {Array.from({ length: D - 1 }, (_, i) => (
        <polyline key={`gy${i}`} points={pts([0, i + 1, 0], [W, i + 1, 0])} stroke="#ffffff08" />
      ))}
      <polygon points={pts([1.4, 2.6, 0.01], [10.6, 2.6, 0.01], [10.6, 6.2, 0.01], [1.4, 6.2, 0.01])} fill="#22c55e0d" stroke="#22c55e30" />

      <Server x={0.3} y={0.3} />
      <Plant x={10.9} y={0.4} />

      {desks[0] && <Desk x={2.0} y={4.0} desk={desks[0]} now={now} hair="#3b2416" shirt="#15803d" />}
      {desks[1] && <Desk x={7.0} y={4.0} desk={desks[1]} now={now} hair="#111827" shirt="#b91c1c" />}

      <Plant x={0.5} y={6.1} />
    </svg>
  );
}
