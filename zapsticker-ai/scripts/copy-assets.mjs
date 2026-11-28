// Copia os binários WebAssembly usados no navegador para /public/vendor,
// assim o app não depende de CDN de terceiros em produção.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "vendor");

const copies = [
  ["node_modules/@mediapipe/tasks-vision/wasm", "mediapipe"],
  ["node_modules/@jsquash/webp/codec/enc/webp_enc.wasm", "webp/webp_enc.wasm"],
  ["node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm", "webp/webp_enc_simd.wasm"],
];

for (const [from, to] of copies) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.warn(`[copy-assets] não encontrado: ${from}`);
    continue;
  }
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}
console.log("[copy-assets] wasm copiado para public/vendor");
