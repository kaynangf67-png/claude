import React from "react";
import { interpolate, random } from "remotion";
import { Camera } from "../componentes/Camera";
import { Icone } from "../componentes/Icone";
import { CORES } from "../tema";
import { Area, CenaProps, useEntrada, useFrameGlobal } from "./comum";

/** Cena 5: "não faça isso" em vermelho, curto e com um tremor rápido na entrada. */
export const Erro: React.FC<CenaProps> = ({ cena, config, inicioSeq, duracaoSeq }) => {
  const frame = useFrameGlobal(inicioSeq);
  const ini = cena.inicioFrame;
  const selo = useEntrada(inicioSeq, ini, 200);
  const texto = useEntrada(inicioSeq, ini + 10, 90);
  const tremor = interpolate(frame - ini, [0, 10], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dx = (random(`erro-x-${frame}`) - 0.5) * tremor;
  const pulso = 0.5 + 0.5 * Math.sin((frame - ini) / 6);

  return (
    <Camera duracao={duracaoSeq} brilho={CORES.erro}>
      <Area>
        <div style={{ transform: `translateX(${dx}px)` }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 20,
              padding: "18px 34px 18px 22px",
              borderRadius: 999,
              background: CORES.erro,
              color: "#FFFFFF",
              fontSize: 46,
              fontWeight: 800,
              letterSpacing: 2,
              opacity: selo,
              transform: `scale(${interpolate(selo, [0, 1], [1.6, 1])})`,
              boxShadow: `0 0 ${40 + 40 * pulso}px ${CORES.erro}AA`,
            }}
          >
            <Icone nome="x" tamanho={58} cor="#FFFFFF" espessura={3.2} />
            NÃO FAÇA ISSO
          </div>
          <div
            style={{
              marginTop: 56,
              fontSize: config.erro.length <= 45 ? 84 : 68,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              opacity: texto,
              transform: `translateY(${interpolate(texto, [0, 1], [40, 0])}px)`,
            }}
          >
            {config.erro}
          </div>
          <div
            style={{
              marginTop: 40,
              height: 8,
              width: `${interpolate(texto, [0, 1], [0, 100])}%`,
              background: `linear-gradient(90deg, ${CORES.erro}, transparent)`,
              borderRadius: 4,
            }}
          />
        </div>
      </Area>
    </Camera>
  );
};
