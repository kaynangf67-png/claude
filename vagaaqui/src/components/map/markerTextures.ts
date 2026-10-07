import * as THREE from 'three';
import { STATUS_COLORS } from '../../config/constants';
import type { SpotStatus } from '../../types';

/**
 * Texturas de marcador desenhadas em canvas e cacheadas por (estado, %, destaque).
 * Evita fontes externas e DOM sobre o canvas 3D: escala bem para centenas de vagas.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function markerTexture(status: SpotStatus, percent: number, highlight: boolean, isLot: boolean) {
  const key = `${status}|${percent}|${highlight}|${isLot}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 256;
  const H = 160;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const color = STATUS_COLORS[status];
  const pillH = 92;
  const pillW = isLot ? 236 : 200;
  const x = (W - pillW) / 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = highlight ? 26 : 14;
  roundRect(ctx, x, 6, pillW, pillH, 46);
  ctx.fillStyle = highlight ? color : 'rgba(8,12,22,0.92)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();

  // ponteiro
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, pillH + 4);
  ctx.lineTo(W / 2, H - 8);
  ctx.lineTo(W / 2 + 16, pillH + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = highlight ? '#05070d' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${isLot ? 50 : 56}px Sora, system-ui, sans-serif`;
  const label = `${isLot ? 'P ' : ''}${status === 'stale' ? '~' : ''}${percent}%`;
  ctx.fillText(label, W / 2, 6 + pillH / 2 + 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const labelCache = new Map<string, THREE.CanvasTexture>();
export function labelTexture(text: string, icon: string, accent = '#5b8cff') {
  const key = `${text}|${icon}|${accent}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 44px Sora, system-ui, sans-serif';
  const textW = ctx.measureText(text).width;
  canvas.width = Math.ceil(textW + 140);
  canvas.height = 96;
  const c2 = canvas.getContext('2d')!;
  roundRect(c2, 4, 8, canvas.width - 8, 80, 40);
  c2.fillStyle = 'rgba(8,12,22,0.86)';
  c2.fill();
  c2.lineWidth = 3;
  c2.strokeStyle = accent;
  c2.stroke();
  c2.beginPath();
  c2.arc(48, 48, 28, 0, Math.PI * 2);
  c2.fillStyle = accent;
  c2.fill();
  c2.fillStyle = '#05070d';
  c2.font = '700 34px Sora, system-ui, sans-serif';
  c2.textAlign = 'center';
  c2.textBaseline = 'middle';
  c2.fillText(icon, 48, 50);
  c2.fillStyle = '#e8eefc';
  c2.font = '600 44px Sora, system-ui, sans-serif';
  c2.textAlign = 'left';
  c2.fillText(text, 92, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, tex);
  return tex;
}

let padTexture: THREE.CanvasTexture | null = null;
/** Moldura da vaga pintada no chão (tingida pela cor do estado). */
export function spotPadTexture() {
  if (padTexture) return padTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 64, 10, 128, 64, 130);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = grad;
  roundRect(ctx, 6, 6, 244, 116, 18);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.stroke();
  padTexture = new THREE.CanvasTexture(canvas);
  return padTexture;
}

const streetCache = new Map<string, THREE.CanvasTexture>();
/** Nome de rua para pintar no chão: texto claro com contorno escuro, fundo transparente. */
export function streetNameTexture(name: string) {
  const hit = streetCache.get(name);
  if (hit) return hit;
  const font = '600 64px Sora, system-ui, sans-serif';
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(name).width + 40);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(20,22,26,0.85)';
  ctx.strokeText(name, w / 2, 50);
  ctx.fillStyle = 'rgba(232,236,242,0.92)';
  ctx.fillText(name, w / 2, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  streetCache.set(name, tex);
  return tex;
}
