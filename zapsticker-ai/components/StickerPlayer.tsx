"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawStickerFrame } from "@/lib/animation";
import { computeEnvelope, decodeAudio, envelopeAt, playBuffer, unlockAudio, type PlaybackHandle } from "@/lib/audio";
import type { AnimationStyle, VideoBackground } from "@/lib/types";

type Source = Blob | HTMLCanvasElement | null | undefined;

// Só um player toca por vez.
let stopCurrent: (() => void) | null = null;

export function StickerPlayer({
  sticker,
  audio,
  animation = "pulse",
  background = null,
  className = "",
  showControls = true,
  label = "Reproduzir figurinha",
  onEnded,
}: {
  sticker: Source;
  audio: Blob | AudioBuffer | null | undefined;
  animation?: AnimationStyle;
  background?: VideoBackground | null;
  className?: string;
  showControls?: boolean;
  label?: string;
  onEnded?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<CanvasImageSource | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const envRef = useRef<Float32Array | null>(null);
  const handleRef = useRef<PlaybackHandle | null>(null);
  const rafRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const draw = useCallback(
    (t: number, level: number, progress: number, isPlaying: boolean) => {
      const c = canvasRef.current;
      const img = imgRef.current;
      if (!c || !img) return;
      const x = c.getContext("2d");
      if (!x) return;
      drawStickerFrame(x, img, c.width, { t, level, animation, background, badge: !!audio, progress, playing: isPlaying });
    },
    [animation, background, audio],
  );

  // Carrega a imagem da figurinha
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setReady(false);
    if (!sticker) {
      imgRef.current = null;
      return;
    }
    if (sticker instanceof HTMLCanvasElement) {
      imgRef.current = sticker;
      setReady(true);
    } else {
      url = URL.createObjectURL(sticker);
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        setReady(true);
      };
      img.src = url;
    }
    return () => {
      cancelled = true;
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    };
  }, [sticker]);

  // Áudio mudou: descarta cache
  useEffect(() => {
    bufferRef.current = audio instanceof AudioBuffer ? audio : null;
    envRef.current = audio instanceof AudioBuffer ? computeEnvelope(audio) : null;
  }, [audio]);

  useEffect(() => {
    if (ready && !playing) draw(0, 0, 0, false);
  }, [ready, playing, draw]);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    if (stopCurrent === stopRef.current) stopCurrent = null;
  }, []);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => () => stopRef.current(), []);

  const play = useCallback(async () => {
    if (!audio || !ready) return;
    stopCurrent?.();
    await unlockAudio();
    if (!bufferRef.current && audio instanceof Blob) {
      setLoading(true);
      try {
        bufferRef.current = await decodeAudio(audio);
        envRef.current = computeEnvelope(bufferRef.current);
      } catch (e) {
        console.error(e);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    const buf = bufferRef.current!;
    const h = playBuffer(buf, {
      onEnded: () => {
        stopRef.current();
        onEnded?.();
      },
    });
    handleRef.current = h;
    stopCurrent = stopRef.current;
    setPlaying(true);
    const loop = () => {
      const t = h.elapsed;
      draw(t, envelopeAt(envRef.current, t), Math.min(1, t / buf.duration), true);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [audio, ready, draw, onEnded]);

  const toggle = () => (playing ? stop() : play());

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!audio}
      aria-label={playing ? "Pausar" : label}
      aria-pressed={playing}
      className={`group relative block aspect-square w-full select-none overflow-hidden rounded-[22%] disabled:cursor-default ${className}`}
    >
      <canvas ref={canvasRef} width={512} height={512} className="size-full" />
      {showControls && audio && (
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-black/45 text-white shadow-xl backdrop-blur-md transition group-active:scale-90 sm:size-16">
            {loading ? (
              <span className="size-5 animate-spin rounded-full border-2 border-white border-r-transparent" />
            ) : playing ? (
              <Pause className="size-6 fill-white" />
            ) : (
              <Play className="ml-1 size-6 fill-white" />
            )}
          </span>
        </span>
      )}
    </button>
  );
}
