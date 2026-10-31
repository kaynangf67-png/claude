type Prepared = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

const MAX_SIDE = 1568; // o que a IA aproveita; acima disso só pesa no envio
const SENDABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Decodifica pelo mesmo caminho da prévia (<img>), que funciona onde createImageBitmap falha. */
function loadViaImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img"));
    };
    img.src = url;
  });
}

function toJpeg(source: CanvasImageSource, width: number, height: number): Prepared {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.9);
  if (!url.startsWith("data:image/jpeg")) throw new Error("canvas");
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Reduz o print e gera JPEG em base64. Três tentativas, porque celulares variam:
 * 1) createImageBitmap  2) <img> + canvas  3) arquivo original, se o formato for aceito e couber no limite de 4,5 MB da Vercel.
 */
export async function prepareImage(blob: Blob): Promise<Prepared> {
  try {
    const bmp = await createImageBitmap(blob);
    try {
      return toJpeg(bmp, bmp.width, bmp.height);
    } finally {
      bmp.close();
    }
  } catch {
    /* segue para a próxima tentativa */
  }
  try {
    const img = await loadViaImg(blob);
    return toJpeg(img, img.naturalWidth, img.naturalHeight);
  } catch {
    /* segue para a próxima tentativa */
  }
  if (SENDABLE.has(blob.type) && blob.size <= 3 * 1024 * 1024) {
    return { data: await readBase64(blob), mediaType: blob.type as Prepared["mediaType"] };
  }
  throw new Error("Não consegui ler esta imagem. Tire o print de novo (PNG ou JPG) e selecione outra vez.");
}
