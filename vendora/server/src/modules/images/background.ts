import sharp from 'sharp';

const WORK_SIZE = 1000;

export interface Cutout {
  /** PNG com fundo transparente, na resolução original. */
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Separa o produto de um fundo LISO (parede, papel, mesa de cor única) sem IA:
 * pinta a partir das bordas tudo que tem a cor do fundo. Não inventa pixels —
 * só decide quais são fundo. Em fundo com textura ou objetos, devolve null em
 * vez de arriscar recortar o produto errado.
 */
export async function cutoutPlainBackground(buffer: Buffer): Promise<Cutout | null> {
  // Materializa em RGB: removeAlpha() num pipeline só roda no fim e apagaria a máscara criada abaixo.
  const rgb = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = rgb.info.width;
  const H = rgb.info.height;
  const base = () => sharp(rgb.data, { raw: { width: W, height: H, channels: 3 } });
  const work = await base()
    .resize({ width: WORK_SIZE, height: WORK_SIZE, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = work;
  const w = info.width;
  const h = info.height;
  const px = (i: number) => [data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!] as const;

  // Cor do fundo = mediana das bordas.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const median = (c: 0 | 1 | 2) => {
    const v = border.map((i) => px(i)[c]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)]!;
  };
  const bg = [median(0), median(1), median(2)] as const;
  const dist = (i: number) => {
    const [r, g, b] = px(i);
    return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  };

  // Fundo precisa ser uniforme nas bordas; senão não arriscamos.
  const tol = 34;
  const uniform = border.filter((i) => dist(i) <= tol).length / border.length;
  if (uniform < 0.7) return null;

  // Flood fill a partir das bordas.
  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const i of border)
    if (!isBg[i] && dist(i) <= tol) {
      isBg[i] = 1;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i - x) / w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const n of nb)
      if (n >= 0 && !isBg[n] && dist(n) <= tol) {
        isBg[n] = 1;
        queue[tail++] = n;
      }
  }
  const bgShare = tail / (w * h);
  // Quase nada de fundo (foto fechada no produto) ou quase tudo (produto da cor do fundo): desiste.
  if (bgShare < 0.06 || bgShare > 0.97) return null;

  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = isBg[i] ? 0 : 255;
  // Máscara na resolução original, com borda levemente suavizada.
  const mask = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .resize({ width: W, height: H, fit: 'fill' })
    .blur(1.2)
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  const png = await base().joinChannel(mask, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  return { png, width: W, height: H };
}
