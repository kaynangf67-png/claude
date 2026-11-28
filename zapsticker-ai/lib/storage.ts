"use client";

import type { DraftRecord, HistoryEntry, StickerRecord } from "./types";

const DB_NAME = "zapsticker-ai";
const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("Armazenamento local indisponível."));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("stickers")) {
          const s = db.createObjectStore("stickers", { keyPath: "id" });
          s.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts");
        if (!db.objectStoreNames.contains("history")) {
          const h = db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
          h.createIndex("at", "at");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o armazenamento local."));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = fn(s);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error ?? new Error("Erro no armazenamento local"));
        t.onabort = () =>
          reject(
            t.error?.name === "QuotaExceededError"
              ? new Error("Sem espaço no armazenamento do navegador. Exclua algumas figurinhas.")
              : (t.error ?? new Error("Operação cancelada")),
          );
      }),
  );
}

export const stickerStore = {
  async list(): Promise<StickerRecord[]> {
    const all = await tx<StickerRecord[]>("stickers", "readonly", (s) => s.getAll());
    return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string) {
    return tx<StickerRecord | undefined>("stickers", "readonly", (s) => s.get(id));
  },
  async put(rec: StickerRecord) {
    await tx("stickers", "readwrite", (s) => s.put(rec));
    notify();
  },
  async remove(id: string) {
    await tx("stickers", "readwrite", (s) => s.delete(id));
    notify();
  },
};

const DRAFT_KEY = "current";
type DraftBlobKey = "image" | "cutout" | "audio";
/**
 * O rascunho é salvo em partes: os ajustes (leves) a cada mudança e os
 * arquivos (pesados) só quando trocam.
 */
export const draftStore = {
  async get(): Promise<DraftRecord | undefined> {
    const meta = await tx<DraftRecord | undefined>("drafts", "readonly", (s) => s.get(DRAFT_KEY));
    if (!meta) return undefined;
    const [image, cutout, audio] = await Promise.all(
      (["image", "cutout", "audio"] as DraftBlobKey[]).map((k) => tx<Blob | undefined>("drafts", "readonly", (s) => s.get(`blob:${k}`))),
    );
    return { ...meta, image, cutout, audio };
  },
  putMeta: (d: Omit<DraftRecord, "image" | "cutout" | "audio">) => tx("drafts", "readwrite", (s) => s.put(d, DRAFT_KEY)),
  putBlob: (key: DraftBlobKey, blob: Blob | undefined) =>
    tx<unknown>("drafts", "readwrite", (s) => {
      if (blob) s.put(blob, `blob:${key}`);
      else s.delete(`blob:${key}`);
    }),
  clear: () => tx("drafts", "readwrite", (s) => s.clear()),
};

export const historyStore = {
  async add(e: Omit<HistoryEntry, "id" | "at">) {
    try {
      await tx("history", "readwrite", (s) => s.add({ ...e, at: Date.now() }));
      notify();
    } catch (err) {
      console.warn("[history]", err);
    }
  },
  async list(limit = 200): Promise<HistoryEntry[]> {
    const all = await tx<HistoryEntry[]>("history", "readonly", (s) => s.getAll());
    return (all ?? []).sort((a, b) => b.at - a.at).slice(0, limit);
  },
  clear: () => tx("history", "readwrite", (s) => s.clear()).then(notify),
};

/** Avisa outras partes da UI (e outras abas) que os dados mudaram. */
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function getChannel() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("zapsticker-ai");
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  return channel;
}
function notify() {
  listeners.forEach((l) => l());
  getChannel()?.postMessage("changed");
}
export function subscribe(fn: () => void) {
  getChannel();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* opcional */
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
