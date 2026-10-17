import React from "react";
import { interpolate } from "remotion";
import { Camera } from "../componentes/Camera";
import { Area, CenaProps, Rotulo, useEntrada } from "./comum";

/** Cena 2: nome da ideia em destaque + uma linha explicando. */
export const Ideia: React.FC<CenaProps> = ({ cena, config, cor, inicioSeq, duracaoSeq }) => {
  const ini = cena.inicioFrame;
  const rotulo = useEntrada(inicioSeq, ini);
  const nome = useEntrada(inicioSeq, ini + 4, 90);
  const sublinhado = useEntrada(inicioSeq, ini + 14, 60);
  const descricao = useEntrada(inicioSeq, ini + 22, 80);
  const tamanho = config.ideia.nome.length <= 22 ? 104 : config.ideia.nome.length <= 40 ? 88 : 74;

  return (
    <Camera duracao={duracaoSeq} brilho={cor}>
      <Area>
        <Rotulo texto="A ideia" cor={cor} progresso={rotulo} />
        <div style={{ marginTop: 44, overflow: "hidden", paddingBottom: 10 }}>
          <div
            style={{
              fontSize: tamanho,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
              transform: `translateY(${interpolate(nome, [0, 1], [110, 0])}%)`,
            }}
          >
            {config.ideia.nome}
          </div>
        </div>
        <div
          style={{
            marginTop: 26,
            height: 10,
            width: `${interpolate(sublinhado, [0, 1], [0, 62])}%`,
            background: cor,
            borderRadius: 5,
            boxShadow: `0 0 40px ${cor}88`,
          }}
        />
        <div
          style={{
            marginTop: 48,
            fontSize: 48,
            fontWeight: 400,
            lineHeight: 1.3,
            color: "#B9B9B4",
            opacity: descricao,
            transform: `translateY(${interpolate(descricao, [0, 1], [30, 0])}px)`,
          }}
        >
          {config.ideia.descricao}
        </div>
      </Area>
    </Camera>
  );
};
