/**
 * Janela do intérprete sobre o vídeo: posicionamento, arrastar, redimensionar,
 * recolher, esconder. O conteúdo 3D (AvatarViewer) é carregado sob demanda.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { InterpretationTimeline } from '@/avatar/timelineEngine';
import type { AccessibilityPrefs } from '@/services/accessibilityService';
import type { AvatarPose } from '@/avatar/animationEngine';
import type { Ambience, AvatarStatus } from './AvatarViewer';
import { AvatarControls } from './AvatarControls';
import type { LayoutOutput } from './avatarLayout';

const AvatarViewer = lazy(() => import('./AvatarViewer'));

export interface AvatarWindowProps {
  layout: LayoutOutput;
  W: number;
  H: number;
  prefs: AccessibilityPrefs;
  setPrefs: (p: Partial<AccessibilityPrefs>) => void;
  getTime: () => number;
  timeline: InterpretationTimeline | null;
  loci: Record<string, 'left' | 'right' | 'center'>;
  immersive: boolean;
  cinema: boolean;
  ambience: Ambience | null;
  speaker: { name: string; color: string } | null;
  gloss: string | null;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  onClose: () => void;
  onStatus: (s: AvatarStatus) => void;
  status: AvatarStatus | null;
  onFps?: (fps: number, cpuMs: number) => void;
  bottomReserve: number;
}

const SIZES: AccessibilityPrefs['interpreterSize'][] = ['S', 'M', 'L'];

export function AvatarWindow(p: AvatarWindowProps) {
  const { layout, W, H } = p;
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [resizeW, setResizeW] = useState<number | null>(null);
  const [touch, setTouch] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; y: number; w: number; moved: boolean } | null>(null);
  const frames = useRef({ n: 0, t: performance.now(), cpu: 0 });
  const touchTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  const onPose = (_pose: AvatarPose, cpuMs: number) => {
    const f = frames.current;
    f.n++;
    f.cpu += cpuMs;
    const now = performance.now();
    if (now - f.t > 1000) {
      p.onFps?.(Math.round((f.n * 1000) / (now - f.t)), f.cpu / f.n);
      f.n = 0;
      f.cpu = 0;
      f.t = now;
    }
  };

  if (p.collapsed) {
    return (
      <button className="interp-pill" style={{ right: layout.side === 'right' ? 16 : 'auto', left: layout.side === 'left' ? 16 : 'auto', bottom: p.bottomReserve + 4 }} onClick={() => p.setCollapsed(false)} aria-label="Mostrar intérprete de Libras">
        <span aria-hidden>🤟</span> Mostrar intérprete
      </button>
    );
  }

  const x = drag?.x ?? layout.x;
  const y = drag?.y ?? layout.y;
  const w = resizeW ?? layout.w;
  const h = p.immersive ? layout.h : w * (layout.h / layout.w);

  const onPointerDown = (e: React.PointerEvent) => {
    if (p.immersive) return;
    if ((e.target as HTMLElement).closest('button')) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro já liberado (ex.: toque muito curto) */
    }
    start.current = { px: e.clientX, py: e.clientY, x: layout.x, y: layout.y, w: layout.w, moved: false };
    if (e.pointerType !== 'mouse') {
      setTouch(true);
      window.clearTimeout(touchTimer.current);
      touchTimer.current = window.setTimeout(() => setTouch(false), 3500);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.moved && Math.hypot(dx, dy) < 5) return;
    s.moved = true;
    setDrag({ x: Math.max(0, Math.min(W - w, s.x + dx)), y: Math.max(0, Math.min(H - h - p.bottomReserve, s.y + dy)) });
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved || !drag) {
      setDrag(null);
      return;
    }
    // encaixe nos cantos inferiores
    const nearBottom = H - p.bottomReserve - (drag.y + h) < 60;
    if (nearBottom && drag.x + w > W - 70) p.setPrefs({ interpreterPosition: 'bottom-right', customPosition: null });
    else if (nearBottom && drag.x < 70) p.setPrefs({ interpreterPosition: 'bottom-left', customPosition: null });
    else p.setPrefs({ interpreterPosition: 'custom', customPosition: { x: drag.x / W, y: drag.y / H } });
    setDrag(null);
  };

  const resizeSide = layout.side === 'right' ? -1 : 1;
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    start.current = { px: e.clientX, py: e.clientY, x: layout.x, y: layout.y, w: layout.w, moved: true };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = (e.clientX - s.px) * resizeSide;
    const dy = s.py - e.clientY;
    const nw = Math.max(W * 0.12, Math.min(W * 0.5, s.w + Math.max(dx, dy / 1.25)));
    setResizeW(nw);
  };
  const onResizeUp = () => {
    start.current = null;
    if (resizeW) p.setPrefs({ interpreterWidth: resizeW / W });
    setResizeW(null);
  };

  const step = (d: number) => {
    const i = SIZES.indexOf(p.prefs.interpreterSize);
    const ni = Math.max(0, Math.min(SIZES.length - 1, i + d));
    p.setPrefs({ interpreterSize: SIZES[ni], interpreterWidth: null });
  };

  // ao redimensionar ancorado à direita/baixo, a janela cresce para cima/esquerda
  const left = resizeW && layout.side === 'right' ? layout.x + layout.w - resizeW : x;
  const top = resizeW ? layout.y + layout.h - h : y;

  const label = `🤟 Libras${p.speaker ? ` · ${p.speaker.name}` : ''}`;
  return (
    <div
      className={`interp ${drag ? 'dragging' : ''} ${resizeW ? 'resizing' : ''} ${p.immersive ? 'immersive' : ''} ${p.cinema ? 'cinema-mode' : ''} ${touch ? 'touch-active' : ''}`}
      style={{ left, top, width: w, height: h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      role="region"
      aria-label="Intérprete de Libras (avatar 3D). Arraste para mover."
    >
      <Suspense
        fallback={
          <div className="interp-loading">
            <div>
              <div className="shimmer" />
              Carregando intérprete 3D…
            </div>
          </div>
        }
      >
        <AvatarViewer getTime={p.getTime} timeline={p.timeline} loci={p.loci} expressiveness={p.immersive ? 1 : 0.5} fpsCap={p.immersive ? 45 : 30} ambience={p.cinema ? p.ambience : null} onStatus={p.onStatus} onPose={onPose} />
      </Suspense>
      {p.status?.kind === 'loading' && (
        <div className="interp-loading">
          <div>
            <div className="shimmer" />
            {p.status.message}
          </div>
        </div>
      )}
      {p.speaker && (
        <span className="interp-speaker" style={{ color: p.speaker.color }}>
          {p.speaker.name}
        </span>
      )}
      {p.gloss && (
        <div className="interp-gloss">
          <span>{p.gloss}</span>
        </div>
      )}
      {!p.immersive && (
        <>
          <AvatarControls
            label={label}
            onSmaller={() => step(-1)}
            onLarger={() => step(1)}
            onSwapSide={() => p.setPrefs({ interpreterPosition: layout.side === 'right' ? 'bottom-left' : 'bottom-right', customPosition: null })}
            onReset={() => p.setPrefs({ interpreterPosition: 'bottom-right', customPosition: null, interpreterWidth: null, interpreterSize: 'M' })}
            onCollapse={() => p.setCollapsed(true)}
            onClose={p.onClose}
            compact={w < 230}
          />
          <button className={`interp-resize ${layout.side === 'right' ? 'tl' : 'tr'}`} aria-label="Redimensionar intérprete" onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp} />
        </>
      )}
    </div>
  );
}
