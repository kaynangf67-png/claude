// Cria um arquivo de timestamps ESTIMADO a partir do "roteiro" do JSON.
// Serve só para ver o vídeo no preview antes de ter o áudio da TTS.
// Para o vídeo final, use os timestamps reais que vêm junto com o áudio.
//
// Uso: npm run timestamps:estimar -- public/config.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const arquivo = process.argv[2] ?? "public/config.json";
const config = JSON.parse(readFileSync(arquivo, "utf8"));
if (!config.roteiro) throw new Error(`"${arquivo}" não tem "roteiro".`);

const r = config.roteiro;
const trechos = [r.gancho, r.ideia, r.numeros, ...r.passos, r.erro, r.fechamento];

// ritmo de uma voz calma: ~2,7 palavras/s, ajustado pelo tamanho da palavra
let t = 0.15;
const palavras = [];
for (const trecho of trechos) {
  for (const texto of trecho.split(/\s+/).filter(Boolean)) {
    const letras = texto.replace(/[^\p{L}\p{N}]/gu, "").length;
    const dur = 0.1 + letras * 0.045;
    palavras.push({ texto, inicio: +t.toFixed(3), fim: +(t + dur).toFixed(3) });
    t += dur + 0.04;
    if (/[,;:]$/.test(texto)) t += 0.18;
    if (/[.!?]$/.test(texto)) t += 0.32;
  }
  t += 0.2;
}

const destino = join(dirname(arquivo), config.timestamps);
writeFileSync(destino, JSON.stringify({ estimado: true, palavras }, null, 1));
console.log(`${destino}: ${palavras.length} palavras, ~${t.toFixed(1)}s (ESTIMADO, não é o áudio real).`);
