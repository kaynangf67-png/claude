"use client";

import { Copy, Download, FileAudio, Image as ImageIcon, MessageCircle, Share2, Smartphone, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { formatBytes } from "@/lib/limits";
import { canShareFiles, copyImageToClipboard, downloadBlob, isIOS, isMobile, openWhatsAppText, shareFiles, stickerFiles } from "@/lib/share";
import { historyStore } from "@/lib/storage";
import type { StickerRecord } from "@/lib/types";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";

type IconType = React.ComponentType<{ className?: string }>;

function WhatsAppIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .53 3.96 1.52 5.69L.55 23.6l6.03-1.58a11.36 11.36 0 0 0 5.45 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z" />
    </svg>
  );
}

/** "Adicionar ao WhatsApp": compartilhamento real pelos recursos do aparelho. */
export function ShareSheet({
  record,
  open,
  onClose,
  mode = "share",
}: {
  record: StickerRecord | null;
  open: boolean;
  onClose: () => void;
  mode?: "share" | "download";
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const files = useMemo(() => (record ? stickerFiles(record) : null), [record]);
  const mobile = typeof window !== "undefined" && isMobile();
  const ios = typeof window !== "undefined" && isIOS();

  if (!record || !files) return null;

  const log = (action: "shared" | "downloaded", detail: string) =>
    historyStore.add({ stickerId: record.id, stickerName: record.name, action, detail });

  const share = async (key: string, list: File[], detail: string) => {
    setBusy(key);
    const r = await shareFiles(list, "Feita no ZapSticker AI 🔊");
    setBusy(null);
    if (r === "shared") {
      toast("Enviado! Escolha o WhatsApp na lista do seu celular.", "success");
      log("shared", detail);
    } else if (r === "unsupported") {
      list.forEach((f, i) => setTimeout(() => downloadBlob(f, f.name), i * 400));
      log("downloaded", detail);
      toast(
        mobile
          ? "Seu navegador não abriu o compartilhamento. Baixamos os arquivos: envie pelo WhatsApp usando o clipe 📎."
          : "Arquivos baixados. No WhatsApp Web ou Desktop, arraste-os para a conversa.",
        "info",
      );
    }
  };

  const dl = (f: File, detail: string) => {
    downloadBlob(f, f.name);
    log("downloaded", detail);
    toast(`Baixando ${f.name}`, "success");
  };

  const copy = async () => {
    const ok = await copyImageToClipboard(record.output.png);
    toast(ok ? "Figurinha copiada! Cole na conversa do WhatsApp Web ou Desktop." : "Seu navegador não permite copiar imagens. Use Baixar.", ok ? "success" : "error");
  };

  const shareables = [
    files.video && {
      key: "video",
      icon: Video,
      title: "Figurinha falante (com som)",
      text: "Vídeo com animação e áudio — toca o som no WhatsApp",
      files: [files.video],
      primary: true,
    },
    {
      key: "sticker",
      icon: WhatsAppIcon,
      title: "Figurinha WebP",
      text: ios ? "Formato oficial 512×512 (sem som)" : "Formato oficial 512×512 (sem som). Pode chegar como figurinha ou imagem, conforme a versão do app",
      files: [files.sticker],
    },
    {
      key: "combo",
      icon: Share2,
      title: "Foto + áudio juntos",
      text: "Envia a imagem e o áudio na mesma mensagem",
      files: [files.png, files.audio],
    },
  ].filter(Boolean) as { key: string; icon: IconType; title: string; text: string; files: File[]; primary?: boolean }[];

  const shareSupported = canShareFiles([files.png]);

  return (
    <Sheet open={open} onClose={onClose} title={mode === "share" ? "Adicionar ao WhatsApp" : "Baixar figurinha"}>
      {mode === "share" && (
        <>
          {!shareSupported && (
            <div className="mb-4 flex gap-3 rounded-2xl bg-sky-500/10 p-3 text-sm text-sky-600 dark:text-sky-300">
              <Smartphone className="mt-0.5 size-5 shrink-0" />
              <p>
                {mobile
                  ? "Seu navegador não suporta o menu de compartilhar arquivos. Os botões abaixo vão baixar os arquivos para você enviar pelo WhatsApp."
                  : "No computador, os arquivos serão baixados. Depois é só arrastar para a conversa no WhatsApp Web ou Desktop."}
              </p>
            </div>
          )}
          <div className="space-y-2">
            {shareables.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!!busy}
                onClick={() => share(s.key, s.files, s.title)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition active:scale-[0.98] disabled:opacity-60 ${
                  s.primary ? "bg-brand text-[#04230f]" : "bg-surface-2 hover:brightness-110"
                }`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.primary ? "bg-black/10" : "bg-surface text-brand"}`}>
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className={`block text-xs ${s.primary ? "text-[#04230f]/75" : "text-muted"}`}>{s.text}</span>
                </span>
                {busy === s.key ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                ) : (
                  <Share2 className="size-4 opacity-70" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold transition active:scale-95">
              <Copy className="size-4" /> Copiar figurinha
            </button>
            <button
              type="button"
              onClick={() => openWhatsAppText("Olha a figurinha que eu fiz no ZapSticker AI! 🔊")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-semibold transition active:scale-95"
            >
              <MessageCircle className="size-4" /> Abrir WhatsApp
            </button>
          </div>
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Baixar arquivos</h3>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {files.video && (
          <DownloadTile icon={Video} label="Vídeo com som" meta={`${(record.output.videoMime ?? "").includes("mp4") ? "MP4" : "WEBM"} · ${formatBytes(files.video.size)}`} onClick={() => dl(files.video!, "Vídeo")} />
        )}
        <DownloadTile icon={WhatsAppIcon} label="Figurinha" meta={`WEBP · ${formatBytes(files.sticker.size)}`} onClick={() => dl(files.sticker, "WebP")} />
        <DownloadTile icon={ImageIcon} label="Imagem" meta={`PNG · ${formatBytes(files.png.size)}`} onClick={() => dl(files.png, "PNG")} />
        <DownloadTile icon={FileAudio} label="Áudio" meta={`WAV · ${formatBytes(files.audio.size)}`} onClick={() => dl(files.audio, "Áudio")} />
      </div>

      <details className="mt-5 rounded-2xl bg-surface-2/50 p-3 text-sm text-muted">
        <summary className="cursor-pointer font-semibold text-fg">Como salvar na minha coleção de figurinhas?</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>O WhatsApp não aceita som em figurinhas. Para mandar com áudio, use a <strong>Figurinha falante</strong>.</li>
          <li>
            Para a figurinha sem som: salve a imagem PNG, abra o WhatsApp, vá em <strong>Figurinhas → Criar figurinha</strong> e escolha a imagem
            (disponível nas versões recentes do app).
          </li>
          <li>Recebeu como figurinha? Toque nela e escolha <strong>Adicionar aos favoritos</strong>.</li>
          <li>
            Com 3 ou mais figurinhas, crie um <strong>pacote .wastickers</strong> em “Minhas figurinhas” e importe com um app de pacotes no Android.
          </li>
        </ul>
      </details>
    </Sheet>
  );
}

function DownloadTile({ icon: Icon, label, meta, onClick }: { icon: IconType; label: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:bg-surface-2 active:scale-95">
      <Icon className="size-5 shrink-0 text-brand" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-[11px] text-muted">{meta}</span>
      </span>
      <Download className="size-4 text-muted" />
    </button>
  );
}
