"use client";

import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { extensionForMime, getAudioContext, pickRecorderMime, unlockAudio } from "@/lib/audio";
import { RECORD_MAX_SECONDS, formatDuration } from "@/lib/limits";
import { useToast } from "../ui/Toast";

/** Gravador de voz pelo microfone, com medidor de nível e limite de tempo. */
export function AudioRecorder({ onRecorded, onCancel }: { onRecorded: (b: Blob, name: string) => void; onCancel?: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "starting" | "recording">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array(28).fill(0.05));
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const rafRef = useRef(0);
  const cancelledRef = useRef(false);

  const cleanup = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => {
    cancelledRef.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    cleanup();
  }, []);

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast("Seu navegador não permite gravar áudio. Envie um arquivo de áudio.", "error");
      return;
    }
    setState("starting");
    cancelledRef.current = false;
    try {
      await unlockAudio();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickRecorderMime("audio");
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
      recRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cleanup();
        setState("idle");
        if (cancelledRef.current) return;
        const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
        const blob = new Blob(chunks, { type });
        if (blob.size < 500) return toast("A gravação ficou vazia. Tente de novo.", "error");
        const d = new Date();
        const stamp = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        onRecorded(blob, `Gravação ${stamp}.${extensionForMime(type)}`);
      };

      // Medidor de nível
      const ac = getAudioContext();
      const srcNode = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
        setLevels((l) => [...l.slice(1), Math.max(0.05, rms)]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      rec.start(200);
      const t0 = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setElapsed(s);
        if (s >= RECORD_MAX_SECONDS) stop();
      }, 100);
      setState("recording");
    } catch (e) {
      cleanup();
      setState("idle");
      const name = (e as DOMException)?.name;
      toast(
        name === "NotAllowedError"
          ? "Permita o uso do microfone nas configurações do navegador para gravar."
          : name === "NotFoundError"
            ? "Nenhum microfone encontrado neste aparelho."
            : "Não foi possível iniciar a gravação.",
        "error",
      );
    }
  };

  const stop = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  };
  const cancel = () => {
    cancelledRef.current = true;
    stop();
    cleanup();
    setState("idle");
    onCancel?.();
  };

  const recording = state === "recording";
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-surface p-6 text-center">
      <div className="flex h-16 w-full max-w-xs items-center justify-center gap-[3px]" aria-hidden>
        {levels.map((l, i) => (
          <span
            key={i}
            className={`w-[5px] rounded-full transition-[height] duration-75 ${recording ? "bg-red-500" : "bg-line"}`}
            style={{ height: `${Math.round(8 + l * 56)}px` }}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums" aria-live="polite">
        {formatDuration(elapsed)}
        <span className="ml-2 text-sm text-muted">/ {RECORD_MAX_SECONDS}s</span>
      </p>
      <div className="mt-5 flex items-center gap-5">
        {onCancel && (
          <button type="button" onClick={cancel} aria-label="Cancelar" className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
            <X className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={state === "starting"}
          aria-label={recording ? "Parar gravação" : "Começar a gravar"}
          className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-xl transition active:scale-90 ${
            recording ? "bg-red-500" : "bg-brand text-[#04230f]"
          }`}
        >
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
          {recording ? <Square className="relative size-7 fill-white" /> : <Mic className="size-8" />}
        </button>
        {onCancel && <span className="size-12" />}
      </div>
      <p className="mt-4 text-sm text-muted">{recording ? "Gravando… toque para parar" : state === "starting" ? "Abrindo o microfone…" : "Toque para gravar sua voz"}</p>
    </div>
  );
}
