import React from "react";
import { AbsoluteFill, Easing, interpolate, random } from "remotion";
import { linearTiming, type TransitionPresentation, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import type { NomeTransicao } from "../tipos";

type P = { cor: string };
type Props = TransitionPresentationComponentProps<P>;

const suave = Easing.bezier(0.7, 0, 0.2, 1);

/** O texto/cena se parte ao meio (corte levemente inclinado) e as metades se afastam, revelando a próxima. */
const Split: React.FC<Props> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = suave(presentationProgress);
  if (presentationDirection === "entering") {
    return (
      <AbsoluteFill style={{ transform: `scale(${interpolate(p, [0, 1], [1.12, 1])})`, opacity: interpolate(p, [0, 0.4], [0.4, 1], { extrapolateRight: "clamp" }) }}>
        {children}
      </AbsoluteFill>
    );
  }
  const afasta = interpolate(p, [0.15, 1], [0, 1100], { extrapolateLeft: "clamp" });
  const linha = interpolate(presentationProgress, [0, 0.2, 0.45], [0, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ zIndex: 1 }}>
      <AbsoluteFill style={{ clipPath: "polygon(0 0, 100% 0, 100% 46%, 0 54%)", transform: `translate(${-afasta * 0.15}px, ${-afasta}px) rotate(${-p * 4}deg)` }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: "polygon(0 54%, 100% 46%, 100% 100%, 0 100%)", transform: `translate(${afasta * 0.15}px, ${afasta}px) rotate(${p * 4}deg)` }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center" }}>
        <div
          style={{
            height: 6,
            width: "130%",
            marginLeft: "-15%",
            background: passedProps.cor,
            boxShadow: `0 0 40px ${passedProps.cor}`,
            transform: `rotate(-4.2deg) scaleX(${linha})`,
            opacity: linha,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A câmera "atravessa" a cena atual e cai na próxima. */
const Zoom: React.FC<Props> = ({ children, presentationDirection, presentationProgress }) => {
  const p = suave(presentationProgress);
  const saindo = presentationDirection === "exiting";
  const escala = saindo ? interpolate(p, [0, 1], [1, 3.2]) : interpolate(p, [0, 1], [0.55, 1]);
  const opacidade = saindo ? interpolate(p, [0.35, 0.75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : interpolate(p, [0.3, 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const desfoque = saindo ? interpolate(p, [0, 1], [0, 26]) : interpolate(p, [0, 1], [18, 0]);
  return (
    <AbsoluteFill style={{ zIndex: saindo ? 1 : 0, transform: `scale(${escala})`, opacity: opacidade, filter: `blur(${desfoque}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

/** Glitch curto: a imagem se fatia em faixas deslocadas, com faixas coloridas, e corta para a próxima no meio. */
const Glitch: React.FC<Props> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const visivel = presentationDirection === "exiting" ? presentationProgress < 0.5 : presentationProgress >= 0.5;
  if (!visivel) return null;
  const forca = 1 - Math.abs(presentationProgress - 0.5) * 2;
  const semente = Math.round(presentationProgress * 40);
  const faixas = 6;
  return (
    <AbsoluteFill style={{ filter: `contrast(${1 + forca * 0.6}) saturate(${1 + forca})` }}>
      {Array.from({ length: faixas }).map((_, i) => {
        const dx = (random(`g-${semente}-${i}`) - 0.5) * 160 * forca;
        const topo = (i / faixas) * 100;
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${topo}% 0 ${100 - topo - 100 / faixas}% 0)`, transform: `translateX(${dx}px)` }}>
            {children}
          </AbsoluteFill>
        );
      })}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`b${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${random(`gb-${semente}-${i}`) * 100}%`,
            height: 6 + random(`gh-${semente}-${i}`) * 34,
            background: i % 2 ? passedProps.cor : i % 3 ? "#00E5FF" : "#FF2D55",
            mixBlendMode: "screen",
            opacity: forca * 0.8,
            transform: `translateX(${(random(`gx-${semente}-${i}`) - 0.5) * 300}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

type Presentation = TransitionPresentation<Record<string, unknown>>;

const custom = (component: React.FC<Props>, cor: string) =>
  ({ component, props: { cor } }) as unknown as Presentation;

export const DURACAO_TRANSICAO: Record<NomeTransicao, number> = {
  split: 14,
  zoom: 12,
  wipe: 12,
  glitch: 8,
};

export const criarTransicao = (nome: NomeTransicao, cor: string) => {
  const timing = linearTiming({ durationInFrames: DURACAO_TRANSICAO[nome] });
  switch (nome) {
    case "split":
      return { timing, presentation: custom(Split, cor) };
    case "zoom":
      return { timing, presentation: custom(Zoom, cor) };
    case "glitch":
      return { timing, presentation: custom(Glitch, cor) };
    case "wipe":
      return { timing, presentation: wipe({ direction: "from-bottom-left" }) as Presentation };
  }
};
