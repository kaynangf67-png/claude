import React from "react";
import type { NomeIcone } from "../tipos";

const TRACOS: Record<NomeIcone | "x" | "mais", React.ReactNode> = {
  alvo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  lista: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  mensagem: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  loja: (
    <>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9h16v2a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 11Z" />
      <path d="M5.5 13v7h13v-7M10 20v-4h4v4" />
    </>
  ),
  dinheiro: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  telefone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.7 2.7L16.5 9.5" />
    </>
  ),
  mapa: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5a3.2 3.2 0 0 1 0 6.2M18 14.3A6 6 0 0 1 21 20" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  foguete: (
    <>
      <path d="M12 3c3.5 2 5 5.5 5 9l-2 4H9l-2-4c0-3.5 1.5-7 5-9Z" />
      <circle cx="12" cy="10" r="1.7" />
      <path d="M9.5 19.5 12 21l2.5-1.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  mais: <path d="M12 5v14M5 12h14" />,
};

export const Icone: React.FC<{
  nome: NomeIcone | "x" | "mais";
  tamanho: number;
  cor: string;
  espessura?: number;
  progresso?: number;
}> = ({ nome, tamanho, cor, espessura = 1.6, progresso = 1 }) => (
  <svg
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke={cor}
    strokeWidth={espessura}
    strokeLinecap="round"
    strokeLinejoin="round"
    // "desenha" o traço do ícone conforme o progresso
    style={{ strokeDasharray: 120, strokeDashoffset: 120 * (1 - progresso) }}
  >
    {TRACOS[nome]}
  </svg>
);
