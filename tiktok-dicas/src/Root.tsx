import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { carregarDados } from "./lib/carregar";
import { ALTURA, FPS, LARGURA } from "./tema";
import type { PropsVideo } from "./tipos";

export const Root: React.FC = () => (
  <Composition
    id="Dica"
    component={Video}
    width={LARGURA}
    height={ALTURA}
    fps={FPS}
    durationInFrames={30 * FPS}
    // Troque o arquivo aqui, no painel de props do Studio, ou com --props='{"config":"outra.json"}'
    defaultProps={{ config: "config.json" } satisfies PropsVideo}
    calculateMetadata={async ({ props }) => {
      const dados = await carregarDados(props.config, FPS);
      return { durationInFrames: dados.duracaoFrames, props: { ...props, dados } };
    }}
  />
);
