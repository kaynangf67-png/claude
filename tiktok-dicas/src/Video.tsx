import React, { useMemo } from "react";
import { AbsoluteFill, Html5Audio, staticFile, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { NomeCena, PropsVideo } from "./tipos";
import { CORES, corDestaque } from "./tema";
import { criarTransicao, DURACAO_TRANSICAO } from "./transicoes";
import { trechosDeFala, volumeTrilha } from "./lib/ducking";
import { Pelicula } from "./componentes/Pelicula";
import { Legendas } from "./componentes/Legendas";
import type { CenaProps } from "./cenas/comum";
import { Gancho } from "./cenas/Gancho";
import { Ideia } from "./cenas/Ideia";
import { Numeros } from "./cenas/Numeros";
import { Passos } from "./cenas/Passos";
import { Erro } from "./cenas/Erro";
import { Fechamento } from "./cenas/Fechamento";

const COMPONENTES: Record<NomeCena, React.FC<CenaProps>> = {
  gancho: Gancho,
  ideia: Ideia,
  numeros: Numeros,
  passos: Passos,
  erro: Erro,
  fechamento: Fechamento,
};

export const Video: React.FC<PropsVideo> = ({ dados }) => {
  const { fps } = useVideoConfig();
  const trechos = useMemo(() => (dados ? trechosDeFala(dados.palavras) : []), [dados]);
  if (!dados) return <AbsoluteFill style={{ background: CORES.fundo }} />;

  const { config, cenas, transicoes, duracaoFrames } = dados;
  const cor = corDestaque(config.cor);

  // Cada transição fica centrada na fronteira entre duas cenas (metade antes, metade depois),
  // para que cada cena comece a aparecer exatamente quando a narração dela começa.
  const duracoes = transicoes.map((t) => DURACAO_TRANSICAO[t]);
  const metade = duracoes.map((d) => Math.floor(d / 2));
  const sequencias = cenas.map((cena, i) => {
    const inicio = cena.inicioFrame - (i > 0 ? metade[i - 1] : 0);
    const fim = i < cenas.length - 1 ? cenas[i + 1].inicioFrame - metade[i] + duracoes[i] : duracaoFrames;
    return { cena, inicio, duracao: fim - inicio };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CORES.fundo }}>
      <TransitionSeries>
        {sequencias.flatMap(({ cena, inicio, duracao }, i) => {
          const Componente = COMPONENTES[cena.nome];
          const itens = [
            <TransitionSeries.Sequence key={cena.nome} durationInFrames={duracao} name={cena.nome}>
              <Componente cena={cena} config={config} cor={cor} inicioSeq={inicio} duracaoSeq={duracao} />
            </TransitionSeries.Sequence>,
          ];
          if (i < transicoes.length) {
            const { timing, presentation } = criarTransicao(transicoes[i], cor);
            itens.push(<TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={presentation} />);
          }
          return itens;
        })}
      </TransitionSeries>

      <Pelicula />
      {/* legendas ficam fora do grão para continuarem nítidas; no gancho a própria cena já é o texto */}
      <Legendas palavras={dados.palavras} cor={cor} ocultarAte={cenas[1].inicioFrame} />

      {dados.temAudio && <Html5Audio src={staticFile(config.audio)} />}
      {dados.temTrilha && config.trilha && (
        <Html5Audio
          src={staticFile(config.trilha)}
          loop
          volume={(f) => volumeTrilha(f / fps, trechos, duracaoFrames / fps)}
        />
      )}
    </AbsoluteFill>
  );
};
