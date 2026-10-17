import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { Camera } from "../componentes/Camera";
import { Icone } from "../componentes/Icone";
import { iconePasso, textoPasso } from "../lib/formatar";
import { Area, CenaProps, Rotulo, useEntrada, useFrameGlobal } from "./comum";

/** Cena 4: 3 passos numerados; cada um entra quando a narração chega nele. */
export const Passos: React.FC<CenaProps> = ({ cena, config, cor, inicioSeq, duracaoSeq }) => {
  const { fps } = useVideoConfig();
  const frame = useFrameGlobal(inicioSeq);
  const rotulo = useEntrada(inicioSeq, cena.inicioFrame);

  return (
    <Camera duracao={duracaoSeq} brilho={cor}>
      <Area>
        <Rotulo texto="Passo a passo" cor={cor} progresso={rotulo} />
        <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 34 }}>
          {config.passos.map((p, i) => {
            const marco = cena.marcos[i] - 4;
            const proximo = cena.marcos[i + 1] ?? cena.fimFrame + 1000; // o último passo não apaga
            const e = spring({ frame: frame - marco, fps, config: { damping: 15, mass: 0.6 } });
            const icone = interpolate(frame, [marco + 4, marco + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const ativo = frame < proximo;
            const brilho = interpolate(frame, [proximo, proximo + 10], [1, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 30,
                  opacity: e * brilho,
                  transform: `translateY(${interpolate(e, [0, 1], [60, 0])}px)`,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 150,
                    height: 150,
                    flexShrink: 0,
                    borderRadius: 36,
                    border: `3px solid ${ativo ? cor : "rgba(255,255,255,0.18)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: ativo ? `0 0 50px ${cor}40` : "none",
                  }}
                >
                  <Icone nome={iconePasso(p, i)} tamanho={78} cor={ativo ? cor : "#F4F4F2"} progresso={icone} />
                  <div
                    style={{
                      position: "absolute",
                      top: -20,
                      left: -16,
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      background: cor,
                      color: "#09090A",
                      fontSize: 30,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                </div>
                <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1.2 }}>{textoPasso(p)}</div>
              </div>
            );
          })}
        </div>
      </Area>
    </Camera>
  );
};
