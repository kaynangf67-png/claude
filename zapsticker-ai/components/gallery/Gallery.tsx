"use client";

import { Clock, Download, Images, Package, Pencil, Plus, Share2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PACK_MAX, PACK_MIN, formatBytes } from "@/lib/limits";
import { exportPack } from "@/lib/packExport";
import { slugify } from "@/lib/pack";
import { canShareFiles, downloadBlob, shareFiles } from "@/lib/share";
import { historyStore, stickerStore, subscribe } from "@/lib/storage";
import type { HistoryAction, HistoryEntry, StickerRecord } from "@/lib/types";
import { ShareSheet } from "../ShareSheet";
import { Button, Spinner } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { StickerCard } from "./StickerCard";

const ACTION: Record<HistoryAction, { label: string; icon: typeof Plus; color: string }> = {
  created: { label: "Criada", icon: Sparkles, color: "text-brand" },
  updated: { label: "Editada", icon: Pencil, color: "text-sky-500" },
  shared: { label: "Compartilhada", icon: Share2, color: "text-brand" },
  downloaded: { label: "Baixada", icon: Download, color: "text-violet-500" },
  deleted: { label: "Excluída", icon: Trash2, color: "text-red-500" },
  exported: { label: "Pacote exportado", icon: Package, color: "text-amber-500" },
};

