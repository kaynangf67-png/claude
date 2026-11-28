"use client";

import { CircleCheck, Images, RotateCcw, Share2, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ANIMATIONS, BACKGROUNDS } from "@/lib/animation";
import { processAudio } from "@/lib/audio";
import { generateSticker } from "@/lib/generate";
import { useObjectUrl } from "@/lib/hooks";
import { renderSticker, type Drawable } from "@/lib/image";
import { formatBytes, formatDuration } from "@/lib/limits";
import type { AnimationStyle, AudioSettings, ImageSettings, StickerOutput, StickerRecord, VideoBackground } from "@/lib/types";
import { ShareSheet } from "../ShareSheet";
import { StickerPlayer } from "../StickerPlayer";
import { Button } from "../ui/Button";
import { Chips } from "../ui/Toggle";
import { useToast } from "../ui/Toast";

export function GenerateStep({
  source,
  transparent,
  imageSettings,
  audio,
  audioSettings,
  animation,
  background,
  name,
  record,
  dirty,
  onChange,
  onSave,
}: {
  source: Drawable;
  transparent: boolean;
  imageSettings: ImageSettings;
  audio: AudioBuffer;
  audioSettings: AudioSettings;
  animation: AnimationStyle;
  background: VideoBackground;
  name: string;
  record: StickerRecord | null;
  dirty: boolean;
  onChange: (p: { animation?: AnimationStyle; videoBackground?: VideoBackground; name?: string }) => void;
  onSave: (o: StickerOutput) => Promise<StickerRecord>;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<{ canvas: HTMLCanvasElement; audio: AudioBuffer } | null>(null);
  const [progress, setProgress] = useState<{ p: number; label: string } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [tab, setTab] = useState<"video" | "sticker">("video");
  const resultRef = useRef<HTMLDivElement>(null);
  const videoUrl = useObjectUrl(record?.output.video);
  const webpUrl = useObjectUrl(record?.output.sticker);

  // Prévia ao vivo (mesma renderização do arquivo final)
  useEffect(() => {
    let alive = true;
    const canvas = renderSticker(source, imageSettings, { transparent });
    processAudio(audio, audioSettings).then((a) => alive && setPreview({ canvas, audio: a }));
    return () => {
      alive = false;
    };
  }, [source, imageSettings, transparent, audio, audioSettings]);

  const generate = async () => {
    setVideoError(null);
    setProgress({ p: 0, label: "Preparando…" });
    try {
      const res = await generateSticker({
        source,
        transparent,
        imageSettings,
        audio,
        audioSettings,
        animation,
        background,
        onProgress: (p, label) => setProgress({ p, label }),
      });
      if (res.videoError) setVideoError(res.videoError);
      await onSave(res.output);
      setTab(res.output.video ? "video" : "sticker");
      toast("Figurinha criada e salva em Minhas figurinhas!", "success");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : "Erro ao gerar a figurinha.", "error");
    } finally {
      setProgress(null);
    }
  };

  const generating = progress !== null;
  const hasResult = !!record && !dirty;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="mx-auto w-full max-w-[380px]">
          <div
            className="relative overflow-hidden rounded-[32px] border border-line p-6"
            style={{ background: BACKGROUNDS.find((b) => b.id === background)?.css }}
          >
            {preview ? (
              <StickerPlayer sticker={preview.canvas} audio={preview.audio} animation={animation} label="Testar reprodução" />
            ) : (
              <div className="aspect-square animate-pulse rounded-[22%] bg-white/10" />
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Prévia · toque para testar · {preview ? formatDuration(preview.audio.duration) : "…"}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Nome da figurinha</span>
          <input
            value={name}
            maxLength={60}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex.: Bom dia do vovô"
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none transition focus:border-brand"
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold">Animação</p>
          <Chips label="Animação" value={animation} options={ANIMATIONS} onChange={(a) => onChange({ animation: a })} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Fundo do vídeo</p>
          <Chips
            label="Fundo do vídeo"
            value={background}
            options={BACKGROUNDS.map((b) => ({ id: b.id, label: b.label, swatch: b.css }))}
            onChange={(b) => onChange({ videoBackground: b })}
          />
        </div>

        {generating ? (
          <div className="rounded-2xl border border-line bg-surface p-4" role="status" aria-live="polite">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">{progress.label}</span>
              <span className="tabular-nums text-muted">{Math.round(progress.p * 100)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progress.p * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">O vídeo é gravado em tempo real, então leva o tempo do áudio. Não feche a página.</p>
          </div>
        ) : hasResult ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="col-span-2" onClick={() => setShareOpen(true)}>
              Adicionar ao WhatsApp
            </Button>
            <Button variant="secondary" onClick={generate} icon={<RotateCcw className="size-4" />}>
              Gerar novamente
            </Button>
            <Link
              href="/minhas-figurinhas"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 text-[15px] font-semibold transition active:scale-[0.97]"
            >
              <Images className="size-4" /> Minhas
            </Link>
          </div>
        ) : (
          <>
            {record && dirty && (
              <p className="flex items-center gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-4 shrink-0" /> Você alterou a figurinha. Gere de novo para atualizar os arquivos.
              </p>
            )}
            <Button size="lg" block onClick={generate} disabled={!preview} icon={<Sparkles className="size-5" />}>
              {record ? "Gerar novamente" : "Gerar figurinha"}
            </Button>
          </>
        )}
        {videoError && (
          <p className="flex gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {videoError}
          </p>
        )}
      </div>

      {hasResult && (
        <div ref={resultRef} className="scroll-mt-24 lg:col-span-2">
          <div className="animate-fade-up rounded-[32px] border border-brand/40 bg-surface p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <CircleCheck className="size-6 text-brand" />
              <h3 className="font-display text-lg font-bold">Arquivos prontos</h3>
            </div>
            <div className="mb-4 inline-flex rounded-full bg-surface-2 p-1 text-sm font-medium">
              {record.output.video && (
                <button type="button" onClick={() => setTab("video")} className={`rounded-full px-4 py-1.5 ${tab === "video" ? "bg-surface shadow" : "text-muted"}`}>
                  Figurinha falante
                </button>
              )}
              <button type="button" onClick={() => setTab("sticker")} className={`rounded-full px-4 py-1.5 ${tab === "sticker" ? "bg-surface shadow" : "text-muted"}`}>
                Figurinha WebP
              </button>
            </div>
            <div className="grid items-center gap-5 sm:grid-cols-[260px_1fr]">
              <div className="checker mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl">
                {tab === "video" && videoUrl ? (
                  <video src={videoUrl} controls playsInline className="size-full object-cover" />
                ) : webpUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={webpUrl} alt={`Figurinha ${record.name}`} className="size-full object-contain" />
                ) : null}
              </div>
              <ul className="space-y-2 text-sm">
                {record.output.video && (
                  <li className="flex justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2">
                    <span>🎬 Vídeo com som ({(record.output.videoMime ?? "").includes("mp4") ? "MP4" : "WEBM"})</span>
                    <span className="text-muted">{formatBytes(record.output.video.size)}</span>
                  </li>
                )}
                <li className="flex justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2">
                  <span>🟢 Figurinha WebP 512×512</span>
                  <span className="text-muted">{formatBytes(record.output.sticker.size)}</span>
                </li>
                <li className="flex justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2">
                  <span>🔊 Áudio WAV · {formatDuration(record.output.duration)}</span>
                  <span className="text-muted">{formatBytes(record.output.audio.size)}</span>
                </li>
                <li className="pt-2">
                  <Button block onClick={() => setShareOpen(true)} icon={<Share2 className="size-4" />}>
                    Compartilhar no WhatsApp
                  </Button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <ShareSheet record={record} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
