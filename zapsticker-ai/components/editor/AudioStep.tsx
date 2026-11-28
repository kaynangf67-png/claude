"use client";

import { FileAudio, Mic, Pause, Play, RefreshCw, Scissors, Trash2, Upload, Volume1, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playBuffer, unlockAudio, type PlaybackHandle } from "@/lib/audio";
import { CLIP_MAX_SECONDS, clampTrim, formatBytes, formatDuration, validateAudioFile } from "@/lib/limits";
import type { AudioSettings } from "@/lib/types";
import { Button, Spinner } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { useToast } from "../ui/Toast";
import { AudioRecorder } from "./AudioRecorder";
import { AUDIO_ACCEPT, HiddenFileInput } from "./FilePickers";
import { Waveform } from "./Waveform";

export function AudioStep({
  audio,
  audioName,
  buffer,
  loading,
  error,
  settings,
  onAudio,
  onRemove,
  onSettings,
}: {
  audio?: Blob;
  audioName?: string;
  buffer: AudioBuffer | null;
  loading: boolean;
  error: string | null;
  settings: AudioSettings;
  onAudio: (b: Blob, name: string) => void;
  onRemove: () => void;
  onSettings: (s: AudioSettings) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choose" | "record">("choose");
  const [playhead, setPlayhead] = useState<number | null>(null);
  const handleRef = useRef<PlaybackHandle | null>(null);
  const rafRef = useRef(0);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setPlayhead(null);
  };
  useEffect(() => stop, []);
  // Recomeça se o trecho ou o áudio mudar
  useEffect(() => stop(), [buffer, settings.trimStart, settings.trimEnd]);

  useEffect(() => {
    if (error) toast(error, "error");
  }, [error, toast]);

  const accept = (f: File) => {
    const err = validateAudioFile(f);
    if (err) return toast(err, "error");
    setMode("choose");
    onAudio(f, f.name);
  };

  const play = async () => {
    if (!buffer) return;
    if (handleRef.current) return stop();
    await unlockAudio();
    const dur = settings.trimEnd - settings.trimStart;
    const h = playBuffer(buffer, { offset: settings.trimStart, duration: dur, volume: settings.volume, onEnded: stop });
    handleRef.current = h;
    const loop = () => {
      setPlayhead(settings.trimStart + Math.min(dur, h.elapsed));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const picker = <HiddenFileInput ref={fileRef} accept={AUDIO_ACCEPT} onFile={accept} />;

  if (!audio || (!buffer && !loading)) {
    return (
      <div className="mx-auto max-w-xl">
        {picker}
        {mode === "record" ? (
          <AudioRecorder
            onRecorded={(b, name) => {
              setMode("choose");
              onAudio(b, name);
            }}
            onCancel={() => setMode("choose")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("record")}
              className="group flex flex-col items-center rounded-[28px] border border-line bg-surface p-7 text-center transition hover:border-brand/50 active:scale-[0.98]"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-brand text-[#04230f] shadow-[0_10px_30px_-8px_rgba(37,211,102,0.7)] transition group-hover:scale-105">
                <Mic className="size-7" />
              </span>
              <span className="mt-4 text-lg font-bold">Gravar áudio</span>
              <span className="mt-1 text-sm text-muted">Use o microfone (até {CLIP_MAX_SECONDS}s)</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group flex flex-col items-center rounded-[28px] border border-line bg-surface p-7 text-center transition hover:border-brand/50 active:scale-[0.98]"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-brand transition group-hover:scale-105">
                <Upload className="size-7" />
              </span>
              <span className="mt-4 text-lg font-bold">Enviar arquivo</span>
              <span className="mt-1 text-sm text-muted">MP3, WAV, M4A, AAC, OGG · até 20 MB</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!buffer) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted">
        <Spinner className="size-7" />
        Lendo o áudio…
      </div>
    );
  }

  const clipLen = settings.trimEnd - settings.trimStart;
  const playing = playhead !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {picker}
      <div className="rounded-[28px] border border-line bg-surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/12 text-brand">
            <FileAudio className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{audioName || "Áudio"}</p>
            <p className="text-xs text-muted">
              Duração total {formatDuration(buffer.duration)} · {formatBytes(audio.size)}
            </p>
          </div>
        </div>

        <Waveform
          buffer={buffer}
          start={settings.trimStart}
          end={settings.trimEnd}
          playhead={playhead}
          onChange={(s, e) => {
            const t = clampTrim(s, e, buffer.duration);
            onSettings({ ...settings, trimStart: t.start, trimEnd: t.end });
          }}
        />

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={play}
            aria-label={playing ? "Pausar" : "Ouvir trecho"}
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-[#04230f] shadow-lg transition active:scale-90"
          >
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
          </button>
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Scissors className="size-4 text-brand" /> Trecho de {formatDuration(clipLen)}
            </p>
            <p className="text-xs tabular-nums text-muted">
              {formatDuration(playhead ?? settings.trimStart)} · de {formatDuration(settings.trimStart)} até {formatDuration(settings.trimEnd)}
            </p>
          </div>
          {(settings.trimStart > 0 || settings.trimEnd < Math.min(buffer.duration, CLIP_MAX_SECONDS) - 0.01) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSettings({ ...settings, trimStart: 0, trimEnd: Math.min(buffer.duration, CLIP_MAX_SECONDS) })}
            >
              Restaurar
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">Arraste as alças verdes para cortar. O trecho pode ter até {CLIP_MAX_SECONDS} segundos.</p>
      </div>

      <div className="rounded-[28px] border border-line bg-surface p-4 sm:p-5">
        <Slider
          label="Volume"
          icon={settings.volume > 1 ? <Volume2 className="size-4 text-muted" /> : <Volume1 className="size-4 text-muted" />}
          value={settings.volume}
          min={0}
          max={2}
          step={0.05}
          onChange={(volume) => onSettings({ ...settings, volume })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        {settings.volume > 1.5 && <p className="mt-1 text-xs text-amber-500">Volume alto pode distorcer o som.</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} icon={<RefreshCw className="size-4" />}>
          Arquivo
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            stop();
            onRemove();
            setMode("record");
          }}
          icon={<Mic className="size-4" />}
        >
          Regravar
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            stop();
            onRemove();
          }}
          icon={<Trash2 className="size-4" />}
        >
          Excluir
        </Button>
      </div>
    </div>
  );
}
