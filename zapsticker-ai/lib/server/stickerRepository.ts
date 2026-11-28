import "server-only";

/**
 * Camada de backend preparada para sincronização em nuvem.
 * Hoje as figurinhas vivem no aparelho (IndexedDB); esta interface define o
 * contrato para quando houver contas de usuário e armazenamento remoto
 * (ex.: Postgres + storage de objetos). Troque `MemoryStickerRepository`
 * por uma implementação persistente sem mudar as rotas.
 */
export interface StickerMeta {
  id: string;
  name: string;
  durationSec: number;
  animation: string;
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StickerRepository {
  list(ownerId: string): Promise<StickerMeta[]>;
  upsert(ownerId: string, meta: StickerMeta): Promise<StickerMeta>;
  remove(ownerId: string, id: string): Promise<boolean>;
}

class MemoryStickerRepository implements StickerRepository {
  private data = new Map<string, Map<string, StickerMeta>>();
  async list(ownerId: string) {
    return [...(this.data.get(ownerId)?.values() ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async upsert(ownerId: string, meta: StickerMeta) {
    if (!this.data.has(ownerId)) this.data.set(ownerId, new Map());
    this.data.get(ownerId)!.set(meta.id, meta);
    return meta;
  }
  async remove(ownerId: string, id: string) {
    return this.data.get(ownerId)?.delete(id) ?? false;
  }
}

const globalRepo = globalThis as unknown as { __zsRepo?: StickerRepository };
export const stickerRepository: StickerRepository = (globalRepo.__zsRepo ??= new MemoryStickerRepository());

export function parseStickerMeta(input: unknown): StickerMeta | string {
  if (!input || typeof input !== "object") return "Corpo inválido";
  const o = input as Record<string, unknown>;
  if (typeof o.id !== "string" || !/^[\w-]{6,64}$/.test(o.id)) return "id inválido";
  if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 60) return "name inválido";
  const duration = Number(o.durationSec);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30) return "durationSec inválido";
  const now = new Date().toISOString();
  return {
    id: o.id,
    name: o.name.trim(),
    durationSec: duration,
    animation: typeof o.animation === "string" ? o.animation.slice(0, 20) : "pulse",
    hasVideo: o.hasVideo === true,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now,
    updatedAt: now,
  };
}
