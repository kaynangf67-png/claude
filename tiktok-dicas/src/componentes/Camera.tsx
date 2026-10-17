import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CORES } from "../tema";

/**
 * Fundo da cena + zoom-in lento e contínuo (efeito de câmera).
 * Todas as cenas passam por aqui.
 */
export const Camera: React.FC<{
  duracao: number;
  brilho: string;
  children: React.ReactNode;
}> = ({ duracao, brilho, children }) => {
  const frame = useCurrentFrame();
  const escala = interpolate(frame, [0, Math.max(1, duracao)], [1, 1.07], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const deriva = interpolate(frame, [0, Math.max(1, duracao)], [0, -18], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: CORES.fundo, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 38%, ${brilho} 0%, transparent 70%)`,
          opacity: 0.16,
          transform: `scale(${escala * 1.1}) translateY(${deriva}px)`,
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${escala}) translateY(${deriva}px)`, transformOrigin: "50% 42%" }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
