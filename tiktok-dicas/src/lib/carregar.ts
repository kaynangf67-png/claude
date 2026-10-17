import { staticFile } from "remotion";
import type { ConfigVideo, DadosVideo, NomeTransicao } from "../tipos";
import { normalizarTimestamps } from "./timestamps";
import { segmentar } from "./segmentar";
import { contarPalavras, textoPasso } from "./formatar";

const TRANSICOES_PADRAO: NomeTransicao[] = ["split", "zoom", "wipe", "glitch", "zoom"];

const existe = async (arquivo: string) => {
  try {
    const r = await fetch(staticFile(arquivo), { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
};

const lerJson = async (arquivo: string): Promise<unknown> => {
  const r = await fetch(staticFile(arquivo));
  if (!r.ok) throw new Error(`Não encontrei "public/${arquivo}" (HTTP ${r.status}).`);
  return r.json();
};

export const carregarDados = async (arquivoConfig: string, fps: number): Promise<DadosVideo> => {
  const config = (await lerJson(arquivoConfig)) as ConfigVideo;
  validarConfig(config);

  const brutos = await lerJson(config.timestamps);
  const palavras = normalizarTimestamps(brutos);
  const { cenas, duracaoFrames, avisos } = segmentar(config, palavras, fps);
  if ((brutos as { estimado?: boolean }).estimado) {
    avisos.push(`"${config.timestamps}" é ESTIMADO (npm run timestamps:estimar). Use os timestamps reais da TTS no vídeo final.`);
  }

  const transicoes = config.transicoes ?? TRANSICOES_PADRAO;
  if (transicoes.length !== 5) throw new Error(`"transicoes" precisa ter 5 itens (tem ${transicoes.length}).`);
  transicoes.forEach((t, i) => {
    if (i > 0 && t === transicoes[i - 1]) throw new Error(`Transição "${t}" repetida duas vezes seguidas.`);
  });

  const [temAudio, temTrilha] = await Promise.all([
    existe(config.audio),
    config.trilha ? existe(config.trilha) : Promise.resolve(false),
  ]);
  if (!temAudio) avisos.push(`"public/${config.audio}" não existe: o vídeo sai SEM narração.`);
  if (config.trilha && !temTrilha) avisos.push(`"public/${config.trilha}" não existe: sem trilha de fundo.`);

  const segundos = duracaoFrames / fps;
  if (segundos < 25 || segundos > 35) {
    avisos.push(`Duração de ${segundos.toFixed(1)}s, fora da faixa 25–35s. Ajuste o tamanho do roteiro.`);
  }
  const gancho = (cenas[0].fimFrame - cenas[0].inicioFrame) / fps;
  if (gancho > 2.5) avisos.push(`O gancho dura ${gancho.toFixed(1)}s (meta: ~2s). Encurte a frase.`);
  config.passos.forEach((p, i) => {
    if (contarPalavras(textoPasso(p)) > 8) avisos.push(`Passo ${i + 1} tem mais de 8 palavras.`);
  });
  avisos.push(...conferirConta(config));

  avisos.forEach((a) => console.warn(`[dica] ${a}`));
  return { config, palavras, cenas, transicoes, duracaoFrames, temAudio, temTrilha, avisos };
};

const validarConfig = (c: ConfigVideo) => {
  const faltando = (["gancho", "ideia", "numeros", "passos", "erro", "fechamento", "audio", "timestamps"] as const).filter(
    (k) => c[k] === undefined,
  );
  if (faltando.length) throw new Error(`Faltam campos no JSON: ${faltando.join(", ")}`);
  if (c.passos.length !== 3) throw new Error(`"passos" precisa ter exatamente 3 itens.`);
  if (c.numeros.length < 1 || c.numeros.length > 4) throw new Error(`"numeros" precisa ter de 1 a 4 itens.`);
  if (c.roteiro && c.roteiro.passos.length !== 3) throw new Error(`"roteiro.passos" precisa ter 3 itens.`);
};

/** Se o infográfico é "a × b = c", confere se a conta fecha. Número errado na tela mata a credibilidade. */
const conferirConta = (c: ConfigVideo): string[] => {
  const ns = c.numeros;
  if (ns.length < 3) return [];
  const ops = ns.map((n, i) => n.operador ?? (i === 0 ? "" : i === ns.length - 1 ? "=" : "×"));
  if (ops[ops.length - 1] !== "=") return [];
  let total = ns[0].valor;
  for (let i = 1; i < ns.length - 1; i++) {
    if (ops[i] === "×") total *= ns[i].valor;
    else if (ops[i] === "+") total += ns[i].valor;
    else if (ops[i] === "−" || ops[i] === "-") total -= ns[i].valor;
    else return [];
  }
  const resultado = ns[ns.length - 1].valor;
  return Math.abs(total - resultado) > 0.5 ? [`A conta dos números não fecha: dá ${total}, mas o resultado é ${resultado}.`] : [];
};
