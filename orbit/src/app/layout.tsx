import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ORBIT — Orquestração de agentes de IA", template: "%s · ORBIT" },
  description: "Defina o objetivo. O ORBIT planeja, executa tarefas autorizadas, verifica os resultados e pede aprovação quando necessário.",
};

export const viewport: Viewport = { themeColor: "#070b14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
