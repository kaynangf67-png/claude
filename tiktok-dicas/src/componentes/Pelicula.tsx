import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";

/** Grão de filme (ruído que muda a cada frame) + vinheta. Fica por cima de tudo, menos das legendas. */
export const Pelicula: React.FC = () => {
  const frame = useCurrentFrame();
  const semente = Math.floor(random(`grao-${frame}`) * 1000);
  const dx = Math.floor(random(`gx-${frame}`) * 60);
  const dy = Math.floor(random(`gy-${frame}`) * 60);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ opacity: 0.11, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%" style={{ transform: `translate(${-dx}px, ${-dy}px)` }}>
          <filter id={`grao-${frame}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={semente} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="1200" height="2040" filter={`url(#grao-${frame})`} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
