"use client";

import { Camera, Frame, ImagePlus, RefreshCw, Trash2, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { canvasToBlob, coverZoom, opaqueRatio, removeSolidBackground, trimTransparent, type Drawable } from "@/lib/image";
import { validateImageFile } from "@/lib/limits";
import { useIsTouch } from "@/lib/hooks";
import type { BgRemovalMode, CropState, ImageSettings } from "@/lib/types";
import { Button, Spinner } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { Chips, Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";
import { CameraCapture } from "./CameraCapture";
import { CropEditor } from "./CropEditor";
import { HiddenFileInput, IMAGE_ACCEPT } from "./FilePickers";

export function PhotoStep({
  image,
  cutout,
  cutoutMode,
  settings,
  onImage,
  onRemoveImage,
  onSettings,
  onCutout,
}: {
  image: HTMLImageElement | null;
  cutout: Drawable | null;
  cutoutMode?: BgRemovalMode;
  settings: ImageSettings;
  onImage: (file: Blob, name: string) => void;
  onRemoveImage: () => void;
  onSettings: (s: ImageSettings) => void;
  onCutout: (blob: Blob, mode: BgRemovalMode, crop: CropState) => void;
}) {
  const toast = useToast();
  const touch = useIsTouch();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState<BgRemovalMode | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (f: File) => {
    const err = validateImageFile(f);
    if (err) return toast(err, "error");
    onImage(f, f.name);
  };
  const openCamera = () => (touch ? cameraRef.current?.click() : setCameraOpen(true));

  const runId = useRef(0);
  const runRemoval = async (mode: BgRemovalMode) => {
    if (!image) return;
    const id = ++runId.current;
    const stale = () => id !== runId.current;
    setProcessing(mode);
    try {
      let canvas: HTMLCanvasElement;
      if (mode === "ai") {
        const { removeBackgroundAI } = await import("@/lib/segment");
        canvas = await removeBackgroundAI(image);
      } else {
        canvas = removeSolidBackground(image);
      }
      if (stale()) return;
      if (opaqueRatio(canvas) < 0.02) {
        throw new Error(
          mode === "ai"
            ? "Não encontramos uma pessoa nesta foto. Tente o modo “Fundo liso” ou outra imagem."
            : "O fundo e o objeto têm cores parecidas demais. Tente o modo “Pessoa (IA)”.",
        );
      }
      const trimmed = trimTransparent(canvas);
      const blob = await canvasToBlob(trimmed, "image/png");
      if (stale()) return;
      onCutout(blob, mode, { ...settings.crop, zoom: 1, x: 0, y: 0 });
      toast("Fundo removido ✨", "success");
    } catch (e) {
      if (stale()) return;
      console.error(e);
      const msg = e instanceof Error && e.message.length < 200 ? e.message : "Não foi possível remover o fundo.";
      toast(msg.includes("Falha") || msg.includes("fetch") ? "Não foi possível carregar a IA de remoção de fundo. Verifique sua conexão." : msg, "error");
      onSettings({ ...settings, removeBg: false });
    } finally {
      if (!stale()) setProcessing(null);
    }
  };

  const setRemoveBg = (on: boolean) => {
    if (!image) return;
    if (!on) {
      runId.current++;
      setProcessing(null);
      onSettings({ ...settings, removeBg: false, crop: { ...settings.crop, zoom: coverZoom(image, settings.crop.rotation), x: 0, y: 0 } });
      return;
    }
    if (cutout && cutoutMode === settings.bgMode) {
      onSettings({ ...settings, removeBg: true, crop: { ...settings.crop, zoom: 1, x: 0, y: 0 } });
    } else {
      onSettings({ ...settings, removeBg: true });
      runRemoval(settings.bgMode);
    }
  };

  const setMode = (mode: BgRemovalMode) => {
    onSettings({ ...settings, bgMode: mode });
    if (settings.removeBg && cutoutMode !== mode) runRemoval(mode);
  };

  const inputs = (
    <>
      <HiddenFileInput ref={galleryRef} accept={IMAGE_ACCEPT} onFile={accept} />
      <HiddenFileInput ref={cameraRef} accept="image/*" capture="environment" onFile={accept} />
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(b) => onImage(b, "Foto da câmera.jpg")} />
    </>
  );

  if (!image) {
    return (
      <div>
        {inputs}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) accept(f);
          }}
          className={`flex flex-col items-center rounded-[32px] border-2 border-dashed p-8 text-center transition sm:p-12 ${
            dragOver ? "border-brand bg-brand/5" : "border-line bg-surface"
          }`}
        >
          <span className="flex size-20 items-center justify-center rounded-[28px] bg-brand/12 text-brand">
            <ImagePlus className="size-9" />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold tracking-tight">Adicione uma foto</h2>
          <p className="mt-1 max-w-xs text-sm text-muted">JPG, PNG ou WEBP de até 15 MB. Fotos de rosto ficam ótimas.</p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
            <Button size="lg" onClick={() => galleryRef.current?.click()} icon={<Upload className="size-5" />}>
              Galeria
            </Button>
            <Button size="lg" variant="secondary" onClick={openCamera} icon={<Camera className="size-5" />}>
              Câmera
            </Button>
          </div>
          <p className="mt-4 hidden text-xs text-muted sm:block">ou arraste uma imagem para cá</p>
        </div>
      </div>
    );
  }

  const source = settings.removeBg && cutout ? cutout : image;
  const transparent = settings.removeBg && !!cutout;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {inputs}
      <div className="relative">
        <CropEditor source={source} transparent={transparent} settings={settings} onCrop={(crop) => onSettings({ ...settings, crop })} />
        {processing && (
          <div className="absolute inset-x-0 top-0 mx-auto flex aspect-square w-full max-w-[420px] flex-col items-center justify-center gap-3 rounded-[28px] bg-black/55 text-white backdrop-blur-sm">
            <Spinner className="size-8" />
            <p className="text-sm font-medium">{processing === "ai" ? "A IA está removendo o fundo…" : "Removendo fundo…"}</p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <Toggle
          icon={<Wand2 className="size-5" />}
          label="Remover fundo"
          description="Processado no seu aparelho"
          checked={settings.removeBg}
          disabled={!!processing}
          onChange={setRemoveBg}
        />
        {settings.removeBg && (
          <div className="rounded-2xl bg-surface-2/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted">Tipo de foto</p>
            <Chips
              label="Tipo de remoção"
              value={settings.bgMode}
              onChange={setMode}
              options={[
                { id: "ai", label: "Pessoa (IA)" },
                { id: "solid", label: "Fundo liso" },
              ]}
            />
          </div>
        )}
        <Toggle
          icon={<Frame className="size-5" />}
          label="Borda branca"
          description="Contorno no estilo das figurinhas do WhatsApp"
          checked={settings.border}
          onChange={(border) => onSettings({ ...settings, border })}
        />
        {settings.border && (
          <div className="rounded-2xl bg-surface-2/40 px-3 py-2">
            <Slider
              label="Espessura"
              value={settings.borderWidth}
              min={4}
              max={28}
              step={1}
              onChange={(borderWidth) => onSettings({ ...settings, borderWidth })}
              format={(v) => `${v}px`}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="secondary" onClick={() => galleryRef.current?.click()} icon={<RefreshCw className="size-4" />}>
            Trocar foto
          </Button>
          <Button variant="danger" onClick={onRemoveImage} icon={<Trash2 className="size-4" />}>
            Remover
          </Button>
        </div>
        <Button variant="ghost" block onClick={openCamera} icon={<Camera className="size-4" />}>
          Tirar outra foto
        </Button>
      </div>
    </div>
  );
}
