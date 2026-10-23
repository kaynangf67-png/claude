import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { applyEdits, EditOperations, normalizeOriginal, probeImage } from '../src/modules/images/processing';
import { signAssetUrl, verifyAssetSignature } from '../src/modules/storage/storage';

const solid = (w: number, h: number, color: { r: number; g: number; b: number }, format: 'png' | 'jpeg' = 'png') =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } })[format]().toBuffer();

const ops = (o: Record<string, unknown>) => EditOperations.parse({ output: {}, ...o });

describe('validação de imagem', () => {
  it('aceita JPG/PNG/WEBP pelo conteúdo', async () => {
    expect(await probeImage(await solid(10, 20, { r: 1, g: 2, b: 3 }))).toEqual({ format: 'png', width: 10, height: 20 });
  });
  it('recusa arquivos que não são imagem e formatos fora da lista', async () => {
    await expect(probeImage(Buffer.from('<svg onload=alert(1)>'))).rejects.toMatchObject({ code: 'invalid_image' });
    const gif = await sharp({ create: { width: 5, height: 5, channels: 3, background: '#000' } }).gif().toBuffer();
    await expect(probeImage(gif)).rejects.toMatchObject({ code: 'unsupported_image' });
  });
  it('a normalização não muda dimensões nem cores', async () => {
    const src = await solid(64, 32, { r: 200, g: 10, b: 10 });
    const out = await normalizeOriginal(src, 'png');
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([64, 32]);
    expect([...data.subarray(0, 3)]).toEqual([200, 10, 10]);
  });
});

describe('edição', () => {
  it('recorta por frações da imagem', async () => {
    const out = await applyEdits(await solid(200, 100, { r: 0, g: 0, b: 0 }), ops({ crop: { x: 0.5, y: 0, width: 0.5, height: 0.5 } }));
    expect([out.width, out.height]).toEqual([100, 50]);
  });

  it('fundo branco: centraliza num quadrado sem ampliar e sem distorcer', async () => {
    const out = await applyEdits(
      await solid(400, 200, { r: 255, g: 0, b: 0 }),
      ops({ whiteBackground: true, output: { size: 1200, format: 'jpeg' } }),
    );
    expect([out.width, out.height]).toEqual([1200, 1200]);
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    expect(px(10, 10).every((v) => v > 245)).toBe(true); // borda branca
    const center = px(600, 600);
    expect(center[0]).toBeGreaterThan(230); // produto continua vermelho
    expect(center[1]).toBeLessThan(30);
  });

  it('brilho e contraste alteram a cópia, não a original', async () => {
    const original = await solid(50, 50, { r: 100, g: 100, b: 100 });
    const copy = Buffer.from(original);
    const out = await applyEdits(original, ops({ brightness: 50, output: { format: 'png' } }));
    expect(original.equals(copy)).toBe(true);
    const { data } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]!).toBeGreaterThan(130);
  });

  it('rotaciona e troca dimensões', async () => {
    const out = await applyEdits(await solid(300, 100, { r: 0, g: 0, b: 0 }), ops({ rotate: 90 }));
    expect([out.width, out.height]).toEqual([100, 300]);
  });

  it('não amplia além do tamanho real', async () => {
    const out = await applyEdits(await solid(300, 300, { r: 0, g: 0, b: 0 }), ops({ output: { size: 2000 } }));
    expect(out.width).toBe(300);
  });
});

describe('URL assinada das imagens', () => {
  it('valida assinatura e expiração', () => {
    const url = new URL(signAssetUrl('k'.repeat(64), 'asset1', 60, 1_000_000), 'http://x');
    const exp = url.searchParams.get('exp')!;
    const sig = url.searchParams.get('sig')!;
    expect(verifyAssetSignature('k'.repeat(64), 'asset1', exp, sig, 1_000_000)).toBe(true);
    expect(verifyAssetSignature('k'.repeat(64), 'asset2', exp, sig, 1_000_000)).toBe(false);
    expect(verifyAssetSignature('k'.repeat(64), 'asset1', exp, sig, 1_000_000 + 61_000)).toBe(false);
    expect(verifyAssetSignature('j'.repeat(64), 'asset1', exp, sig, 1_000_000)).toBe(false);
  });
});
