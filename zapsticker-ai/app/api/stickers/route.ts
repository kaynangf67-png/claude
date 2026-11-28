import { parseStickerMeta, stickerRepository } from "@/lib/server/stickerRepository";

export const dynamic = "force-dynamic";

/**
 * API de metadados de figurinhas (base para sincronização futura).
 * Identificação provisória por cabeçalho `x-device-id` até existir login.
 */
function owner(req: Request): string | null {
  const id = req.headers.get("x-device-id");
  return id && /^[\w-]{8,64}$/.test(id) ? id : null;
}

export async function GET(req: Request) {
  const o = owner(req);
  if (!o) return Response.json({ error: "x-device-id ausente ou inválido" }, { status: 400 });
  return Response.json({ stickers: await stickerRepository.list(o) });
}

export async function POST(req: Request) {
  const o = owner(req);
  if (!o) return Response.json({ error: "x-device-id ausente ou inválido" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const meta = parseStickerMeta(body);
  if (typeof meta === "string") return Response.json({ error: meta }, { status: 422 });
  return Response.json({ sticker: await stickerRepository.upsert(o, meta) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const o = owner(req);
  if (!o) return Response.json({ error: "x-device-id ausente ou inválido" }, { status: 400 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });
  return Response.json({ removed: await stickerRepository.remove(o, id) });
}
