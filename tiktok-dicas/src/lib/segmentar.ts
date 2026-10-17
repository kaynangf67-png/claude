import type { Cena, ConfigVideo, NomeCena, Palavra } from "../tipos";
import { normalizarTexto, tokens } from "./timestamps";
import { textoPasso } from "./formatar";

/** Quanto tempo antes da primeira palavra a cena já aparece na tela. */
const ANTECIPACAO_S = 0.12;
/** Respiro no final, depois da última palavra. */
const CAUDA_S = 1.4;

const iguais = (a: string, b: string) =>
  a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

/**
 * Procura, perto de `esperado`, o índice onde as primeiras palavras de `alvo` aparecem na narração.
 * A TTS às vezes escreve números por extenso ("trezentos" x "300"), por isso é uma busca tolerante
 * em janela, e não uma contagem cega de palavras.
 */
const localizar = (narrado: string[], alvo: string[], esperado: number, min: number, max: number): number => {
  const janela = 10;
  let melhor = Math.min(Math.max(esperado, min), max);
  let melhorPontos = 0;
  for (let j = Math.max(min, esperado - janela); j <= Math.min(max, esperado + janela); j++) {
    let pontos = 0;
    for (let k = 0; k < Math.min(3, alvo.length); k++) {
      if (narrado[j + k] !== undefined && iguais(narrado[j + k], alvo[k])) pontos++;
      else break;
    }
    const maisPerto = Math.abs(j - esperado) < Math.abs(melhor - esperado);
    if (pontos > melhorPontos || (pontos === melhorPontos && pontos > 0 && maisPerto)) {
      melhor = j;
      melhorPontos = pontos;
    }
  }
  return melhor;
};

const textosNarrados = (c: ConfigVideo): string[] => {
  const r = c.roteiro;
  if (r) return [r.gancho, r.ideia, r.numeros, ...r.passos, r.erro, r.fechamento];
  return [
    c.gancho,
    `${c.ideia.nome}. ${c.ideia.descricao}`,
    c.numeros.map((n) => `${n.rotulo} ${n.valor}`).join(" "),
    ...c.passos.map(textoPasso),
    c.erro,
    `${c.fechamento} ${c.proximoGancho ?? ""}`,
  ];
};

export const segmentar = (config: ConfigVideo, palavras: Palavra[], fps: number) => {
  const avisos: string[] = [];
  const narrado = palavras.map((p) => normalizarTexto(p.texto));
  const segmentos = textosNarrados(config).map(tokens);
  const n = palavras.length;

  // índice da 1ª palavra de cada segmento (8 segmentos: gancho, ideia, numeros, passo1..3, erro, fechamento)
  const inicios: number[] = [0];
  for (let s = 1; s < segmentos.length; s++) {
    const anterior = inicios[s - 1];
    const esperado = anterior + segmentos[s - 1].length;
    const restantes = segmentos.length - s;
    const idx = localizar(narrado, segmentos[s], esperado, anterior + 1, n - restantes);
    if (!iguais(narrado[idx] ?? "", segmentos[s][0] ?? "")) {
      avisos.push(
        `Não achei o começo do trecho ${s + 1} ("${segmentos[s].slice(0, 3).join(" ")}...") na narração; usei a contagem de palavras. Confira se o "roteiro" bate com o áudio.`,
      );
    }
    inicios.push(idx);
  }

  const tempoInicio = (idx: number) =>
    idx === 0 ? 0 : Math.max(palavras[idx - 1].fim, palavras[idx].inicio - ANTECIPACAO_S);
  const frame = (seg: number) => Math.round(seg * fps);
  const fimTotal = frame(palavras[n - 1].fim + CAUDA_S);

  // agrupa os 8 segmentos nas 6 cenas (os 3 passos viram uma cena só, com marcos internos)
  const grupos: { nome: NomeCena; segs: number[] }[] = [
    { nome: "gancho", segs: [0] },
    { nome: "ideia", segs: [1] },
    { nome: "numeros", segs: [2] },
    { nome: "passos", segs: [3, 4, 5] },
    { nome: "erro", segs: [6] },
    { nome: "fechamento", segs: [7] },
  ];

  const cenas: Cena[] = grupos.map((g, i) => {
    const primeiro = inicios[g.segs[0]];
    const proximo = i < grupos.length - 1 ? inicios[grupos[i + 1].segs[0]] : n;
    return {
      nome: g.nome,
      inicioFrame: frame(tempoInicio(primeiro)),
      fimFrame: i < grupos.length - 1 ? frame(tempoInicio(proximo)) : fimTotal,
      palavras: palavras.slice(primeiro, proximo),
      marcos: g.segs.map((s) => frame(palavras[inicios[s]].inicio)),
    };
  });

  // Marco extra no fechamento: quando começa a frase de gancho do próximo vídeo.
  const fechamento = cenas[5];
  if (config.proximoGancho) {
    const alvo = tokens(config.proximoGancho);
    const ini = inicios[7];
    const idx = localizar(narrado, alvo, Math.max(ini, n - alvo.length), ini, n - 1);
    const achou = iguais(narrado[idx] ?? "", alvo[0] ?? "");
    fechamento.marcos.push(
      achou
        ? frame(palavras[idx].inicio)
        : Math.round(fechamento.inicioFrame + (fechamento.fimFrame - fechamento.inicioFrame) * 0.55),
    );
  }

  return { cenas, duracaoFrames: fimTotal, avisos };
};
