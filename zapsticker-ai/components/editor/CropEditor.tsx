"use client";

import { Maximize, Minimize, Move, RotateCcw, RotateCw, ZoomIn } from "lucide-react";
import { useEffect, useRef } from "react";
import { coverZoom, renderSticker, type Drawable } from "@/lib/image";
import type { CropState, ImageSettings } from "@/lib/types";
import { Slider } from "../ui/Slider";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Recorte/ajuste com visualização real da figurinha (arrastar, pinça, roda do mouse). */
export function CropEditor({
  source,
  transparent,
  settings,
  onCrop,
}: {
  source: Drawable;
  transparent: boolean;
  settings: ImageSettings;
  onCrop: (c: CropState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropRef = useRef(settings.crop);
  cropRef.current = settings.crop;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Renderiza a prévia real (mesmo código que gera o arquivo final)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c) return;
      const out = renderSticker(source, settings, { transparent });
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(out, 0, 0, c.width, c.height);
    });
    return () => cancelAnimationFrame(id);
  }, [source, settings, transparent]);

  const update = (patch: Partial<CropState>) => {
    const c = { ...cropRef.current, ...patch };
    c.zoom = clamp(c.zoom, MIN_ZOOM, MAX_ZOOM);
    c.x = clamp(c.x, -1.2, 1.2);
    c.y = clamp(c.y, -1.2, 1.2);
    cropRef.current = c;
    onCrop(c);
  };

  // Roda do mouse (passiva = false para impedir rolagem da página)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      update({ zoom: cropRef.current.zoom * Math.exp(-e.deltaY * 0.0015) });
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: cropRef.current.zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    const rect = canvasRef.current!.getBoundingClientRect();
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      update({ zoom: pinch.current.zoom * (d / pinch.current.dist) });
    } else if (pointers.current.size === 1) {
      // a área útil ocupa ~88% do quadro
      const k = 1 / (rect.width * 0.88);
      update({ x: cropRef.current.x + (next.x - prev.x) * k, y: cropRef.current.y + (next.y - prev.y) * k });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const fill = coverZoom(source, settings.crop.rotation);

  return (
    <div>
      <div className="checker relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-[28px] border border-line">
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className="size-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Prévia da figurinha. Arraste para mover e use pinça ou a roda do mouse para zoom."
        />
        <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <Move className="size-3" /> Arraste · pinça para zoom
        </span>
      </div>
      <div className="mx-auto mt-4 max-w-[420px] space-y-3">
        <Slider
          label="Zoom"
          icon={<ZoomIn className="size-4 text-muted" />}
          value={settings.crop.zoom}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          onChange={(zoom) => update({ zoom })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Girar ←", icon: RotateCcw, on: () => update({ rotation: (settings.crop.rotation + 270) % 360 }) },
            { label: "Girar →", icon: RotateCw, on: () => update({ rotation: (settings.crop.rotation + 90) % 360 }) },
            { label: "Inteira", icon: Minimize, on: () => update({ zoom: 1, x: 0, y: 0 }) },
            { label: "Preencher", icon: Maximize, on: () => update({ zoom: fill, x: 0, y: 0 }) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.on}
              className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2/70 py-2.5 text-[11px] font-medium text-muted transition hover:text-fg active:scale-95"
            >
              <b.icon className="size-5 text-fg" />
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
