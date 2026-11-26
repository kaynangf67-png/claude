// Tema preto e branco: converte qualquer imagem para 1-bit (apenas #000 e #fff)
// com pontilhado ordenado (Bayer 4x4), preservando sombras e detalhes.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function ditherCtx(ctx, w, h) {
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  for (let y = 0, i = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++, i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      let l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      l = (l - 0.45) * 2.5 + 0.5; // contraste forte: céu claro vira branco liso, contornos viram preto
      const v = l > BAYER[row + (x & 3)] ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
}

export function ditherCanvas(c) { ditherCtx(c.getContext('2d'), c.width, c.height); return c; }

// remove emojis coloridos dos textos da interface
const EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic}))*/gu;
export function noEmoji(html) { return String(html).replace(EMOJI, '').replace(/️/g, ''); }
