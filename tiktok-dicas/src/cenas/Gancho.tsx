import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { Camera } from "../componentes/Camera";
import { Area, CenaProps, temposPorPalavra, useFrameGlobal } from "./comum";

const destacar = (palavra: string) => /\d|\$/.test(palavra);

/** Cena 1: frase de gancho em tela cheia, palavra por palavra, no ritmo da narração. */
export const Gancho: React.FC<CenaProps> = ({ cena, config, cor, inicioSeq, duracaoSeq }) => {
  const { fps } = useVideoConfig();
  const frame = useFrameGlobal(inicioSeq);
  const palavras = config.gancho.split(/\s+/).filter(Boolean);
  const tempos = temposPorPalavra(config.gancho, cena, fps);
  const tamanho = config.gancho.length <= 40 ? 116 : config.gancho.length <= 65 ? 100 : 86;

  return (
    <Camera duracao={duracaoSeq} brilho={cor}>
      <Area baseLivre>
        <div
          style={{
            fontSize: tamanho,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -3,
            textAlign: "center",
          }}
        >
          {palavras.map((p, i) => {
            // a palavra aparece 2 frames antes de ser dita, para o olho chegar junto com o ouvido
            const e = spring({ frame: frame - tempos[i] + 2, fps, config: { damping: 14, mass: 0.5 } });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 14px",
                  color: destacar(p) ? cor : "#F4F4F2",
                  opacity: e,
                  filter: `blur(${interpolate(e, [0, 1], [14, 0])}px)`,
                  transform: `translateY(${interpolate(e, [0, 1], [50, 0])}px)`,
                }}
              >
                {p}
              </span>
            );
          })}
        </div>
      </Area>
    </Camera>
  );
};
