import type { Formato, NomeIcone, Passo } from "../tipos";

export const formatarValor = (valor: number, formato: Formato = "numero"): string => {
  const inteiro = Math.round(valor).toLocaleString("pt-BR");
  if (formato === "moeda") return `R$ ${inteiro}`;
  if (formato === "percentual") return `${inteiro}%`;
  return inteiro;
};

export const textoPasso = (p: Passo): string => (typeof p === "string" ? p : p.texto);

const ICONES_PADRAO: NomeIcone[] = ["alvo", "mensagem", "check"];

export const iconePasso = (p: Passo, i: number): NomeIcone =>
  (typeof p === "string" ? undefined : p.icone) ?? ICONES_PADRAO[i] ?? "check";

export const contarPalavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
