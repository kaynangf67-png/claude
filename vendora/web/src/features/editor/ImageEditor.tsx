import { motion } from 'framer-motion';
import { Crop, Eraser, FlipHorizontal2, Redo2, RotateCw, Save, SquareDashed, Undo2, X } from 'lucide-react';
import type { EffectiveRules } from '@vendora/shared';
import { useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Notice, Spinner } from '../../components/ui';
import { api, ApiError, type Asset } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import {
  adjustPixels,
  historyReducer,
  initialHistory,
  isPristine,
  isUsableCrop,
  rectFromPoints,
  toOperations,
  type CropRect,
  type EditState,
} from './logic';

const PREVIEW_MAX = 720;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
    img.src = src;
  });
}

/** Desenha a prévia: recorte → rotação → espelho → ajustes → fundo branco quadrado. */
function renderPreview(canvas: HTMLCanvasElement, img: HTMLImageElement, e: EditState) {
  const crop = isUsableCrop(e.crop) ? e.crop : { x: 0, y: 0, width: 1, height: 1 };
  const sw = img.naturalWidth * crop.width;
  const sh = img.naturalHeight * crop.height;
  const scale = Math.min(1, PREVIEW_MAX / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const rotated = e.rotate === 90 || e.rotate === 270;
  const cw = rotated ? h : w;
  const ch = rotated ? w : h;
  const side = e.square || e.whiteBackground ? Math.max(cw, ch) : 0;

  canvas.width = side || cw;
  canvas.height = side || ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  // Igual ao servidor: gira e depois espelha na horizontal (escala aplicada antes = espelho na tela).
  if (e.flip) ctx.scale(-1, 1);
  ctx.rotate((e.rotate * Math.PI) / 180);
  ctx.drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, sw, sh, -w / 2, -h / 2, w, h);
  ctx.restore();
  if (e.brightness || e.contrast || e.saturation) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    adjustPixels(data.data, e.brightness, e.contrast, e.saturation);
    ctx.putImageData(data, 0, 0);
  }
}

function Slider({ label, value, onChange, onDone }: { label: string; value: number; onChange: (v: number) => void; onDone: () => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs font-medium text-ink-700">
        {label} <span className="tabular-nums text-ink-500">{value > 0 ? `+${value}` : value}</span>
      </span>
      <input
        type="range"
        min={-100}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onDone}
        onKeyUp={onDone}
        className="mt-1.5 w-full accent-accent"
      />
    </label>
  );
}

