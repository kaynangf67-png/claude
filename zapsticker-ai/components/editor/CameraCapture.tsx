"use client";

import { Camera, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** Câmera pelo navegador (usada no computador; no celular abrimos a câmera nativa). */
export function CameraCapture({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (b: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "Permita o acesso à câmera nas configurações do navegador para tirar a foto."
            : name === "NotFoundError"
              ? "Nenhuma câmera foi encontrada neste aparelho."
              : "Não foi possível abrir a câmera neste navegador. Use a opção Galeria.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const x = c.getContext("2d")!;
    if (facing === "user") {
      x.translate(c.width, 0);
      x.scale(-1, 1);
    }
    x.drawImage(v, 0, 0);
    c.toBlob((b) => b && (onCapture(b), onClose()), "image/jpeg", 0.92);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tirar foto">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        {error && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">{error}</p>}
      </div>
      <div className="mt-4 flex items-center justify-center gap-6">
        <Button variant="secondary" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} icon={<RefreshCw className="size-4" />} aria-label="Trocar câmera" />
        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label="Capturar"
          className="flex size-[72px] items-center justify-center rounded-full border-4 border-brand bg-white text-[#04230f] transition active:scale-90 disabled:opacity-40"
        >
          <Camera className="size-7" />
        </button>
        <span className="size-11" />
      </div>
    </Sheet>
  );
}
