import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palavra } from "../tipos";
import { FONTE, LEGENDA, SEGURA } from "../tema";

type Bloco = { palavras: Palavra[]; inicio: number; fim: number };

const MAX_PALAVRAS = 3;
const MAX_CARACTERES = 20;
const PAUSA_S = 0.35;

/** Agrupa as palavras em blocos curtos (até 3 palavras), quebrando em pontuação e pausas. */
const agrupar = (palavras: Palavra[]): Bloco[] => {
  const blocos: Bloco[] = [];
  let atual: Palavra[] = [];
  palavras.forEach((p, i) => {
    atual.push(p);
    const prox = palavras[i + 1];
    const chars = atual.map((w) => w.texto).join(" ").length;
    const quebra =
      !prox ||
      atual.length >= MAX_PALAVRAS ||
      chars >= MAX_CARACTERES ||
      /[.,!?;:]$/.test(p.texto) ||
      prox.inicio - p.fim > PAUSA_S;
    if (quebra) {
      blocos.push({ palavras: atual, inicio: atual[0].inicio, fim: p.fim });
      atual = [];
    }
  });
  // cada bloco fica na tela até o próximo começar (sem "piscar" entre blocos)
  return blocos.map((b, i) => ({
    ...b,
    fim: blocos[i + 1] ? Math.min(blocos[i + 1].inicio, b.fim + 0.6) : b.fim + 0.6,
  }));
};

export const Legendas: React.FC<{ palavras: Palavra[]; cor: string; ocultarAte: number }> = ({
  palavras,
  cor,
  ocultarAte,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blocos = useMemo(() => agrupar(palavras), [palavras]);
  const t = frame / fps;

  // blocos que começam antes de `ocultarAte` (o gancho) nunca aparecem, nem a "sobra" deles
  const bloco = blocos.find((b) => b.inicio * fps >= ocultarAte - 6 && t >= b.inicio - 0.05 && t < b.fim);
  if (!bloco) return null;

  const entrada = spring({ frame: frame - Math.round(bloco.inicio * fps), fps, config: { damping: 18, mass: 0.5 } });

  return (
    <AbsoluteFill
      style={{
        top: LEGENDA.topo,
        height: LEGENDA.base - LEGENDA.topo,
        left: SEGURA.esquerda,
        right: SEGURA.direita,
        width: "auto",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTE,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.12,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: -1,
          transform: `translateY(${interpolate(entrada, [0, 1], [24, 0])}px) scale(${interpolate(entrada, [0, 1], [0.92, 1])})`,
          opacity: entrada,
        }}
      >
        {bloco.palavras.map((p, i) => {
          const fimAtiva = bloco.palavras[i + 1]?.inicio ?? bloco.fim;
          const ativa = t >= p.inicio && t < fimAtiva;
          const dita = t >= p.inicio;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 12px",
                color: ativa ? cor : "#FFFFFF",
                opacity: dita ? 1 : 0.45,
                transform: `scale(${ativa ? 1.08 : 1})`,
                textShadow: "0 6px 28px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.9)",
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
