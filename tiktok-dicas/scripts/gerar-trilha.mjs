// Gera public/trilha.wav: um loop lo-fi/ambiente simples e livre de direitos (sintetizado aqui).
// Serve para o projeto rodar de primeira. Troque por uma trilha sua quando quiser.
// Uso: npm run trilha
import { writeFileSync } from "node:fs";

const TAXA = 32000;
const BPM = 72;
const COMPASSO = (60 / BPM) * 4;
// Fmaj7 - Em7 - Dm7 - Cmaj7, 2 compassos cada
const ACORDES = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const DURACAO = ACORDES.length * 2 * COMPASSO;
const N = Math.round(DURACAO * TAXA);
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let semente = 7;
const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;

const saida = new Float32Array(N);
let filtro = 0;
for (let i = 0; i < N; i++) {
  const t = i / TAXA;
  const idx = Math.floor(t / (2 * COMPASSO)) % ACORDES.length;
  const tAcorde = t % (2 * COMPASSO);
  const envelope = Math.min(1, tAcorde / 0.8) * Math.min(1, (2 * COMPASSO - tAcorde) / 0.4);

  // pad: senoides levemente desafinadas + tremolo lento
  let pad = 0;
  for (const nota of ACORDES[idx]) {
    const f = hz(nota);
    pad += Math.sin(2 * Math.PI * f * t) + 0.6 * Math.sin(2 * Math.PI * f * 1.003 * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
  }
  pad *= 0.045 * envelope * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t));
  // baixo na fundamental
  pad += 0.12 * envelope * Math.sin(2 * Math.PI * hz(ACORDES[idx][0] - 12) * t);

  // bumbo suave nos tempos 1 e 3, chimbal discreto nos contratempos
  const batida = 60 / BPM;
  const tb = t % (2 * batida);
  const bumbo = 0.5 * Math.sin(2 * Math.PI * (45 + 70 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9);
  const tc = (t + batida / 2) % batida;
  const chimbal = 0.025 * aleatorio() * Math.exp(-tc * 60);

  // chiado de vinil
  const vinil = 0.006 * aleatorio() + (Math.random() < 0.0004 ? 0.08 * aleatorio() : 0);

  // passa-baixa de um polo para deixar tudo abafado (cara de lo-fi)
  filtro += 0.18 * (pad + bumbo + chimbal - filtro);
  saida[i] = filtro + vinil;
}

// normaliza para -3 dBFS
const pico = saida.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const ganho = 0.707 / pico;

const dados = Buffer.alloc(44 + N * 2);
dados.write("RIFF", 0);
dados.writeUInt32LE(36 + N * 2, 4);
dados.write("WAVEfmt ", 8);
dados.writeUInt32LE(16, 16);
dados.writeUInt16LE(1, 20);
dados.writeUInt16LE(1, 22);
dados.writeUInt32LE(TAXA, 24);
dados.writeUInt32LE(TAXA * 2, 28);
dados.writeUInt16LE(2, 32);
dados.writeUInt16LE(16, 34);
dados.write("data", 36);
dados.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  dados.writeInt16LE(Math.round(Math.max(-1, Math.min(1, saida[i] * ganho)) * 32767), 44 + i * 2);
}
writeFileSync(new URL("../public/trilha.wav", import.meta.url), dados);
console.log(`public/trilha.wav gerado (${DURACAO.toFixed(1)}s, loop).`);
