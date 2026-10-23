/** Maior lado permitido mantendo a proporção; nunca amplia. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Reduz a foto no próprio aparelho antes do envio (fotos de celular passam de 5 MB
 * e o servidor aceita até 4 MB por arquivo). 2000 px sobra para os marketplaces.
 */
export async function compressPhoto(file: File, max = 2000, quality = 0.88): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // PNG com transparência vira fundo branco, não preto
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a foto'))), 'image/jpeg', quality),
  );
}
