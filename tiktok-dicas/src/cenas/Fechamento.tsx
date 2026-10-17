import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { Camera } from "../componentes/Camera";
import { Icone } from "../componentes/Icone";
import { Area, CenaProps, Rotulo, useEntrada, useFrameGlobal } from "./comum";

/**
 * Cena 6: chamada para seguir + "dica nova todo dia".
 * Quando a narração chega no gancho do próximo vídeo, a chamada sobe e o gancho assume a tela.
 */
export const Fechamento: React.FC<CenaProps> = ({ cena, config, cor, inicioSeq, duracaoSeq }) => {
  const frame = useFrameGlobal(inicioSeq);
  const ini = cena.inicioFrame;
  const marcoProximo = config.proximoGancho ? cena.marcos[cena.marcos.length - 1] : cena.fimFrame + 1000;

  const botao = useEntrada(inicioSeq, ini, 140);
  const chamada = useEntrada(inicioSeq, ini + 8);
  const todoDia = useEntrada(inicioSeq, ini + 18);
  const troca = useEntrada(inicioSeq, marcoProximo - 6, 80);
  const proximo = useEntrada(inicioSeq, marcoProximo, 90);
  const clique = interpolate(frame - ini, [16, 20, 26], [1, 0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Camera duracao={duracaoSeq} brilho={cor}>
      <Area>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            opacity: interpolate(troca, [0, 1], [1, 0]),
            transform: `translateY(${interpolate(troca, [0, 1], [0, -120])}px) scale(${interpolate(troca, [0, 1], [1, 0.9])})`,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "22px 40px 22px 26px",
              borderRadius: 999,
              background: cor,
              color: "#09090A",
              fontSize: 50,
              fontWeight: 800,
              opacity: botao,
              transform: `scale(${interpolate(botao, [0, 1], [0.6, 1]) * clique})`,
              transformOrigin: "left center",
              boxShadow: `0 0 70px ${cor}55`,
            }}
          >
            <Icone nome="mais" tamanho={56} cor="#09090A" espessura={3.4} />
            Seguir {config.perfil ?? ""}
          </div>
          <div
            style={{
              marginTop: 50,
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              opacity: chamada,
              transform: `translateY(${interpolate(chamada, [0, 1], [40, 0])}px)`,
            }}
          >
            {config.fechamento}
          </div>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 46,
              fontWeight: 600,
              color: cor,
              opacity: todoDia,
            }}
          >
            <Icone nome="calendario" tamanho={52} cor={cor} espessura={2} progresso={todoDia} />
            dica nova todo dia
          </div>
        </AbsoluteFill>

        {config.proximoGancho && (
          <AbsoluteFill style={{ justifyContent: "center", opacity: proximo }}>
            <Rotulo texto="No próximo vídeo" cor={cor} progresso={proximo} />
            <div
              style={{
                marginTop: 40,
                fontSize: config.proximoGancho.length <= 50 ? 88 : 72,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -2.5,
                filter: `blur(${interpolate(proximo, [0, 1], [12, 0])}px)`,
                transform: `translateY(${interpolate(proximo, [0, 1], [50, 0])}px)`,
              }}
            >
              {config.proximoGancho}
            </div>
          </AbsoluteFill>
        )}
      </Area>
    </Camera>
  );
};
