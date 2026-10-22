import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { SessionProvider } from "@/components/app/SessionProvider";
import "./globals.css";

const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display-serif", display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: {
    default: "Desafio Menos Açúcar — 21 dias para hábitos mais conscientes",
    template: "%s · Desafio Menos Açúcar",
  },
  description:
    "Um desafio de 21 dias com missões curtas e práticas para entender seus hábitos com doces e bebidas adoçadas e montar estratégias que funcionam para você. Sem culpa e sem dieta.",
  applicationName: "Desafio Menos Açúcar",
};

export const viewport: Viewport = {
  themeColor: "#174D3C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-paper"
        >
          Pular para o conteúdo
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
