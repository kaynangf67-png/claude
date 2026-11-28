"use client";

import { canvasToBlob, createCanvas, ctx2d, loadImage } from "./image";
import { TRAY_SIZE } from "./limits";
import { buildStickerPack, slugify } from "./pack";
import type { StickerRecord } from "./types";

/** Gera o arquivo .wastickers a partir das figurinhas selecionadas. */
export async function exportPack(records: StickerRecord[], name: string, publisher: string): Promise<Blob> {
  const first = await loadImage(records[0].output.png);
  const tray = createCanvas(TRAY_SIZE, TRAY_SIZE);
  const tx = ctx2d(tray);
  tx.imageSmoothingQuality = "high";
  tx.drawImage(first, 0, 0, TRAY_SIZE, TRAY_SIZE);
  const trayPng = new Uint8Array(await (await canvasToBlob(tray, "image/png")).arrayBuffer());

  const used = new Set<string>();
  const stickers = await Promise.all(
    records.map(async (r, i) => {
      let fileName = `${String(i + 1).padStart(2, "0")}_${slugify(r.name)}.webp`;
      while (used.has(fileName)) fileName = `${i}_${fileName}`;
      used.add(fileName);
      return { fileName, webp: new Uint8Array(await r.output.sticker.arrayBuffer()), emojis: ["🔊", "😀"] };
    }),
  );
  const zip = buildStickerPack({
    identifier: `zapsticker_${slugify(name).replace(/-/g, "_")}_${Date.now().toString(36)}`,
    name,
    publisher,
    trayPng,
    stickers,
  });
  return new Blob([zip as BlobPart], { type: "application/zip" });
}
