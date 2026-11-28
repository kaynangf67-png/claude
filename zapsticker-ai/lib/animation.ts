import type { AnimationStyle, VideoBackground } from "./types";

export interface FrameOptions {
  /** Tempo em segundos desde o início. */
  t: number;
  /** Nível da voz 0…1 naquele instante. */
  level: number;
  animation: AnimationStyle;
  /** Fundo opaco (vídeo) ou transparente (prévia sobre a UI). */
  background?: VideoBackground | null;
  /** Desenha o selo de áudio. */
  badge?: boolean;
  /** Progresso 0…1 do áudio (anel do selo). */
  progress?: number;
  playing?: boolean;
}

export const ANIMATIONS: { id: AnimationStyle; label: string }[] = [
  { id: "pulse", label: "Pulsar" },
  { id: "bounce", label: "Pular" },
  { id: "wobble", label: "Balançar" },
  { id: "shake", label: "Tremer" },
  { id: "float", label: "Flutuar" },
  { id: "none", label: "Parado" },
];

export const BACKGROUNDS: { id: VideoBackground; label: string; css: string }[] = [
  { id: "green", label: "Verde", css: "linear-gradient(160deg,#25D366,#128C7E)" },
  { id: "dark", label: "Escuro", css: "#0b141a" },
  { id: "light", label: "Claro", css: "#efeae2" },
  { id: "gradient", label: "Neon", css: "linear-gradient(160deg,#7c3aed,#25D366)" },
];

function paintBackground(ctx: CanvasRenderingContext2D, size: number, bg: VideoBackground, t: number) {
  if (bg === "dark" || bg === "light") {
    ctx.fillStyle = bg === "dark" ? "#0b141a" : "#efeae2";
    ctx.fillRect(0, 0, size, size);
    // padrão de pontinhos discreto, como papel de parede de conversa
    ctx.fillStyle = bg === "dark" ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
    const gap = size / 16;
    for (let y = gap / 2; y < size; y += gap)
      for (let x = gap / 2; x < size; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, size / 220, 0, Math.PI * 2);
        ctx.fill();
      }
    return;
  }
  const g = ctx.createLinearGradient(0, 0, size * Math.cos(t * 0.3) * 0.2 + size * 0.4, size);
  if (bg === "green") {
    g.addColorStop(0, "#25D366");
    g.addColorStop(1, "#0c6b5f");
  } else {
    g.addColorStop(0, "#7c3aed");
    g.addColorStop(1, "#25D366");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** Desenha um quadro da figurinha animada. Compartilhado entre prévia e exportação de vídeo. */
export function drawStickerFrame(
  ctx: CanvasRenderingContext2D,
  sticker: CanvasImageSource,
  size: number,
  o: FrameOptions,
) {
  const { t, animation } = o;
  const level = Math.max(0, Math.min(1, o.level));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (o.background) paintBackground(ctx, size, o.background, t);

  // Entrada "pop" nos primeiros 0,35 s
  const intro = Math.min(1, t / 0.35);
  const pop = o.background ? 1 - Math.pow(1 - intro, 3) * (1 - 0.15 * Math.sin(intro * Math.PI)) : 1;

  let scale = (o.background ? 0.84 : 1) * pop;
  let dx = 0,
    dy = 0,
    rot = 0;
  const active = o.playing === false ? 0 : 1;
  switch (animation) {
    case "pulse":
      scale *= 1 + (0.025 * Math.sin(t * 4) + 0.09 * level) * active;
      break;
    case "bounce":
      dy = -Math.abs(Math.sin(t * 5.5)) * size * (0.03 + 0.07 * level) * active;
      scale *= 1 + 0.03 * level * active;
      break;
    case "wobble":
      rot = Math.sin(t * 7) * (0.05 + 0.12 * level) * active;
      break;
    case "shake":
      dx = Math.sin(t * 47) * size * 0.018 * (0.3 + level) * active;
      dy = Math.cos(t * 39) * size * 0.012 * (0.3 + level) * active;
      rot = Math.sin(t * 31) * 0.03 * level * active;
      break;
    case "float":
      dy = Math.sin(t * 2.4) * size * 0.03 * active;
      rot = Math.sin(t * 1.7) * 0.04 * active;
      scale *= 1 + 0.05 * level * active;
      break;
    case "none":
      break;
  }

  ctx.save();
  ctx.translate(size / 2 + dx, size / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.drawImage(sticker, -size / 2, -size / 2, size, size);
  ctx.restore();

  if (o.badge) drawAudioBadge(ctx, size, level, t, o.progress ?? 0, o.playing !== false);
}

/** Selo "toque para ouvir": círculo verde com equalizador animado pela voz. */
export function drawAudioBadge(ctx: CanvasRenderingContext2D, size: number, level: number, t: number, progress: number, playing: boolean) {
  const r = size * 0.095;
  const cx = size - r - size * 0.04;
  const cy = size - r - size * 0.04;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = size * 0.02;
  ctx.fillStyle = "#25D366";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (progress > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = size * 0.009;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, r - size * 0.008, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  const bars = 4;
  const bw = r * 0.16;
  const gap = r * 0.12;
  const total = bars * bw + (bars - 1) * gap;
  for (let i = 0; i < bars; i++) {
    const wave = playing ? 0.35 + 0.65 * Math.abs(Math.sin(t * (6 + i * 1.7) + i)) : 0.4;
    const hgt = r * (0.28 + (playing ? 0.75 * level * wave + 0.15 * wave : [0.35, 0.6, 0.45, 0.3][i]));
    const x = cx - total / 2 + i * (bw + gap);
    const y = cy - hgt / 2;
    const rr = bw / 2;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + bw, y, x + bw, y + hgt, rr);
    ctx.arcTo(x + bw, y + hgt, x, y + hgt, rr);
    ctx.arcTo(x, y + hgt, x, y, rr);
    ctx.arcTo(x, y, x + bw, y, rr);
    ctx.fill();
  }
}
