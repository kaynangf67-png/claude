import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZapSticker AI",
    short_name: "ZapSticker",
    description: "Sua foto. Sua voz. Sua figurinha.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b0d",
    theme_color: "#070b0d",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
