import { zipSync, strToU8 } from "fflate";

export interface PackSticker {
  fileName: string;
  webp: Uint8Array;
  emojis?: string[];
}

export interface PackInput {
  identifier: string;
  name: string;
  publisher: string;
  trayPng: Uint8Array;
  stickers: PackSticker[];
}

/**
 * Monta um pacote de figurinhas compatível com:
 *  - o formato ".wastickers" lido por apps importadores (title.txt, author.txt,
 *    tray.png e as figurinhas .webp na raiz);
 *  - o `contents.json` do app de exemplo oficial do WhatsApp
 *    (github.com/WhatsApp/stickers), para quem publicar um app companheiro.
 */
export function buildStickerPack(p: PackInput): Uint8Array {
  if (p.stickers.length < 3) throw new Error("Um pacote precisa de pelo menos 3 figurinhas.");
  if (p.stickers.length > 30) throw new Error("Um pacote pode ter no máximo 30 figurinhas.");
  const name = p.name.trim().slice(0, 128) || "Minhas figurinhas";
  const publisher = p.publisher.trim().slice(0, 128) || "ZapSticker AI";
  const contents = {
    android_play_store_link: "",
    ios_app_store_link: "",
    sticker_packs: [
      {
        identifier: p.identifier,
        name,
        publisher,
        tray_image_file: "tray.png",
        image_data_version: "1",
        avoid_cache: false,
        publisher_email: "",
        publisher_website: "",
        privacy_policy_website: "",
        license_agreement_website: "",
        animated_sticker_pack: false,
        stickers: p.stickers.map((s) => ({ image_file: s.fileName, emojis: s.emojis?.length ? s.emojis : ["🔊"] })),
      },
    ],
  };
  const files: Record<string, Uint8Array> = {
    "title.txt": strToU8(name),
    "author.txt": strToU8(publisher),
    "tray.png": p.trayPng,
    "contents.json": strToU8(JSON.stringify(contents, null, 2)),
  };
  for (const s of p.stickers) files[s.fileName] = s.webp;
  // Figurinhas já são comprimidas: armazenar sem recompressão.
  return zipSync(files, { level: 0 });
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "figurinha"
  );
}
