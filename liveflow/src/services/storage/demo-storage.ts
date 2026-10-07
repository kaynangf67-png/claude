import { uuid } from '@/lib/utils';
import type { Bucket, FileStorage } from '@/services/data/types';

const DB_NAME = 'liveflow-files';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function safeName(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  return `${uuid()}.${ext || 'bin'}`;
}

/** Arquivos do modo demonstração ficam no IndexedDB do navegador (sobrevivem a reload). */
export class DemoStorage implements FileStorage {
  private urls = new Map<string, string>();

  constructor(private readonly userId: string) {}

  async upload(bucket: Bucket, file: Blob, opts: { name: string; onProgress?: (pct: number) => void }): Promise<string> {
    const path = `${this.userId}/${safeName(opts.name)}`;
    opts.onProgress?.(10);
    await tx('readwrite', (s) => s.put(file, `${bucket}/${path}`));
    opts.onProgress?.(100);
    return path;
  }

  async resolveUrl(bucket: Bucket, path: string): Promise<string | null> {
    if (!path.startsWith(`${this.userId}/`)) return null; // mesma regra do bucket real
    const key = `${bucket}/${path}`;
    const cached = this.urls.get(key);
    if (cached) return cached;
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urls.set(key, url);
    return url;
  }

  async remove(bucket: Bucket, path: string): Promise<void> {
    const key = `${bucket}/${path}`;
    const url = this.urls.get(key);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(key);
    await tx('readwrite', (s) => s.delete(key));
  }
}