function relative(at: number) {
  const diff = (Date.now() - at) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Gallery() {
  const toast = useToast();
  const [items, setItems] = useState<StickerRecord[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<"stickers" | "history">("stickers");
  const [shareRec, setShareRec] = useState<{ rec: StickerRecord; mode: "share" | "download" } | null>(null);
  const [deleting, setDeleting] = useState<StickerRecord | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [packOpen, setPackOpen] = useState(false);
  const [packName, setPackName] = useState("Minhas figurinhas com som");
  const [packAuthor, setPackAuthor] = useState("ZapSticker AI");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([stickerStore.list(), historyStore.list()]);
      setItems(s);
      setHistory(h);
    } catch (e) {
      console.error(e);
      setItems([]);
      toast("Não foi possível abrir o armazenamento local do navegador.", "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
    const unsub = subscribe(load);
    return () => {
      unsub();
    };
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    await stickerStore.remove(deleting.id);
    await historyStore.add({ stickerId: deleting.id, stickerName: deleting.name, action: "deleted" });
    setSelected((s) => s.filter((x) => x !== deleting.id));
    toast("Figurinha excluída.", "success");
    setDeleting(null);
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= PACK_MAX ? s : [...s, id]));

  const doExport = async () => {
    if (!items) return;
    setExporting(true);
    try {
      const recs = selected.map((id) => items.find((i) => i.id === id)!).filter(Boolean);
      const blob = await exportPack(recs, packName, packAuthor);
      const file = new File([blob], `${slugify(packName)}.wastickers`, { type: "application/zip" });
      const r = canShareFiles([file]) ? await shareFiles([file]) : "unsupported";
      if (r === "unsupported") downloadBlob(file, file.name);
      if (r !== "cancelled") {
        await historyStore.add({ stickerId: "pack", stickerName: packName, action: "exported", detail: `${recs.length} figurinhas · ${formatBytes(blob.size)}` });
        toast(`Pacote com ${recs.length} figurinhas pronto (${formatBytes(blob.size)}).`, "success");
      }
      setPackOpen(false);
      setSelecting(false);
      setSelected([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar o pacote.", "error");
    } finally {
      setExporting(false);
    }
  };

  if (items === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Minhas figurinhas</h1>
          <p className="text-sm text-muted">
            {items.length} {items.length === 1 ? "figurinha salva" : "figurinhas salvas"} neste aparelho
          </p>
        </div>
        <Link
          href="/criar?novo=1"
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-[15px] font-semibold text-[#04230f] transition active:scale-95"
        >
          <Plus className="size-5" /> Nova
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-surface-2 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("stickers")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${tab === "stickers" ? "bg-surface shadow" : "text-muted"}`}
          >
            <Images className="size-4" /> Figurinhas
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${tab === "history" ? "bg-surface shadow" : "text-muted"}`}
          >
            <Clock className="size-4" /> Histórico
          </button>
        </div>
        {tab === "stickers" && items.length > 0 && (
          <Button
            variant={selecting ? "secondary" : "outline"}
            size="sm"
            className="ml-auto"
            onClick={() => {
              setSelecting((s) => !s);
              setSelected([]);
            }}
            icon={selecting ? <X className="size-4" /> : <Package className="size-4" />}
          >
            {selecting ? "Cancelar" : "Criar pacote"}
          </Button>
        )}
      </div>

      {tab === "stickers" ? (
        items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[32px] border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span className="flex size-20 items-center justify-center rounded-[28px] bg-brand/12 text-4xl">🔊</span>
            <h2 className="mt-5 font-display text-xl font-bold">Nenhuma figurinha ainda</h2>
            <p className="mt-1 max-w-xs text-sm text-muted">Crie sua primeira figurinha com áudio. Ela aparece aqui para ouvir, editar e compartilhar.</p>
            <Link
              href="/criar?novo=1"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-6 font-semibold text-[#04230f] transition active:scale-95"
            >
              Criar minha figurinha
            </Link>
          </div>
        ) : (
          <>
            {selecting && (
              <p className="mb-4 rounded-2xl bg-surface-2/60 p-3 text-sm text-muted">
                Selecione de {PACK_MIN} a {PACK_MAX} figurinhas para gerar um pacote <strong className="text-fg">.wastickers</strong>. Ele pode ser
                importado por apps de pacotes de figurinhas no Android. Figurinhas de pacote não têm som (regra do WhatsApp).
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {items.map((rec) => (
                <StickerCard
                  key={rec.id}
                  rec={rec}
                  selecting={selecting}
                  selected={selected.includes(rec.id)}
                  onToggleSelect={() => toggle(rec.id)}
                  onShare={() => setShareRec({ rec, mode: "share" })}
                  onDownload={() => setShareRec({ rec, mode: "download" })}
                  onDelete={() => setDeleting(rec)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="rounded-[28px] border border-line bg-surface">
          {history.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">O histórico de criações aparece aqui.</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {history.map((h) => {
                  const a = ACTION[h.action];
                  const exists = items.some((i) => i.id === h.stickerId);
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 ${a.color}`}>
                        <a.icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-semibold">{h.stickerName}</span> · {a.label}
                          {h.detail ? <span className="text-muted"> ({h.detail})</span> : null}
                        </p>
                        <p className="text-xs text-muted">{relative(h.at)}</p>
                      </div>
                      {exists && (
                        <Link href={`/criar?id=${encodeURIComponent(h.stickerId)}`} className="text-xs font-semibold text-brand">
                          Abrir
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line p-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => historyStore.clear()}>
                  Limpar histórico
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {selecting && (
        <div className="glass fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-line p-3 md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-1">
            <p className="flex-1 text-sm">
              <strong>{selected.length}</strong> selecionada{selected.length === 1 ? "" : "s"}
              {selected.length < PACK_MIN && <span className="text-muted"> · faltam {PACK_MIN - selected.length}</span>}
            </p>
            <Button disabled={selected.length < PACK_MIN} onClick={() => setPackOpen(true)} icon={<Package className="size-4" />}>
              Exportar pacote
            </Button>
          </div>
        </div>
      )}

      <ShareSheet record={shareRec?.rec ?? null} mode={shareRec?.mode} open={!!shareRec} onClose={() => setShareRec(null)} />

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title="Excluir figurinha?">
        <p className="text-sm text-muted">
          “{deleting?.name}” será apagada deste aparelho. Essa ação não pode ser desfeita.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button className="!bg-red-500 !text-white" onClick={confirmDelete} icon={<Trash2 className="size-4" />}>
            Excluir
          </Button>
        </div>
      </Sheet>

      <Sheet open={packOpen} onClose={() => setPackOpen(false)} title="Pacote de figurinhas">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nome do pacote</span>
            <input
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              maxLength={128}
              className="h-12 w-full rounded-2xl border border-line bg-surface-2/50 px-4 text-[16px] outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Autor</span>
            <input
              value={packAuthor}
              onChange={(e) => setPackAuthor(e.target.value)}
              maxLength={128}
              className="h-12 w-full rounded-2xl border border-line bg-surface-2/50 px-4 text-[16px] outline-none focus:border-brand"
            />
          </label>
          <p className="text-xs text-muted">
            O arquivo contém as figurinhas WebP 512×512, o ícone do pacote (96×96) e o <code>contents.json</code> no formato do app oficial de
            exemplo do WhatsApp.
          </p>
          <Button block size="lg" loading={exporting} onClick={doExport} icon={<Package className="size-5" />}>
            Gerar .wastickers ({selected.length})
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
