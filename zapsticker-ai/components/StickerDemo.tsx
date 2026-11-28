"use client";

import { useEffect, useState } from "react";
import { createCanvas, ctx2d, renderSticker } from "@/lib/image";
import { DEFAULT_IMAGE_SETTINGS } from "@/lib/types";
import { StickerPlayer } from "./StickerPlayer";

/** Gera um "oi!" sintetizado (Web Audio) para a demonstração. */
async function synthDemoAudio(): Promise<AudioBuffer> {
  const rate = 44100;
  const dur = 1.9;
  const Off = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Off(1, Math.ceil(rate * dur), rate);
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const notes: [number, number, number][] = [
    [0.0, 523.25, 0.18],
    [0.2, 659.25, 0.18],
    [0.4, 783.99, 0.18],
    [0.62, 1046.5, 0.5],
    [1.2, 880, 0.12],
    [1.36, 1046.5, 0.4],
  ];
  for (const [t, f, d] of notes) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(f * 0.92, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f * 0.012;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(master);
    o.start(t);
    lfo.start(t);
    o.stop(t + d + 0.05);
    lfo.stop(t + d + 0.05);
  }
  return ctx.startRendering();
}

function drawDemoArt(): HTMLCanvasElement {
  const c = createCanvas(600, 600);
  const x = ctx2d(c);
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = '440px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  x.fillText("😎", 300, 330);
  return c;
}

export function StickerDemo() {
  const [sticker, setSticker] = useState<HTMLCanvasElement | null>(null);
  const [audio, setAudio] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    const art = drawDemoArt();
    setSticker(renderSticker(art, { ...DEFAULT_IMAGE_SETTINGS, borderWidth: 16 }, { transparent: true }));
    synthDemoAudio().then(setAudio).catch(() => setAudio(null));
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute -inset-10 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      {/* Moldura de conversa do WhatsApp */}
      <div className="relative overflow-hidden rounded-[36px] border border-line bg-[#0b141a] p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-3 border-b border-white/5 pb-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand/20 text-lg">🙂</div>
          <div>
            <p className="text-sm font-semibold text-white">Amigos</p>
            <p className="text-[11px] text-white/50">online</p>
          </div>
        </div>
        <div className="mb-3 max-w-[75%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-[13px] text-white/90">
          Manda aquela figurinha! 😂
        </div>
        <div className="ml-auto w-[78%] animate-float">
          {sticker ? (
            <StickerPlayer sticker={sticker} audio={audio} animation="bounce" label="Ouvir a figurinha de demonstração" />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-[22%] bg-white/5" />
          )}
        </div>
        <p className="mt-2 text-right text-[11px] text-white/40">toque para ouvir 🔊</p>
      </div>
    </div>
  );
}
