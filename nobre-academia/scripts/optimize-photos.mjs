// Converte as fotos de photos-originais/ em AVIF + WebP (800 e 1600 px de largura)
// dentro de public/fotos/ e registra as dimensões em src/photos.json.
// Uso: npm run fotos
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { extname, basename, join } from 'node:path';
import sharp from 'sharp';

const SRC = 'photos-originais';
const OUT = 'public/fotos';
const WIDTHS = [800, 1600];

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f));
const manifest = {};

for (const file of files) {
  const name = basename(file, extname(file))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const image = sharp(join(SRC, file)).rotate();
  const { width, height } = await image.metadata();
  const ratio = height / width;
  const widths = WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);

  for (const w of widths) {
    const resized = image.clone().resize({ width: w });
    await resized.clone().avif({ quality: 55 }).toFile(join(OUT, `${name}-${w}.avif`));
    await resized.clone().webp({ quality: 78 }).toFile(join(OUT, `${name}-${w}.webp`));
  }
  manifest[name] = { widths, ratio: Number(ratio.toFixed(4)) };
  console.log(`✓ ${file} → ${name} (${widths.join(', ')} px)`);
}

await writeFile('src/photos.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${files.length} foto(s) processada(s). Agora referencie pelo nome em src/config/academia.ts.`);
