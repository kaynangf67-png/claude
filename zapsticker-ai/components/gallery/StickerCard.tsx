"use client";

import { Check, Download, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/lib/limits";
import type { StickerRecord } from "@/lib/types";
import { StickerPlayer } from "../StickerPlayer";

export function StickerCard({
  rec,
  selecting,
  selected,
  onToggleSelect,
  onShare,
  onDownload,
  onDelete,
}: {
  rec: StickerRecord;
  selecting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onShare: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const date = new Date(rec.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <article
      className={`group relative flex flex-col rounded-[28px] border bg-surface p-3 transition ${selected ? "border-brand ring-2 ring-brand/40" : "border-line"}`}
    >
      <div className="checker relative overflow-hidden rounded-[22px]">
        <StickerPlayer sticker={rec.output.png} audio={rec.output.audio} animation={rec.animation} label={`Ouvir ${rec.name}`} />
        {selecting && (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-pressed={selected}
            aria-label={selected ? `Remover ${rec.name} do pacote` : `Adicionar ${rec.name} ao pacote`}
            className="absolute inset-0 flex items-start justify-end bg-black/10 p-3"
          >
            <span
              className={`flex size-7 items-center justify-center rounded-full border-2 ${selected ? "border-brand bg-brand text-[#04230f]" : "border-white bg-black/30"}`}
            >
              {selected && <Check className="size-4" strokeWidth={3} />}
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{rec.name}</h3>
          <p className="text-xs text-muted">
            {date} · 🔊 {formatDuration(rec.output.duration)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={onShare}
          aria-label={`Compartilhar ${rec.name} no WhatsApp`}
          title="Compartilhar"
          className="col-span-1 flex h-10 items-center justify-center rounded-xl bg-brand text-[#04230f] transition active:scale-90"
        >
          <Share2 className="size-[18px]" />
        </button>
        <Link
          href={`/criar?id=${encodeURIComponent(rec.id)}`}
          aria-label={`Editar ${rec.name}`}
          title="Editar"
          className="flex h-10 items-center justify-center rounded-xl bg-surface-2 transition active:scale-90"
        >
          <Pencil className="size-[18px]" />
        </Link>
        <button
          type="button"
          onClick={onDownload}
          aria-label={`Baixar ${rec.name}`}
          title="Baixar"
          className="flex h-10 items-center justify-center rounded-xl bg-surface-2 transition active:scale-90"
        >
          <Download className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir ${rec.name}`}
          title="Excluir"
          className="flex h-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition active:scale-90"
        >
          <Trash2 className="size-[18px]" />
        </button>
      </div>
    </article>
  );
}
