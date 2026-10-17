import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cena, ConfigVideo } from "../tipos";
import { ALTURA, CONTEUDO, FONTE } from "../tema";

export type CenaProps = {
  cena: Cena;
  config: ConfigVideo;
  cor: string;
  /** Frame global em que a <Sequence> desta cena começa (inclui a metade da transição de entrada) */
  inicioSeq: number;
  duracaoSeq: number;
};

/** Frame global do vídeo (o mesmo relógio da narração). */
export const useFrameGlobal = (inicioSeq: number) => useCurrentFrame() + inicioSeq;

/** 0→1 com mola, a partir de um frame global. */
export const useEntrada = (inicioSeq: number, aPartirDe: number, rigidez = 120) => {
  const { fps } = useVideoConfig();
  const frame = useFrameGlobal(inicioSeq);
  return spring({ frame: frame - aPartirDe, fps, config: { damping: 16, stiffness: rigidez, mass: 0.7 } });
};

export const Area: React.FC<{
  children: React.ReactNode;
  justificar?: React.CSSProperties["justifyContent"];
  baseLivre?: boolean;
}> = ({ children, justificar = "center", baseLivre = false }) => (
  <AbsoluteFill
    style={{
      top: CONTEUDO.topo,
      bottom: baseLivre ? 150 + 90 : ALTURA - CONTEUDO.base,
      left: CONTEUDO.esquerda,
      right: CONTEUDO.direita,
      width: "auto",
      height: "auto",
      justifyContent: justificar,
      fontFamily: FONTE,
      color: "#F4F4F2",
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Pequeno rótulo de seção ("A IDEIA", "PASSO A PASSO"...). */
export const Rotulo: React.FC<{ texto: string; cor: string; progresso: number }> = ({ texto, cor, progresso }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: progresso }}>
    <div style={{ width: interpolate(progresso, [0, 1], [0, 56]), height: 4, background: cor, borderRadius: 2 }} />
    <div
      style={{
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: 7,
        color: cor,
        textTransform: "uppercase",
        transform: `translateX(${interpolate(progresso, [0, 1], [-20, 0])}px)`,
      }}
    >
      {texto}
    </div>
  </div>
);

/** Distribui as palavras visíveis de um texto ao longo dos tempos da narração. */
export const temposPorPalavra = (textoTela: string, cena: Cena, fps: number): number[] => {
  const visiveis = textoTela.split(/\s+/).filter(Boolean);
  const ditas = cena.palavras;
  if (ditas.length === visiveis.length) return ditas.map((p) => Math.round(p.inicio * fps));
  // narração diferente do texto da tela: espalha uniformemente pela fala da cena
  const ini = ditas[0]?.inicio ?? cena.inicioFrame / fps;
  const fim = ditas[ditas.length - 1]?.fim ?? cena.fimFrame / fps;
  return visiveis.map((_, i) => Math.round((ini + ((fim - ini) * i) / visiveis.length) * fps));
};
