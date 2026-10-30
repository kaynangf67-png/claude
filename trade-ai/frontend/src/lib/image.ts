/** Reduz o print para no máximo 1568 px no lado maior (o que a IA aproveita) e gera JPEG em base64. */
export async function prepareImage(blob: Blob): Promise<{ data: string; mediaType: "image/jpeg"; preview: string }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador sem suporte a canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.9);
  return { data: url.split(",")[1], mediaType: "image/jpeg", preview: url };
}
