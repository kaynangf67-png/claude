"use client";

import { ArrowLeft, ArrowRight, Check, CloudCheck, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioBuffer, useImage } from "@/lib/hooks";
import { coverZoom } from "@/lib/image";
import { CLIP_MAX_SECONDS } from "@/lib/limits";
import { draftStore, historyStore, newId, requestPersistentStorage, stickerStore } from "@/lib/storage";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_SETTINGS,
  type EditorSource,
  type StickerOutput,
  type StickerRecord,
} from "@/lib/types";
import { Button, Spinner } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { AudioStep } from "./AudioStep";
import { GenerateStep } from "./GenerateStep";
import { PhotoStep } from "./PhotoStep";

type Step = 1 | 2 | 3;

const emptySource = (): EditorSource => ({
  imageSettings: structuredClone(DEFAULT_IMAGE_SETTINGS),
  audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
  animation: "pulse",
  videoBackground: "green",
  name: "Minha figurinha",
});

const STEPS = [
  { n: 1, label: "Foto" },
  { n: 2, label: "Áudio" },
  { n: 3, label: "Gerar" },
] as const;

export function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [src, setSrc] = useState<EditorSource>(emptySource);
  const [step, setStep] = useState<Step>(1);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [record, setRecord] = useState<StickerRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const pendingCover = useRef(false);

  const { image, error: imageError } = useImage(src.image);
  const { image: cutout } = useImage(src.cutout);
  const { buffer, loading: audioLoading, error: audioError } = useAudioBuffer(src.audio);

  const update = useCallback((patch: Partial<EditorSource>) => {
    setSrc((s) => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

  // ---------- Carregamento inicial: figurinha existente, novo ou rascunho ----------
  const id = params.get("id");
  const fresh = params.get("novo");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (id) {
          const rec = await stickerStore.get(id);
          if (!alive) return;
          if (rec) {
            const { output: _o, id: _i, createdAt: _c, updatedAt: _u, ...source } = rec;
            setSrc(source);
            setEditingId(rec.id);
            setRecord(rec);
            setDirty(false);
            setStep(1);
          } else toast("Figurinha não encontrada.", "error");
          router.replace("/criar");
        } else if (fresh) {
          await draftStore.clear();
          router.replace("/criar");
        } else {
          const d = await draftStore.get();
          if (!alive) return;
          if (d && (d.image || d.audio)) {
            const { editingId: eid, step: st, savedAt: _s, dirty: dd, ...source } = d;
            setSrc({ ...emptySource(), ...source });
            setStep(st);
            setEditingId(eid);
            setDirty(dd ?? true);
            if (eid) setRecord((await stickerStore.get(eid)) ?? null);
            toast("Rascunho restaurado. Continue de onde parou.", "info");
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Salvamento automático ----------
  const savedBlobs = useRef<{ image?: Blob; cutout?: Blob; audio?: Blob }>({});
  const firstSave = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (firstSave.current) {
      firstSave.current = false;
      savedBlobs.current = { image: src.image, cutout: src.cutout, audio: src.audio };
      return;
    }
    setSaved("saving");
    const t = setTimeout(async () => {
      try {
        const { image: img, cutout: cut, audio: aud, ...meta } = src;
        for (const [k, b] of [
          ["image", img],
          ["cutout", cut],
          ["audio", aud],
        ] as const) {
          if (savedBlobs.current[k] !== b) {
            await draftStore.putBlob(k, b);
            savedBlobs.current[k] = b;
          }
        }
        await draftStore.putMeta({ ...meta, editingId, step, dirty, savedAt: Date.now() });
        setSaved("saved");
      } catch (e) {
        console.warn("[autosave]", e);
        setSaved("idle");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [src, step, editingId, dirty, loaded]);

  // ---------- Ajustes que dependem dos arquivos carregados ----------
  useEffect(() => {
    if (imageError) {
      toast(imageError, "error");
      update({ image: undefined, cutout: undefined });
    }
  }, [imageError, toast, update]);

  useEffect(() => {
    if (image && pendingCover.current) {
      pendingCover.current = false;
      setSrc((s) => ({ ...s, imageSettings: { ...s.imageSettings, crop: { zoom: coverZoom(image, 0), x: 0, y: 0, rotation: 0 } } }));
    }
  }, [image]);

  useEffect(() => {
    if (audioError) update({ audio: undefined, audioName: undefined });
  }, [audioError, update]);

  useEffect(() => {
    if (buffer && src.audioSettings.trimEnd <= 0) {
      const end = Math.min(buffer.duration, CLIP_MAX_SECONDS);
      setSrc((s) => ({ ...s, audioSettings: { ...s.audioSettings, trimStart: 0, trimEnd: end } }));
      if (buffer.duration > CLIP_MAX_SECONDS) toast(`Selecionamos os primeiros ${CLIP_MAX_SECONDS}s. Arraste as alças para escolher o trecho.`, "info");
    }
  }, [buffer, src.audioSettings.trimEnd, toast]);

  // ---------- Ações ----------
  const reset = async () => {
    await draftStore.clear().catch(() => {});
    savedBlobs.current = {};
    setSrc(emptySource());
    setEditingId(undefined);
    setRecord(null);
    setDirty(false);
    setStep(1);
    setSaved("idle");
  };

  const save = async (output: StickerOutput): Promise<StickerRecord> => {
    const now = Date.now();
    const existing = editingId ? await stickerStore.get(editingId) : undefined;
    const rec: StickerRecord = {
      ...src,
      name: src.name.trim() || "Minha figurinha",
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      output,
    };
    await stickerStore.put(rec);
    await historyStore.add({ stickerId: rec.id, stickerName: rec.name, action: existing ? "updated" : "created" });
    requestPersistentStorage();
    setEditingId(rec.id);
    setRecord(rec);
    setDirty(false);
    return rec;
  };

  const goTo = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        <Spinner className="size-7" />
      </div>
    );
  }

  const clipOk = !!buffer && src.audioSettings.trimEnd - src.audioSettings.trimStart >= 0.3;
  const canGo = (s: Step) => (s === 1 ? true : s === 2 ? !!image : !!image && clipOk);
  const transparent = src.imageSettings.removeBg && !!cutout;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{editingId ? "Editar figurinha" : "Criar figurinha"}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            {saved === "saving" ? (
              <>
                <Spinner className="size-3" /> Salvando…
              </>
            ) : saved === "saved" ? (
              <>
                <CloudCheck className="size-3.5 text-brand" /> Rascunho salvo automaticamente
              </>
            ) : (
              "Foto → Áudio → Gerar → Compartilhar"
            )}
          </p>
        </div>
        {(src.image || src.audio) && (
          <Button variant="ghost" size="sm" onClick={reset} icon={<RotateCcw className="size-4" />}>
            Recomeçar
          </Button>
        )}
      </div>

      {/* Indicador de etapas */}
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Etapas">
        {STEPS.map((s) => {
          const done = step > s.n || (s.n === 1 && !!image && step !== 1) || (s.n === 2 && clipOk && step === 3);
          const current = step === s.n;
          return (
            <li key={s.n}>
              <button
                type="button"
                disabled={!canGo(s.n)}
                onClick={() => goTo(s.n)}
                aria-current={current ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-2xl border p-2 pr-3 text-left text-sm font-semibold transition disabled:opacity-40 ${
                  current ? "border-brand bg-brand/10 text-fg" : "border-line bg-surface text-muted"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                    current || done ? "bg-brand text-[#04230f]" : "bg-surface-2"
                  }`}
                >
                  {done && !current ? <Check className="size-4" strokeWidth={3} /> : s.n}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div key={step} className="animate-fade-up">
        {step === 1 && (
          <PhotoStep
            image={image}
            cutout={cutout}
            cutoutMode={src.cutoutMode}
            settings={src.imageSettings}
            onImage={(blob, name) => {
              pendingCover.current = true;
              update({
                image: blob,
                imageName: name,
                cutout: undefined,
                cutoutMode: undefined,
                imageSettings: { ...src.imageSettings, removeBg: false, crop: { zoom: 1, x: 0, y: 0, rotation: 0 } },
              });
            }}
            onRemoveImage={() => update({ image: undefined, cutout: undefined, cutoutMode: undefined, imageName: undefined })}
            onSettings={(imageSettings) => update({ imageSettings })}
            onCutout={(blob, mode, crop) => {
              setSrc((s) => ({ ...s, cutout: blob, cutoutMode: mode, imageSettings: { ...s.imageSettings, removeBg: true, bgMode: mode, crop } }));
              setDirty(true);
            }}
          />
        )}
        {step === 2 && (
          <AudioStep
            audio={src.audio}
            audioName={src.audioName}
            buffer={buffer}
            loading={audioLoading}
            error={audioError}
            settings={src.audioSettings}
            onAudio={(blob, name) => update({ audio: blob, audioName: name, audioSettings: { ...src.audioSettings, trimStart: 0, trimEnd: 0 } })}
            onRemove={() => update({ audio: undefined, audioName: undefined, audioSettings: { ...src.audioSettings, trimStart: 0, trimEnd: 0 } })}
            onSettings={(audioSettings) => update({ audioSettings })}
          />
        )}
        {step === 3 && image && buffer && (
          <GenerateStep
            source={transparent ? cutout! : image}
            transparent={transparent}
            imageSettings={src.imageSettings}
            audio={buffer}
            audioSettings={src.audioSettings}
            animation={src.animation}
            background={src.videoBackground}
            name={src.name}
            record={record}
            dirty={dirty}
            onChange={(p) => update(p)}
            onSave={save}
          />
        )}
      </div>

      {/* Navegação entre etapas */}
      {step < 3 && (
        <div className="glass sticky bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 -mx-4 mt-8 flex gap-3 border-t border-line px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none md:bottom-0">
          {step > 1 && (
            <Button variant="secondary" size="lg" onClick={() => goTo((step - 1) as Step)} icon={<ArrowLeft className="size-5" />} aria-label="Voltar" />
          )}
          <Button size="lg" className="flex-1 sm:ml-auto sm:flex-none" disabled={!canGo((step + 1) as Step)} onClick={() => goTo((step + 1) as Step)}>
            {step === 1 ? "Próximo: áudio" : "Próximo: gerar"} <ArrowRight className="size-5" />
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="mt-8">
          <Button variant="ghost" onClick={() => goTo(2)} icon={<ArrowLeft className="size-4" />}>
            Voltar ao áudio
          </Button>
        </div>
      )}
    </div>
  );
}