export function ImageEditor({
  asset,
  rules,
  onClose,
  onSaved,
}: {
  asset: Asset;
  rules: EffectiveRules;
  onClose: () => void;
  onSaved: (a: Asset) => void;
}) {
  const { meta } = useAuth();
  const toast = useToast();
  const [h, dispatch] = useReducer(historyReducer, undefined, () => initialHistory());
  const e = h.present;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<'adjust' | 'crop'>('adjust');
  const [split, setSplit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [promotional, setPromotional] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftCrop, setDraftCrop] = useState<CropRect | null>(null);
  const [aspect, setAspect] = useState<number | null>(1);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadImage(asset.url)
      .then(setImg)
      .catch(() => toast('error', 'Não foi possível abrir a imagem.'));
  }, [asset.url, toast]);

  useEffect(() => {
    if (!img) return;
    if (afterRef.current) renderPreview(afterRef.current, img, e);
    if (beforeRef.current) renderPreview(beforeRef.current, img, { ...e, brightness: 0, contrast: 0, saturation: 0 });
  }, [img, e]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        dispatch({ type: ev.shiftKey ? 'redo' : 'undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const point = (ev: ReactPointerEvent) => {
    const r = cropRef.current!.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  };
  const imageAspect = img ? img.naturalWidth / img.naturalHeight : 1;

  async function save() {
    setSaving(true);
    try {
      const r = await api.post<{ asset: Asset }>(`/api/assets/${asset.id}/edit`, { operations: toOperations(e), promotional });
      toast('success', 'Cópia editada salva. A original continua preservada.');
      onSaved(r.asset);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Falha ao processar a imagem.');
    } finally {
      setSaving(false);
    }
  }

  async function removeBackground() {
    setSaving(true);
    try {
      const r = await api.post<{ asset: Asset }>(`/api/assets/${asset.id}/remove-background`);
      toast('success', 'Fundo removido numa cópia. Revise as bordas do produto antes de usar.');
      onSaved(r.asset);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Falha ao remover o fundo.');
    } finally {
      setSaving(false);
    }
  }

  const shownCrop = draftCrop ?? e.crop;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label="Editor de imagem">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:shadow-[var(--shadow-lift)]"
      >
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <div className="flex items-center gap-1">
            <button className="btn-ghost px-2" onClick={() => dispatch({ type: 'undo' })} disabled={!h.past.length} aria-label="Desfazer">
              <Undo2 className="size-4" />
            </button>
            <button className="btn-ghost px-2" onClick={() => dispatch({ type: 'redo' })} disabled={!h.future.length} aria-label="Refazer">
              <Redo2 className="size-4" />
            </button>
            <button className="btn-ghost text-xs" onClick={() => dispatch({ type: 'reset' })} disabled={isPristine(e)}>
              Restaurar
            </button>
          </div>
          <p className="hidden text-sm font-semibold sm:block">Editor de imagem</p>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Fechar editor">
            <X className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_300px]">
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 bg-[repeating-conic-gradient(#232220_0_25%,#2c2b29_0_50%)] bg-[length:20px_20px] p-4 sm:p-6">
            {!img && <Spinner className="size-6 text-ink-400" />}
            {img && mode === 'crop' && (
              <div
                ref={cropRef}
                className="relative max-h-[60vh] touch-none select-none"
                style={{ aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}` }}
                onPointerDown={(ev) => {
                  (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
                  const p = point(ev);
                  setDragStart(p);
                  setDraftCrop({ x: p.x, y: p.y, width: 0, height: 0 });
                }}
                onPointerMove={(ev) => dragStart && setDraftCrop(rectFromPoints(dragStart, point(ev), aspect, imageAspect))}
                onPointerUp={() => {
                  if (draftCrop && isUsableCrop(draftCrop)) dispatch({ type: 'set', patch: { crop: draftCrop } });
                  setDragStart(null);
                  setDraftCrop(null);
                }}
              >
                <img src={asset.url} alt="" draggable={false} className="max-h-[60vh] w-auto" />
                {shownCrop && (
                  <div
                    className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgb(18_19_26/0.5)]"
                    style={{
                      left: `${shownCrop.x * 100}%`,
                      top: `${shownCrop.y * 100}%`,
                      width: `${shownCrop.width * 100}%`,
                      height: `${shownCrop.height * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
            {img && mode === 'adjust' && (
              <div className="relative max-w-full">
                <canvas ref={afterRef} className="block max-h-[60vh] max-w-full rounded-lg shadow-[var(--shadow-soft)]" aria-label="Depois" />
                <canvas
                  ref={beforeRef}
                  className="absolute inset-0 block h-full w-full rounded-lg"
                  style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                  aria-label="Antes"
                />
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-surface shadow" style={{ left: `${split}%` }} />
                <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">Antes</span>
                <span className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">Depois</span>
              </div>
            )}
            {img && mode === 'adjust' && (
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(ev) => setSplit(Number(ev.target.value))}
                className="w-64 accent-accent"
                aria-label="Comparar antes e depois"
              />
            )}
            <p className="text-center text-[11px] text-ink-500">
              {mode === 'crop'
                ? 'Arraste sobre a imagem para recortar.'
                : 'Prévia aproximada. O arquivo final é processado no servidor, sem ampliar a foto e sem alterar o produto.'}
            </p>
          </div>

          <aside className="space-y-6 border-t border-ink-100 p-5 lg:border-t-0 lg:border-l">
            <div className="grid grid-cols-2 gap-2">
              <button className={mode === 'adjust' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('adjust')}>
                Ajustes
              </button>
              <button className={mode === 'crop' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('crop')}>
                <Crop className="size-4" /> Recortar
              </button>
            </div>

            {mode === 'crop' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button className={aspect === 1 ? 'btn-primary flex-1' : 'btn-secondary flex-1'} onClick={() => setAspect(1)}>
                    1:1
                  </button>
                  <button className={aspect === null ? 'btn-primary flex-1' : 'btn-secondary flex-1'} onClick={() => setAspect(null)}>
                    Livre
                  </button>
                </div>
                <button className="btn-secondary w-full" disabled={!e.crop} onClick={() => dispatch({ type: 'set', patch: { crop: null } })}>
                  Remover recorte
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Slider label="Brilho" value={e.brightness} onChange={(v) => dispatch({ type: 'set', patch: { brightness: v }, key: 'brightness' })} onDone={() => dispatch({ type: 'commit' })} />
                  <Slider label="Contraste" value={e.contrast} onChange={(v) => dispatch({ type: 'set', patch: { contrast: v }, key: 'contrast' })} onDone={() => dispatch({ type: 'commit' })} />
                  <Slider label="Saturação" value={e.saturation} onChange={(v) => dispatch({ type: 'set', patch: { saturation: v }, key: 'saturation' })} onDone={() => dispatch({ type: 'commit' })} />
                  {Math.abs(e.saturation) > 40 && (
                    <p className="text-[11px] text-amber-300">Cuidado: saturação alta pode alterar a cor real do produto.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-secondary" onClick={() => dispatch({ type: 'set', patch: { rotate: ((e.rotate + 90) % 360) as EditState['rotate'] } })}>
                    <RotateCw className="size-4" /> Girar
                  </button>
                  <button className="btn-secondary" onClick={() => dispatch({ type: 'set', patch: { flip: !e.flip } })}>
                    <FlipHorizontal2 className="size-4" /> Espelhar
                  </button>
                </div>
                {e.flip && <p className="text-[11px] text-amber-300">Espelhar inverte textos e logotipos do produto. Use só se a foto original estiver invertida.</p>}
              </>
            )}

            <div className="space-y-3 border-t border-ink-100 pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-accent" checked={e.whiteBackground} onChange={(ev) => dispatch({ type: 'set', patch: { whiteBackground: ev.target.checked } })} />
                <SquareDashed className="size-4 text-ink-500" /> Quadrado com fundo branco
              </label>
              <p className="-mt-1 text-[11px] text-ink-500">Centraliza a foto numa tela branca, sem cortar nem distorcer o produto.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">Tamanho</span>
                  <select className="input" value={e.size ?? ''} onChange={(ev) => dispatch({ type: 'set', patch: { size: ev.target.value ? Number(ev.target.value) : null } })}>
                    <option value="">Original</option>
                    <option value={rules.imageRecommendedSize}>{rules.imageRecommendedSize}px (recomendado)</option>
                    {rules.imageMaxSize && rules.imageMaxSize !== rules.imageRecommendedSize && <option value={rules.imageMaxSize}>{rules.imageMaxSize}px</option>}
                    <option value={1000}>1000px</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Formato</span>
                  <select className="input" value={e.format} onChange={(ev) => dispatch({ type: 'set', patch: { format: ev.target.value as EditState['format'] } })}>
                    {rules.imageFormats.map((f) => (
                      <option key={f} value={f}>
                        {f.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-2 text-xs text-ink-700">
                <input type="checkbox" className="mt-0.5 accent-accent" checked={promotional} onChange={(ev) => setPromotional(ev.target.checked)} />
                Marcar como imagem promocional (não pode ser a foto principal)
              </label>
            </div>

            {meta?.backgroundRemoval ? (
              <button className="btn-secondary w-full" onClick={removeBackground} disabled={saving}>
                <Eraser className="size-4" /> Remover fundo ({meta.backgroundRemoval.provider})
              </button>
            ) : (
              <Notice>A remoção automática de fundo depende de um serviço externo não configurado neste servidor.</Notice>
            )}

            <button className="btn-primary w-full py-3" onClick={save} disabled={saving || isPristine(e) || !img}>
              {saving ? <Spinner /> : <Save className="size-4" />} Salvar cópia editada
            </button>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}
